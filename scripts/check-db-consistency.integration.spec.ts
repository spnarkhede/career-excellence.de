import { describe, expect, it } from "vitest";
import { prisma } from "../packages/database/src/index";
import { checkConsistency, isClean } from "./check-db-consistency";

async function isDatabaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// TEST 8: Consistency script reports zero problems on seeded data.
// Relies on CI's existing "Seed database" step (pnpm db:seed) having already run
// against this same database before this test file executes — see .github/workflows/ci.yml.
describe.runIf(await isDatabaseReachable())("check-db-consistency against seeded data", () => {
  it("reports zero orphaned users, zero users without roles, zero duplicate profiles, zero dangling sessions", async () => {
    const seededUsers = await prisma.user.count({
      where: { email: { endsWith: "@example.test" } },
    });
    // If this is 0, the seed step did not run before this test — fail loudly rather
    // than passing vacuously on an empty database.
    expect(seededUsers).toBeGreaterThan(0);

    const report = await checkConsistency(prisma);
    expect(isClean(report)).toBe(true);
  });
});
