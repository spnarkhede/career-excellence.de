import { SetMetadata } from "@nestjs/common";
import type { PermissionName } from "@saas/types";

export const REQUIRE_PERMISSION_KEY = "requirePermission";

/**
 * Declarative counterpart to `assertPermission` — attaches the required
 * permission as route metadata, which `PermissionsGuard` reads and enforces.
 * Prefer this over an inline `assertPermission` call in new handlers so a
 * route's required permission is visible at a glance (and discoverable by
 * the route-matrix test, which reads this same metadata) rather than buried
 * in a function body. `assertPermission` remains available for object-level
 * checks that need to run in the middle of a handler, after loading some
 * specific row.
 */
export const RequirePermission = (permission: PermissionName) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
