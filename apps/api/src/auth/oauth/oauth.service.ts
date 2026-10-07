import { Injectable, NotFoundException } from "@nestjs/common";
import {
  buildOAuthProviderRegistry,
  generateCodeChallenge,
  generateCodeVerifier,
  generateNonce,
  generateNumericOtp,
  generateState,
  oauthStateCookieSameSite,
  OAuthProviderError,
  type ExternalIdentity,
  type OAuthProviderAdapter,
} from "@saas/auth";
import { loadPrivateEnv } from "@saas/config";
import { prisma } from "@saas/database";
import { oauthPendingIdentityEmailTemplate, StubEmailProvider } from "@saas/email";
import { logger } from "@saas/observability";
import { hashToken } from "@saas/security/server";
import { isExpired } from "@saas/utils";
import { AuthService, type IssuedTokens, type RequestContext } from "../auth.service.js";

const env = loadPrivateEnv();
const emailProvider = new StubEmailProvider();

const PENDING_IDENTITY_TTL_MS = 15 * 60 * 1000;
const MAX_PENDING_IDENTITY_ATTEMPTS = 5;

export type OAuthMode = "login" | "link";

export interface OAuthStartResult {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
  nonce: string;
  sameSite: "lax" | "none";
}

export type OAuthCallbackResult =
  | { kind: "signed_in"; tokens: IssuedTokens & { userId: string } }
  | { kind: "linked"; userId: string }
  | { kind: "pending_email"; lookupToken: string }
  | { kind: "error"; code: string };

@Injectable()
export class OAuthService {
  private registryPromise: Promise<Record<string, OAuthProviderAdapter>> | null = null;

  constructor(private authService: AuthService) {}

  /** Test-only seam: injects a fake provider registry (mocked adapters)
   * instead of building one from real env config / real provider APIs — used
   * by phase9-oauth.spec.ts so every test can run without a network call or
   * real provider credentials. Never called in production (nothing wires it
   * up outside tests). */
  useRegistryForTesting(registry: Record<string, OAuthProviderAdapter>): void {
    this.registryPromise = Promise.resolve(registry);
  }

  /** Built once, lazily, and memoized — mirrors the lazy-singleton pattern
   * already used for the email queue (Phase 8): most test files never touch
   * OAuth at all, so nothing should eagerly do network-dependent work (the
   * generic provider's OIDC discovery fetch) just from importing this class. */
  private getRegistry(): Promise<Record<string, OAuthProviderAdapter>> {
    if (!this.registryPromise) {
      this.registryPromise = buildOAuthProviderRegistry({
        google:
          env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET
            ? { clientId: env.GOOGLE_OAUTH_CLIENT_ID, clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET }
            : undefined,
        microsoft:
          env.MICROSOFT_OAUTH_CLIENT_ID && env.MICROSOFT_OAUTH_CLIENT_SECRET
            ? {
                clientId: env.MICROSOFT_OAUTH_CLIENT_ID,
                clientSecret: env.MICROSOFT_OAUTH_CLIENT_SECRET,
                tenant: env.MICROSOFT_OAUTH_TENANT,
              }
            : undefined,
        github:
          env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_CLIENT_SECRET
            ? { clientId: env.GITHUB_OAUTH_CLIENT_ID, clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET }
            : undefined,
        facebook:
          env.FACEBOOK_OAUTH_CLIENT_ID && env.FACEBOOK_OAUTH_CLIENT_SECRET
            ? {
                clientId: env.FACEBOOK_OAUTH_CLIENT_ID,
                clientSecret: env.FACEBOOK_OAUTH_CLIENT_SECRET,
              }
            : undefined,
        apple:
          env.APPLE_OAUTH_CLIENT_ID &&
          env.APPLE_OAUTH_TEAM_ID &&
          env.APPLE_OAUTH_KEY_ID &&
          env.APPLE_OAUTH_PRIVATE_KEY
            ? {
                clientId: env.APPLE_OAUTH_CLIENT_ID,
                teamId: env.APPLE_OAUTH_TEAM_ID,
                keyId: env.APPLE_OAUTH_KEY_ID,
                privateKey: env.APPLE_OAUTH_PRIVATE_KEY,
              }
            : undefined,
        generic:
          env.OAUTH_GENERIC_PROVIDER_NAME && env.OAUTH_GENERIC_ISSUER && env.OAUTH_GENERIC_CLIENT_ID
            ? {
                name: env.OAUTH_GENERIC_PROVIDER_NAME,
                issuer: env.OAUTH_GENERIC_ISSUER,
                clientId: env.OAUTH_GENERIC_CLIENT_ID,
                clientSecret: env.OAUTH_GENERIC_CLIENT_SECRET,
              }
            : undefined,
      });
    }
    return this.registryPromise;
  }

  async listRegisteredProviders(): Promise<string[]> {
    return Object.keys(await this.getRegistry());
  }

  private async getAdapter(provider: string): Promise<OAuthProviderAdapter> {
    const registry = await this.getRegistry();
    const adapter = registry[provider];
    if (!adapter) {
      throw new NotFoundException(`OAuth provider "${provider}" is not configured.`);
    }
    return adapter;
  }

  private redirectUriFor(provider: string): string {
    // Checklist "exact redirect URIs per environment from config, no
    // wildcards" — read literally from env, one per provider, never derived
    // or pattern-matched from the incoming request's own host/path.
    const map: Record<string, string> = {
      google: env.GOOGLE_OAUTH_REDIRECT_URI,
      microsoft: env.MICROSOFT_OAUTH_REDIRECT_URI,
      github: env.GITHUB_OAUTH_REDIRECT_URI,
      facebook: env.FACEBOOK_OAUTH_REDIRECT_URI,
      apple: env.APPLE_OAUTH_REDIRECT_URI,
      [env.OAUTH_GENERIC_PROVIDER_NAME]: env.OAUTH_GENERIC_REDIRECT_URI,
    };
    const uri = map[provider];
    if (!uri) {
      throw new NotFoundException(`No redirect URI configured for provider "${provider}".`);
    }
    return uri;
  }

  async startAuthorization(provider: string): Promise<OAuthStartResult> {
    const adapter = await this.getAdapter(provider);
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const nonce = generateNonce();
    const authorizationUrl = adapter.buildAuthorizationUrl({
      redirectUri: this.redirectUriFor(provider),
      state,
      codeChallenge,
      nonce,
    });
    return {
      authorizationUrl,
      state,
      codeVerifier,
      nonce,
      sameSite: oauthStateCookieSameSite(adapter),
    };
  }

  async handleCallback(params: {
    provider: string;
    code: string;
    codeVerifier: string;
    nonce?: string;
    mode: OAuthMode;
    linkUserId?: string;
    /** Apple only — the one-time `user` form field, parsed by the caller. */
    appleDisplayName?: string | null;
    ctx: RequestContext;
  }): Promise<OAuthCallbackResult> {
    const { provider, mode, linkUserId, ctx } = params;
    const adapter = await this.getAdapter(provider);

    let identity: ExternalIdentity;
    try {
      identity = await adapter.resolveIdentity({
        code: params.code,
        redirectUri: this.redirectUriFor(provider),
        codeVerifier: params.codeVerifier,
        nonce: params.nonce,
      });
    } catch (err) {
      const code = err instanceof OAuthProviderError ? err.code : "exchange_failed";
      logger.error({ err, provider, requestId: ctx.requestId }, "OAuth identity resolution failed");
      await this.authService.recordAuthEvent(null, "oauth_callback_failed", ctx, {
        provider,
        code,
      });
      return { kind: "error", code };
    }
    if (params.appleDisplayName && !identity.displayName) {
      identity = { ...identity, displayName: params.appleDisplayName };
    }

    return this.resolveIdentity(provider, identity, mode, linkUserId, ctx);
  }

  private async resolveIdentity(
    provider: string,
    identity: ExternalIdentity,
    mode: OAuthMode,
    linkUserId: string | undefined,
    ctx: RequestContext,
  ): Promise<OAuthCallbackResult> {
    // Checklist 3: identity is matched on (provider, providerAccountId) —
    // NEVER on email alone.
    const existingLink = await prisma.oauthAccount.findUnique({
      where: {
        provider_providerAccountId: { provider, providerAccountId: identity.providerAccountId },
      },
    });

    if (existingLink) {
      if (mode === "link") {
        if (existingLink.userId !== linkUserId) {
          // Checklist "Provider identity collision": this exact provider
          // identity is already linked to a DIFFERENT account.
          await this.authService.recordAuthEvent(
            linkUserId ?? null,
            "oauth_identity_collision",
            ctx,
            {
              provider,
            },
          );
          return { kind: "error", code: "identity_already_linked" };
        }
        return { kind: "linked", userId: existingLink.userId };
      }
      const tokens = await this.authService.issueSessionForUser(
        existingLink.userId,
        ctx,
        "oauth_login_succeeded",
      );
      return { kind: "signed_in", tokens };
    }

    if (mode === "link") {
      if (!linkUserId) {
        return { kind: "error", code: "link_session_missing" };
      }
      // Checklist 5: "Unverified provider emails never link."
      if (!identity.emailVerified) {
        return { kind: "error", code: "unverified_email" };
      }
      await prisma.oauthAccount.create({
        data: {
          provider,
          providerAccountId: identity.providerAccountId,
          userId: linkUserId,
          emailAtLinkTime: identity.email ?? "",
          emailVerifiedByProvider: true,
        },
      });
      await this.authService.recordAuthEvent(linkUserId, "oauth_account_linked", ctx, { provider });
      return { kind: "linked", userId: linkUserId };
    }

    // mode === "login", no existing link for this provider identity.
    if (!identity.email || !identity.emailVerified) {
      // Facebook (missing email) / Microsoft (untrusted email claim) / GitHub
      // (no verified primary) all land here — collect and verify an email
      // ourselves before creating anything.
      const lookupToken = await this.createPendingIdentity(provider, identity, ctx);
      return { kind: "pending_email", lookupToken };
    }

    const existingUser = await prisma.user.findUnique({ where: { email: identity.email } });
    if (existingUser) {
      // Checklist 5: "An email collision with an existing account never auto
      // links." The response intentionally DOES reveal that an account with
      // this email exists — unlike password/OTP flows, this is the task's
      // own specified UX ("The user signs in to the existing account, then
      // links from settings"), not an oversight; see FINDINGS.md.
      await this.authService.recordAuthEvent(existingUser.id, "oauth_email_collision", ctx, {
        provider,
      });
      return { kind: "error", code: "email_collision" };
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: identity.email!,
          passwordHash: null,
          status: "active",
          emailVerifiedAt: new Date(),
          profile: { create: { displayName: identity.displayName ?? undefined } },
        },
      });
      const userRole = await tx.role.findUniqueOrThrow({ where: { name: "user" } });
      await tx.userRole.createMany({
        data: [{ userId: created.id, roleId: userRole.id }],
        skipDuplicates: true,
      });
      await tx.oauthAccount.create({
        data: {
          provider,
          providerAccountId: identity.providerAccountId,
          userId: created.id,
          emailAtLinkTime: identity.email!,
          emailVerifiedByProvider: true,
        },
      });
      return created;
    });

    const tokens = await this.authService.issueSessionForUser(
      user.id,
      ctx,
      "oauth_signup_succeeded",
    );
    return { kind: "signed_in", tokens };
  }

  private async createPendingIdentity(
    provider: string,
    identity: ExternalIdentity,
    ctx: RequestContext,
  ): Promise<string> {
    const lookupToken = generateState(); // any CSPRNG token works here
    await prisma.oauthPendingIdentity.create({
      data: {
        provider,
        providerAccountId: identity.providerAccountId,
        displayName: identity.displayName,
        lookupTokenHash: hashToken(lookupToken),
        expiresAt: new Date(Date.now() + PENDING_IDENTITY_TTL_MS),
      },
    });
    await this.authService.recordAuthEvent(null, "oauth_pending_identity_created", ctx, {
      provider,
    });
    return lookupToken;
  }

  /** Step 1 of the collect-and-verify-an-email flow: the user types an
   * email in; a numeric code is sent to it, same shape as OTP. */
  async submitPendingEmail(lookupToken: string, email: string, ctx: RequestContext): Promise<void> {
    const pending = await prisma.oauthPendingIdentity.findUnique({
      where: { lookupTokenHash: hashToken(lookupToken) },
    });
    if (!pending || pending.usedAt || isExpired(pending.expiresAt)) {
      return; // same neutral response whether the lookup token is valid or not
    }

    const code = generateNumericOtp(6);
    await prisma.oauthPendingIdentity.update({
      where: { id: pending.id },
      data: { pendingEmail: email, verifyCodeHash: hashToken(code), verifyAttempts: 0 },
    });

    try {
      await emailProvider.send({
        to: email,
        subject: "Verify your email",
        html: oauthPendingIdentityEmailTemplate(code),
      });
    } catch (err) {
      logger.error({ err, requestId: ctx.requestId }, "OAuth pending-identity email failed");
    }
  }

  /** Step 2: the code is confirmed, completing exactly the same
   * email-collision/account-creation decision `resolveIdentity` makes for a
   * provider that already supplied a trusted email — reused here via the
   * same private method, now that this email has been independently verified. */
  async confirmPendingEmail(
    lookupToken: string,
    code: string,
    ctx: RequestContext,
  ): Promise<OAuthCallbackResult> {
    const pending = await prisma.oauthPendingIdentity.findUnique({
      where: { lookupTokenHash: hashToken(lookupToken) },
    });
    if (!pending || pending.usedAt || isExpired(pending.expiresAt) || !pending.verifyCodeHash) {
      return { kind: "error", code: "pending_identity_invalid" };
    }
    if (pending.verifyAttempts >= MAX_PENDING_IDENTITY_ATTEMPTS) {
      return { kind: "error", code: "pending_identity_invalid" };
    }
    if (pending.verifyCodeHash !== hashToken(code)) {
      await prisma.oauthPendingIdentity.update({
        where: { id: pending.id },
        data: { verifyAttempts: { increment: 1 } },
      });
      return { kind: "error", code: "pending_identity_invalid" };
    }

    const consumed = await prisma.oauthPendingIdentity.updateMany({
      where: { id: pending.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count === 0) {
      return { kind: "error", code: "pending_identity_invalid" };
    }

    const verifiedIdentity: ExternalIdentity = {
      providerAccountId: pending.providerAccountId,
      email: pending.pendingEmail,
      emailVerified: true,
      displayName: pending.displayName,
    };
    return this.resolveIdentity(pending.provider, verifiedIdentity, "login", undefined, ctx);
  }

  async listLinkedAccounts(userId: string) {
    return prisma.oauthAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, provider: true, emailAtLinkTime: true, createdAt: true },
    });
  }

  /** Checklist 7: "never unlink the last sign in method." A password counts
   * as a sign-in method; so does each remaining linked provider. */
  async unlinkAccount(userId: string, provider: string, ctx: RequestContext): Promise<void> {
    const [user, linkedCount] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      prisma.oauthAccount.count({ where: { userId } }),
    ]);
    const hasPassword = Boolean(user.passwordHash);
    if (!hasPassword && linkedCount <= 1) {
      throw new OAuthProviderError(
        "Can't unlink your only sign-in method. Set a password or link another provider first.",
        "last_sign_in_method",
      );
    }

    // Phase 10 (object-level checks, checklist "Return 404 where existence
    // must stay hidden"): this scopes the delete to `userId`, so a provider
    // the caller never linked gets the same 404 whether it was never linked
    // by anyone or is linked to a DIFFERENT account — never a 403 that would
    // confirm it exists elsewhere.
    const result = await prisma.oauthAccount.deleteMany({ where: { userId, provider } });
    if (result.count === 0) {
      throw new NotFoundException("No linked account found for that provider.");
    }
    await this.authService.recordAuthEvent(userId, "oauth_account_unlinked", ctx, { provider });
  }
}
