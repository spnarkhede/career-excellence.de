import jwt from "jsonwebtoken";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { StubAuthProvider, generateNumericOtp, issueOneTimeToken } from "@saas/auth";
import { loadPrivateEnv } from "@saas/config";
import { prisma, type Prisma } from "@saas/database";
import {
  otpEmailTemplate,
  passwordResetEmailTemplate,
  StubEmailProvider,
  verificationEmailTemplate,
} from "@saas/email";
import { hashToken } from "@saas/security/server";
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
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  refreshExpiresAt: Date;
}

const env = loadPrivateEnv();

// Singletons for this stub: swap for real provider adapters without touching call sites below.
const authProvider = new StubAuthProvider();
const emailProvider = new StubEmailProvider();

@Injectable()
export class AuthService {
  private async recordSecurityEvent(
    userId: string | null,
    type: string,
    ctx: RequestContext,
    metadata: Record<string, unknown> = {},
  ) {
    await prisma.securityEvent.create({
      data: {
        userId,
        type,
        metadata: metadata as Prisma.InputJsonValue,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
    });
  }

  private signAccessToken(userId: string, sessionId: string): string {
    return jwt.sign({ sub: userId, sid: sessionId }, env.AUTH_JWT_SECRET, {
      expiresIn: env.AUTH_ACCESS_TOKEN_TTL,
    });
  }

  private async issueSession(userId: string, ctx: RequestContext): Promise<IssuedTokens> {
    const refreshToken = generateSecureToken(32);
    const refreshExpiresAt = new Date(Date.now() + env.AUTH_REFRESH_TOKEN_TTL * 1000);

    const session = await prisma.session.create({
      data: {
        userId,
        refreshTokenHash: hashToken(refreshToken),
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        expiresAt: refreshExpiresAt,
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

    const identity = await authProvider.createPasswordIdentity(input.email, input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        status: "pending_verification",
        profile: { create: {} },
        authIdentities: {
          create: { provider: "password", providerId: identity.providerId },
        },
      },
    });

    const userRole = await prisma.role.findUniqueOrThrow({ where: { name: "user" } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: userRole.id } });

    await this.sendVerificationEmail(user.id, user.email);
    await this.recordSecurityEvent(user.id, "signup", ctx);

    return { id: user.id, email: user.email, status: user.status };
  }

  private async sendVerificationEmail(userId: string, email: string) {
    const { token, expiresAt } = issueOneTimeToken(userId, "email_verification", 60 * 60 * 24);
    await prisma.verificationToken.create({
      data: { userId, purpose: "email_verification", tokenHash: hashToken(token), expiresAt },
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
      await this.recordSecurityEvent(user.id, "resend_verification", ctx);
    }
  }

  async verifyEmail(input: VerifyEmailInput, ctx: RequestContext): Promise<void> {
    const tokenHash = hashToken(input.token);
    const record = await prisma.verificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.purpose !== "email_verification" || record.consumedAt) {
      throw new BadRequestException("This verification link is invalid or has already been used.");
    }
    if (isExpired(record.expiresAt)) {
      throw new BadRequestException("This verification link has expired.");
    }

    await prisma.$transaction([
      prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date(), status: "active" },
      }),
    ]);

    await this.recordSecurityEvent(record.userId, "email_verified", ctx);
  }

  async login(input: LoginInput, ctx: RequestContext): Promise<IssuedTokens & { userId: string }> {
    const identity = await authProvider.verifyPassword(input.email, input.password);
    if (!identity) {
      await this.recordSecurityEvent(null, "login_failed", ctx, { email: input.email });
      throw new UnauthorizedException("Invalid email or password.");
    }

    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || user.status === "suspended" || user.status === "deleted") {
      await this.recordSecurityEvent(user?.id ?? null, "login_blocked", ctx);
      throw new UnauthorizedException("Invalid email or password.");
    }

    const tokens = await this.issueSession(user.id, ctx);
    await this.recordSecurityEvent(user.id, "login_succeeded", ctx);

    return { ...tokens, userId: user.id };
  }

  async refresh(
    refreshToken: string,
    ctx: RequestContext,
  ): Promise<IssuedTokens & { userId: string }> {
    const refreshTokenHash = hashToken(refreshToken);
    const session = await prisma.session.findUnique({ where: { refreshTokenHash } });

    if (!session || session.revokedAt || isExpired(session.expiresAt)) {
      throw new UnauthorizedException("Session expired or revoked. Please sign in again.");
    }

    // Rotate: invalidate the old refresh token and issue a new session record.
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokedReason: "rotated" },
    });

    const tokens = await this.issueSession(session.userId, ctx);
    await prisma.session.update({
      where: { id: tokens.sessionId },
      data: { lastActiveAt: new Date() },
    });

    return { ...tokens, userId: session.userId };
  }

  async logout(sessionId: string, ctx: RequestContext): Promise<void> {
    await prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "logout" },
    });
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    await this.recordSecurityEvent(session?.userId ?? null, "logout", ctx);
  }

  async requestPasswordReset(input: RequestPasswordResetInput, ctx: RequestContext): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Neutral response regardless of whether the account exists.
    if (!user) return;

    const { token, expiresAt } = issueOneTimeToken(user.id, "password_reset", 60 * 60);
    await prisma.verificationToken.create({
      data: { userId: user.id, purpose: "password_reset", tokenHash: hashToken(token), expiresAt },
    });
    const resetUrl = `${env.APP_ENV === "local" ? "http://localhost:3000" : ""}/reset-password?token=${token}`;
    await emailProvider.send({
      to: user.email,
      subject: "Reset your password",
      html: passwordResetEmailTemplate(resetUrl),
    });
    await this.recordSecurityEvent(user.id, "password_reset_requested", ctx);
  }

  async resetPassword(input: ResetPasswordInput, ctx: RequestContext): Promise<void> {
    const tokenHash = hashToken(input.token);
    const record = await prisma.verificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.purpose !== "password_reset" || record.consumedAt) {
      throw new BadRequestException("This reset link is invalid or has already been used.");
    }
    if (isExpired(record.expiresAt)) {
      throw new BadRequestException("This reset link has expired.");
    }

    const identity = await prisma.authIdentity.findFirst({
      where: { userId: record.userId, provider: "password" },
    });
    if (!identity) {
      throw new BadRequestException("Password sign-in is not enabled for this account.");
    }

    await authProvider.changePassword(identity.providerId, input.password);
    await prisma.verificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    // Revoke every existing session; the user must sign in again with the new password.
    await prisma.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "password_reset" },
    });

    await this.recordSecurityEvent(record.userId, "password_reset_completed", ctx);
  }

  async requestOtp(input: RequestOtpInput, ctx: RequestContext): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) return; // neutral response

    const code = generateNumericOtp(6);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await prisma.verificationToken.create({
      data: { userId: user.id, purpose: "otp", tokenHash: hashToken(code), expiresAt },
    });
    await emailProvider.send({
      to: user.email,
      subject: "Your verification code",
      html: otpEmailTemplate(code),
    });
    await this.recordSecurityEvent(user.id, "otp_requested", ctx);
  }

  async verifyOtp(
    input: VerifyOtpInput,
    ctx: RequestContext,
  ): Promise<IssuedTokens & { userId: string }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new UnauthorizedException("Invalid or expired code.");

    const record = await prisma.verificationToken.findFirst({
      where: { userId: user.id, purpose: "otp", consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!record || isExpired(record.expiresAt) || record.attempts >= 5) {
      throw new UnauthorizedException("Invalid or expired code.");
    }

    if (record.tokenHash !== hashToken(input.code)) {
      await prisma.verificationToken.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("Invalid or expired code.");
    }

    await prisma.verificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    const tokens = await this.issueSession(user.id, ctx);
    await this.recordSecurityEvent(user.id, "otp_login_succeeded", ctx);
    return { ...tokens, userId: user.id };
  }

  async listSessions(userId: string) {
    return prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastActiveAt: "desc" },
    });
  }

  async revokeSession(userId: string, sessionId: string, ctx: RequestContext): Promise<void> {
    await prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "user_revoked" },
    });
    await this.recordSecurityEvent(userId, "session_revoked", ctx, { sessionId });
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
    await this.recordSecurityEvent(userId, "sessions_revoked_all_others", ctx);
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
