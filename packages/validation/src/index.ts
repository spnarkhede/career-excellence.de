import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

// NIST SP 800-63B password policy (see docs/auth/ARCHITECTURE.md decision D11):
// minimum length only, no composition rules (no required character classes), a
// generous hard cap well above the required >=64, and every printable character
// (including spaces) allowed — nothing here restricts which characters a password
// may contain. Breach checking (k-anonymity range API) happens server-side, behind a
// feature flag, in AuthService — not in this shared schema, since it needs network
// access and must never run in the browser.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`);

/**
 * Pure, client-safe strength *estimate* for the signup form's meter — never used for
 * enforcement (that's `passwordSchema` plus the server-side breach check). Score is
 * 0-4; based on length and character-class variety, which is a reasonable UX signal
 * even though NIST 800-63B deliberately doesn't require any specific composition.
 */
export function estimatePasswordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too short" | "Weak" | "Fair" | "Good" | "Strong";
} {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { score: 0, label: "Too short" };
  }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) =>
    re.test(password),
  ).length;
  const lengthBonus = password.length >= 16 ? 1 : 0;
  const score = Math.min(4, Math.max(1, classes + lengthBonus)) as 0 | 1 | 2 | 3 | 4;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"] as const;
  return { score, label: labels[score] };
}

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const requestOtpSchema = z.object({
  email: emailSchema,
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: z.string().length(6).regex(/^\d+$/, "OTP must be numeric"),
});

export const requestMagicLinkSchema = z.object({
  email: emailSchema,
});

export const verifyMagicLinkSchema = z.object({
  token: z.string().min(1),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
});

export const cookiePreferencesSchema = z.object({
  analytics: z.boolean(),
  marketing: z.boolean(),
  consentVersion: z.string(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RequestMagicLinkInput = z.infer<typeof requestMagicLinkSchema>;
export type VerifyMagicLinkInput = z.infer<typeof verifyMagicLinkSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CookiePreferencesInput = z.infer<typeof cookiePreferencesSchema>;
