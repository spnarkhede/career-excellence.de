import jwt from "jsonwebtoken";
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { generateNumericOtp, issueOneTimeToken } from "@saas/auth";
import { loadPrivateEnv } from "@saas/config";
import { prisma, type Prisma } from "@saas/database";
import {
  duplicateSignupNoticeTemplate,
  otpEmailTemplate,
  passwordResetEmailTemplate,
  StubEmailProvider,
  verificationEmailTemplate,
} from "@saas/email";
import { logger } from "@saas/observability";
import {
  hashIp,
  hashPassword,
  hashToken,
  isPasswordBreached,
  needsRehash,
  verifyPassword,
} from "@saas/security/server";
import { generateSecureToken, isExpired } from "@saas/utils";
import type {
  LoginInput,
  RequestOtpInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  SignUpInput,
  VerifyEmailInput,
  VerifyOtpInput,
} from "@saas/validation";

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  refreshExpiresAt: Date;
}

// None of these reveal whether an email is registered — they describe the TOKEN's
// state, not the account's. "already_verified" and "already_used" are deliberately
// distinct even though both currently reuse the token's `usedAt` field (see
// sendVerificationEmail's invalidation comment) — the UI can offer the same recovery
// action (resend) for either, but the backend tells them apart for clearer messaging.
export type VerifyEmailReason =
  "valid" | "expired" | "already_used" | "invalid" | "already_verified";

const env = loadPrivateEnv();

// Swap for a real provider adapter without touching call sites below.
const emailProvider = new StubEmailProvider();

// Per-account lockout (checklist "Rate-limited account" / "Locked account"): after
// this many consecutive failed password attempts within the window, the account is
// locked with a GROWING delay — each additional failure beyond the threshold doubles
// the lockout duration (capped), rather than a single fixed window, to slow a
// persistent attacker faster than a one-off typo-prone legitimate user.
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const BASE_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const MAX_LOCKOUT_DURATION_MS = 24 * 60 * 60 * 1000;

function computeLockoutDuration(failedLoginCount: number): number {
  const overage = Math.max(0, failedLoginCount - MAX_FAILED_LOGIN_ATTEMPTS);
  return Math.min(MAX_LOCKOUT_DURATION_MS, BASE_LOCKOUT_DURATION_MS * 2 ** overage);
}

// A fixed-cost dummy hash, computed once at process startup (never per-request) and
// verified against on every login for an email that doesn't exist, so the time taken
// to reject an unknown email is statistically indistinguishable from a wrong password
// on a known one — checklist: "the response times for known and unknown emails are
// within a set tolerance." A literal hardcoded hash would tie this to one specific
// ARGON2_PARAMS forever; computing it once at boot keeps it self-consistent with
// whatever the current parameters are.
const dummyHashPromise: Promise<string> = hashPassword(generateSecureToken(32));

@Injectable()
export class AuthService {
  private async recordAuthEvent(
    userId: string | null,
    type: string,
    ctx: RequestContext,
    metadata: Record<string, unknown> = {},
  ) {
    await prisma.authEvent.create({
      data: {
        userId,
        type,
        ipHash: ctx.ipAddress ? hashIp(ctx.ipAddress, env.ENCRYPTION_KEY) : null,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  private signAccessToken(userId: string, sessionId: string): string {
    return jwt.sign({ sub: userId, sid: sessionId }, env.AUTH_JWT_SECRET, {
      expiresIn: env.AUTH_ACCESS_TOKEN_TTL,
    });
  }

  /**
   * Creates a brand-new session (new family). `issueSession` (below) rotates within
   * an existing family on refresh — this is the only place a fresh familyId is minted.
   */
  private async createSession(userId: string, ctx: RequestContext): Promise<IssuedTokens> {
    const refreshToken = generateSecureToken(32);
    const now = Date.now();
    const refreshExpiresAt = new Date(now + env.AUTH_REFRESH_TOKEN_TTL * 1000);
    // The absolute ceiling is set once, at login, and never extended by rotation —
    // see `issueSession` below.
    const absoluteExpiresAt = new Date(now + env.AUTH_REFRESH_TOKEN_TTL * 1000);

    const session = await prisma.session.create({
      data: {
        userId,
        refreshTokenHash: hashToken(refreshToken),
        userAgent: ctx.userAgent,
        ipHash: ctx.ipAddress ? hashIp(ctx.ipAddress, env.ENCRYPTION_KEY) : null,
        expiresAt: refreshExpiresAt,
        absoluteExpiresAt,
      },
    });

    const accessToken = this.signAccessToken(userId, session.id);
    return { accessToken, refreshToken, sessionId: session.id, refreshExpiresAt };
  }

  /** Rotates an existing session within its family, carrying the family's original absoluteExpiresAt forward unchanged. */
  private async rotateSession(
    userId: string,
    familyId: string,
    absoluteExpiresAt: Date,
    ctx: RequestContext,
  ): Promise<IssuedTokens> {
    const refreshToken = generateSecureToken(32);
    const refreshExpiresAt = new Date(
      Math.min(Date.now() + env.AUTH_REFRESH_TOKEN_TTL * 1000, absoluteExpiresAt.getTime()),
    );

    const session = await prisma.session.create({
      data: {
        userId,
        familyId,
        refreshTokenHash: hashToken(refreshToken),
        userAgent: ctx.userAgent,
        ipHash: ctx.ipAddress ? hashIp(ctx.ipAddress, env.ENCRYPTION_KEY) : null,
        expiresAt: refreshExpiresAt,
        absoluteExpiresAt,
      },
    });

    const accessToken = this.signAccessToken(userId, session.id);
    return { accessToken, refreshToken, sessionId: session.id, refreshExpiresAt };
  }

  async signUp(
    input: SignUpInput,
    ctx: RequestContext,
  ): Promise<{ email: string; status: "pending_verification" }> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });

    // Hash (and, if enabled, breach-check) unconditionally on BOTH branches, in the
    // same order, before ever branching on whether the account exists — timing alone
    // must not reveal which case this was (checklist: "same response and similar
    // timing for new and existing emails").
    const passwordHash = await hashPassword(input.password);
    const breached = env.FEATURE_BREACHED_PASSWORD_CHECK
      ? await isPasswordBreached(input.password)
      : false;

    if (existing) {
      // Create nothing. Notify the real account owner so they know someone attempted
      // this; the person submitting the form sees exactly the same response as a
      // successful signup either way (never told the email is taken).
      await this.sendEmail(
        existing.id,
        existing.email,
        "Someone tried to sign up with your email",
        duplicateSignupNoticeTemplate(),
        ctx,
        "duplicate_signup_notice_sent",
        "duplicate_signup_notice_failed",
      );
      await this.recordAuthEvent(existing.id, "signup_duplicate_attempt", ctx);
      return { email: input.email, status: "pending_verification" };
    }

    if (breached) {
      throw new BadRequestException(
        "This password has appeared in a known data breach. Please choose a different one.",
      );
    }

    // Single transaction: user + profile (nested create, same statement) + default
    // role assignment. This closes a previously-known gap (see docs/auth/FINDINGS.md)
    // where the role assignment happened as a separate, non-atomic round trip —
    // a crash between the two calls left an orphaned user with no role. Any failure
    // anywhere in this block (including the role lookup) rolls back the entire thing —
    // no partial user is ever left behind (checklist: "Partial account creation").
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          status: "pending_verification",
          profile: { create: {} },
        },
      });
      const userRole = await tx.role.findUniqueOrThrow({ where: { name: "user" } });
      // `skipDuplicates` makes the role assignment idempotent — safe to retry this
      // transaction (e.g. after a transient error) without a duplicate-key failure.
      await tx.userRole.createMany({
        data: [{ userId: created.id, roleId: userRole.id }],
        skipDuplicates: true,
      });
      return created;
    });

    await this.sendVerificationEmail(user.id, user.email, ctx);
    await this.recordAuthEvent(user.id, "signup", ctx);

    return { email: user.email, status: "pending_verification" };
  }

  /** Delivery-failure-tolerant send: logs with the request ID and records a distinct
   * auth_event on failure, but never throws — the caller's own action (signup, resend)
   * must still succeed so the user can retry via the resend endpoint. */
  private async sendEmail(
    userId: string,
    to: string,
    subject: string,
    html: string,
    ctx: RequestContext,
    sentEventType: string,
    failedEventType: string,
  ): Promise<void> {
    try {
      await emailProvider.send({ to, subject, html });
      await this.recordAuthEvent(userId, sentEventType, ctx);
    } catch (err) {
      logger.error({ err, requestId: ctx.requestId, userId }, "Email delivery failed");
      await this.recordAuthEvent(userId, failedEventType, ctx);
    }
  }

  private async sendVerificationEmail(
    userId: string,
    email: string,
    ctx: RequestContext,
  ): Promise<void> {
    // Resend invalidates older tokens: any still-unused verify_email token for this
    // user is marked used (i.e. no longer usable) before a new one is issued, so only
    // the most recently sent link ever works — never two live links at once.
    await prisma.oneTimeToken.updateMany({
      where: { userId, purpose: "verify_email", usedAt: null },
      data: { usedAt: new Date() },
    });

    const { token, expiresAt } = issueOneTimeToken(userId, "verify_email", 60 * 60 * 24);
    await prisma.oneTimeToken.create({
      data: { userId, purpose: "verify_email", tokenHash: hashToken(token), expiresAt },
    });
    const verifyUrl = `${env.APP_ENV === "local" ? "http://localhost:3000" : ""}/verify-email?token=${token}`;
    await this.sendEmail(
      userId,
      email,
      "Confirm your email address",
      verificationEmailTemplate(verifyUrl),
      ctx,
      "verification_sent",
      "verification_send_failed",
    );
  }

  async resendVerification(email: string, ctx: RequestContext): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    // Always record the attempt and always return the same way, whether or not the
    // account exists — checklist: "same response for known and unknown emails".
    await this.recordAuthEvent(user?.id ?? null, "verification_resend_requested", ctx);

    if (!user || user.status !== "pending_verification") return;

    // Per-email cooldown (distinct from the per-IP @Throttle on the controller route):
    // refuse to re-send more than once within this window, but still respond exactly
    // as if it had sent — the caller can't distinguish "just sent" from "rate limited".
    const RESEND_COOLDOWN_MS = 60_000;
    const lastToken = await prisma.oneTimeToken.findFirst({
      where: { userId: user.id, purpose: "verify_email" },
      orderBy: { createdAt: "desc" },
    });
    if (lastToken && Date.now() - lastToken.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      return;
    }

    await this.sendVerificationEmail(user.id, user.email, ctx);
  }

  async verifyEmail(input: VerifyEmailInput, ctx: RequestContext): Promise<VerifyEmailReason> {
    const tokenHash = hashToken(input.token);
    const record = await prisma.oneTimeToken.findUnique({ where: { tokenHash } });

    if (!record || record.purpose !== "verify_email") {
      return "invalid";
    }

    if (record.usedAt) {
      const user = await prisma.user.findUnique({ where: { id: record.userId } });
      return user?.emailVerifiedAt ? "already_verified" : "already_used";
    }

    if (isExpired(record.expiresAt)) {
      return "expired";
    }

    await prisma.$transaction([
      prisma.oneTimeToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date(), status: "active" },
      }),
    ]);

    await this.recordAuthEvent(record.userId, "email_verified", ctx);
    return "valid";
  }

  /**
   * `existingSessionId` is the session the caller's current cookie resolves to, if
   * any (resolved by the controller, which can read the cookie before this is
   * called) — passed through so a successful login can discard it (session fixation
   * prevention: a session that existed before this login must never remain valid
   * alongside the new one).
   */
  async login(
    input: LoginInput,
    ctx: RequestContext,
    existingSessionId?: string | null,
  ): Promise<IssuedTokens & { userId: string }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    // Checklist "Credentials": look up by normalized email (emailSchema already
    // trimmed/lowercased it before this ever runs). When no user exists, still run a
    // password comparison — against a fixed-cost dummy hash computed once at process
    // startup — so the time taken is statistically indistinguishable from comparing
    // against a real, wrong password. Both outcomes throw the identical message.
    const passwordHashToCompare = user?.passwordHash ?? (await dummyHashPromise);
    const valid = await verifyPassword(passwordHashToCompare, input.password);

    if (!user || !user.passwordHash || !valid) {
      await this.recordAuthEvent(user?.id ?? null, "login_failed", ctx);
      if (user) {
        await this.recordFailedAttempt(user);
      }
      throw new UnauthorizedException("Invalid email or password.");
    }

    // Every account-state check below runs ONLY after the password has been
    // confirmed correct (checklist: "Account states, checked only after the password
    // matches") — checking any of these first would let anyone probe an email's
    // existence/status using any password at all, an enumeration vector.

    if (user.deletedAt || user.status === "disabled" || user.status === "deleted") {
      await this.recordAuthEvent(user.id, "login_blocked_status", ctx);
      throw new ForbiddenException({
        code: "ACCOUNT_DISABLED",
        message: "This account is disabled. Contact support for help.",
      });
    }

    if (user.status === "locked" && user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordAuthEvent(user.id, "login_blocked_locked", ctx);
      throw new HttpException(
        {
          code: "ACCOUNT_LOCKED",
          message: "This account is temporarily locked due to repeated failed attempts.",
          details: { unlockAt: user.lockedUntil.toISOString() },
        },
        423, // HttpStatus has no LOCKED member; 423 is the standard WebDAV "Locked" code.
      );
    }

    if (user.status === "pending_verification") {
      await this.recordAuthEvent(user.id, "login_blocked_unverified", ctx);
      throw new ForbiddenException({
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email address before signing in.",
      });
    }

    // Reset the failure counter on any successful login (checklist: "Reset on
    // success").
    if (user.failedLoginCount > 0 || user.status === "locked") {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null, status: "active" },
      });
    }

    // Rehash on login when parameters change: a password that verified successfully
    // against the OLD hash is rehashed with the current ARGON2_PARAMS, so every
    // stored hash converges on the current target over time without a mass rehash.
    if (needsRehash(user.passwordHash)) {
      const newHash = await hashPassword(input.password);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
    }

    // Session fixation prevention: discard whatever session the caller's current
    // cookie pointed at (if any — e.g. an expired or borrowed cookie) before issuing
    // a brand-new one for this login.
    if (existingSessionId) {
      await prisma.session.updateMany({
        where: { id: existingSessionId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "superseded_by_new_login" },
      });
    }

    const tokens = await this.createSession(user.id, ctx);
    await this.recordAuthEvent(user.id, "login_succeeded", ctx);

    return { ...tokens, userId: user.id };
  }

  private async recordFailedAttempt(user: { id: string; failedLoginCount: number }): Promise<void> {
    const failedLoginCount = user.failedLoginCount + 1;
    const lockingOut = failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        ...(lockingOut
          ? {
              status: "locked",
              lockedUntil: new Date(Date.now() + computeLockoutDuration(failedLoginCount)),
            }
          : {}),
      },
    });
  }

  async refresh(
    refreshToken: string,
    ctx: RequestContext,
  ): Promise<IssuedTokens & { userId: string }> {
    const refreshTokenHash = hashToken(refreshToken);
    const session = await prisma.session.findUnique({ where: { refreshTokenHash } });

    if (!session) {
      throw new UnauthorizedException("Session expired or revoked. Please sign in again.");
    }

    if (session.revokedAt) {
      // This refresh token was already rotated (or explicitly revoked) — presenting it
      // again means it was either replayed from a stolen copy, or a client retried a
      // request after a race. Treat it as compromise: revoke the entire session family.
      await prisma.session.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "reuse_detected" },
      });
      await this.recordAuthEvent(session.userId, "refresh_token_reuse_detected", ctx);
      throw new UnauthorizedException("Session expired or revoked. Please sign in again.");
    }

    if (isExpired(session.expiresAt) || isExpired(session.absoluteExpiresAt)) {
      throw new UnauthorizedException("Session expired or revoked. Please sign in again.");
    }

    // Rotate: invalidate the old refresh token and issue a new session record in the
    // same family, carrying the original absoluteExpiresAt forward unchanged.
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokedReason: "rotated" },
    });

    const tokens = await this.rotateSession(
      session.userId,
      session.familyId,
      session.absoluteExpiresAt,
      ctx,
    );

    return { ...tokens, userId: session.userId };
  }

  async logout(sessionId: string, ctx: RequestContext): Promise<void> {
    await prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "logout" },
    });
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    await this.recordAuthEvent(session?.userId ?? null, "logout", ctx);
  }

  async requestPasswordReset(input: RequestPasswordResetInput, ctx: RequestContext): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Neutral response regardless of whether the account exists.
    if (!user || user.deletedAt) return;

    const { token, expiresAt } = issueOneTimeToken(user.id, "reset_password", 60 * 60);
    await prisma.oneTimeToken.create({
      data: { userId: user.id, purpose: "reset_password", tokenHash: hashToken(token), expiresAt },
    });
    const resetUrl = `${env.APP_ENV === "local" ? "http://localhost:3000" : ""}/reset-password?token=${token}`;
    await emailProvider.send({
      to: user.email,
      subject: "Reset your password",
      html: passwordResetEmailTemplate(resetUrl),
    });
    await this.recordAuthEvent(user.id, "password_reset_requested", ctx);
  }

  async resetPassword(input: ResetPasswordInput, ctx: RequestContext): Promise<void> {
    const tokenHash = hashToken(input.token);
    const record = await prisma.oneTimeToken.findUnique({ where: { tokenHash } });
    if (!record || record.purpose !== "reset_password" || record.usedAt) {
      throw new BadRequestException("This reset link is invalid or has already been used.");
    }
    if (isExpired(record.expiresAt)) {
      throw new BadRequestException("This reset link has expired.");
    }

    if (env.FEATURE_BREACHED_PASSWORD_CHECK && (await isPasswordBreached(input.password))) {
      throw new BadRequestException(
        "This password has appeared in a known data breach. Please choose a different one.",
      );
    }

    const passwordHash = await hashPassword(input.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.oneTimeToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Revoke every existing session; the user must sign in again with the new password.
      prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "password_reset" },
      }),
    ]);

    await this.recordAuthEvent(record.userId, "password_reset_completed", ctx);
  }

  async requestOtp(input: RequestOtpInput, ctx: RequestContext): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || user.deletedAt) return; // neutral response

    const code = generateNumericOtp(6);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await prisma.oneTimeToken.create({
      data: { userId: user.id, purpose: "otp", tokenHash: hashToken(code), expiresAt },
    });
    await emailProvider.send({
      to: user.email,
      subject: "Your verification code",
      html: otpEmailTemplate(code),
    });
    await this.recordAuthEvent(user.id, "otp_requested", ctx);
  }

  async verifyOtp(
    input: VerifyOtpInput,
    ctx: RequestContext,
  ): Promise<IssuedTokens & { userId: string }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || user.deletedAt) throw new UnauthorizedException("Invalid or expired code.");

    const record = await prisma.oneTimeToken.findFirst({
      where: { userId: user.id, purpose: "otp", usedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!record || isExpired(record.expiresAt) || record.attempts >= 5) {
      throw new UnauthorizedException("Invalid or expired code.");
    }

    if (record.tokenHash !== hashToken(input.code)) {
      await prisma.oneTimeToken.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("Invalid or expired code.");
    }

    await prisma.oneTimeToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    const tokens = await this.createSession(user.id, ctx);
    await this.recordAuthEvent(user.id, "otp_login_succeeded", ctx);
    return { ...tokens, userId: user.id };
  }

  async listSessions(userId: string) {
    return prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastUsedAt: "desc" },
    });
  }

  async revokeSession(userId: string, sessionId: string, ctx: RequestContext): Promise<void> {
    await prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "user_revoked" },
    });
    await this.recordAuthEvent(userId, "session_revoked", ctx, { sessionId });
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
    ctx: RequestContext,
  ): Promise<void> {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null, id: { not: currentSessionId } },
      data: { revokedAt: new Date(), revokedReason: "revoke_all_others" },
    });
    await this.recordAuthEvent(userId, "sessions_revoked_all_others", ctx);
  }

  /**
   * Soft-deletes an account: sets deletedAt + status=deleted, revokes every session.
   * Email is not released for reuse by this operation — the row (and its unique email
   * constraint) remains in place indefinitely; see docs/auth/FINDINGS.md for the
   * documented email-reuse decision this implies.
   */
  async softDeleteAccount(userId: string, ctx: RequestContext): Promise<void> {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date(), status: "deleted" },
      }),
      prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "account_deleted" },
      }),
    ]);
    await this.recordAuthEvent(userId, "account_soft_deleted", ctx);
  }

  verifyAccessToken(token: string): { userId: string; sessionId: string } {
    try {
      const payload = jwt.verify(token, env.AUTH_JWT_SECRET) as { sub: string; sid: string };
      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      throw new UnauthorizedException("Invalid or expired session.");
    }
  }
}
