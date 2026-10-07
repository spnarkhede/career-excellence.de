import type { Request } from "express";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { assertPermission } from "@saas/authorization";
import { REQUIRE_PERMISSION_KEY } from "./require-permission.decorator.js";

/**
 * Enforces whatever permission `@RequirePermission(...)` attached to the
 * route. Must run AFTER `SessionGuard` (which resolves and attaches
 * `request.principal`) — a route with `@RequirePermission` but no
 * `SessionGuard` ahead of it has no principal to check, which this guard
 * itself does not try to paper over (it would throw on `request.principal`
 * being undefined, which is the correct failure mode: a route wired wrong
 * should break loudly in testing, not silently allow everyone through).
 *
 * This is the declarative half of the "requirePermission(name)" helper the
 * checklist calls for — `assertPermission` (called manually inside a
 * handler) is the other half, used where the check depends on a specific
 * loaded row rather than being a blanket per-route requirement.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.get<string | undefined>(
      REQUIRE_PERMISSION_KEY,
      context.getHandler(),
    );
    if (!permission) return true; // no @RequirePermission on this route — nothing to enforce

    const request = context.switchToHttp().getRequest<Request>();
    assertPermission(request.principal!, permission as never);
    return true;
  }
}
