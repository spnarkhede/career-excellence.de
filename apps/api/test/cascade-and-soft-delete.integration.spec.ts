import { prisma } from "@saas/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "../src/auth/auth.service.js";
import { cleanupTestUsers, isDatabaseReachable } from "./db-test-helpers.js";

const EMAIL_PREFIX = "phase3-cascade-softdelete-";
const ctx = { ipAddress: "203.0.113.11", userAgent: "vitest", requestId: "test-request" };
const TEST_PASSWORD = "a-strong-password-123"; // secret-scan-ignore-line: fake fixture

describe("cascade delete and soft delete (real database)", () => {
  const authService = new AuthService();
  let dbReachable = false;

  beforeAll(async () => {
    dbReachable = await isDatabaseReachable();
  });

  afterAll(async () => {
    if (dbReachable) await cleanupTestUsers(EMAIL_PREFIX);
  });

  // TEST 6 (part 1 of 2): hard delete cascades to every dependent row.
  it("a hard delete of a user cascades to its profile, sessions, and other dependent rows", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = `${EMAIL_PREFIX}hard-delete@example.test`;
    await authService.signUp({ email, password: TEST_PASSWORD, termsAccepted: true }, ctx);
    const { id: userId } = await prisma.user.findUniqueOrThrow({ where: { email } });
    // Activate directly — this test exercises cascade delete, not the verification flow.
    await prisma.user.update({ where: { id: userId }, data: { status: "active" } });
    await authService.login({ email, password: TEST_PASSWORD }, ctx);

    expect(await prisma.profile.findUnique({ where: { userId } })).not.toBeNull();
    expect(await prisma.session.count({ where: { userId } })).toBeGreaterThan(0);
    expect(await prisma.userRole.count({ where: { userId } })).toBeGreaterThan(0);

    await prisma.user.delete({ where: { id: userId } });

    expect(await prisma.profile.findUnique({ where: { userId } })).toBeNull();
    expect(await prisma.session.count({ where: { userId } })).toBe(0);
    expect(await prisma.userRole.count({ where: { userId } })).toBe(0);
  });

  // TEST 6 (part 2 of 2): soft delete revokes every session and blocks future sign-in.
  it("soft-deleting an account sets deletedAt + status=deleted, revokes every session, and blocks sign-in", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = `${EMAIL_PREFIX}soft-delete@example.test`;
    const password = TEST_PASSWORD;
    await authService.signUp({ email, password, termsAccepted: true }, ctx);
    const { id: userId } = await prisma.user.findUniqueOrThrow({ where: { email } });
    // Activate directly — this test exercises soft delete, not the verification flow.
    await prisma.user.update({ where: { id: userId }, data: { status: "active" } });
    await authService.login({ email, password }, ctx);
    await authService.login({ email, password }, ctx); // a second session

    const activeSessionsBefore = await prisma.session.count({
      where: { userId, revokedAt: null },
    });
    expect(activeSessionsBefore).toBeGreaterThanOrEqual(2);

    await authService.softDeleteAccount(userId, ctx);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.deletedAt).not.toBeNull();
    expect(user.status).toBe("deleted");

    const activeSessionsAfter = await prisma.session.count({ where: { userId, revokedAt: null } });
    expect(activeSessionsAfter).toBe(0);

    // Row itself (and the email, per the documented reuse decision — see
    // docs/auth/FINDINGS.md) still exists; the account simply can never sign in again.
    // Phase 5 distinguishes this from "wrong credentials" with a distinct 403 message
    // (checked only after the password has already been confirmed correct).
    await expect(authService.login({ email, password }, ctx)).rejects.toThrow(/disabled/i);
  });
});
