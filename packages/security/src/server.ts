import argon2 from "argon2";
import { createHash } from "node:crypto";

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
