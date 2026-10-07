import jwt from "jsonwebtoken";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuthService } from "../src/auth/auth.service.js";
import { CsrfGuard } from "../src/common/csrf.guard.js";

// Pure JWT logic — no database needed, so unlike the DB-dependent integration
// specs these run for real every time and are "Confirmed working," not "Requires
// manual verification."
describe("AuthService.verifyAccessToken (Phase 7: access token lifecycle)", () => {
  const authService = new AuthService();

  function issue(userId: string, sessionId: string): string {
    // signAccessToken is private; going through login()/otp/etc. here would need
    // a database, so this calls it via the same AuthService instance it's defined
    // on, cast to expose the private method — a pragmatic way to unit-test a
    // private signing method without a live database.
    return (
      authService as unknown as {
        signAccessToken: (u: string, s: string) => string;
      }
    ).signAccessToken(userId, sessionId);
  }

  it("round-trips a freshly signed token", () => {
    const token = issue("user-1", "session-1");
    const result = authService.verifyAccessToken(token);
    expect(result).toEqual({ userId: "user-1", sessionId: "session-1" });
  });

  it("rejects a token signed with alg:none", () => {
    // jsonwebtoken refuses to produce an alg:none token via jwt.sign with a
    // non-null secret, so this constructs one by hand (base64url header+payload,
    // no signature) — exactly what a forged "alg confusion" attack would send.
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "user-1", sid: "session-1" })).toString(
      "base64url",
    );
    const forged = `${header}.${payload}.`;
    expect(() => authService.verifyAccessToken(forged)).toThrow("Invalid or expired session.");
  });

  it("rejects a token signed with a different, unregistered key (no matching kid)", () => {
    const otherKey = jwt.sign({ sub: "user-1", sid: "session-1" }, "a".repeat(40));
    expect(() => authService.verifyAccessToken(otherKey)).toThrow("Invalid or expired session.");
  });

  it("rejects an expired token", () => {
    const priv = process.env.AUTH_JWT_PRIVATE_KEY as string;
    const token = jwt.sign({ sub: "user-1", sid: "session-1" }, priv, {
      algorithm: "RS256",
      keyid: process.env.AUTH_JWT_KID || "default",
      expiresIn: -10, // already expired
      issuer: process.env.AUTH_JWT_ISSUER || "career-excellence-api",
      audience: process.env.AUTH_JWT_AUDIENCE || "career-excellence-web",
    });
    expect(() => authService.verifyAccessToken(token)).toThrow("Invalid or expired session.");
  });

  it("rejects a token with the wrong issuer", () => {
    const priv = process.env.AUTH_JWT_PRIVATE_KEY as string;
    const token = jwt.sign({ sub: "user-1", sid: "session-1" }, priv, {
      algorithm: "RS256",
      keyid: process.env.AUTH_JWT_KID || "default",
      expiresIn: 900,
      issuer: "someone-else",
      audience: process.env.AUTH_JWT_AUDIENCE || "career-excellence-web",
    });
    expect(() => authService.verifyAccessToken(token)).toThrow("Invalid or expired session.");
  });

  it("rejects a token with the wrong audience", () => {
    const priv = process.env.AUTH_JWT_PRIVATE_KEY as string;
    const token = jwt.sign({ sub: "user-1", sid: "session-1" }, priv, {
      algorithm: "RS256",
      keyid: process.env.AUTH_JWT_KID || "default",
      expiresIn: 900,
      issuer: process.env.AUTH_JWT_ISSUER || "career-excellence-api",
      audience: "someone-elses-app",
    });
    expect(() => authService.verifyAccessToken(token)).toThrow("Invalid or expired session.");
  });

  it("rejects a garbage/malformed token", () => {
    expect(() => authService.verifyAccessToken("not.a.jwt")).toThrow("Invalid or expired session.");
  });
});

// Pure guard logic (no NestJS bootstrap, no database) — constructs a minimal
// ExecutionContext by hand, same pattern as all-exceptions-filter.spec.ts's
// makeHost().
describe("CsrfGuard (Phase 7: CSRF token + Origin check)", () => {
  const guard = new CsrfGuard();

  function makeContext(opts: {
    method: string;
    origin?: string;
    cookieToken?: string;
    headerToken?: string;
  }): ExecutionContext {
    const request = {
      method: opts.method,
      get: (name: string) => {
        if (name.toLowerCase() === "origin") return opts.origin;
        if (name.toLowerCase() === "x-csrf-token") return opts.headerToken;
        return undefined;
      },
      cookies: opts.cookieToken ? { csrf_token: opts.cookieToken } : {},
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it("allows safe methods (GET) through without any CSRF check", () => {
    expect(guard.canActivate(makeContext({ method: "GET" }))).toBe(true);
  });

  it("allows a state-changing request with a matching cookie and header token", () => {
    const context = makeContext({
      method: "POST",
      cookieToken: "abc123",
      headerToken: "abc123",
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects a state-changing request with no CSRF token at all", () => {
    const context = makeContext({ method: "POST" });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("rejects a state-changing request where the header doesn't match the cookie", () => {
    const context = makeContext({
      method: "POST",
      cookieToken: "abc123",
      headerToken: "wrong-value",
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("rejects a state-changing request from a disallowed Origin even with a valid token", () => {
    const context = makeContext({
      method: "DELETE",
      origin: "https://evil.example",
      cookieToken: "abc123",
      headerToken: "abc123",
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
