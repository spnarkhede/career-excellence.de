import type { AuthenticatedPrincipal, PermissionName } from "@saas/types";

/**
 * Centralized permission check. Never branch authorization logic on role name
 * directly (e.g. `if role === "administrator"`); always check a permission.
 */
export function can(principal: AuthenticatedPrincipal, permission: PermissionName): boolean {
  return principal.permissions.includes(permission);
}

/** Checks permission AND that the principal owns the resource, or holds an elevated permission. */
export function canAccessOwnResource(
  principal: AuthenticatedPrincipal,
  resourceOwnerId: string,
  ownPermission: PermissionName,
  elevatedPermission?: PermissionName,
): boolean {
  if (principal.user.id === resourceOwnerId && can(principal, ownPermission)) return true;
  if (elevatedPermission && can(principal, elevatedPermission)) return true;
  return false;
}

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Throws ForbiddenError unless the principal holds the required permission. */
export function assertPermission(
  principal: AuthenticatedPrincipal,
  permission: PermissionName,
): void {
  if (!can(principal, permission)) {
    throw new ForbiddenError();
  }
}
