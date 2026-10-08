import { prisma } from "@saas/database";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { signUpSchema } from "@saas/validation";
import { AuthService } from "../src/auth/auth.service.js";
import { cleanupTestUsers, isDatabaseReachable } from "./db-test-helpers.js";

/** Phase 14 task 3: "signup records acceptance of the current terms
 * version and timestamp." */
describe("signUpSchema requires an explicit terms acceptance", () => {
  const validBase = { email: "a@example.com", password: "a-strong-password-123" }; // secret-scan-ignore-line: fake fixture

  it("rejects a signup with termsAccepted missing entirely", () => {
    expect(signUpSchema.safeParse(validBase).success).toBe(false);
  });

  it("rejects a signup with termsAccepted explicitly false", () => {
    expect(signUpSchema.safeParse({ ...validBase, termsAccepted: false }).success).toBe(false);
  });

  it("accepts a signup with termsAccepted true", () => {
    const result = signUpSchema.safeParse({ ...validBase, termsAccepted: true });
    expect(result.success).toBe(true);
  });
});

const EMAIL_PREFIX = "phase14-terms-";
const ctx = { ipAddress: "203.0.113.60", userAgent: "vitest", requestId: "test-request" };

describe("signUp() records a Consent row with the current terms version and a timestamp", () => {
  const authService = new AuthService();
  let dbReachable = false;

  beforeAll(async () => {
    dbReachable = await isDatabaseReachable();
  });

  afterAll(async () => {
    if (dbReachable) await cleanupTestUsers(EMAIL_PREFIX);
  });

  it("creates exactly one 'terms' Consent row at signup, versioned and timestamped", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = `${EMAIL_PREFIX}accept@example.test`;
    await authService.signUp(
      { email, password: "a-strong-password-123", termsAccepted: true }, // secret-scan-ignore-line: fake fixture
      ctx,
    );

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const consents = await prisma.consent.findMany({ where: { userId: user.id, type: "terms" } });

    expect(consents).toHaveLength(1);
    expect(consents[0]?.version).toBe("1");
    expect(consents[0]?.acceptedAt).toBeInstanceOf(Date);
  });
});
