import { randomInt } from "node:crypto";
import { generateSecureToken } from "@saas/utils";

export type TokenPurpose = "verify_email" | "reset_password" | "otp" | "magic_link";

export interface OneTimeToken {
  token: string;
  purpose: TokenPurpose;
  userId: string;
  expiresAt: Date;
}

/** Issues a one-time, short-lived token for verification/reset/OTP flows. Callers persist and hash it themselves. */
export function issueOneTimeToken(
  userId: string,
  purpose: TokenPurpose,
  ttlSeconds: number,
): OneTimeToken {
  return {
    token: generateSecureToken(32),
    purpose,
    userId,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  };
}

export function generateNumericOtp(length = 6): string {
  const max = 10 ** length;
  const code = randomInt(0, max).toString().padStart(length, "0");
  return code;
}
