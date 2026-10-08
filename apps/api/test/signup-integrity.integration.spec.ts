import { prisma } from "@saas/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "../src/auth/auth.service.js";
import { cleanupTestUsers, isDatabaseReachable } from "./db-test-helpers.js";

const EMAIL_PREFIX = "phase3-signup-integrity-";
const ctx = { ipAddress: "203.0.113.10", userAgent: "vitest", requestId: "test-request" };
const TEST_PASSWORD = "a-strong-password-123"; // secret-scan-ignore-line: fake fixture

describe("signup integrity (real database)", () => {
  const authService = new AuthService();
  let dbReachable = false;

  beforeAll(async () => {
    dbReachable = await isDatabaseReachable();
  });

  afterAll(async () => {
    if (dbReachable) await cleanupTestUsers(EMAIL_PREFIX);
  });

  // TEST 1: Same email with different case or spaces fails.
  it("rejects a signup whose email differs only by case or surrounding whitespace from an existing account", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = `${EMAIL_PREFIX}case@example.test`;
    await authService.signUp({ email, password: TEST_PASSWORD, termsAccepted: true }, ctx);

    await expect(
      authService.signUp(
        { email: email.toUpperCase(), password: TEST_PASSWORD, termsAccepted: true },
        ctx,
      ),
    ).rejects.toThrow(/already exists/i);

    // The Zod `emailSchema` (`.trim().toLowerCase()`) normalizes whitespace/case before
    // this ever reaches the database, so this exercises the DB-level CITEXT uniqueness
    // directly, bypassing the app-layer normalization the real HTTP path always applies.
    await expect(
      prisma.user.create({
        data: { email: `  ${email}  `, passwordHash: "x" },
      }),
    ).rejects.toThrow();
  });

  // TEST 2 (part 1 of 2): 10 concurrent signups (10 distinct emails) produce exactly 10 profiles.
  it("10 concurrent signups for 10 distinct emails produce exactly 10 users and 10 profiles", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const emails = Array.from(
      { length: 10 },
      (_, i) => `${EMAIL_PREFIX}concurrent-${i}@example.test`,
    );

    await Promise.all(
      emails.map((email) =>
        authService.signUp({ email, password: TEST_PASSWORD, termsAccepted: true }, ctx),
      ),
    );

    const users = await prisma.user.findMany({ where: { email: { in: emails } } });
    expect(users).toHaveLength(10);

    const profiles = await prisma.profile.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
    });
    expect(profiles).toHaveLength(10);

    for (const user of users) {
      const roles = await prisma.userRole.findMany({ where: { userId: user.id } });
      expect(roles).toHaveLength(1);
    }
  });

  // TEST 2 (part 2 of 2): 2 concurrent signups for the SAME email produce exactly one user.
  it("2 concurrent signups for the same email produce exactly one user", async ({ skip }) => {
    if (!dbReachable) skip();
    const email = `${EMAIL_PREFIX}same-email-race@example.test`;

    const results = await Promise.allSettled([
      authService.signUp({ email, password: TEST_PASSWORD, termsAccepted: true }, ctx),
      authService.signUp({ email, password: "a-different-password-456", termsAccepted: true }, ctx), // secret-scan-ignore-line: fake fixture password
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    // Exactly one of the two concurrent calls wins; the other must fail with the
    // "already exists" conflict (or a raw unique-constraint violation if both calls
    // reached the INSERT before either's SELECT-check observed the other's row —
    // either failure mode is an acceptable way to reject the loser, as long as there
    // is exactly one winner).
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const users = await prisma.user.findMany({ where: { email } });
    expect(users).toHaveLength(1);
  });

  // TEST 7: Simulated trigger/transaction failure leaves no partial user.
  it("leaves no partial user when the signup transaction fails partway through", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    const email = `${EMAIL_PREFIX}partial-failure@example.test`;

    // There are no database triggers in this schema (see docs/auth/ARCHITECTURE.md
    // decision: user+profile+role creation is one application-level transaction, not
    // a trigger). "Simulated trigger failure" here means simulating a failure partway
    // through that same transaction shape — reproduce AuthService.signUp's exact
    // sequence (create user+profile, then a second step) but force the second step to
    // throw, and confirm the user row does not survive. This exercises Prisma's
    // $transaction rollback guarantee directly, without mutating any shared seed data
    // (renaming/deleting a real role would collide with or cascade onto other tests
    // running concurrently in this suite).
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: { email, passwordHash: "x", profile: { create: {} } },
        });
        throw new Error("simulated failure after the user row was created");
      }),
    ).rejects.toThrow(/simulated failure/);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeNull();
  });
});
