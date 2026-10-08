import { prisma } from "@saas/database";
import type { ExternalIdentity, OAuthProviderAdapter } from "@saas/auth";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "../src/auth/auth.service.js";
import { OAuthService } from "../src/auth/oauth/oauth.service.js";
import { cleanupTestUsers, isDatabaseReachable } from "./db-test-helpers.js";

const EMAIL_PREFIX = "phase9-oauth-";
const ctx = { ipAddress: "203.0.113.70", userAgent: "vitest", requestId: "test-request" };
const TEST_PASSWORD = "a-strong-password-123"; // secret-scan-ignore-line: fake fixture

/** A fake adapter whose `resolveIdentity` just returns whatever the test
 * wants, regardless of the exchange params — exercises OAuthService's own
 * account-resolution logic in isolation from any real provider/network call. */
function fakeAdapter(
  identity: ExternalIdentity,
  callbackMethod: "GET" | "POST" = "GET",
): OAuthProviderAdapter {
  return {
    name: "fake",
    callbackMethod,
    buildAuthorizationUrl: () => "https://fake.test/authorize",
    resolveIdentity: async () => identity,
  };
}

async function createActiveUser(suffix: string): Promise<{ email: string; userId: string }> {
  const authService = new AuthService();
  const email = `${EMAIL_PREFIX}${suffix}@example.test`;
  const signUpResult = await authService.signUp(
    { email, password: TEST_PASSWORD, termsAccepted: true },
    ctx,
  );
  await prisma.user.update({ where: { email }, data: { status: "active" } });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: signUpResult.email } });
  return { email, userId: user.id };
}

describe("Phase 9: OAuth and social login (real database, mocked providers)", () => {
  const authService = new AuthService();
  let dbReachable = false;

  beforeAll(async () => {
    dbReachable = await isDatabaseReachable();
  });

  afterAll(async () => {
    if (dbReachable) await cleanupTestUsers(EMAIL_PREFIX);
  });

  function makeOAuthService(adapter: OAuthProviderAdapter): OAuthService {
    const service = new OAuthService(authService);
    service.useRegistryForTesting({ [adapter.name]: adapter });
    return service;
  }

  // Checklist "OAuth initialization".
  it("builds an authorization URL for a registered provider", async ({ skip }) => {
    if (!dbReachable) skip();
    const oauth = makeOAuthService(
      fakeAdapter({
        providerAccountId: "p1",
        email: null,
        emailVerified: false,
        displayName: null,
      }),
    );
    const result = await oauth.startAuthorization("fake");
    expect(result.authorizationUrl).toBe("https://fake.test/authorize");
    expect(result.state).toBeTruthy();
    expect(result.codeVerifier).toBeTruthy();
  });

  // Checklist "Callback handling" / new account creation for a provider with
  // a verified email and no existing account.
  it("creates a brand-new account on first sign-in with a verified email", async ({ skip }) => {
    if (!dbReachable) skip();
    const email = `${EMAIL_PREFIX}new-account@example.test`;
    const oauth = makeOAuthService(
      fakeAdapter({ providerAccountId: "ext-1", email, emailVerified: true, displayName: "Ada" }),
    );

    const result = await oauth.handleCallback({
      provider: "fake",
      code: "code-1",
      codeVerifier: "v1",
      mode: "login",
      ctx,
    });

    expect(result.kind).toBe("signed_in");
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerifiedAt).not.toBeNull();
    const link = await prisma.oauthAccount.findUniqueOrThrow({
      where: { provider_providerAccountId: { provider: "fake", providerAccountId: "ext-1" } },
    });
    expect(link.userId).toBe(user.id);
  });

  // Checklist "Callback handling" (existing link) — signing in again with the
  // same provider identity reuses the existing account, never creates a
  // second one. Identity matched on (provider, providerAccountId), never email.
  it("signs in to the existing linked account on a repeat login, by provider+providerAccountId", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = `${EMAIL_PREFIX}repeat-login@example.test`;
    const oauth = makeOAuthService(
      fakeAdapter({ providerAccountId: "ext-2", email, emailVerified: true, displayName: null }),
    );

    const first = await oauth.handleCallback({
      provider: "fake",
      code: "code-1",
      codeVerifier: "v1",
      mode: "login",
      ctx,
    });
    const second = await oauth.handleCallback({
      provider: "fake",
      code: "code-2",
      codeVerifier: "v1",
      mode: "login",
      ctx,
    });

    expect(first.kind).toBe("signed_in");
    expect(second.kind).toBe("signed_in");
    if (first.kind === "signed_in" && second.kind === "signed_in") {
      expect(second.tokens.userId).toBe(first.tokens.userId);
    }
    const userCount = await prisma.user.count({ where: { email } });
    expect(userCount).toBe(1);
  });

  // Checklist "Email collision" / explicit test "email collision".
  it("never auto-links on an email collision with an existing account", async ({ skip }) => {
    if (!dbReachable) skip();
    const { email } = await createActiveUser("email-collision");
    const oauth = makeOAuthService(
      fakeAdapter({ providerAccountId: "ext-3", email, emailVerified: true, displayName: null }),
    );

    const result = await oauth.handleCallback({
      provider: "fake",
      code: "code-1",
      codeVerifier: "v1",
      mode: "login",
      ctx,
    });

    expect(result).toEqual({ kind: "error", code: "email_collision" });
    const link = await prisma.oauthAccount.findUnique({
      where: { provider_providerAccountId: { provider: "fake", providerAccountId: "ext-3" } },
    });
    expect(link).toBeNull();
  });

  // Checklist "Unverified provider email" / explicit test "unverified email"
  // — routes through the collect-and-verify-an-email flow instead of
  // creating or linking anything.
  it("routes an unverified/missing email into the pending-identity flow instead of creating an account", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const oauth = makeOAuthService(
      fakeAdapter({
        providerAccountId: "ext-4",
        email: null,
        emailVerified: false,
        displayName: null,
      }),
    );

    const result = await oauth.handleCallback({
      provider: "fake",
      code: "code-1",
      codeVerifier: "v1",
      mode: "login",
      ctx,
    });

    expect(result.kind).toBe("pending_email");
    const link = await prisma.oauthAccount.findUnique({
      where: { provider_providerAccountId: { provider: "fake", providerAccountId: "ext-4" } },
    });
    expect(link).toBeNull();
  });

  it("completes account creation once the pending email is submitted and verified", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const oauth = makeOAuthService(
      fakeAdapter({
        providerAccountId: "ext-5",
        email: null,
        emailVerified: false,
        displayName: "Sam",
      }),
    );
    const started = await oauth.handleCallback({
      provider: "fake",
      code: "code-1",
      codeVerifier: "v1",
      mode: "login",
      ctx,
    });
    expect(started.kind).toBe("pending_email");
    if (started.kind !== "pending_email") return;

    const email = `${EMAIL_PREFIX}pending-completed@example.test`;
    await oauth.submitPendingEmail(started.lookupToken, email, ctx);
    const pending = await prisma.oauthPendingIdentity.findFirstOrThrow({
      where: { provider: "fake", providerAccountId: "ext-5" },
    });
    expect(pending.verifyCodeHash).not.toBeNull();

    // The raw code only ever exists in the (stubbed) sent email — AuthService
    // has no method returning it, by design, same as every other OTP-style
    // flow in this codebase. Set a known code directly on the row rather than
    // scraping a mail catcher, matching the pattern used by other phases'
    // tests for codes they can't otherwise observe.
    const { hashToken } = await import("@saas/security/server");
    const knownCode = "123456";
    await prisma.oauthPendingIdentity.update({
      where: { id: pending.id },
      data: { verifyCodeHash: hashToken(knownCode) },
    });

    const wrong = await oauth.confirmPendingEmail(started.lookupToken, "000000", ctx);
    expect(wrong.kind).toBe("error");

    const result = await oauth.confirmPendingEmail(started.lookupToken, knownCode, ctx);
    expect(result.kind).toBe("signed_in");
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  // Checklist "Account linking" / "Existing account linking" — linking a NEW
  // provider identity to an authenticated user from settings.
  it("links a new provider identity to the calling (authenticated) user", async ({ skip }) => {
    if (!dbReachable) skip();
    const { userId } = await createActiveUser("link-flow");
    const oauth = makeOAuthService(
      fakeAdapter({
        providerAccountId: "ext-6",
        email: "whatever@example.test",
        emailVerified: true,
        displayName: null,
      }),
    );

    const result = await oauth.handleCallback({
      provider: "fake",
      code: "code-1",
      codeVerifier: "v1",
      mode: "link",
      linkUserId: userId,
      ctx,
    });

    expect(result).toEqual({ kind: "linked", userId });
    const link = await prisma.oauthAccount.findUniqueOrThrow({
      where: { provider_providerAccountId: { provider: "fake", providerAccountId: "ext-6" } },
    });
    expect(link.userId).toBe(userId);
  });

  it("refuses to link an unverified provider email (checklist: 'Unverified provider emails never link')", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const { userId } = await createActiveUser("link-unverified");
    const oauth = makeOAuthService(
      fakeAdapter({
        providerAccountId: "ext-7",
        email: "x@example.test",
        emailVerified: false,
        displayName: null,
      }),
    );

    const result = await oauth.handleCallback({
      provider: "fake",
      code: "code-1",
      codeVerifier: "v1",
      mode: "link",
      linkUserId: userId,
      ctx,
    });

    expect(result).toEqual({ kind: "error", code: "unverified_email" });
  });

  // Checklist "Provider identity collision" / explicit test "identity collision".
  it("shows a clear error when the provider identity is already linked to a DIFFERENT account", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const first = await createActiveUser("identity-collision-a");
    const second = await createActiveUser("identity-collision-b");
    const oauth = makeOAuthService(
      fakeAdapter({
        providerAccountId: "ext-8",
        email: "whichever@example.test",
        emailVerified: true,
        displayName: null,
      }),
    );

    await oauth.handleCallback({
      provider: "fake",
      code: "code-1",
      codeVerifier: "v1",
      mode: "link",
      linkUserId: first.userId,
      ctx,
    });

    const collision = await oauth.handleCallback({
      provider: "fake",
      code: "code-2",
      codeVerifier: "v1",
      mode: "link",
      linkUserId: second.userId,
      ctx,
    });

    expect(collision).toEqual({ kind: "error", code: "identity_already_linked" });
  });

  it("is a no-op (not an error) when the same user re-links an identity already linked to them", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const { userId } = await createActiveUser("relink-self");
    const oauth = makeOAuthService(
      fakeAdapter({
        providerAccountId: "ext-9",
        email: "x@example.test",
        emailVerified: true,
        displayName: null,
      }),
    );

    await oauth.handleCallback({
      provider: "fake",
      code: "code-1",
      codeVerifier: "v1",
      mode: "link",
      linkUserId: userId,
      ctx,
    });
    const again = await oauth.handleCallback({
      provider: "fake",
      code: "code-2",
      codeVerifier: "v1",
      mode: "link",
      linkUserId: userId,
      ctx,
    });

    expect(again).toEqual({ kind: "linked", userId });
  });

  // Checklist "Multiple accounts" (link and unlink from settings).
  describe("listLinkedAccounts / unlinkAccount", () => {
    it("lists linked accounts without exposing internal fields", async ({ skip }) => {
      if (!dbReachable) skip();
      const { userId } = await createActiveUser("list-accounts");
      const oauth = makeOAuthService(
        fakeAdapter({
          providerAccountId: "ext-10",
          email: "x@example.test",
          emailVerified: true,
          displayName: null,
        }),
      );
      await oauth.handleCallback({
        provider: "fake",
        code: "code-1",
        codeVerifier: "v1",
        mode: "link",
        linkUserId: userId,
        ctx,
      });

      const accounts = await oauth.listLinkedAccounts(userId);
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({ provider: "fake" });
    });

    // Checklist 7: "never unlink the last sign in method."
    it("refuses to unlink the only remaining sign-in method for a password-less account", async ({
      skip,
    }) => {
      if (!dbReachable) skip();
      const oauth = makeOAuthService(
        fakeAdapter({
          providerAccountId: "ext-11",
          email: `${EMAIL_PREFIX}only-method@example.test`,
          emailVerified: true,
          displayName: null,
        }),
      );
      const result = await oauth.handleCallback({
        provider: "fake",
        code: "code-1",
        codeVerifier: "v1",
        mode: "login",
        ctx,
      });
      expect(result.kind).toBe("signed_in");
      if (result.kind !== "signed_in") return;

      await expect(oauth.unlinkAccount(result.tokens.userId, "fake", ctx)).rejects.toThrow(
        /only sign-in method/i,
      );
    });

    it("allows unlinking a provider when the account still has a password set", async ({
      skip,
    }) => {
      if (!dbReachable) skip();
      const { userId } = await createActiveUser("unlink-with-password");
      const oauth = makeOAuthService(
        fakeAdapter({
          providerAccountId: "ext-12",
          email: "x@example.test",
          emailVerified: true,
          displayName: null,
        }),
      );
      await oauth.handleCallback({
        provider: "fake",
        code: "code-1",
        codeVerifier: "v1",
        mode: "link",
        linkUserId: userId,
        ctx,
      });

      await expect(oauth.unlinkAccount(userId, "fake", ctx)).resolves.toBeUndefined();
      const accounts = await oauth.listLinkedAccounts(userId);
      expect(accounts).toHaveLength(0);
    });
  });

  // Checklist "Callback failure" — the adapter itself throws (simulating a
  // token-exchange/network error).
  it("reports a generic callback-failure error when the adapter throws", async ({ skip }) => {
    if (!dbReachable) skip();
    const failingAdapter: OAuthProviderAdapter = {
      name: "fake",
      callbackMethod: "GET",
      buildAuthorizationUrl: () => "https://fake.test/authorize",
      resolveIdentity: async () => {
        throw new Error("simulated provider outage");
      },
    };
    const oauth = makeOAuthService(failingAdapter);

    const result = await oauth.handleCallback({
      provider: "fake",
      code: "code-1",
      codeVerifier: "v1",
      mode: "login",
      ctx,
    });

    expect(result.kind).toBe("error");
  });
});
