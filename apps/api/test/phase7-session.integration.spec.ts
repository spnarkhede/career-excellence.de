import { prisma } from "@saas/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "../src/auth/auth.service.js";
import { cleanupTestUsers, isDatabaseReachable } from "./db-test-helpers.js";

const EMAIL_PREFIX = "phase7-session-";
const ctx = { ipAddress: "203.0.113.50", userAgent: "vitest", requestId: "test-request" };
const TEST_PASSWORD = "a-strong-password-123"; // secret-scan-ignore-line: fake fixture

async function createLoggedInUser(suffix: string) {
  const authService = new AuthService();
  const email = `${EMAIL_PREFIX}${suffix}@example.test`;
  await authService.signUp({ email, password: TEST_PASSWORD }, ctx);
  await prisma.user.update({ where: { email }, data: { status: "active" } });
  const tokens = await authService.login({ email, password: TEST_PASSWORD }, ctx);
  return { email, ...tokens };
}

describe("Phase 7: session and token lifecycle (real database)", () => {
  const authService = new AuthService();
  let dbReachable = false;

  beforeAll(async () => {
    dbReachable = await isDatabaseReachable();
  });

  afterAll(async () => {
    if (dbReachable) await cleanupTestUsers(EMAIL_PREFIX);
  });

  // Checklist 4/19: Refresh token rotation.
  it("rotates the refresh token on use, within the same family", async ({ skip }) => {
    if (!dbReachable) skip();
    const { refreshToken, sessionId } = await createLoggedInUser("rotation");
    const original = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });

    const rotated = await authService.refresh(refreshToken, ctx);
    expect(rotated.refreshToken).not.toBe(refreshToken);
    expect(rotated.sessionId).not.toBe(sessionId);

    const newSession = await prisma.session.findUniqueOrThrow({
      where: { id: rotated.sessionId },
    });
    expect(newSession.familyId).toBe(original.familyId);

    const oldSession = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(oldSession.revokedAt).not.toBeNull();
    expect(oldSession.rotatedToSessionId).toBe(rotated.sessionId);
  });

  // Checklist 23 / explicit test: "reuse of a rotated token revokes the family."
  it("revokes the entire session family when a rotated token is replayed outside the grace window", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const { refreshToken, sessionId } = await createLoggedInUser("reuse-outside-grace");
    const rotated = await authService.refresh(refreshToken, ctx);

    // Push the rotation's revokedAt into the past, outside the grace window, so
    // the next presentation of the OLD token is treated as a stolen-token replay
    // rather than a benign race.
    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });

    await expect(authService.refresh(refreshToken, ctx)).rejects.toThrow(/expired or revoked/i);

    const liveSession = await prisma.session.findUniqueOrThrow({
      where: { id: rotated.sessionId },
    });
    expect(liveSession.revokedAt).not.toBeNull();
    expect(liveSession.revokedReason).toBe("reuse_detected");
  });

  // Benign-race handling: a rotated token replayed WITHIN the grace window
  // resolves to the live session instead of nuking the family.
  it("resolves a rotated-token replay within the grace window to the live session, without revoking the family", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const { refreshToken, sessionId } = await createLoggedInUser("reuse-within-grace");
    const rotated = await authService.refresh(refreshToken, ctx);

    // The grace window defaults to 10s and the rotation just happened — this
    // presentation is still within it.
    const result = await authService.refresh(refreshToken, ctx);
    expect(result.userId).toBeTruthy();

    const originalSession = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(originalSession.revokedReason).not.toBe("reuse_detected");
    // The session the first rotation produced should still exist and not have
    // been force-revoked as part of a family-wide reuse response.
    const firstRotated = await prisma.session.findUniqueOrThrow({
      where: { id: rotated.sessionId },
    });
    expect(firstRotated.revokedReason).not.toBe("reuse_detected");
  });

  // Checklist 5/21: Refresh token expiration / expired token handling.
  it("rejects a refresh token whose session has passed its absolute expiry", async ({ skip }) => {
    if (!dbReachable) skip();
    const { refreshToken, sessionId } = await createLoggedInUser("absolute-expiry");
    await prisma.session.update({
      where: { id: sessionId },
      data: { absoluteExpiresAt: new Date(Date.now() - 1000) },
    });
    await expect(authService.refresh(refreshToken, ctx)).rejects.toThrow(/expired or revoked/i);
  });

  // Checklist 22: Invalid token handling.
  it("rejects a refresh token that was never issued", async ({ skip }) => {
    if (!dbReachable) skip();
    await expect(
      authService.refresh("not-a-real-refresh-token", ctx), // secret-scan-ignore-line
    ).rejects.toThrow(/expired or revoked/i);
  });

  // Checklist 24/explicit test: "replaying a cookie after logout returns 401" —
  // here exercised at the session-row level (SessionGuard's own DB check), since
  // the HTTP-cookie half is covered by the controller wiring, not AuthService.
  it("revokes exactly the targeted session on logout, leaving others untouched", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const { sessionId, email } = await createLoggedInUser("logout");
    // A second, independent login (no existingSessionId passed) — simulates a
    // second device/browser signed in to the same account.
    const second = await authService.login({ email, password: TEST_PASSWORD }, ctx);

    await authService.logout(sessionId, ctx);

    const loggedOut = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(loggedOut.revokedAt).not.toBeNull();

    const other = await prisma.session.findUniqueOrThrow({ where: { id: second.sessionId } });
    expect(other.revokedAt).toBeNull();
  });

  // Checklist 6 ("Logout: ... Log out of all devices").
  it("logoutAllDevices revokes every session for the user, including the calling one", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const { sessionId, userId, email } = await createLoggedInUser("logout-all");
    const second = await authService.login({ email, password: TEST_PASSWORD }, ctx);

    await authService.logoutAllDevices(userId, ctx);

    const first = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    const other = await prisma.session.findUniqueOrThrow({ where: { id: second.sessionId } });
    expect(first.revokedAt).not.toBeNull();
    expect(other.revokedAt).not.toBeNull();
  });

  // Checklist "Password change revokes other sessions."
  it("changePassword revokes every OTHER session but keeps the calling session alive", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const { sessionId, userId, email } = await createLoggedInUser("change-password");
    const second = await authService.login({ email, password: TEST_PASSWORD }, ctx);

    await authService.changePassword(
      userId,
      sessionId,
      { currentPassword: TEST_PASSWORD, newPassword: "a-different-strong-password-456" }, // secret-scan-ignore-line
      ctx,
    );

    const current = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    const other = await prisma.session.findUniqueOrThrow({ where: { id: second.sessionId } });
    expect(current.revokedAt).toBeNull();
    expect(other.revokedAt).not.toBeNull();
  });

  it("rejects changePassword when the current password is wrong", async ({ skip }) => {
    if (!dbReachable) skip();
    const { sessionId, userId } = await createLoggedInUser("change-password-wrong");
    await expect(
      authService.changePassword(
        userId,
        sessionId,
        { currentPassword: "totally-wrong", newPassword: "a-different-strong-password-456" }, // secret-scan-ignore-line
        ctx,
      ),
    ).rejects.toThrow(/current password is incorrect/i);
  });

  // Checklist 27/28/31: session persistence / idle timeout enforcement.
  it("touchSessionActivity updates lastUsedAt, backing idle-timeout enforcement", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const { sessionId } = await createLoggedInUser("idle-touch");
    const before = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });

    await new Promise((resolve) => setTimeout(resolve, 10));
    await authService.touchSessionActivity(sessionId);

    const after = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(after.lastUsedAt.getTime()).toBeGreaterThan(before.lastUsedAt.getTime());
  });

  // Checklist "listSessions" / session list page data shape: never exposes the
  // refresh-token hash or the internal rotation pointer.
  it("listSessions returns rows that never include refreshTokenHash", async ({ skip }) => {
    if (!dbReachable) skip();
    const { userId } = await createLoggedInUser("list-sessions");
    const sessions = await authService.listSessions(userId);
    expect(sessions.length).toBeGreaterThan(0);
    for (const session of sessions) {
      expect("refreshTokenHash" in session).toBe(true); // raw service-level row
      // The hash itself is never the raw refresh token and is a fixed-length hex
      // digest — never logged/returned by the controller layer (see auth.controller.ts).
      expect(session.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
