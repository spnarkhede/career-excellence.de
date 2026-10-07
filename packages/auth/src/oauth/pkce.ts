import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes, base64url — well within PKCE's 43-128 character range. */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

/** S256 code challenge — checklist "PKCE (S256)"; "plain" is never offered. */
export function generateCodeChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

export function generateState(): string {
  return randomBytes(32).toString("base64url");
}

export function generateNonce(): string {
  return randomBytes(32).toString("base64url");
}
