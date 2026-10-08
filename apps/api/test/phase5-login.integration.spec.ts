import type { INestApplication } from "@nestjs/common";
import { prisma } from "@saas/database";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthModule } from "../src/auth/auth.module.js";
import { AuthService } from "../src/auth/auth.service.js";
import { cleanupTestUsers, isDatabaseReachable } from "./db-test-helpers.js";

const EMAIL_PREFIX = "phase5-login-";
const ctx = { ipAddress: "203.0.113.30", userAgent: "vitest", requestId: "test-request" };
const TEST_PASSWORD = "a-strong-password-123"; // secret-scan-ignore-line: fake fixture

async function createActiveUser(emailSuffix: string): Promise<string> {
  const authService = new AuthService();
  const email = `${EMAIL_PREFIX}${emailSuffix}@example.test`;
  await authService.signUp({ email, password: TEST_PASSWORD, termsAccepted: true }, ctx);
  await prisma.user.update({ where: { email }, data: { status: "active" } });
  return email;
}

describe("Phase 5: login process (real database)", () => {
  const authService = new AuthService();
  let dbReachable = false;

  beforeAll(async () => {
    dbReachable = await isDatabaseReachable();
  });

  afterAll(async () => {
    if (dbReachable) await cleanupTestUsers(EMAIL_PREFIX);
  });

  // Checklist 6: Incorrect password.
  it("rejects a correct email with the wrong password with the generic message", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("wrong-password");
    await expect(
      authService.login({ email, password: "totally-wrong-password" }, ctx), // secret-scan-ignore-line
    ).rejects.toThrow(/invalid email or password/i);
  });

  // Checklist 2 (credentials lookup) — unknown email gets the SAME message as a wrong password.
  it("rejects an unknown email with the same generic message as a wrong password", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    await expect(
      authService.login(
        { email: `${EMAIL_PREFIX}never-existed@example.test`, password: "whatever123" }, // secret-scan-ignore-line
        ctx,
      ),
    ).rejects.toThrow(/invalid email or password/i);
  });

  // Checklist 7: Correct credentials.
  it("issues a session for correct credentials on an active account", async ({ skip }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("correct-credentials");
    const result = await authService.login({ email, password: TEST_PASSWORD }, ctx);
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.sessionId).toBeTruthy();

    const event = await prisma.authEvent.findFirst({
      where: { userId: result.userId, type: "login_succeeded" },
    });
    expect(event).not.toBeNull();
  });

  // Checklist 8: Unverified account.
  it("rejects login for a pending_verification account with EMAIL_NOT_VERIFIED, after confirming the password", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = `${EMAIL_PREFIX}unverified@example.test`;
    await authService.signUp({ email, password: TEST_PASSWORD, termsAccepted: true }, ctx);
    await expect(authService.login({ email, password: TEST_PASSWORD }, ctx)).rejects.toThrow(
      /verify your email/i,
    );
  });

  // Checklist 9 / "Disabled account".
  it("rejects login for a disabled account with a distinct support message", async ({ skip }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("disabled");
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.user.update({ where: { id: user.id }, data: { status: "disabled" } });
    await expect(authService.login({ email, password: TEST_PASSWORD }, ctx)).rejects.toThrow(
      /disabled/i,
    );
  });

  // Checklist 10: Deleted account.
  it("rejects login for a (soft-)deleted account with the same disabled-style message", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("deleted");
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await authService.softDeleteAccount(user.id, ctx);
    await expect(authService.login({ email, password: TEST_PASSWORD }, ctx)).rejects.toThrow(
      /disabled/i,
    );
  });

  // Checklist 11 / 12: Locked / rate-limited account, with growing delay.
  it("locks the account after repeated failures, reports the unlock time, and the lockout grows on further attempts", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("lockout");

    for (let i = 0; i < 5; i++) {
      await authService.login({ email, password: "wrong" }, ctx).catch(() => {});
    }

    const lockedError = await authService
      .login({ email, password: "wrong" }, ctx)
      .catch((e: unknown) => e);
    expect((lockedError as Error).message).toMatch(/locked/i);

    const userAfterFirstLock = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(userAfterFirstLock.status).toBe("locked");
    const firstLockoutMs = userAfterFirstLock.lockedUntil!.getTime() - Date.now();

    // Force the lock to have "expired" so the next wrong attempt is evaluated fresh,
    // then fail again — the resulting lockout must be LONGER than the first (growing
    // delay), even though failedLoginCount only grew by one more failure.
    await prisma.user.update({
      where: { email },
      data: { lockedUntil: new Date(Date.now() - 1000), status: "active" },
    });
    await authService.login({ email, password: "wrong" }, ctx).catch(() => {});

    const userAfterSecondLock = await prisma.user.findUniqueOrThrow({ where: { email } });
    const secondLockoutMs = userAfterSecondLock.lockedUntil!.getTime() - Date.now();
    expect(secondLockoutMs).toBeGreaterThan(firstLockoutMs);
  });

  // Checklist 5: Reset on success.
  it("resets the failure counter and unlocks the account on a successful login", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("reset-on-success");
    await authService.login({ email, password: "wrong" }, ctx).catch(() => {});
    await authService.login({ email, password: "wrong" }, ctx).catch(() => {});

    await authService.login({ email, password: TEST_PASSWORD }, ctx);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.failedLoginCount).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(user.status).toBe("active");
  });

  // Session fixation prevention.
  it("discards the caller's existing session when a new login succeeds", async ({ skip }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("session-fixation");
    const first = await authService.login({ email, password: TEST_PASSWORD }, ctx);

    await authService.login({ email, password: TEST_PASSWORD }, ctx, first.sessionId);

    const firstSession = await prisma.session.findUniqueOrThrow({ where: { id: first.sessionId } });
    expect(firstSession.revokedAt).not.toBeNull();
    expect(firstSession.revokedReason).toBe("superseded_by_new_login");
  });

  // Timing test: unknown vs known (wrong-password) email response times within tolerance.
  it("responds to an unknown email in roughly the same time as a wrong password on a known one", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("timing");

    const SAMPLES = 8;
    const knownTimes: number[] = [];
    const unknownTimes: number[] = [];

    for (let i = 0; i < SAMPLES; i++) {
      const t0 = performance.now();
      await authService.login({ email, password: "wrong-but-plausible" }, ctx).catch(() => {}); // secret-scan-ignore-line
      knownTimes.push(performance.now() - t0);

      const t1 = performance.now();
      await authService
        .login({ email: `${EMAIL_PREFIX}timing-unknown-${i}@example.test`, password: "wrong" }, ctx)
        .catch(() => {});
      unknownTimes.push(performance.now() - t1);
    }

    const median = (xs: number[]): number => {
      const sorted = xs.slice().sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)] ?? 0;
    };
    const knownMedian = median(knownTimes);
    const unknownMedian = median(unknownTimes);

    // Generous tolerance (both must do one argon2id verify each) — this asserts the
    // two paths are the same ORDER of magnitude, not identical to the millisecond;
    // CI/shared hardware is noisy. The property under test is "no instant short-
    // circuit for one path," which a >3x gap would reveal.
    const ratio = Math.max(knownMedian, unknownMedian) / Math.min(knownMedian, unknownMedian);
    expect(ratio).toBeLessThan(3);
  });
});

/**
 * Checklist 1: Input validation (empty/invalid email, empty password) -> 422 with
 * field messages. Needs the real HTTP layer (ZodValidationPipe runs at the
 * controller boundary), not just AuthService — bootstrapped the same minimal way as
 * get-verification-url.integration.spec.ts.
 */
describe("Phase 5: login input validation (real database)", () => {
  let app: INestApplication | null = null;
  let dbReachable = false;

  beforeAll(async () => {
    dbReachable = await isDatabaseReachable();
    if (!dbReachable) return;
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("rejects an empty email with 422", async ({ skip }) => {
    if (!dbReachable || !app) skip();
    const res = await request(app!.getHttpServer())
      .post("/auth/login")
      .send({ email: "", password: "whatever123" }); // secret-scan-ignore-line
    expect(res.status).toBe(422);
    expect(res.body.details?.fieldErrors?.email).toBeTruthy();
  });

  it("rejects an invalid email with 422", async ({ skip }) => {
    if (!dbReachable || !app) skip();
    const res = await request(app!.getHttpServer())
      .post("/auth/login")
      .send({ email: "not-an-email", password: "whatever123" }); // secret-scan-ignore-line
    expect(res.status).toBe(422);
    expect(res.body.details?.fieldErrors?.email).toBeTruthy();
  });

  it("rejects an empty password with 422", async ({ skip }) => {
    if (!dbReachable || !app) skip();
    const res = await request(app!.getHttpServer())
      .post("/auth/login")
      .send({ email: "someone@example.test", password: "" });
    expect(res.status).toBe(422);
    expect(res.body.details?.fieldErrors?.password).toBeTruthy();
  });

  // Checklist 3 / 4: leading/trailing spaces and upper/lowercase are normalized
  // before lookup — a request with un-normalized casing/whitespace for a real
  // account's email must behave identically to the normalized form.
  it("normalizes email case and surrounding whitespace before the credentials lookup", async ({
    skip,
  }) => {
    if (!dbReachable || !app) skip();
    const authService = new AuthService();
    const email = `${EMAIL_PREFIX}normalize@example.test`;
    await authService.signUp({ email, password: TEST_PASSWORD, termsAccepted: true }, ctx);
    await prisma.user.update({ where: { email }, data: { status: "active" } });

    const res = await request(app!.getHttpServer())
      .post("/auth/login")
      .send({ email: `  ${email.toUpperCase()}  `, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    // No tokens in the response body when using cookies.
    expect(res.body).not.toHaveProperty("accessToken");
    expect(res.body).not.toHaveProperty("refreshToken");

    await cleanupTestUsers(EMAIL_PREFIX);
  });
});
