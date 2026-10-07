export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  send(input: SendEmailInput): Promise<void>;
}

/** Logs emails instead of sending them. Used in local development and tests. */
export class StubEmailProvider implements EmailProvider {
  async send(input: SendEmailInput): Promise<void> {
    console.warn(`[email:stub] to=${input.to} subject="${input.subject}"`);
  }
}

export function verificationEmailTemplate(verifyUrl: string): SendEmailInput["html"] {
  return `<p>Confirm your email address by clicking the link below.</p><p><a href="${verifyUrl}">Verify email</a></p><p>This link expires soon and can only be used once.</p>`;
}

export function passwordResetEmailTemplate(resetUrl: string): SendEmailInput["html"] {
  return `<p>We received a request to reset your password.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`;
}

export function otpEmailTemplate(code: string): SendEmailInput["html"] {
  return `<p>Your one-time verification code is:</p><p style="font-size:24px;font-weight:bold;">${code}</p><p>This code expires shortly.</p>`;
}

export function magicLinkEmailTemplate(signInUrl: string): SendEmailInput["html"] {
  return `<p>Click the link below to sign in.</p><p><a href="${signInUrl}">Sign in</a></p><p>This link expires soon and can only be used once. If you didn't request this, you can ignore this email.</p>`;
}

/** Phase 9 (OAuth): sent when a provider either returned no email at all
 * (Facebook) or one this app isn't willing to trust for linking (Microsoft) —
 * the user types an email in and must prove they control it before any
 * account is created from that provider identity. */
export function oauthPendingIdentityEmailTemplate(code: string): SendEmailInput["html"] {
  return `<p>Enter this code to finish signing in:</p><p style="font-size:24px;font-weight:bold;">${code}</p><p>This code expires shortly.</p>`;
}

/** Confirms a password change/reset to the account owner — sent regardless of
 * which flow changed it (token-based reset or the authenticated change-password
 * endpoint), so the owner has a record even if they didn't initiate it. */
export function passwordChangedEmailTemplate(): SendEmailInput["html"] {
  return `<p>Your password was just changed.</p><p>Every other session on your account has been signed out. If this wasn't you, reset your password immediately and contact support.</p>`;
}

/** Sent when someone tries to sign up with an email that already has an account — no
 * account is created; this notifies the real owner without confirming anything to the
 * person who submitted the form (who never sees a different response either way). */
export function duplicateSignupNoticeTemplate(): SendEmailInput["html"] {
  return `<p>Someone just tried to create a new account using this email address, which already has an account.</p><p>If this was you, you can simply sign in instead. If it wasn't you, no action is needed — no new account was created, and your existing account is unaffected.</p>`;
}
