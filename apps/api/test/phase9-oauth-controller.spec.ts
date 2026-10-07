import { describe, expect, it, vi } from "vitest";
import { OAuthController } from "../src/auth/oauth/oauth.controller.js";
import { setOAuthStateCookie } from "../src/auth/oauth/oauth-state.js";

/** Pure-logic controller tests — no database, no network. Covers every
 * callback-validation branch that happens BEFORE OAuthService is ever
 * called: state missing/mismatched, cancellation, missing code, in-app
 * browser detection — plus the explicit "replayed code" test (the state
 * cookie is single-use, consumed on the first callback attempt, so a
 * replay of the same callback URL always finds no cookie the second time). */

function makeReqRes(opts: {
  cookies?: Record<string, string>;
  userAgent?: string;
  query?: Record<string, string>;
}) {
  const cookieJar = { ...opts.cookies };
  const headers: Record<string, string> = {};
  const redirect = vi.fn();
  const status = vi.fn().mockReturnThis();
  const type = vi.fn().mockReturnThis();
  const send = vi.fn().mockReturnThis();
  const cookieFn = vi.fn();
  const clearCookie = vi.fn((name: string) => {
    delete cookieJar[name];
  });

  const req = {
    cookies: cookieJar,
    get: (name: string) => (name.toLowerCase() === "user-agent" ? opts.userAgent : headers[name]),
    query: opts.query ?? {},
  };
  const res = { redirect, status, type, send, cookie: cookieFn, clearCookie };
  return { req, res, redirect, send, cookieFn, cookieJar };
}

/** Simulates the browser round trip: pulls the value `setOAuthStateCookie`
 * just set via `res.cookie(...)` back into `req.cookies`. */
function roundTripCookie(
  res: { cookie: ReturnType<typeof vi.fn> },
  req: { cookies: Record<string, string> },
) {
  const call = res.cookie.mock.calls.at(-1);
  if (!call) throw new Error("expected res.cookie to have been called");
  req.cookies[call[0] as string] = call[1] as string;
}

function makeController(oauthServiceOverrides: Record<string, unknown> = {}) {
  const oauthService = {
    startAuthorization: vi.fn(),
    handleCallback: vi.fn(),
    listRegisteredProviders: vi.fn(),
    ...oauthServiceOverrides,
  };
  const authService = { verifyAccessToken: vi.fn() };
  const controller = new OAuthController(oauthService as never, authService as never);
  return { controller, oauthService, authService };
}

describe("OAuthController callback validation (checklist: State validation, OAuth cancellation)", () => {
  it("redirects to the in-app-browser warning page without ever calling startAuthorization", async () => {
    const { controller, oauthService } = makeController();
    const { req, res, send } = makeReqRes({
      userAgent: "Mozilla/5.0 ... FBAN/FB4A;FBAV/300.0",
    });

    await controller.start("google", undefined, undefined, req as never, res as never);

    expect((res as unknown as { status: ReturnType<typeof vi.fn> }).status).toHaveBeenCalledWith(
      200,
    );
    expect((res as unknown as { type: ReturnType<typeof vi.fn> }).type).toHaveBeenCalledWith(
      "html",
    );
    expect(send.mock.calls[0]?.[0]).toContain("Open in your browser");
    expect(oauthService.startAuthorization).not.toHaveBeenCalled();
  });

  it("proceeds to startAuthorization for a normal browser user agent", async () => {
    const { controller, oauthService } = makeController({
      startAuthorization: vi.fn().mockResolvedValue({
        authorizationUrl: "https://provider.test/authorize?x=1",
        state: "s1",
        codeVerifier: "v1",
        nonce: "n1",
        sameSite: "lax",
      }),
    });
    const { req, res, redirect } = makeReqRes({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36",
    });

    await controller.start("google", undefined, undefined, req as never, res as never);

    expect(oauthService.startAuthorization).toHaveBeenCalledWith("google");
    expect(redirect).toHaveBeenCalledWith(302, "https://provider.test/authorize?x=1");
  });

  it("redirects to a cancellation page when the provider reports access_denied (checklist: OAuth cancellation)", async () => {
    const { controller, oauthService } = makeController();
    const { req, res, redirect } = makeReqRes({});

    await controller.callbackGet(
      "google",
      "code-1",
      "state-1",
      "access_denied",
      req as never,
      res as never,
    );

    expect(redirect).toHaveBeenCalledWith(302, expect.stringContaining("code=cancelled"));
    expect(oauthService.handleCallback).not.toHaveBeenCalled();
  });

  it("redirects to a state_missing error when no state cookie exists at all", async () => {
    const { controller, oauthService } = makeController();
    const { req, res, redirect } = makeReqRes({});

    await controller.callbackGet(
      "google",
      "code-1",
      "state-1",
      undefined,
      req as never,
      res as never,
    );

    expect(redirect).toHaveBeenCalledWith(302, expect.stringContaining("code=state_missing"));
    expect(oauthService.handleCallback).not.toHaveBeenCalled();
  });

  it("redirects to a state_mismatch error when the state param doesn't match the cookie (checklist: mismatched state)", async () => {
    const { controller, oauthService } = makeController();
    const { req, res, redirect } = makeReqRes({});
    setOAuthStateCookie(
      res as never,
      {
        provider: "google",
        state: "expected-state",
        codeVerifier: "v1",
        nonce: "n1",
        mode: "login",
      },
      "lax",
    );
    // Pull the cookie value the helper just set back into the request, the
    // way a real browser round trip would.
    roundTripCookie(res as never, req as never);

    await controller.callbackGet(
      "google",
      "code-1",
      "an-attacker-supplied-different-state",
      undefined,
      req as never,
      res as never,
    );

    expect(redirect).toHaveBeenCalledWith(302, expect.stringContaining("code=state_mismatch"));
    expect(oauthService.handleCallback).not.toHaveBeenCalled();
  });

  it("redirects to a missing_code error when the provider returns state but no code", async () => {
    const { controller, oauthService } = makeController();
    const { req, res, redirect } = makeReqRes({});
    setOAuthStateCookie(
      res as never,
      { provider: "google", state: "s1", codeVerifier: "v1", nonce: "n1", mode: "login" },
      "lax",
    );
    roundTripCookie(res as never, req as never);

    await controller.callbackGet("google", undefined, "s1", undefined, req as never, res as never);

    expect(redirect).toHaveBeenCalledWith(302, expect.stringContaining("code=missing_code"));
    expect(oauthService.handleCallback).not.toHaveBeenCalled();
  });

  it("rejects a REPLAYED callback: the state cookie is consumed on first use, so the same callback URL fails the second time (checklist: Token reuse / explicit test 'replayed code')", async () => {
    const { controller, oauthService } = makeController({
      handleCallback: vi.fn().mockResolvedValue({ kind: "error", code: "exchange_failed" }),
    });
    const { req, res, redirect } = makeReqRes({});
    setOAuthStateCookie(
      res as never,
      { provider: "google", state: "s1", codeVerifier: "v1", nonce: "n1", mode: "login" },
      "lax",
    );
    roundTripCookie(res as never, req as never);

    // First attempt: cookie present, consumed.
    await controller.callbackGet("google", "code-1", "s1", undefined, req as never, res as never);
    expect(oauthService.handleCallback).toHaveBeenCalledTimes(1);

    // Second attempt with the SAME code/state: the cookie was cleared by the
    // first call, so this can never reach handleCallback again.
    await controller.callbackGet("google", "code-1", "s1", undefined, req as never, res as never);
    expect(oauthService.handleCallback).toHaveBeenCalledTimes(1); // still 1, not 2
    expect(redirect).toHaveBeenLastCalledWith(302, expect.stringContaining("code=state_missing"));
  });
});
