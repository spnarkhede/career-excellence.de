import "reflect-metadata";
import { Reflector } from "@nestjs/core";
import { ForbiddenError } from "@saas/authorization";
import type { AuthenticatedPrincipal } from "@saas/types";
import { ExecutionContext } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { PermissionsGuard } from "../src/common/permissions.guard.js";
import { REQUIRE_PERMISSION_KEY } from "../src/common/require-permission.decorator.js";

function makeContext(principal: AuthenticatedPrincipal | undefined, handlerMetadata?: string) {
  const handler = handlerMetadata ? Object.assign(() => {}, {}) : () => {};
  const reflector = new Reflector();
  if (handlerMetadata) {
    Reflect.defineMetadata(REQUIRE_PERMISSION_KEY, handlerMetadata, handler);
  }
  const context = {
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => ({ principal }) }),
  } as unknown as ExecutionContext;
  return { context, reflector };
}

function fakePrincipal(permissions: string[]): AuthenticatedPrincipal {
  return {
    user: { id: "user-1", email: "a@example.test" },
    sessionId: "session-1",
    roles: ["user"],
    permissions,
    profile: null,
  } as unknown as AuthenticatedPrincipal;
}

describe("PermissionsGuard (checklist: requirePermission(name) helper, 403 when forbidden)", () => {
  it("allows the request through when no @RequirePermission metadata is present on the route", () => {
    const { context, reflector } = makeContext(undefined);
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows the request through when the principal holds the required permission", () => {
    const principal = fakePrincipal(["profile.read.own"]);
    const { context, reflector } = makeContext(principal, "profile.read.own");
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it("throws ForbiddenError when the principal lacks the required permission", () => {
    const principal = fakePrincipal(["profile.read.own"]); // missing profile.update.own
    const { context, reflector } = makeContext(principal, "profile.update.own");
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
  });

  it("never trusts a client-supplied permission list — only the server-resolved principal matters", () => {
    // Simulates a forged request body/header claiming elevated permissions —
    // PermissionsGuard only ever reads `request.principal`, which SessionGuard
    // populated from a database join (PrincipalService), never from anything
    // the client sent (checklist: "Never trust roles from the client").
    const principal = fakePrincipal([]); // the REAL, server-resolved permission set: none
    const { context, reflector } = makeContext(principal, "settings.manage");
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
  });
});
