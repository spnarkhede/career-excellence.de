import { generateKeyPairSync } from "node:crypto";
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
  magicLinkEmailTemplate,
  otpEmailTemplate,
  passwordChangedEmailTemplate,
  passwordResetEmailTemplate,
  StubEmailProvider,
  verificationEmailTemplate,
} from "@saas/email";
import { enqueueEmail } from "../common/email-queue.js";
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
  ChangePasswordInput,
  LoginInput,
  RequestMagicLinkInput,
  RequestOtpInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  SignUpInput,
  VerifyEmailInput,
  VerifyMagicLinkInput,
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

// Phase 6 (OTP authentication): expiry within the 5-10 minute range the spec
// requires; magic links get the generous end of that range since clicking an email
// link is slower than typing a 6-digit code. Attempt limit matches the login
// lockout's own default (5) for consistency. Cooldown is shown in the UI countdown.
const OTP_TTL_MS = 5 * 60 * 1000;
const MAGIC_LINK_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;

// Phase 8 (password reset): 45 minutes sits inside the task's 30-60 minute
// range without being pinned to either boundary. Cooldown mirrors the OTP/
// verification-resend pattern (per-destination, not just the controller's
// per-IP @Throttle) — checklist "rate limited per email and IP."
const RESET_PASSWORD_TTL_SECONDS = 45 * 60;
const RESET_PASSWORD_RESEND_COOLDOWN_MS = 60 * 1000;

// Phase 7: access tokens are signed with asymmetric RS256, never the shared-secret
// HS256 used before this phase — a leaked verification key (the PUBLIC half)
// can't be used to forge tokens, unlike a leaked HMAC secret. (RS256 was chosen
// over the other spec-allowed option, EdDSA, because @types/jsonwebtoken@9.0.10's
// Algorithm union doesn't include "EdDSA" yet, even though the underlying
// library/Node both support it — RS256 avoids fighting the type definitions for
// no functional benefit.) If AUTH_JWT_PRIVATE_KEY/PUBLIC_KEY aren't configured, an
// ephemeral keypair is generated once here at process startup (the same
// "computed once at boot" pattern as dummyHashPromise above) — fine for local
// dev/tests; every restart invalidates outstanding access tokens in that mode,
// but refresh tokens are unaffected (they're opaque, stored separately, and
// re-mint a freshly-signed access token on use).
const { signingPrivateKey, signingPublicKey } =
  env.AUTH_JWT_PRIVATE_KEY && env.AUTH_JWT_PUBLIC_KEY
    ? { signingPrivateKey: env.AUTH_JWT_PRIVATE_KEY, signingPublicKey: env.AUTH_JWT_PUBLIC_KEY }
    : (() => {
        const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
        logger.warn(
          "AUTH_JWT_PRIVATE_KEY/AUTH_JWT_PUBLIC_KEY not set — generated an ephemeral " +
            "RSA keypair for this process. Access tokens signed before a restart " +
            "will fail verification afterward. Set both env vars in any environment " +
            "that must survive a restart.",
        );
        return {
          signingPrivateKey: privateKey.export({ type: "pkcs8", format: "pem" }) as string,
          signingPublicKey: publicKey.export({ type: "spki", format: "pem" }) as string,
        };
      })();

// Small tolerance for clock drift between API instances when checking exp/nbf —
// checklist: "small clock skew."
const JWT_CLOCK_TOLERANCE_SECONDS = 5;

@Injectable()
export class AuthService {
  // Public so OAuthService (Phase 9) can log its own event types through the
  // one shared implementation, rather than duplicating the ipHash/metadata
  // handling.
  async recordAuthEvent(
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
    return jwt.sign({ sub: userId, sid: sessionId }, signingPrivateKey, {
      algorithm: "RS256",
      // Carried in the JWT header; verifyAccessToken uses it to pick which public
      // key to verify against, enabling rotation without invalidating every
      // outstanding token signed under the previous key.
      keyid: env.AUTH_JWT_KID,
      expiresIn: env.AUTH_ACCESS_TOKEN_TTL,
      issuer: env.AUTH_JWT_ISSUER,
      audience: env.AUTH_JWT_AUDIENCE,
      // Sets an explicit `nbf` claim equal to `iat` (immediately valid) rather than
      // leaving it unset — checklist: "checks... not before."
      notBefore: 0,
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
    // Phase 8: password-reset-related emails go through the BullMQ queue
    // (checklist "email sent from a queue") instead of the direct, in-request
    // send every other email type still uses — opted in per call site rather
    // than switched globally, since broadening this to every email type is a
    // larger change than this phase's explicit scope.
    queued = false,
  ): Promise<void> {
    try {
      if (queued) {
        await enqueueEmail({ to, subject, html });
      } else {
        await emailProvider.send({ to, subject, html });
      }
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
      const withinGraceWindow =
        Date.now() - session.revokedAt.getTime() <= env.AUTH_REFRESH_REUSE_GRACE_MS;

      // A revoked token presented again within a short grace window after its own
      // rotation is treated as a benign race (two tabs refreshing near-simultaneously,
      // or a client retrying a request whose response it never saw) rather than a
      // stolen-token replay — it's resolved to whatever session this one was rotated
      // into, following the chain forward if that session has itself since been
      // rotated again. Outside the grace window, the same presentation is exactly
      // what a stolen, already-used refresh token looks like, so the entire family
      // is revoked.
      if (withinGraceWindow && session.rotatedToSessionId) {
        const live = await this.followRotationChain(session.rotatedToSessionId);
        if (live && !isExpired(live.absoluteExpiresAt)) {
          return this.rotateAndRecord(live, ctx);
        }
      }

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

    return this.rotateAndRecord(session, ctx);
  }

  /** Follows `rotatedToSessionId` pointers to the current live (non-revoked) session
   * in a rotation chain, capped at a few hops so a corrupted chain can't loop forever. */
  private async followRotationChain(
    startSessionId: string,
  ): Promise<Awaited<ReturnType<typeof prisma.session.findUnique>> | null> {
    let current = await prisma.session.findUnique({ where: { id: startSessionId } });
    let hops = 0;
    while (current?.revokedAt && current.rotatedToSessionId && hops < 5) {
      current = await prisma.session.findUnique({ where: { id: current.rotatedToSessionId } });
      hops++;
    }
    return current && !current.revokedAt ? current : null;
  }

  /** Revokes `session`, rotates it forward within the same family, and records the
   * rotation-chain pointer on the now-revoked row (used by the grace-window check above). */
  private async rotateAndRecord(
    session: { id: string; userId: string; familyId: string; absoluteExpiresAt: Date },
    ctx: RequestContext,
  ): Promise<IssuedTokens & { userId: string }> {
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

    await prisma.session.update({
      where: { id: session.id },
      data: { rotatedToSessionId: tokens.sessionId },
    });

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

    // Checklist "Enumeration protection": an unknown/deleted account still does a
    // comparable amount of work (generate+hash a token) before returning, instead
    // of short-circuiting immediately — narrows, though doesn't perfectly close,
    // the timing gap against the real branch below (the dominant remaining cost
    // difference is the DB write + queue enqueue, which has no cheap equivalent to
    // fake without itself writing something; see FINDINGS.md for the honest
    // limitation this leaves).
    if (!user || user.deletedAt) {
      hashToken(generateSecureToken(32));
      await this.recordAuthEvent(null, "password_reset_requested", ctx);
      return;
    }

    // Per-email cooldown (distinct from the controller's per-IP @Throttle) +
    // "a new request invalidates earlier tokens" — same pattern as
    // requestOtp/resendVerification.
    const lastToken = await prisma.oneTimeToken.findFirst({
      where: { userId: user.id, purpose: "reset_password" },
      orderBy: { createdAt: "desc" },
    });
    if (
      lastToken &&
      Date.now() - lastToken.createdAt.getTime() < RESET_PASSWORD_RESEND_COOLDOWN_MS
    ) {
      return;
    }
    await prisma.oneTimeToken.updateMany({
      where: { userId: user.id, purpose: "reset_password", usedAt: null },
      data: { usedAt: new Date() },
    });

    const { token, expiresAt } = issueOneTimeToken(
      user.id,
      "reset_password",
      RESET_PASSWORD_TTL_SECONDS,
    );
    await prisma.oneTimeToken.create({
      data: { userId: user.id, purpose: "reset_password", tokenHash: hashToken(token), expiresAt },
    });
    const resetUrl = `${env.APP_ENV === "local" ? "http://localhost:3000" : ""}/reset-password?token=${token}`;
    await this.sendEmail(
      user.id,
      user.email,
      "Reset your password",
      passwordResetEmailTemplate(resetUrl),
      ctx,
      "password_reset_requested",
      "password_reset_email_failed",
      true,
    );
  }

  async resetPassword(input: ResetPasswordInput, ctx: RequestContext): Promise<void> {
    const tokenHash = hashToken(input.token);
    const record = await prisma.oneTimeToken.findUnique({ where: { tokenHash } });

    if (!record || record.purpose !== "reset_password") {
      throw new BadRequestException({
        code: "RESET_TOKEN_INVALID",
        message: "This reset link is invalid.",
      });
    }
    if (record.usedAt) {
      await this.recordAuthEvent(record.userId, "password_reset_failed_used_token", ctx);
      throw new BadRequestException({
        code: "RESET_TOKEN_USED",
        message: "This reset link has already been used.",
      });
    }
    if (isExpired(record.expiresAt)) {
      await this.recordAuthEvent(record.userId, "password_reset_failed_expired_token", ctx);
      throw new BadRequestException({
        code: "RESET_TOKEN_EXPIRED",
        message: "This reset link has expired.",
      });
    }

    if (env.FEATURE_BREACHED_PASSWORD_CHECK && (await isPasswordBreached(input.password))) {
      throw new BadRequestException({
        code: "PASSWORD_BREACHED",
        message:
          "This password has appeared in a known data breach. Please choose a different one.",
      });
    }

    const passwordHash = await hashPassword(input.password);

    // Atomic consume: the WHERE clause re-checks `usedAt: null` at the moment of
    // the UPDATE itself, not just at the earlier SELECT above — the same pattern
    // Phase 6 applied to OTP/magic-link (see BUG-009) and Phase 7 relies on for
    // refresh-token rotation. Without this, two concurrent submissions of the same
    // still-valid token could both pass the checks above before either writes
    // `usedAt`, both succeeding (test: "two simultaneous submits with one token,
    // exactly one succeeds").
    const consumed = await prisma.oneTimeToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count === 0) {
      await this.recordAuthEvent(record.userId, "password_reset_failed_used_token", ctx);
      throw new BadRequestException({
        code: "RESET_TOKEN_USED",
        message: "This reset link has already been used.",
      });
    }

    // Revoke every existing session; the user must sign in again with the new
    // password (checklist "Session invalidation after password change").
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "password_reset" },
      }),
    ]);

    await this.recordAuthEvent(record.userId, "password_reset_completed", ctx);

    const user = await prisma.user.findUnique({ where: { id: record.userId } });
    if (user) {
      await this.sendEmail(
        user.id,
        user.email,
        "Your password was changed",
        passwordChangedEmailTemplate(),
        ctx,
        "password_changed_notice_sent",
        "password_changed_notice_failed",
        true,
      );
    }
  }

  /** Authenticated password change (distinct from the token-based `resetPassword`
   * above): requires the current password, then revokes every OTHER session —
   * checklist "Password change revokes other sessions" — while leaving the
   * session making this call itself alive, since the caller is demonstrably still
   * in control of the account right now. */
  async changePassword(
    userId: string,
    currentSessionId: string,
    input: ChangePasswordInput,
    ctx: RequestContext,
  ): Promise<void> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    // No password hash means this account only ever authenticated via OAuth/OTP/
    // magic-link — there is no "current password" to check against, so this
    // endpoint (by design) can't be used to set one; a future OAuth-account
    // password-creation flow would be a distinct, deliberate feature, not a
    // fallback inside this check.
    const valid = user.passwordHash
      ? await verifyPassword(user.passwordHash, input.currentPassword)
      : false;
    if (!valid) {
      await this.recordAuthEvent(userId, "password_change_failed", ctx);
      throw new UnauthorizedException("Current password is incorrect.");
    }

    if (env.FEATURE_BREACHED_PASSWORD_CHECK && (await isPasswordBreached(input.newPassword))) {
      throw new BadRequestException(
        "This password has appeared in a known data breach. Please choose a different one.",
      );
    }

    const passwordHash = await hashPassword(input.newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      prisma.session.updateMany({
        where: { userId, revokedAt: null, id: { not: currentSessionId } },
        data: { revokedAt: new Date(), revokedReason: "password_changed" },
      }),
    ]);

    await this.recordAuthEvent(userId, "password_changed", ctx);
  }

  /** Updates a session's last-activity timestamp — called on every authenticated
   * request (SessionGuard), which is what backs idle-timeout enforcement; `lastUsedAt`
   * would otherwise only ever reflect the session's creation time. */
  async touchSessionActivity(sessionId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { lastUsedAt: new Date() },
    });
  }

  async requestOtp(input: RequestOtpInput, ctx: RequestContext): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Same response for known and unknown destinations — the caller cannot tell
    // these two branches apart from the outside.
    if (!user || user.deletedAt) return;

    // Per-destination cooldown + "resend invalidates the previous code": refuse to
    // send a new code within the cooldown window, but respond identically either
    // way; otherwise, invalidate any still-unused code before issuing a new one, so
    // only the most recently sent code is ever valid.
    const lastToken = await prisma.oneTimeToken.findFirst({
      where: { userId: user.id, purpose: "otp" },
      orderBy: { createdAt: "desc" },
    });
    if (lastToken && Date.now() - lastToken.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      return;
    }
    await prisma.oneTimeToken.updateMany({
      where: { userId: user.id, purpose: "otp", usedAt: null },
      data: { usedAt: new Date() },
    });

    const code = generateNumericOtp(6);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await prisma.oneTimeToken.create({
      data: { userId: user.id, purpose: "otp", tokenHash: hashToken(code), expiresAt },
    });
    await this.sendEmail(
      user.id,
      user.email,
      "Your verification code",
      otpEmailTemplate(code),
      ctx,
      "otp_sent",
      "otp_send_failed",
    );
  }

  async verifyOtp(
    input: VerifyOtpInput,
    ctx: RequestContext,
    existingSessionId?: string | null,
  ): Promise<IssuedTokens & { userId: string }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Identical message for "no such user," "no live code," "expired," "too many
    // attempts," and "wrong code" — none of these are distinguishable from outside.
    if (!user || user.deletedAt) {
      throw new UnauthorizedException("Invalid or expired code.");
    }

    const record = await prisma.oneTimeToken.findFirst({
      where: { userId: user.id, purpose: "otp", usedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!record || isExpired(record.expiresAt) || record.attempts >= MAX_OTP_ATTEMPTS) {
      throw new UnauthorizedException("Invalid or expired code.");
    }

    if (record.tokenHash !== hashToken(input.code)) {
      await prisma.oneTimeToken.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("Invalid or expired code.");
    }

    // Atomic consume: the WHERE clause re-checks `usedAt: null` at the moment of the
    // UPDATE itself, not just at the earlier SELECT above. If two requests race with
    // the same correct code, only the first UPDATE's row matches this guard — the
    // second gets `count: 0` and is rejected, never issuing a second session for the
    // same code (checklist/test: "concurrent use of one code, exactly one succeeds").
    const consumed = await prisma.oneTimeToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw new UnauthorizedException("Invalid or expired code.");
    }

    if (existingSessionId) {
      await prisma.session.updateMany({
        where: { id: existingSessionId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "superseded_by_new_login" },
      });
    }

    const tokens = await this.createSession(user.id, ctx);
    await this.recordAuthEvent(user.id, "otp_login_succeeded", ctx);
    return { ...tokens, userId: user.id };
  }

  async requestMagicLink(input: RequestMagicLinkInput, ctx: RequestContext): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || user.deletedAt) return; // same response for known and unknown

    const lastToken = await prisma.oneTimeToken.findFirst({
      where: { userId: user.id, purpose: "magic_link" },
      orderBy: { createdAt: "desc" },
    });
    if (lastToken && Date.now() - lastToken.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      return;
    }
    await prisma.oneTimeToken.updateMany({
      where: { userId: user.id, purpose: "magic_link", usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);
    await prisma.oneTimeToken.create({
      data: { userId: user.id, purpose: "magic_link", tokenHash: hashToken(token), expiresAt },
    });
    const signInUrl = `${env.APP_ENV === "local" ? "http://localhost:3000" : ""}/magic-link?token=${token}`;
    await this.sendEmail(
      user.id,
      user.email,
      "Your sign-in link",
      magicLinkEmailTemplate(signInUrl),
      ctx,
      "magic_link_sent",
      "magic_link_send_failed",
    );
  }

  async verifyMagicLink(
    input: VerifyMagicLinkInput,
    ctx: RequestContext,
    existingSessionId?: string | null,
  ): Promise<IssuedTokens & { userId: string }> {
    const tokenHash = hashToken(input.token);
    const record = await prisma.oneTimeToken.findUnique({ where: { tokenHash } });

    if (!record || record.purpose !== "magic_link" || record.usedAt) {
      throw new UnauthorizedException("This sign-in link is invalid or has already been used.");
    }
    if (isExpired(record.expiresAt)) {
      throw new UnauthorizedException("This sign-in link has expired.");
    }

    // Same atomic-consume guard as verifyOtp above — a 32-byte token has no
    // meaningful "attempts" concept (it's unguessable), but it can still be replayed
    // or raced, so the same `usedAt: null` re-check at UPDATE time applies.
    const consumed = await prisma.oneTimeToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw new UnauthorizedException("This sign-in link is invalid or has already been used.");
    }

    if (existingSessionId) {
      await prisma.session.updateMany({
        where: { id: existingSessionId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "superseded_by_new_login" },
      });
    }

    const tokens = await this.createSession(record.userId, ctx);
    await this.recordAuthEvent(record.userId, "magic_link_login_succeeded", ctx);
    return { ...tokens, userId: record.userId };
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

  /** "Log out of all devices" (checklist item 6) — unlike `revokeOtherSessions`,
   * this also revokes the CALLING session, since the intent here is explicitly to
   * end every session including this one, not to keep the current one alive. */
  /**
   * Issues a session for a user already resolved by some OTHER flow (Phase 9:
   * OAuth) — same session-fixation handling (discard whatever session the
   * caller's current cookie pointed at) and session-creation call sequence as
   * `login`/`verifyOtp`/`verifyMagicLink`, factored out here so a new sign-in
   * mechanism never has to re-implement it.
   */
  async issueSessionForUser(
    userId: string,
    ctx: RequestContext,
    eventType: string,
    existingSessionId?: string | null,
  ): Promise<IssuedTokens & { userId: string }> {
    if (existingSessionId) {
      await prisma.session.updateMany({
        where: { id: existingSessionId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "superseded_by_new_login" },
      });
    }
    const tokens = await this.createSession(userId, ctx);
    await this.recordAuthEvent(userId, eventType, ctx);
    return { ...tokens, userId };
  }

  async logoutAllDevices(userId: string, ctx: RequestContext): Promise<void> {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "logout_all_devices" },
    });
    await this.recordAuthEvent(userId, "logout_all_devices", ctx);
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
    // Read the header first (unverified) only to pick which public key to verify
    // against — the signature itself is still checked below, so a forged/garbage
    // header just fails to match a known kid and falls through to the generic
    // rejection, never short-circuiting trust.
    let kid: string | undefined;
    try {
      const decoded = jwt.decode(token, { complete: true });
      kid = typeof decoded?.header.kid === "string" ? decoded.header.kid : undefined;
    } catch {
      throw new UnauthorizedException("Invalid or expired session.");
    }

    const publicKey =
      kid === env.AUTH_JWT_KID
        ? signingPublicKey
        : kid && kid === env.AUTH_JWT_PREVIOUS_KID && env.AUTH_JWT_PREVIOUS_PUBLIC_KEY
          ? env.AUTH_JWT_PREVIOUS_PUBLIC_KEY
          : null;
    if (!publicKey) {
      throw new UnauthorizedException("Invalid or expired session.");
    }

    try {
      const payload = jwt.verify(token, publicKey, {
        // Explicit allowlist — jwt.verify never falls back to "none" or another
        // algorithm when this is set, regardless of what the token's own header
        // claims (checklist: "allowlists the algorithm, reject none").
        algorithms: ["RS256"],
        issuer: env.AUTH_JWT_ISSUER,
        audience: env.AUTH_JWT_AUDIENCE,
        clockTolerance: JWT_CLOCK_TOLERANCE_SECONDS,
      }) as { sub: string; sid: string };
      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      throw new UnauthorizedException("Invalid or expired session.");
    }
  }
}
