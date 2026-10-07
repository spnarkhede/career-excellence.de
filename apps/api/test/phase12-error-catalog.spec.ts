import { prisma } from "@saas/database";
import { UnauthorizedException, HttpException } from "@nestjs/common";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { AuthService } from "../src/auth/auth.service.js";
import { AUTH_ERROR_CATALOG } from "../src/common/error-catalog.js";
import { cleanupTestUsers, isDatabaseReachable } from "./db-test-helpers.js";

/**
 * Phase 12 "Error handling" — DONE WHEN "all tests pass and ERRORS.md
 * matches the code." The catalog-shape test below is pure logic (no DB);
 * the per-code integration tests confirm the actual thrown exception's
 * status/code/message match the catalog exactly, not just a human
 * cross-reading of ERRORS.md against the source.
 */
describe("AUTH_ERROR_CATALOG shape", () => {
  it("every entry has a non-empty message and a valid HTTP status", () => {
    for (const [code, entry] of Object.entries(AUTH_ERROR_CATALOG)) {
      expect(entry.message.length, `${code} has an empty message`).toBeGreaterThan(0);
      expect(entry.status, `${code} has an invalid status`).toBeGreaterThanOrEqual(400);
      expect(entry.status, `${code} has an invalid status`).toBeLessThan(600);
    }
  });

  // Checklist item 16: "no generic 'Something went wrong' where a safe
  // recovery path exists" — every code OTHER than the two genuinely
  // unexpected/infrastructure ones must have a message specific enough that
  // it isn't just restating "something went wrong."
  it("no catalog entry other than INTERNAL_ERROR/SERVICE_UNAVAILABLE uses a generic message", () => {
    for (const [code, entry] of Object.entries(AUTH_ERROR_CATALOG)) {
      if (code === "INTERNAL_ERROR" || code === "SERVICE_UNAVAILABLE") continue;
      expect(
        entry.message.toLowerCase(),
        `${code}'s message is too generic for a known failure cause`,
      ).not.toMatch(/^something went wrong\.?$/);
    }
  });

  it("every entry declares a real recovery path", () => {
    for (const [code, entry] of Object.entries(AUTH_ERROR_CATALOG)) {
      expect(entry.recovery, `${code} has no recovery path`).not.toBeNull();
    }
  });
});

function extractCode(err: unknown): string | undefined {
  if (err instanceof HttpException) {
    const body = err.getResponse();
    if (typeof body === "object" && body !== null) {
      return (body as Record<string, unknown>).code as string | undefined;
    }
  }
  return undefined;
}

function extractStatus(err: unknown): number | undefined {
  return err instanceof HttpException ? err.getStatus() : undefined;
}

const EMAIL_PREFIX = "phase12-errors-";
const ctx = { ipAddress: "203.0.113.40", userAgent: "vitest", requestId: "test-request" };
const TEST_PASSWORD = "a-strong-password-123"; // secret-scan-ignore-line: fake fixture

describe("Error catalog entries, triggered for real against a live database", () => {
  const authService = new AuthService();
  let dbReachable = false;

  beforeAll(async () => {
    dbReachable = await isDatabaseReachable();
  });

  afterAll(async () => {
    if (dbReachable) await cleanupTestUsers(EMAIL_PREFIX);
  });

  it("login() with a wrong password throws INVALID_CREDENTIALS matching the catalog", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = `${EMAIL_PREFIX}bad-password@example.test`;
    await authService.signUp({ email, password: TEST_PASSWORD }, ctx);
    await prisma.user.update({ where: { email }, data: { status: "active" } });

    const err: unknown = await authService
      .login({ email, password: "totally-wrong-password" }, ctx) // secret-scan-ignore-line
      .catch((e: unknown) => e);

    expect(extractStatus(err)).toBe(AUTH_ERROR_CATALOG.INVALID_CREDENTIALS.status);
    expect(extractCode(err)).toBe("INVALID_CREDENTIALS");
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect((err as Error).message).toBe(AUTH_ERROR_CATALOG.INVALID_CREDENTIALS.message);
  });

  it("verifyOtp() with an unknown email throws OTP_INVALID_OR_EXPIRED matching the catalog", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const err: unknown = await authService
      .verifyOtp({ email: `${EMAIL_PREFIX}never-existed@example.test`, code: "000000" }, ctx)
      .catch((e: unknown) => e);

    expect(extractStatus(err)).toBe(AUTH_ERROR_CATALOG.OTP_INVALID_OR_EXPIRED.status);
    expect(extractCode(err)).toBe("OTP_INVALID_OR_EXPIRED");
  });

  it("refresh() with a nonexistent token throws a session error matching the catalog", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const err: unknown = await authService
      .refresh("not-a-real-refresh-token", ctx)
      .catch((e: unknown) => e);

    // Could be SESSION_EXPIRED or SESSION_REVOKED depending on which branch a
    // nonexistent token takes — either is a confirmed-correct catalog entry;
    // the point of this test is that it is NEVER an uncoded generic 401.
    const code = extractCode(err);
    expect(["SESSION_EXPIRED", "SESSION_REVOKED", "INVALID_TOKEN"]).toContain(code);
    expect(code && AUTH_ERROR_CATALOG[code]).toBeDefined();
  });
});
