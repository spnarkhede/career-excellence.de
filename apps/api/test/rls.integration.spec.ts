import { prisma } from "@saas/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "../src/auth/auth.service.js";
import { cleanupTestUsers, isDatabaseReachable } from "./db-test-helpers.js";

const EMAIL_PREFIX = "phase3-rls-";
const ctx = { ipAddress: "203.0.113.12", userAgent: "vitest", requestId: "test-request" };
const TEST_PASSWORD = "a-strong-password-123"; // secret-scan-ignore-line: fake fixture

/**
 * These tests exercise the real Postgres roles/policies created in the Phase 3
 * migration (00000000000001_phase3_auth_tables/migration.sql), not application-layer
 * authorization. The connection Prisma uses (DATABASE_URL's role) is the schema owner
 * and therefore normally bypasses RLS — `SET LOCAL ROLE` inside a transaction switches
 * the *effective* role for the rest of that transaction only (reset automatically when
 * the transaction ends), which is how a superuser/owner connection can still exercise
 * RLS as a non-privileged role without a second physical connection. Requires the
 * `app_anon`/`app_authenticated` roles to exist — i.e. this migration to be applied.
 */
describe("row-level security (real database)", () => {
  let dbReachable = false;
  let userAId = "";
  let userBId = "";

  beforeAll(async () => {
    dbReachable = await isDatabaseReachable();
    if (!dbReachable) return;

    const authService = new AuthService();
    const a = await authService.signUp(
      { email: `${EMAIL_PREFIX}user-a@example.test`, password: TEST_PASSWORD },
      ctx,
    );
    const b = await authService.signUp(
      { email: `${EMAIL_PREFIX}user-b@example.test`, password: TEST_PASSWORD },
      ctx,
    );
    userAId = a.id;
    userBId = b.id;
  });

  afterAll(async () => {
    if (dbReachable) await cleanupTestUsers(EMAIL_PREFIX);
  });

  // TEST 3: User A cannot select, insert, update, or delete User B's rows.
  it("user A's effective role selects only its own users/profiles row, never user B's", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE app_authenticated`);
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userAId}, true)`;

      const ownUser = await tx.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "users" WHERE "id" = ${userAId}`;
      const otherUser = await tx.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "users" WHERE "id" = ${userBId}`;
      expect(ownUser).toHaveLength(1);
      expect(otherUser).toHaveLength(0);

      const ownProfile = await tx.$queryRaw<
        { userId: string }[]
      >`SELECT "userId" FROM "profiles" WHERE "userId" = ${userAId}`;
      const otherProfile = await tx.$queryRaw<
        { userId: string }[]
      >`SELECT "userId" FROM "profiles" WHERE "userId" = ${userBId}`;
      expect(ownProfile).toHaveLength(1);
      expect(otherProfile).toHaveLength(0);
    });
  });

  it("user A cannot update user B's profile row even by primary key (RLS filters the UPDATE's own match)", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE app_authenticated`);
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userAId}, true)`;

      // RLS makes user B's row invisible to this UPDATE's own WHERE match — the
      // statement succeeds (it is a syntactically valid UPDATE) but affects 0 rows.
      const affected =
        await tx.$executeRaw`UPDATE "profiles" SET "displayName" = 'hijacked' WHERE "userId" = ${userBId}`;
      expect(affected).toBe(0);
    });

    const bProfile = await prisma.profile.findUniqueOrThrow({ where: { userId: userBId } });
    expect(bProfile.displayName).not.toBe("hijacked");
  });

  it("user A cannot insert or delete rows in users at all (no INSERT/DELETE grant for app_authenticated)", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE app_authenticated`);
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userAId}, true)`;
        await tx.$executeRaw`DELETE FROM "users" WHERE "id" = ${userBId}`;
      }),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE app_authenticated`);
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userAId}, true)`;
        await tx.$executeRaw`INSERT INTO "users" ("id", "email") VALUES ('forged-id', 'forged@example.test')`;
      }),
    ).rejects.toThrow(/permission denied/i);
  });

  // TEST 4: Anonymous client reads nothing from auth tables.
  it("the anonymous role has no access to any auth table — not users, profiles, sessions, or roles", async ({
    skip,
  }) => {
    if (!dbReachable) skip();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE app_anon`);
        return tx.$queryRaw`SELECT "id" FROM "users" LIMIT 1`;
      }),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE app_anon`);
        return tx.$queryRaw`SELECT "id" FROM "profiles" LIMIT 1`;
      }),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE app_anon`);
        return tx.$queryRaw`SELECT "id" FROM "sessions" LIMIT 1`;
      }),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE app_anon`);
        return tx.$queryRaw`SELECT "id" FROM "roles" LIMIT 1`;
      }),
    ).rejects.toThrow(/permission denied/i);
  });
});
