import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

// NIST SP 800-63B password policy (see docs/auth/ARCHITECTURE.md decision D11):
// minimum length only, no composition rules (no required character classes), a
// generous hard cap well above the required >=64, and every printable character
// (including spaces) allowed — nothing here restricts which characters a password
// may contain. Breach checking (k-anonymity range API) happens server-side, behind a
// feature flag, in AuthService — not in this shared schema, since it needs network
// access and must never run in the browser. Minimum is 15, not NIST's bare 8 floor,
// because this app has no second factor — password is the sole authenticator, which
// is the condition NIST 800-63B ties to the stricter 15-character minimum.
export const PASSWORD_MIN_LENGTH = 15;
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

// Phase 14 task 3: "signup records acceptance of the current terms version
// and timestamp." Bumping this string is how a future change to the terms
// text is tracked — every acceptance stores WHICH version was agreed to,
// not just that one was.
export const CURRENT_TERMS_VERSION = "1";

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  // `z.literal(true)` rejects `false`/missing/any other value with a clear
  // message — the checkbox must be explicitly checked, never defaulted or
  // silently assumed.
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms and Privacy Policy to continue." }),
  }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
  // Stage 5 #74 "Session persistence setting": true (default) sets cookie
  // Max-Age equal to the refresh token's absolute lifetime ("remember me");
  // false omits Max-Age entirely, so the browser discards the cookie on
  // restart even though the server-side session itself is unaffected.
  rememberMe: z.boolean().optional().default(true),
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

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

// Phase 9 (OAuth): the "collect and verify an email" sub-flow used whenever a
// provider returns no usable (present + trusted) email — Facebook's missing
// email, Microsoft's untrusted email claim, or GitHub with no verified
// primary email.
export const oauthSubmitPendingEmailSchema = z.object({
  lookupToken: z.string().min(1),
  email: emailSchema,
});

export const oauthVerifyPendingEmailSchema = z.object({
  lookupToken: z.string().min(1),
  code: z.string().length(6).regex(/^\d+$/, "Code must be numeric"),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
});

export const cookiePreferencesSchema = z.object({
  analytics: z.boolean(),
  marketing: z.boolean(),
  consentVersion: z.string(),
});

// Phase 14 task 9 ("spam protection on public forms"): the real fields a
// human fills in are `name`/`email`/`message`; the rest are anti-spam
// signals, never shown to the user as form errors (a bot filling the
// honeypot or submitting instantly gets the SAME generic rejection a real
// validation failure would, never a specific "you're a bot" message that
// would just teach it what to avoid next time).
export const contactFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  message: z.string().trim().min(10).max(2000),
  // Honeypot: a field no real user ever sees or fills in (hidden via CSS,
  // never via a `type="hidden"` input bots specifically know to skip) —
  // any non-empty value here means an automated submission.
  website: z.string().max(0, "Spam detected.").optional().default(""),
  // The client stamps this with `Date.now()` when the form first renders;
  // the server rejects a submission faster than a human could plausibly
  // fill the form (checklist "minimum fill time").
  renderedAt: z.coerce.number().int().positive(),
  // Cloudflare Turnstile's client-side widget token — verified server-side
  // against Cloudflare's siteverify API. Optional at the schema level so a
  // missing token produces the SAME generic rejection as every other spam
  // signal, rather than a schema-validation error that reveals which
  // specific check failed.
  turnstileToken: z.string().optional(),
});
export type ContactFormInput = z.infer<typeof contactFormSchema>;

// Phase 14 task 5: "never send emails, tokens or IDs in URLs or events."
// A closed allowlist of event names — an arbitrary client-supplied string
// could otherwise smuggle a value shaped like an email/token into a metric
// label. `properties` is deliberately a small, flat key→primitive map
// (never nested, never containing anything matching an email/JWT/UUID
// shape) — enforced server-side in apps/api/src/analytics/analytics.service.ts,
// not just by this schema.
export const ANALYTICS_EVENT_NAMES = [
  "signup_started",
  "signup_completed",
  "login",
  "verification_completed",
] as const;

export const analyticsEventSchema = z.object({
  event: z.enum(ANALYTICS_EVENT_NAMES),
  properties: z
    .record(z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .default({}),
});
export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;

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
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type OAuthSubmitPendingEmailInput = z.infer<typeof oauthSubmitPendingEmailSchema>;
export type OAuthVerifyPendingEmailInput = z.infer<typeof oauthVerifyPendingEmailSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CookiePreferencesInput = z.infer<typeof cookiePreferencesSchema>;
