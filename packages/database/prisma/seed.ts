import { PrismaClient } from "../generated/client/index.js";

/** Seeds the baseline roles and permissions required by the authorization system. */
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

  for (const [roleName, perms] of Object.entries(rolePermissionMap)) {
    const role = await prisma.role.upsert({
      where: { name: roleName as never },
      update: {},
      create: { name: roleName as never },
    });

    for (const permName of perms) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { name: permName } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
