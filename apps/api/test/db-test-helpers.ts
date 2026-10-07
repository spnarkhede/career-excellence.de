import { prisma } from "@saas/database";

/**
 * Integration tests in this folder need a real Postgres connection (DATABASE_URL) with
 * the Phase 3 migrations applied — they exercise real constraints, RLS policies, and
 * transaction behavior that cannot be meaningfully faked with a mock. CI provisions a
 * real Postgres service container and runs migrations before tests (see
 * .github/workflows/ci.yml), so these run for real there. Locally, without a reachable
 * database, this check lets each test skip itself cleanly at runtime instead of
 * hanging or crashing with an unhelpful connection error.
 *
 * Checked once in each spec file's `beforeAll` into a `dbReachable` flag, then read by
 * every `it` (`if (!dbReachable) skip();`) — not a single top-level `await
 * describe.runIf(...)` at the top of the file, because apps/api's tsconfig targets
 * CommonJS (required for NestJS decorators), which `tsc --noEmit` rejects top-level
 * await under.
 */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/** Deletes everything these tests create, in FK-safe order. Never drops seed roles/permissions. */
export async function cleanupTestUsers(emailPrefix: string): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: emailPrefix } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.oneTimeToken.deleteMany({ where: { userId: { in: ids } } });
  await prisma.oauthAccount.deleteMany({ where: { userId: { in: ids } } });
  await prisma.authEvent.deleteMany({ where: { userId: { in: ids } } });
  await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
  await prisma.profile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
