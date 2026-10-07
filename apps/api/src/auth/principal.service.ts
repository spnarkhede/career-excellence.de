import { Injectable, UnauthorizedException } from "@nestjs/common";
import { prisma } from "@saas/database";
import type { AuthenticatedPrincipal, PermissionName, RoleName } from "@saas/types";

@Injectable()
export class PrincipalService {
  async resolve(userId: string, sessionId: string): Promise<AuthenticatedPrincipal> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt || user.status === "disabled" || user.status === "deleted") {
      throw new UnauthorizedException("Account is not active.");
    }
    if (user.status === "locked" && user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException("Account is not active.");
    }

    // Self-healing guard against an orphaned user (e.g. a profile row lost to a bug
    // predating the transactional signUp in AuthService, or any other out-of-band
    // write that created a user without one). A plain SELECT first, rather than an
    // unconditional upsert, so the common case (profile already exists) costs one
    // read and no write on every authenticated request. The rare race between two
    // concurrent requests for the same newly-orphaned user is handled by `create`'s
    // unique `userId` PK violation, swallowed below — idempotent either way.
    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      await prisma.profile.create({ data: { userId } }).catch((err: { code?: string }) => {
        if (err.code !== "P2002") throw err; // P2002 = unique constraint — lost the race, fine.
      });
    }

    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    const roles = userRoles.map((ur) => ur.role.name as RoleName);
    const permissions = Array.from(
      new Set(
        userRoles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.name as PermissionName),
        ),
      ),
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      roles,
      permissions,
      sessionId,
    };
  }
}
