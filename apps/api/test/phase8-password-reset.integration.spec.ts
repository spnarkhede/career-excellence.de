import { prisma } from "@saas/database";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as emailQueueModule from "../src/common/email-queue.js";
import { AuthService } from "../src/auth/auth.service.js";
import { cleanupTestUsers, isDatabaseReachable } from "./db-test-helpers.js";

const EMAIL_PREFIX = "phase8-reset-";
const ctx = { ipAddress: "203.0.113.60", userAgent: "vitest", requestId: "test-request" };
const TEST_PASSWORD = "a-strong-password-123"; // secret-scan-ignore-line: fake fixture
const NEW_PASSWORD = "a-different-strong-password-789"; // secret-scan-ignore-line: fake fixture

async function createActiveUser(suffix: string): Promise<string> {
  const authService = new AuthService();
  const email = `${EMAIL_PREFIX}${suffix}@example.test`;
  await authService.signUp({ email, password: TEST_PASSWORD }, ctx);
  await prisma.user.update({ where: { email }, data: { status: "active" } });
  return email;
}

/** Captures the raw reset token the way a real test would scrape it from a
 * local mail catcher — AuthService has no method that returns it, by design.
 * Spies on the queue producer (not a live Redis connection) since Phase 8
 * enqueues this email instead of sending it directly. */
async function captureNextResetToken(trigger: () => Promise<void>): Promise<string> {
  const enqueueSpy = vi.spyOn(emailQueueModule, "enqueueEmail").mockResolvedValue(undefined);
  await trigger();
  const call = enqueueSpy.mock.calls.at(-1)?.[0] as { html: string } | undefined;
  enqueueSpy.mockRestore();
  const match = call?.html.match(/token=([^"&]+)/);
  const token = match?.[1];
  if (!token) throw new Error("expected a reset URL with a token in the queued email");
  return decodeURIComponent(token);
}

describe("Phase 8: password reset (real database)", () => {
  const authService = new AuthService();
  let dbReachable = false;

  beforeAll(async () => {
    dbReachable = await isDatabaseReachable();
  });

  afterAll(async () => {
    if (dbReachable) await cleanupTestUsers(EMAIL_PREFIX);
  });

  // Checklist 1/2: Forgot password / reset email.
  it("issues a 32-byte reset token, stores only its hash, and the email is queued (not sent directly)", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("happy-path");
    const token = await captureNextResetToken(() =>
      authService.requestPasswordReset({ email }, ctx),
    );
    expect(Buffer.from(token, "base64url").length).toBe(32);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const record = await prisma.oneTimeToken.findFirstOrThrow({
      where: { userId: user.id, purpose: "reset_password" },
      orderBy: { createdAt: "desc" },
    });
    // Checklist 3: reset token — no raw token in the database, only a 64-hex SHA-256 hash.
    expect(record.tokenHash).not.toBe(token);
    expect(record.tokenHash).not.toContain(token);
    expect(record.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  // Checklist 7: Password update.
  it("updates the password hash so the new password works and the old one no longer does", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("password-update");
    const token = await captureNextResetToken(() =>
      authService.requestPasswordReset({ email }, ctx),
    );
    await authService.resetPassword({ token, password: NEW_PASSWORD }, ctx);

    await expect(authService.login({ email, password: NEW_PASSWORD }, ctx)).resolves.toMatchObject({
      userId: expect.any(String),
    });
    await expect(authService.login({ email, password: TEST_PASSWORD }, ctx)).rejects.toThrow(
      /invalid email or password/i,
    );
  });

  // Checklist 8/9: Session invalidation after password change / existing sessions
  // after reset. Explicit test: "sessions in a second browser context dead after
  // reset" — modeled here as two independent logins (two browser contexts).
  it("revokes every existing session (both browser contexts) on a successful reset", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("session-invalidation");
    const firstContext = await authService.login({ email, password: TEST_PASSWORD }, ctx);
    const secondContext = await authService.login({ email, password: TEST_PASSWORD }, ctx);

    const token = await captureNextResetToken(() =>
      authService.requestPasswordReset({ email }, ctx),
    );
    await authService.resetPassword({ token, password: NEW_PASSWORD }, ctx);

    const first = await prisma.session.findUniqueOrThrow({
      where: { id: firstContext.sessionId },
    });
    const second = await prisma.session.findUniqueOrThrow({
      where: { id: secondContext.sessionId },
    });
    expect(first.revokedAt).not.toBeNull();
    expect(second.revokedAt).not.toBeNull();
  });

  // Checklist 4/11: Reset token expiration / expired reset links.
  it("rejects an expired token with a distinct, enumeration-safe error code", async ({ skip }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("expired");
    const token = await captureNextResetToken(() =>
      authService.requestPasswordReset({ email }, ctx),
    );
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.oneTimeToken.updateMany({
      where: { userId: user.id, purpose: "reset_password", usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const error = await authService
      .resetPassword({ token, password: NEW_PASSWORD }, ctx)
      .catch((e: unknown) => e);
    expect((error as { response?: { code?: string } }).response?.code).toBe("RESET_TOKEN_EXPIRED");
  });

  // Checklist 5: Token reuse.
  it("rejects reusing an already-consumed token", async ({ skip }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("reuse");
    const token = await captureNextResetToken(() =>
      authService.requestPasswordReset({ email }, ctx),
    );

    await authService.resetPassword({ token, password: NEW_PASSWORD }, ctx); // first use succeeds
    const error = await authService
      .resetPassword({ token, password: "yet-another-password-456" }, ctx) // secret-scan-ignore-line
      .catch((e: unknown) => e);
    expect((error as { response?: { code?: string } }).response?.code).toBe("RESET_TOKEN_USED");
  });

  // Checklist 6/12: Token invalidation / multiple reset requests — a new request
  // invalidates the earlier token, and a request within the cooldown is a no-op.
  it("invalidates the previous token when a new reset is requested, and respects the resend cooldown", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("resend");
    const firstToken = await captureNextResetToken(() =>
      authService.requestPasswordReset({ email }, ctx),
    );
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    // Back-date the first token so the next request clears the cooldown.
    await prisma.oneTimeToken.updateMany({
      where: { userId: user.id, purpose: "reset_password" },
      data: { createdAt: new Date(Date.now() - 120_000) },
    });

    const secondToken = await captureNextResetToken(() =>
      authService.requestPasswordReset({ email }, ctx),
    );
    expect(secondToken).not.toBe(firstToken);

    const firstError = await authService
      .resetPassword({ token: firstToken, password: NEW_PASSWORD }, ctx)
      .catch((e: unknown) => e);
    expect((firstError as { response?: { code?: string } }).response?.code).toBe(
      "RESET_TOKEN_USED",
    );
    await expect(
      authService.resetPassword({ token: secondToken, password: NEW_PASSWORD }, ctx),
    ).resolves.toBeUndefined();
  });

  it("does not send a new email when a reset is requested again within the cooldown", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("cooldown");
    await authService.requestPasswordReset({ email }, ctx);

    const enqueueSpy = vi.spyOn(emailQueueModule, "enqueueEmail").mockResolvedValue(undefined);
    await authService.requestPasswordReset({ email }, ctx); // immediately again
    expect(enqueueSpy).not.toHaveBeenCalled();
    enqueueSpy.mockRestore();
  });

  // Checklist 10: Enumeration protection.
  it("resolves without throwing for both a known and an unknown email", async ({ skip }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("enum");
    await expect(authService.requestPasswordReset({ email }, ctx)).resolves.toBeUndefined();
    await expect(
      authService.requestPasswordReset({ email: `${EMAIL_PREFIX}never-existed@example.test` }, ctx),
    ).resolves.toBeUndefined();
  });

  // Checklist 13 / explicit test: two simultaneous submits with one token —
  // exactly one succeeds. Same atomic-consume pattern that fixed BUG-009 for OTP.
  it("lets exactly one of two concurrent resetPassword submissions with the same token succeed", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("concurrent");
    const token = await captureNextResetToken(() =>
      authService.requestPasswordReset({ email }, ctx),
    );

    const results = await Promise.allSettled([
      authService.resetPassword({ token, password: NEW_PASSWORD }, ctx),
      authService.resetPassword({ token, password: "a-third-strong-password-321" }, ctx), // secret-scan-ignore-line
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });

  it("rejects an unrecognized token the same way as an expired or used one", async ({ skip }) => {
    if (!dbReachable) skip();
    const error = await authService
      .resetPassword({ token: "not-a-real-token", password: NEW_PASSWORD }, ctx) // secret-scan-ignore-line
      .catch((e: unknown) => e);
    expect((error as { response?: { code?: string } }).response?.code).toBe("RESET_TOKEN_INVALID");
  });
});
