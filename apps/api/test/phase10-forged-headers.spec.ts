import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuthService } from "../src/auth/auth.service.js";
import { PrincipalService } from "../src/auth/principal.service.js";
import { SessionGuard } from "../src/auth/session.guard.js";

/**
 * Phase 10 explicit test 5: "Forged middleware headers still fail at the
 * handler." CVE-2025-29927 forged the `x-middleware-subrequest` header to
 * skip Next.js middleware entirely; the general class of bug is "a header
 * that LOOKS like it came from trusted infrastructure, but didn't." This
 * proves `SessionGuard` — the actual authorization boundary, independent of
 * any Next.js middleware — reads ONLY the session cookie (verified via
 * `AuthService.verifyAccessToken`'s signature check, then a DB lookup), and
 * never consults any request header at all, forged or not.
 */
function makeContext(headers: Record<string, string>, cookies: Record<string, string> = {}) {
  const setHeader = () => {};
  const request = {
    cookies,
    get: (name: string) => headers[name.toLowerCase()],
    headers,
  };
  const response = { setHeader };
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
}

describe("SessionGuard ignores every request header — only the verified session cookie matters", () => {
  const guard = new SessionGuard(new AuthService(), new PrincipalService());

  it("rejects a request with NO session cookie, even carrying a forged x-middleware-subrequest header (CVE-2025-29927-style bypass attempt)", async () => {
    const context = makeContext({
      "x-middleware-subrequest":
        "src/middleware:src/middleware:src/middleware:src/middleware:src/middleware",
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a request with NO session cookie, even carrying forged identity/role headers", async () => {
    const context = makeContext({
      "x-user-id": "11111111-1111-1111-1111-111111111111",
      "x-user-role": "super_administrator",
      "x-principal": JSON.stringify({
        roles: ["super_administrator"],
        permissions: ["settings.manage"],
      }),
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a request whose session cookie is syntactically JWT-shaped but unsigned, regardless of accompanying headers", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ sub: "11111111-1111-1111-1111-111111111111", sid: "fake-session" }),
    ).toString("base64url");
    const forgedToken = `${header}.${payload}.`;

    const context = makeContext({ "x-user-role": "administrator" }, { app_session: forgedToken });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
