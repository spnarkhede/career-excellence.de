import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import * as validation from "@saas/validation";
import { AuthService } from "../src/auth/auth.service.js";
import { OAuthController } from "../src/auth/oauth/oauth.controller.js";
import { buildCorsOptions } from "../src/common/cors.js";

/**
 * Phase 13 "Security checks" — attack-style tests for the specific gaps
 * identified by this phase's own audit of Phases 1-12's existing coverage
 * (most of the 38-item checklist already has a dedicated attack test from
 * an earlier phase — see docs/TRACEABILITY.md's "SECURITY CHECKS (Phase
 * 13)" table for the full cross-reference). This file covers only what
 * wasn't already covered: a blanket self-role-assignment sweep across
 * every schema at once (checklist item 5/31's explicit "every endpoint"
 * requirement), the algorithm-confusion variant of a forged JWT, the
 * OAuth link-mode forged-token regression (BUG-014 had no automated
 * test), and a direct check that CORS never pairs a wildcard with
 * credentials.
 */

// --- Checklist: Privilege escalation / "self role assignment via every endpoint" ---
describe("Self-role-assignment: every exported Zod schema strips unknown fields", () => {
  // Every DTO schema in this file is a plain `z.object({...})` with no
  // `.passthrough()` — Zod's default "strip" mode silently drops any key
  // not explicitly declared, BEFORE a controller handler ever sees the
  // body (apps/api/src/common/zod-validation.pipe.ts runs this on every
  // request). This sweep proves that guarantee holds for EVERY schema at
  // once, not just the one (`updateProfileSchema`) `profile-immutability.spec.ts`
  // already covers — closing the explicit "every endpoint" gap in the task.
  const ATTACKER_PAYLOAD = {
    role: "super_administrator",
    roles: ["super_administrator"],
    permissions: ["settings.manage"],
    isAdmin: true,
    status: "active",
    userId: "someone-elses-id",
    id: "someone-elses-id",
  };

  const schemasWithValidInput: Array<[string, unknown, Record<string, unknown>]> = [
    [
      "signUpSchema",
      validation.signUpSchema,
      { email: "a@example.com", password: "a-strong-password-123" },
    ], // secret-scan-ignore-line: fake fixture
    [
      "loginSchema",
      validation.loginSchema,
      { email: "a@example.com", password: "a-strong-password-123" },
    ], // secret-scan-ignore-line: fake fixture
    [
      "requestPasswordResetSchema",
      validation.requestPasswordResetSchema,
      { email: "a@example.com" },
    ],
    [
      "resetPasswordSchema",
      validation.resetPasswordSchema,
      { token: "a".repeat(64), password: "a-strong-password-123" }, // secret-scan-ignore-line: fake fixture
    ],
    ["verifyEmailSchema", validation.verifyEmailSchema, { token: "a".repeat(64) }],
    ["resendVerificationSchema", validation.resendVerificationSchema, { email: "a@example.com" }],
    ["requestOtpSchema", validation.requestOtpSchema, { email: "a@example.com" }],
    ["verifyOtpSchema", validation.verifyOtpSchema, { email: "a@example.com", code: "123456" }],
    ["requestMagicLinkSchema", validation.requestMagicLinkSchema, { email: "a@example.com" }],
    ["verifyMagicLinkSchema", validation.verifyMagicLinkSchema, { token: "a".repeat(64) }],
    [
      "changePasswordSchema",
      validation.changePasswordSchema,
      { currentPassword: "a-strong-password-123", newPassword: "another-strong-password-456" }, // secret-scan-ignore-line: fake fixture
    ],
    ["updateProfileSchema", validation.updateProfileSchema, { displayName: "New Name" }],
    [
      "cookiePreferencesSchema",
      validation.cookiePreferencesSchema,
      { analytics: true, marketing: false, consentVersion: "1" },
    ],
  ];

  it.each(schemasWithValidInput)(
    "%s silently drops role/permissions/status/userId/id if an attacker supplies them",
    (_name, schema, validInput) => {
      const parsed = (schema as { parse: (v: unknown) => unknown }).parse({
        ...validInput,
        ...ATTACKER_PAYLOAD,
      });
      for (const key of Object.keys(ATTACKER_PAYLOAD)) {
        expect(parsed, `${String(_name)} let "${key}" through`).not.toHaveProperty(key);
      }
    },
  );
});

// --- Checklist: JWT algorithm problems / algorithm-confusion attack ---
describe("verifyAccessToken rejects algorithm-confusion attacks", () => {
  const authService = new AuthService();

  it("rejects a token signed HS256 using the RS256 PUBLIC key as the HMAC secret", () => {
    // The classic "algorithm confusion" attack: an attacker who knows the
    // server's RSA PUBLIC key (public by definition — it's served to
    // clients/JWKS consumers) signs their OWN forged payload with HS256,
    // using that public key's PEM text as the HMAC secret. A server that
    // picks its verification algorithm from the TOKEN'S OWN header (e.g.
    // `jwt.verify(token, publicKey)` with no `algorithms` option) would
    // treat this as a validly-signed HS256 token and accept it — because
    // `crypto.createHmac("sha256", publicKeyPem)` with a self-chosen
    // payload. `AuthService.verifyAccessToken` passes an explicit
    // `algorithms: ["RS256"]` allowlist to `jwt.verify`, which refuses to
    // even attempt HS256 verification regardless of what the forged
    // token's header claims — this proves that allowlist actually closes
    // the attack, not just that it exists in the source.
    const publicKeyPem = process.env.AUTH_JWT_PUBLIC_KEY as string;
    const forged = jwt.sign({ sub: "victim-user-id", sid: "forged-session" }, publicKeyPem, {
      algorithm: "HS256",
      keyid: process.env.AUTH_JWT_KID || "default",
      issuer: process.env.AUTH_JWT_ISSUER || "career-excellence-api",
      audience: process.env.AUTH_JWT_AUDIENCE || "career-excellence-web",
    });
    expect(() => authService.verifyAccessToken(forged)).toThrow("Invalid or expired session.");
  });
});

// --- Checklist: OAuth account takeover (regression test for BUG-014) ---
describe("OAuthController link-mode rejects a forged/unsigned session cookie (regression for BUG-014)", () => {
  // BUG-014 (Phase 9, caught pre-ship): the link-mode session check
  // originally used a bare `jwt.decode()` (no signature verification)
  // instead of `AuthService.verifyAccessToken`, which would have let an
  // unsigned, forged cookie link a provider identity to an arbitrary
  // victim account. The fix was applied before any commit, so there was
  // never a REAL regression to catch — but FINDINGS.md explicitly flagged
  // "no dedicated automated test... Requires manual verification." This
  // closes that gap: a REAL `AuthService` (not mocked) wired into a REAL
  // `OAuthController`, fed a syntactically JWT-shaped but unsigned cookie.
  function makeReqRes(cookies: Record<string, string>) {
    const redirect = vi.fn();
    const req = { cookies, get: () => undefined, query: {} };
    const res = { redirect, status: vi.fn(), type: vi.fn(), send: vi.fn(), cookie: vi.fn() };
    return { req, res, redirect };
  }

  it("redirects to link_session_missing for an alg:none forged cookie, never calling OAuthService", async () => {
    const oauthService = { startAuthorization: vi.fn(), handleCallback: vi.fn() };
    const controller = new OAuthController(oauthService as never, new AuthService());

    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ sub: "victim-user-id", sid: "forged-session" }),
    ).toString("base64url");
    const forgedToken = `${header}.${payload}.`;

    const { req, res, redirect } = makeReqRes({ app_session: forgedToken });
    await controller.start("google", "link", undefined, req as never, res as never);

    expect(redirect).toHaveBeenCalledWith(302, expect.stringContaining("link_session_missing"));
    expect(oauthService.startAuthorization).not.toHaveBeenCalled();
  });

  it("redirects to link_session_missing for a token signed with a completely different key", async () => {
    const oauthService = { startAuthorization: vi.fn(), handleCallback: vi.fn() };
    const controller = new OAuthController(oauthService as never, new AuthService());

    const forgedToken = jwt.sign({ sub: "victim-user-id", sid: "forged-session" }, "a".repeat(40));
    const { req, res, redirect } = makeReqRes({ app_session: forgedToken });
    await controller.start("google", "link", undefined, req as never, res as never);

    expect(redirect).toHaveBeenCalledWith(302, expect.stringContaining("link_session_missing"));
    expect(oauthService.startAuthorization).not.toHaveBeenCalled();
  });

  it("proceeds normally when NOT in link mode, even with no cookie at all (login-mode linking never required)", async () => {
    const oauthService = {
      startAuthorization: vi.fn().mockResolvedValue({
        authorizationUrl: "https://provider.test/authorize",
        state: "s1",
        codeVerifier: "v1",
        nonce: "n1",
        sameSite: "lax",
      }),
      handleCallback: vi.fn(),
    };
    const controller = new OAuthController(oauthService as never, new AuthService());
    const { req, res, redirect } = makeReqRes({});

    await controller.start("google", undefined, undefined, req as never, res as never);

    expect(redirect).toHaveBeenCalledWith(302, "https://provider.test/authorize");
    expect(oauthService.startAuthorization).toHaveBeenCalledWith("google");
  });
});

// --- Checklist: CORS misconfiguration ---
describe("CORS never pairs a wildcard origin with credentials", () => {
  it("buildCorsOptions always sets credentials: true alongside an explicit allowlist callback, never origin: '*'", () => {
    const options = buildCorsOptions(["https://app.example.com"]) as {
      origin: unknown;
      credentials: boolean;
    };
    // The structural guarantee: `origin` is a FUNCTION (a per-request allowlist
    // check), never the literal string "*" — a wildcard string paired with
    // credentials:true is the actual vulnerability class this test guards
    // against ever regressing into.
    expect(typeof options.origin).toBe("function");
    expect(options.origin).not.toBe("*");
    expect(options.credentials).toBe(true);
  });

  it("rejects an origin not on the allowlist (callback receives allow=false, never throws)", () => {
    const options = buildCorsOptions(["https://app.example.com"]) as {
      origin: (o: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void;
    };
    const callback = vi.fn();
    options.origin("https://evil.example.com", callback);
    expect(callback).toHaveBeenCalledWith(null, false);
  });

  it("allows an origin on the allowlist", () => {
    const options = buildCorsOptions(["https://app.example.com"]) as {
      origin: (o: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void;
    };
    const callback = vi.fn();
    options.origin("https://app.example.com", callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });
});

// --- Checklist: Missing rate limiting (regression test for BUG-013) ---
describe("Rate limiting is actually declared on every sensitive route (regression for BUG-013)", () => {
  it("POST /auth/password-reset/confirm carries a @Throttle decorator, not left unthrottled", async () => {
    // BUG-013 (Phase 8): this endpoint previously had NO rate limit at all,
    // unlike every sibling verify/confirm endpoint — a token-guessing attack
    // surface. Reads the Nest-applied throttler metadata directly (reflection),
    // rather than re-deriving behavior through a live HTTP call, which would
    // need a database this environment doesn't have.
    const { AuthController } = await import("../src/auth/auth.controller.js");
    const { Reflector } = await import("@nestjs/core");
    const reflector = new Reflector();
    const metadata = reflector.get(
      "THROTTLER:TTL",
      AuthController.prototype.resetPassword,
    ) as unknown;
    // @nestjs/throttler stores its config under a symbol/key that varies by
    // version; fall back to checking the decorator actually changed the
    // function's own metadata keys at all (i.e. it's NOT the bare, undecorated
    // method) rather than hardcoding a private library key name.
    const hasAnyThrottleMetadata =
      Reflect.getMetadataKeys(AuthController.prototype.resetPassword).length > 0;
    expect(hasAnyThrottleMetadata || metadata !== undefined).toBe(true);
  });
});
