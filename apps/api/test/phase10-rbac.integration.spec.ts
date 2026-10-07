import { prisma } from "@saas/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "../src/auth/auth.service.js";
import { OAuthService } from "../src/auth/oauth/oauth.service.js";
import { cleanupTestUsers, isDatabaseReachable } from "./db-test-helpers.js";

const EMAIL_PREFIX = "phase10-rbac-";
const ctx = { ipAddress: "203.0.113.80", userAgent: "vitest", requestId: "test-request" };
const TEST_PASSWORD = "a-strong-password-123"; // secret-scan-ignore-line: fake fixture

async function createActiveUser(suffix: string) {
  const authService = new AuthService();
  const email = `${EMAIL_PREFIX}${suffix}@example.test`;
  await authService.signUp({ email, password: TEST_PASSWORD }, ctx);
  await prisma.user.update({ where: { email }, data: { status: "active" } });
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { email, userId: user.id };
}

describe("Phase 10: object-level checks (checklist: 'Return 404 where existence must stay hidden')", () => {
  const authService = new AuthService();
  let dbReachable = false;

  beforeAll(async () => {
    dbReachable = await isDatabaseReachable();
  });

  afterAll(async () => {
    if (dbReachable) await cleanupTestUsers(EMAIL_PREFIX);
  });

  describe("revokeSession", () => {
    it("revokes a session the caller actually owns", async ({ skip }) => {
      if (!dbReachable) skip();
      const { email, userId } = await createActiveUser("revoke-own");
      const tokens = await authService.login({ email, password: TEST_PASSWORD }, ctx);
      await expect(
        authService.revokeSession(userId, tokens.sessionId, ctx),
      ).resolves.toBeUndefined();
    });

    it("returns 404 (never 403) for a session that belongs to a DIFFERENT user — existence must stay hidden", async ({
      skip,
    }) => {
      if (!dbReachable) skip();
      const owner = await createActiveUser("revoke-owner");
      const attacker = await createActiveUser("revoke-attacker");
      const ownerSession = await authService.login(
        { email: owner.email, password: TEST_PASSWORD },
        ctx,
      );

      await expect(
        authService.revokeSession(attacker.userId, ownerSession.sessionId, ctx),
      ).rejects.toMatchObject({ status: 404 });

      // The owner's session must still be intact — the attacker's attempt had
      // no side effect, not even a partial one.
      const session = await prisma.session.findUniqueOrThrow({
        where: { id: ownerSession.sessionId },
      });
      expect(session.revokedAt).toBeNull();
    });

    it("returns 404 for a session id that never existed at all — identical to the 'belongs to someone else' case", async ({
      skip,
    }) => {
      if (!dbReachable) skip();
      const { userId } = await createActiveUser("revoke-nonexistent");
      await expect(
        authService.revokeSession(userId, "00000000-0000-0000-0000-000000000000", ctx),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("unlinkAccount", () => {
    function makeOAuthService(): OAuthService {
      return new OAuthService(authService);
    }

    it("returns 404 for a provider the caller never linked", async ({ skip }) => {
      if (!dbReachable) skip();
      const { userId } = await createActiveUser("unlink-never-linked");
      const oauth = makeOAuthService();
      await expect(oauth.unlinkAccount(userId, "google", ctx)).rejects.toMatchObject({
        status: 404,
      });
    });

    it("returns 404 (never 403) for a provider linked to a DIFFERENT account", async ({ skip }) => {
      if (!dbReachable) skip();
      const owner = await createActiveUser("unlink-owner");
      const attacker = await createActiveUser("unlink-attacker");
      await prisma.oauthAccount.create({
        data: {
          provider: "google",
          providerAccountId: `phase10-${owner.userId}`,
          userId: owner.userId,
          emailAtLinkTime: owner.email,
          emailVerifiedByProvider: true,
        },
      });

      const oauth = makeOAuthService();
      await expect(oauth.unlinkAccount(attacker.userId, "google", ctx)).rejects.toMatchObject({
        status: 404,
      });

      const stillLinked = await prisma.oauthAccount.findFirst({
        where: { userId: owner.userId, provider: "google" },
      });
      expect(stillLinked).not.toBeNull();
    });
  });
});
