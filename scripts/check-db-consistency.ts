// Finds orphaned users, users without roles, duplicate profiles, and dangling sessions.
// Exits non-zero (and prints the offending ids) if anything is found — never prints
// passwords/tokens/hashes, only ids and counts. Safe to run repeatedly; read-only.
// Relative import, not the `@saas/database` package specifier — this script lives at
// the repo root, outside every workspace package, matching the existing convention in
// scripts/check-bundle-for-secrets.ts (relative imports into packages/*/src avoid
// needing every root-level script's target package declared as a root dependency).
import { prisma } from "../packages/database/src/index";

export interface ConsistencyReport {
  orphanedUsers: string[]; // users with no profile row
  usersWithoutRoles: string[]; // users with zero userRole rows
  duplicateProfileUserIds: string[]; // userIds appearing more than once in profiles
  danglingSessions: string[]; // sessions whose userId no longer exists in users
}

/** Pure check against whatever Prisma client is passed — the production client in the
 * CLI below, or a per-test client in check-db-consistency.spec.ts. */
export async function checkConsistency(
  client: Pick<typeof prisma, "user" | "profile" | "userRole" | "session" | "$queryRaw">,
): Promise<ConsistencyReport> {
  const [orphanedUsers, usersWithoutRoles, duplicateProfileRows, danglingSessionRows] =
    await Promise.all([
      client.$queryRaw<{ id: string }[]>`
        SELECT u."id" FROM "users" u
        LEFT JOIN "profiles" p ON p."userId" = u."id"
        WHERE p."userId" IS NULL
      `,
      client.$queryRaw<{ id: string }[]>`
        SELECT u."id" FROM "users" u
        LEFT JOIN "user_roles" ur ON ur."userId" = u."id"
        WHERE ur."userId" IS NULL
      `,
      // Always structurally impossible (profiles.userId is the primary key), but kept
      // as a defensive, DB-truth check per this phase's explicit checklist item rather
      // than assuming the schema constraint can never be bypassed (e.g. by a future
      // migration that relaxes it without updating this script).
      client.$queryRaw<{ userid: string; cnt: bigint }[]>`
        SELECT "userId" as userid, COUNT(*) as cnt FROM "profiles"
        GROUP BY "userId" HAVING COUNT(*) > 1
      `,
      client.$queryRaw<{ id: string }[]>`
        SELECT s."id" FROM "sessions" s
        LEFT JOIN "users" u ON u."id" = s."userId"
        WHERE u."id" IS NULL
      `,
    ]);

  return {
    orphanedUsers: orphanedUsers.map((r) => r.id),
    usersWithoutRoles: usersWithoutRoles.map((r) => r.id),
    duplicateProfileUserIds: duplicateProfileRows.map((r) => r.userid),
    danglingSessions: danglingSessionRows.map((r) => r.id),
  };
}

export function isClean(report: ConsistencyReport): boolean {
  return (
    report.orphanedUsers.length === 0 &&
    report.usersWithoutRoles.length === 0 &&
    report.duplicateProfileUserIds.length === 0 &&
    report.danglingSessions.length === 0
  );
}

async function main() {
  const report = await checkConsistency(prisma);
  const clean = isClean(report);

  console.log("Database consistency check:");
  console.log(`  Orphaned users (no profile):     ${report.orphanedUsers.length}`);
  console.log(`  Users without roles:              ${report.usersWithoutRoles.length}`);
  console.log(`  Duplicate profile userIds:        ${report.duplicateProfileUserIds.length}`);
  console.log(`  Dangling sessions (no such user): ${report.danglingSessions.length}`);

  if (!clean) {
    console.error("\nConsistency problems found:");
    if (report.orphanedUsers.length) console.error("  orphanedUsers:", report.orphanedUsers);
    if (report.usersWithoutRoles.length)
      console.error("  usersWithoutRoles:", report.usersWithoutRoles);
    if (report.duplicateProfileUserIds.length)
      console.error("  duplicateProfileUserIds:", report.duplicateProfileUserIds);
    if (report.danglingSessions.length)
      console.error("  danglingSessions:", report.danglingSessions);
    process.exit(1);
  }

  console.log("\nNo consistency problems found.");
}

if (process.argv[1]?.endsWith("check-db-consistency.ts")) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
