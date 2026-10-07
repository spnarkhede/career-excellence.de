import { hashPassword } from "@saas/security/server";
import { PrismaClient } from "../generated/client/index.js";

// Dev/test-only fixed password for every seeded user — never a real credential, never
// used outside a local/CI database. Documented here rather than generated-and-discarded
// so a developer running `pnpm db:seed` can actually sign in locally with these accounts.
const SEED_USER_PASSWORD = "Seeded-Dev-Password-1"; // secret-scan-ignore-line: fake dev-only fixture, see comment above

/** Seeds the baseline roles/permissions and a handful of generated test users. */
async function main() {
  const prisma = new PrismaClient();

  const permissions = [
    "profile.read.own",
    "profile.update.own",
    "users.read",
    "users.suspend",
    "audit.read",
    "settings.manage",
    "content.manage",
  ];

  for (const name of permissions) {
    await prisma.permission.upsert({ where: { name }, update: {}, create: { name } });
  }

  const rolePermissionMap: Record<string, string[]> = {
    user: ["profile.read.own", "profile.update.own"],
    support: ["profile.read.own", "profile.update.own", "users.read"],
    moderator: ["profile.read.own", "profile.update.own", "users.read", "content.manage"],
    administrator: [
      "profile.read.own",
      "profile.update.own",
      "users.read",
      "users.suspend",
      "audit.read",
      "content.manage",
    ],
    super_administrator: permissions,
  };

  const roleIdByName = {} as Record<keyof typeof rolePermissionMap, string>;

  for (const [roleName, perms] of Object.entries(rolePermissionMap)) {
    const role = await prisma.role.upsert({
      where: { name: roleName as never },
      update: {},
      create: { name: roleName as never },
    });
    roleIdByName[roleName] = role.id;

    for (const permName of perms) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { name: permName } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  // Generated test users — clearly fake, never real identities or credentials.
  // `displayName` is deliberately generic ("Test User N"), not a real person's name.
  const passwordHash = await hashPassword(SEED_USER_PASSWORD);

  const testUsers: Array<{
    email: string;
    role: keyof typeof rolePermissionMap;
    status: "active" | "pending_verification";
  }> = [
    { email: "seed-test-user-1@example.test", role: "user", status: "active" },
    { email: "seed-test-user-2@example.test", role: "user", status: "active" },
    {
      email: "seed-test-user-unverified@example.test",
      role: "user",
      status: "pending_verification",
    },
    { email: "seed-test-support@example.test", role: "support", status: "active" },
    { email: "seed-test-administrator@example.test", role: "administrator", status: "active" },
  ];

  function getRoleId(roleName: keyof typeof rolePermissionMap): string {
    const id = roleIdByName[roleName];
    if (!id) throw new Error(`Role "${roleName}" was not seeded before test users.`);
    return id;
  }

  for (const spec of testUsers) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: {},
      create: {
        email: spec.email,
        passwordHash,
        status: spec.status,
        emailVerifiedAt: spec.status === "active" ? new Date() : null,
        profile: { create: { displayName: spec.email.split("@")[0] } },
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: getRoleId(spec.role) } },
      update: {},
      create: { userId: user.id, roleId: getRoleId(spec.role) },
    });
  }

  console.log(`Seeded ${testUsers.length} test users. Dev-only password: ${SEED_USER_PASSWORD}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
