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
