import jwt from "jsonwebtoken";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { generateNumericOtp, issueOneTimeToken } from "@saas/auth";
import { loadPrivateEnv } from "@saas/config";
import { prisma, type Prisma } from "@saas/database";
import {
  otpEmailTemplate,
  passwordResetEmailTemplate,
  StubEmailProvider,
  verificationEmailTemplate,
} from "@saas/email";
import { hashIp, hashPassword, hashToken, verifyPassword } from "@saas/security/server";
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

const env = loadPrivateEnv();

// Swap for a real provider adapter without touching call sites below.
const emailProvider = new StubEmailProvider();

// After this many consecutive failed password attempts, the account is locked for
// LOCKOUT_DURATION_MS rather than allowing unlimited guesses.
const MAX_FAILED_LOGIN_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

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

  async signUp(input: SignUpInput, ctx: RequestContext) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      // Account enumeration is intentionally avoided for login/reset, but signup
      // must tell the user their email is taken so they don't create a duplicate.
      throw new ConflictException("An account with this email already exists.");
    }

    const passwordHash = await hashPassword(input.password);

    // Single transaction: user + profile (nested create, same statement) + default
    // role assignment. This closes a previously-known gap (see docs/auth/FINDINGS.md)
    // where the role assignment happened as a separate, non-atomic round trip —
    // a crash between the two calls left an orphaned user with no role.
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

    await this.sendVerificationEmail(user.id, user.email);
    await this.recordAuthEvent(user.id, "signup", ctx);

    return { id: user.id, email: user.email, status: user.status };
  }

  private async sendVerificationEmail(userId: string, email: string) {
    const { token, expiresAt } = issueOneTimeToken(userId, "verify_email", 60 * 60 * 24);
    await prisma.oneTimeToken.create({
      data: { userId, purpose: "verify_email", tokenHash: hashToken(token), expiresAt },
    });
    const verifyUrl = `${env.APP_ENV === "local" ? "http://localhost:3000" : ""}/verify-email?token=${token}`;
    await emailProvider.send({
      to: email,
      subject: "Confirm your email address",
      html: verificationEmailTemplate(verifyUrl),
    });
  }

  async resendVerification(email: string, ctx: RequestContext): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    // Always behave the same way whether or not the account exists.
    if (user && user.status === "pending_verification") {
      await this.sendVerificationEmail(user.id, user.email);
      await this.recordAuthEvent(user.id, "resend_verification", ctx);
    }
  }

  async verifyEmail(input: VerifyEmailInput, ctx: RequestContext): Promise<void> {
    const tokenHash = hashToken(input.token);
    const record = await prisma.oneTimeToken.findUnique({ where: { tokenHash } });
    if (!record || record.purpose !== "verify_email" || record.usedAt) {
      throw new BadRequestException("This verification link is invalid or has already been used.");
    }
    if (isExpired(record.expiresAt)) {
      throw new BadRequestException("This verification link has expired.");
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
  }

  async login(input: LoginInput, ctx: RequestContext): Promise<IssuedTokens & { userId: string }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    // Neutral failure for "no such user" and "wrong password" alike — never reveal
    // which one it was (user enumeration).
    if (!user || !user.passwordHash || user.deletedAt) {
      await this.recordAuthEvent(user?.id ?? null, "login_failed", ctx);
      throw new UnauthorizedException("Invalid email or password.");
    }

    if (user.status === "locked" && user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordAuthEvent(user.id, "login_blocked_locked", ctx);
      throw new UnauthorizedException("Invalid email or password.");
    }

    if (user.status === "disabled" || user.status === "deleted") {
      await this.recordAuthEvent(user.id, "login_blocked_status", ctx);
      throw new UnauthorizedException("Invalid email or password.");
    }

    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      const failedLoginCount = user.failedLoginCount + 1;
      const lockingOut = failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          ...(lockingOut
            ? { status: "locked", lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) }
            : {}),
        },
      });
      await this.recordAuthEvent(user.id, lockingOut ? "account_locked" : "login_failed", ctx);
      throw new UnauthorizedException("Invalid email or password.");
    }

    if (user.failedLoginCount > 0 || user.status === "locked") {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null, status: "active" },
      });
    }

    const tokens = await this.createSession(user.id, ctx);
    await this.recordAuthEvent(user.id, "login_succeeded", ctx);

    return { ...tokens, userId: user.id };
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
