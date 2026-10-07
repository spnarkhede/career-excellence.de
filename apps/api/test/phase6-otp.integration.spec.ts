import { prisma } from "@saas/database";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthService } from "../src/auth/auth.service.js";
import { cleanupTestUsers, isDatabaseReachable } from "./db-test-helpers.js";

const EMAIL_PREFIX = "phase6-otp-";
const ctx = { ipAddress: "203.0.113.40", userAgent: "vitest", requestId: "test-request" };
const TEST_PASSWORD = "a-strong-password-123"; // secret-scan-ignore-line: fake fixture

async function createActiveUser(suffix: string): Promise<string> {
  const authService = new AuthService();
  const email = `${EMAIL_PREFIX}${suffix}@example.test`;
  await authService.signUp({ email, password: TEST_PASSWORD }, ctx);
  await prisma.user.update({ where: { email }, data: { status: "active" } });
  return email;
}

/** Captures the raw OTP code the way a real test would scrape it from a local mail
 * catcher — AuthService has no method that returns it, by design. */
async function captureNextOtpCode(trigger: () => Promise<void>): Promise<string> {
  const emailModule = await import("@saas/email");
  const sendSpy = vi.spyOn(emailModule.StubEmailProvider.prototype, "send");
  await trigger();
  const call = sendSpy.mock.calls.at(-1)?.[0] as { html: string } | undefined;
  sendSpy.mockRestore();
  const match = call?.html.match(/(\d{6})/);
  const code = match?.[1];
  if (!code) throw new Error("expected a 6-digit code in the sent email");
  return code;
}

describe("Phase 6: OTP authentication (real database)", () => {
  const authService = new AuthService();
  let dbReachable = false;

  beforeAll(async () => {
    dbReachable = await isDatabaseReachable();
  });

  afterAll(async () => {
    if (dbReachable) await cleanupTestUsers(EMAIL_PREFIX);
  });

  // Checklist 1/2: OTP authentication, generation and hashing.
  it("issues a 6-digit code, stores only its hash, and a correct code creates a session", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("happy-path");
    const code = await captureNextOtpCode(() => authService.requestOtp({ email }, ctx));
    expect(code).toMatch(/^\d{6}$/);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const record = await prisma.oneTimeToken.findFirstOrThrow({
      where: { userId: user.id, purpose: "otp" },
      orderBy: { createdAt: "desc" },
    });
    // No raw code in the database — only a 64-hex-char SHA-256 hash, structurally
    // distinct from the 6-digit code itself.
    expect(record.tokenHash).not.toBe(code);
    expect(record.tokenHash).not.toContain(code);
    expect(record.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    const result = await authService.verifyOtp({ email, code }, ctx);
    expect(result.accessToken).toBeTruthy();
    expect(result.userId).toBe(user.id);
  });

  // Checklist 3 / "Expired code" test.
  it("rejects an expired code without consuming it", async ({ skip }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("expired");
    const code = await captureNextOtpCode(() => authService.requestOtp({ email }, ctx));
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.oneTimeToken.updateMany({
      where: { userId: user.id, purpose: "otp", usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(authService.verifyOtp({ email, code }, ctx)).rejects.toThrow(
      /invalid or expired/i,
    );
  });

  // Checklist 4 / "Wrong code until lockout" test.
  it("locks out after the attempt limit, then rejects even the correct code", async ({ skip }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("lockout");
    const code = await captureNextOtpCode(() => authService.requestOtp({ email }, ctx));

    for (let i = 0; i < 5; i++) {
      await expect(authService.verifyOtp({ email, code: "000000" }, ctx)).rejects.toThrow(
        /invalid or expired/i,
      );
    }

    // The attempt limit (5) has now been reached — even the CORRECT code is
    // rejected, because the code itself (not just this guess) is spent.
    await expect(authService.verifyOtp({ email, code }, ctx)).rejects.toThrow(
      /invalid or expired/i,
    );
  });

  // Checklist 7 / "Replayed code" test.
  it("rejects reusing an already-consumed code", async ({ skip }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("replay");
    const code = await captureNextOtpCode(() => authService.requestOtp({ email }, ctx));

    await authService.verifyOtp({ email, code }, ctx); // first use succeeds
    await expect(authService.verifyOtp({ email, code }, ctx)).rejects.toThrow(
      /invalid or expired/i,
    ); // replay rejected
  });

  // "Concurrent use of one code (exactly one succeeds)" test.
  it("lets exactly one of two concurrent verifications with the same code succeed", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("concurrent");
    const code = await captureNextOtpCode(() => authService.requestOtp({ email }, ctx));

    const results = await Promise.allSettled([
      authService.verifyOtp({ email, code }, ctx),
      authService.verifyOtp({ email, code }, ctx),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  // Checklist 5: OTP resend invalidates the previous code.
  it("resend invalidates the previous code and respects the cooldown", async ({ skip }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("resend");
    const firstCode = await captureNextOtpCode(() => authService.requestOtp({ email }, ctx));
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    // Immediately requesting again, within the cooldown, must be a no-op (same
    // response either way) — back-date the first token's createdAt to clear it.
    await prisma.oneTimeToken.updateMany({
      where: { userId: user.id, purpose: "otp" },
      data: { createdAt: new Date(Date.now() - 60_000) },
    });

    const secondCode = await captureNextOtpCode(() => authService.requestOtp({ email }, ctx));
    expect(secondCode).not.toBe(firstCode);

    // The first code is now invalid, even though it was never used or expired.
    await expect(authService.verifyOtp({ email, code: firstCode }, ctx)).rejects.toThrow(
      /invalid or expired/i,
    );
    // The second (current) code still works.
    await expect(authService.verifyOtp({ email, code: secondCode }, ctx)).resolves.toBeTruthy();
  });

  it("respects the resend cooldown by returning the same response without sending a new code", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("cooldown");
    await authService.requestOtp({ email }, ctx);

    const emailModule = await import("@saas/email");
    const sendSpy = vi.spyOn(emailModule.StubEmailProvider.prototype, "send");
    await authService.requestOtp({ email }, ctx); // immediately again, within cooldown
    expect(sendSpy).not.toHaveBeenCalled();
    sendSpy.mockRestore();
  });

  // Checklist 6 / "Enumeration safe responses" test.
  it("gives the same response (void, no throw) for a known and an unknown email on request", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("enum-request");
    await expect(authService.requestOtp({ email }, ctx)).resolves.toBeUndefined();
    await expect(
      authService.requestOtp({ email: `${EMAIL_PREFIX}never-existed@example.test` }, ctx),
    ).resolves.toBeUndefined();
  });

  it("gives the identical error message for a known email with a wrong code and an unknown email", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = await createActiveUser("enum-verify");
    await authService.requestOtp({ email }, ctx);

    const knownError = await authService
      .verifyOtp({ email, code: "000000" }, ctx)
      .catch((e: unknown) => e);
    const unknownError = await authService
      .verifyOtp({ email: `${EMAIL_PREFIX}never-existed@example.test`, code: "000000" }, ctx)
      .catch((e: unknown) => e);

    expect((knownError as Error).message).toBe((unknownError as Error).message);
  });

  // Magic link: same shape of guarantees (atomic consume, invalidate-on-resend,
  // enumeration-safe), using a 32-byte token instead of a 6-digit code.
  describe("magic link", () => {
    async function captureNextMagicLinkToken(trigger: () => Promise<void>): Promise<string> {
      const emailModule = await import("@saas/email");
      const sendSpy = vi.spyOn(emailModule.StubEmailProvider.prototype, "send");
      await trigger();
      const call = sendSpy.mock.calls.at(-1)?.[0] as { html: string } | undefined;
      sendSpy.mockRestore();
      const match = call?.html.match(/token=([^"&]+)/);
      const token = match?.[1];
      if (!token) throw new Error("expected a magic-link URL with a token in the sent email");
      return decodeURIComponent(token);
    }

    it("verifies a valid magic-link token and rejects it on replay", async ({ skip }) => {
      if (!dbReachable) skip();
      const email = await createActiveUser("magic-link");
      const token = await captureNextMagicLinkToken(() =>
        authService.requestMagicLink({ email }, ctx),
      );

      const result = await authService.verifyMagicLink({ token }, ctx);
      expect(result.accessToken).toBeTruthy();

      await expect(authService.verifyMagicLink({ token }, ctx)).rejects.toThrow(
        /invalid or has already been used/i,
      );
    });

    it("lets exactly one of two concurrent verifications with the same magic-link token succeed", async ({
      skip,
    }) => {
      if (!dbReachable) skip();
      const email = await createActiveUser("magic-link-concurrent");
      const token = await captureNextMagicLinkToken(() =>
        authService.requestMagicLink({ email }, ctx),
      );

      const results = await Promise.allSettled([
        authService.verifyMagicLink({ token }, ctx),
        authService.verifyMagicLink({ token }, ctx),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    });

    it("rejects an unrecognized magic-link token the same way as an expired one", async ({
      skip,
    }) => {
      if (!dbReachable) skip();
      await expect(
        authService.verifyMagicLink({ token: "not-a-real-token" }, ctx), // secret-scan-ignore-line
      ).rejects.toThrow(/invalid or has already been used/i);
    });
  });
});
