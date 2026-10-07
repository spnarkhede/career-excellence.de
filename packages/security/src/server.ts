import argon2 from "argon2";
import { createHash, createHmac } from "node:crypto";

/** Server-only: password hashing and token hashing. Never import this from browser-bundled code. */

// OWASP password storage cheat sheet's current argon2id recommendation: 19 MiB memory,
// 2 iterations, 1 degree of parallelism. Explicit (not argon2's library defaults) so a
// future change to the library's own defaults never silently changes what's stored, and
// so `needsRehash` below has a fixed target to compare existing hashes against.
export const ARGON2_PARAMS = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024, // KiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_PARAMS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * True if an existing hash was produced with different parameters than `ARGON2_PARAMS`
 * (e.g. this value changed after the hash was stored). Callers check this only after a
 * successful `verifyPassword`, and rehash with the current parameters so every stored
 * hash converges on the current target over time, without forcing a mass rehash.
 */
export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, ARGON2_PARAMS);
}

/**
 * Checks a password against the Have I Been Pwned Pwned Passwords API using k-anonymity
 * (only the first 5 hex characters of the SHA-1 hash are ever sent — the real password,
 * and even its full hash, never leave this process). Caller decides whether to enforce
 * this behind a feature flag; on any network/API failure this fails OPEN (returns false
 * — "not known to be breached") so an outage never blocks signup/reset.
 */
export async function isPasswordBreached(plain: string): Promise<boolean> {
  const sha1 = createHash("sha1").update(plain).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => line.trim().toUpperCase().startsWith(`${suffix}:`));
  } catch {
    return false;
  }
}

/** Fast one-way hash for high-volume lookup tokens (refresh/verification tokens). Not for passwords. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * One-way hash for client IP addresses before storage (sessions.ipHash, auth_events.ipHash).
 * Raw IPs are never persisted — AUTH_RULES.md rule 4 and the Phase 3 "No secrets" column
 * spec. HMAC (keyed, not plain SHA-256) so a low-entropy IPv4 address can't be recovered
 * via a precomputed rainbow table of every possible address.
 */
export function hashIp(ip: string, key: string): string {
  return createHmac("sha256", key).update(ip).digest("hex");
}
