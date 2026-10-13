import { prisma } from "@saas/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "../src/auth/auth.service.js";
import { PrincipalService } from "../src/auth/principal.service.js";
import { cleanupTestUsers, isDatabaseReachable } from "./db-test-helpers.js";

/**
 * Phase 17: race conditions and edge cases. These exercise real concurrent calls
 * against a real Postgres connection (parallel request runners via Promise.all) —
 * see db-test-helpers.ts for why this needs a reachable database and skips cleanly
 * without one. Browser-only scenarios (multi-tab, multi-device, offline/reconnect,
 * slow provider, duplicate clicks, rapid navigation) are covered by
 * tests/e2e/phase17-race-conditions.spec.ts or documented as manual verification in
 * docs/auth/EDGE_CASES.md, per AUTH_RULES.md rule 13.
 */
const EMAIL_PREFIX = "phase17-race-";
const ctx = { ipAddress: "203.0.113.40", userAgent: "vitest", requestId: "test-request" };
const TEST_PASSWORD = "a-strong-password-123"; // secret-scan-ignore-line: fake fixture

async function createActiveUser(emailSuffix: string): Promise<{ email: string; userId: string }> {
  const authService = new AuthService();
  const email = `${EMAIL_PREFIX}${emailSuffix}@example.test`;
  await authService.signUp({ email, password: TEST_PASSWORD, termsAccepted: true }, ctx);
  const user = await prisma.user.update({ where: { email }, data: { status: "active" } });
  return { email, userId: user.id };
}

describe("Phase 17: race conditions and edge cases (real database)", () => {
  const authService = new AuthService();
  const principalService = new PrincipalService();
  let dbReachable = false;

  beforeAll(async () => {
    dbReachable = await isDatabaseReachable();
  });

  afterAll(async () => {
    if (dbReachable) await cleanupTestUsers(EMAIL_PREFIX);
  });

  // Checklist 1: Two login requests simultaneously.
  it("issues two independent, valid sessions for two concurrent logins with correct credentials", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const { email } = await createActiveUser("concurrent-login");

    const [a, b] = await Promise.all([
      authService.login({ email, password: TEST_PASSWORD }, ctx),
      authService.login({ email, password: TEST_PASSWORD }, ctx),
    ]);

    expect(a.sessionId).not.toBe(b.sessionId);
    const sessions = await prisma.session.findMany({
      where: { id: { in: [a.sessionId, b.sessionId] } },
    });
    expect(sessions).toHaveLength(2);
    expect(sessions.every((s) => s.revokedAt === null)).toBe(true);
  });

  // Checklist 2: Login + logout simultaneously (on a DIFFERENT, already-existing session).
  it("logging out an existing session concurrently with a brand-new login revokes only the targeted session", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const { email } = await createActiveUser("login-logout-race");
    const existing = await authService.login({ email, password: TEST_PASSWORD }, ctx);

    const [loginResult] = await Promise.all([
      authService.login({ email, password: TEST_PASSWORD }, ctx),
      authService.logout(existing.sessionId, ctx),
    ]);

    const [oldSession, newSession] = await Promise.all([
      prisma.session.findUnique({ where: { id: existing.sessionId } }),
      prisma.session.findUnique({ where: { id: loginResult.sessionId } }),
    ]);
    expect(oldSession?.revokedAt).not.toBeNull();
    expect(oldSession?.revokedReason).toBe("logout");
    expect(newSession?.revokedAt).toBeNull();
  });

  // Checklist 3: Login + refresh simultaneously (refresh targets a pre-existing
  // session, login creates an unrelated new one — the two must not interfere).
  it("a concurrent refresh of an existing session and a brand-new login both succeed independently", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const { email } = await createActiveUser("login-refresh-race");
    const existing = await authService.login({ email, password: TEST_PASSWORD }, ctx);

    const [refreshResult, loginResult] = await Promise.all([
      authService.refresh(existing.refreshToken, ctx),
      authService.login({ email, password: TEST_PASSWORD }, ctx),
    ]);

    expect(refreshResult.sessionId).not.toBe(existing.sessionId);
    expect(refreshResult.sessionId).not.toBe(loginResult.sessionId);
    const rotatedFrom = await prisma.session.findUnique({ where: { id: existing.sessionId } });
    expect(rotatedFrom?.revokedReason).toBe("rotated");
  });

  // Checklist 4 / 19: token refresh + API request simultaneously / refresh token
  // rotation during concurrent requests. Two concurrent presentations of the SAME
  // refresh token (e.g. two tabs refreshing near-simultaneously) must resolve to a
  // single rotation, with both callers landing on the same live session — not a
  // false "reuse detected" family revocation, per the grace-window benign-race design.
  it("two concurrent refreshes of the SAME refresh token resolve to one rotation without a false reuse-detected revocation", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const { email } = await createActiveUser("concurrent-refresh-same-token");
    const existing = await authService.login({ email, password: TEST_PASSWORD }, ctx);

    const results = await Promise.allSettled([
      authService.refresh(existing.refreshToken, ctx),
      authService.refresh(existing.refreshToken, ctx),
    ]);

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof authService.refresh>>> =>
        r.status === "fulfilled",
    );
    // At least one must succeed; if both do (benign race, grace window), they must
    // land on the same live session rather than each minting an independent one.
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    if (fulfilled.length === 2) {
      expect(fulfilled[0]?.value.sessionId).toBe(fulfilled[1]?.value.sessionId);
    }

    const originalSession = await prisma.session.findUnique({ where: { id: existing.sessionId } });
    expect(originalSession?.revokedReason).not.toBe("reuse_detected");
  });

  // Checklist 19 (adversarial variant): a refresh token reused OUTSIDE the grace
  // window (simulating a stolen, already-rotated token replayed later) must revoke
  // the entire session family, not be treated as a benign race.
  it("replaying an already-rotated refresh token outside the grace window revokes the whole family", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const { email } = await createActiveUser("stale-reuse-outside-grace");
    const existing = await authService.login({ email, password: TEST_PASSWORD }, ctx);
    await authService.refresh(existing.refreshToken, ctx);

    // Backdate the rotated-away session's revokedAt beyond the grace window so the
    // next presentation of its old refresh token is treated as a genuine replay.
    await prisma.session.update({
      where: { id: existing.sessionId },
      data: { revokedAt: new Date(Date.now() - 10 * 60 * 1000) },
    });

    await expect(authService.refresh(existing.refreshToken, ctx)).rejects.toThrow(
      /expired or revoked/i,
    );
    const originalSession = await prisma.session.findUnique({ where: { id: existing.sessionId } });
    const family = await prisma.session.findMany({
      where: { familyId: originalSession?.familyId },
    });
    expect(family.every((s) => s.revokedAt !== null)).toBe(true);
  });

  // Checklist 17: profile request before session request completes — two concurrent
  // principal resolutions for a user whose profile row doesn't exist yet (e.g. the
  // self-heal race from a pre-transactional-signup orphan) must not create two rows
  // or throw an unhandled unique-constraint error.
  it("concurrent principal resolution for a profile-less user self-heals without a duplicate-row error", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const { email, userId } = await createActiveUser("concurrent-principal-resolve");
    const session = await authService.login({ email, password: TEST_PASSWORD }, ctx);
    // Simulate an orphaned user (profile lost to an out-of-band write) so the
    // self-heal path in PrincipalService.resolve actually has to run.
    await prisma.profile.delete({ where: { userId } });

    const [principalA, principalB] = await Promise.all([
      principalService.resolve(userId, session.sessionId),
      principalService.resolve(userId, session.sessionId),
    ]);

    expect(principalA.user.id).toBe(userId);
    expect(principalB.user.id).toBe(userId);
    const profiles = await prisma.profile.findMany({ where: { userId } });
    expect(profiles).toHaveLength(1);
  });

  // Checklist 18: profile request after logout — once a session is revoked, refresh
  // (the only way the profile/session surface renews itself) must reject it, not
  // silently issue new tokens for a logged-out session.
  it("refresh fails for a session that was already logged out", async ({ skip }) => {
    if (!dbReachable) skip();
    const { email } = await createActiveUser("profile-after-logout");
    const session = await authService.login({ email, password: TEST_PASSWORD }, ctx);
    await authService.logout(session.sessionId, ctx);

    // Outside the grace window (logout is a deliberate end of the session, not a
    // rotation), the refresh token must be rejected outright.
    await prisma.session.update({
      where: { id: session.sessionId },
      data: { revokedAt: new Date(Date.now() - 10 * 60 * 1000) },
    });
    await expect(authService.refresh(session.refreshToken, ctx)).rejects.toThrow(
      /expired or revoked/i,
    );
  });
});
