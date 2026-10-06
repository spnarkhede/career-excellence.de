import { Injectable, UnauthorizedException } from "@nestjs/common";
import { prisma } from "@saas/database";
import type { AuthenticatedPrincipal, PermissionName, RoleName } from "@saas/types";

@Injectable()
export class PrincipalService {
  async resolve(userId: string, sessionId: string): Promise<AuthenticatedPrincipal> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === "suspended" || user.status === "deleted") {
      throw new UnauthorizedException("Account is not active.");
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
