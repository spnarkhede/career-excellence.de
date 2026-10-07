import argon2 from "argon2";
import { createHash, createHmac } from "node:crypto";

/** Server-only: password hashing and token hashing. Never import this from browser-bundled code. */

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
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
