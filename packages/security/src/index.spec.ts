import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  cookieName,
  generateNonce,
  isAllowedRedirect,
  isOriginAllowed,
  isSafeRelativePath,
  resolveAuthRedirect,
  safeReturnTo,
  sessionCookieOptions,
} from "./index";

describe("buildContentSecurityPolicy", () => {
  it("never includes unsafe-inline for script-src", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc123" });
    const scriptSrcLine = csp.split("; ").find((d) => d.startsWith("script-src"));
    expect(scriptSrcLine).toBeDefined();
    expect(scriptSrcLine).not.toContain("unsafe-inline");
    expect(scriptSrcLine).toContain("'nonce-abc123'");
  });

  it("sets frame-ancestors none by default", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc123" });
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("adds upgrade-insecure-requests only in production", () => {
    const dev = buildContentSecurityPolicy({ nonce: "n" });
    const prod = buildContentSecurityPolicy({ nonce: "n", isProduction: true });
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(prod).toContain("upgrade-insecure-requests");
  });
});

describe("buildSecurityHeaders", () => {
  it("includes baseline headers always", () => {
    const headers = buildSecurityHeaders({ nonce: "n" });
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  });

  it("only includes Strict-Transport-Security in production", () => {
    expect(buildSecurityHeaders({ nonce: "n" })["Strict-Transport-Security"]).toBeUndefined();
    expect(
      buildSecurityHeaders({ nonce: "n", isProduction: true })["Strict-Transport-Security"],
    ).toContain("max-age");
  });
});

describe("generateNonce", () => {
  it("generates a non-empty, non-repeating value", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });
});

describe("isOriginAllowed", () => {
  it("allows requests with no Origin header (non-browser clients)", () => {
    expect(isOriginAllowed(undefined, ["https://example.com"])).toBe(true);
  });

  it("allows an allowlisted origin", () => {
    expect(isOriginAllowed("https://example.com", ["https://example.com"])).toBe(true);
  });

  it("rejects a non-allowlisted origin", () => {
    expect(isOriginAllowed("https://evil.com", ["https://example.com"])).toBe(false);
  });
});

describe("cookieName (Phase 7 checklist: __Host- prefix)", () => {
  it("applies the __Host- prefix when secure and no domain is set", () => {
    expect(cookieName("app_session", { secure: true })).toBe("__Host-app_session");
  });

  it("does not apply the prefix when not secure (e.g. local dev over HTTP)", () => {
    expect(cookieName("app_session", { secure: false })).toBe("app_session");
  });

  it("does not apply the prefix when a Domain attribute is set", () => {
    expect(cookieName("app_session", { secure: true, domain: "example.com" })).toBe("app_session");
  });
});

describe("sessionCookieOptions (Phase 7 checklist: cookie configuration)", () => {
  it("always sets httpOnly, Path=/, and defaults to SameSite=Lax", () => {
    const opts = sessionCookieOptions({ secure: true, maxAgeSeconds: 60 });
    expect(opts.httpOnly).toBe(true);
    expect(opts.path).toBe("/");
    expect(opts.sameSite).toBe("lax");
  });

  it("supports SameSite=Strict for cookies that never need a cross-site send", () => {
    const opts = sessionCookieOptions({ secure: true, maxAgeSeconds: 60, sameSite: "strict" });
    expect(opts.sameSite).toBe("strict");
  });

  it("omits the Domain attribute entirely when unset, rather than sending an empty one", () => {
    const opts = sessionCookieOptions({ secure: true, maxAgeSeconds: 60 });
    expect("domain" in opts).toBe(false);
  });

  it("includes the Domain attribute when one is explicitly given", () => {
    const opts = sessionCookieOptions({ secure: true, maxAgeSeconds: 60, domain: "example.com" });
    expect(opts.domain).toBe("example.com");
  });
});

// Phase 10 checklist item 11/explicit test 2: "Malicious returnTo values
// rejected: https://evil.example, //evil.example, /\evil.example,
// javascript:alert(1), encoded variants."
describe("isSafeRelativePath / isAllowedRedirect / safeReturnTo (checklist: safe return URL helper)", () => {
  const MALICIOUS_RETURN_TO_VALUES = [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "%2F%2Fevil.example", // encoded "//evil.example" — single decode still fails the startsWith check
    "%5Cevil.example", // encoded leading backslash
    "/%5Cevil.example", // "/" + encoded backslash — decodes to "/\evil.example"
    "/\t/evil.example", // tab — browsers strip this, turning it into "//evil.example"
    "/\n/evil.example",
    "/%2F%2Fevil.example", // "/" + encoded "//" — decodes to "//evil.example", still starts with "/" but then "//"
    "%252F%252Fevil.example", // double-encoded — single decode leaves it still-encoded, never starts with "/"
    "",
  ];

  it.each(MALICIOUS_RETURN_TO_VALUES)("rejects %j as unsafe", (value) => {
    expect(isSafeRelativePath(value)).toBe(false);
    expect(isAllowedRedirect(value, ["https://app.example"])).toBe(false);
    expect(safeReturnTo(value)).toBe("/dashboard");
  });

  it("accepts an ordinary relative path", () => {
    expect(isSafeRelativePath("/dashboard")).toBe(true);
    expect(isSafeRelativePath("/dashboard/sessions")).toBe(true);
    expect(isSafeRelativePath("/dashboard?tab=billing")).toBe(true);
  });

  it("rejects a malformed percent-encoded sequence rather than throwing", () => {
    expect(isSafeRelativePath("/%")).toBe(false);
    expect(() => isSafeRelativePath("/%")).not.toThrow();
  });

  it("isAllowedRedirect still accepts an allowlisted absolute origin", () => {
    expect(isAllowedRedirect("https://app.example/welcome", ["https://app.example"])).toBe(true);
  });

  it("isAllowedRedirect rejects a non-allowlisted absolute origin", () => {
    expect(isAllowedRedirect("https://evil.example", ["https://app.example"])).toBe(false);
  });

  it("safeReturnTo falls back to /dashboard for null/undefined/empty input", () => {
    expect(safeReturnTo(null)).toBe("/dashboard");
    expect(safeReturnTo(undefined)).toBe("/dashboard");
    expect(safeReturnTo("")).toBe("/dashboard");
  });

  it("safeReturnTo passes through a safe path with no allowlist given", () => {
    expect(safeReturnTo("/dashboard/sessions")).toBe("/dashboard/sessions");
  });

  it("safeReturnTo honors a custom fallback", () => {
    expect(safeReturnTo("//evil.example", { fallback: "/login" })).toBe("/login");
  });

  it("safeReturnTo rejects a safe-shaped path outside the given allowlist", () => {
    expect(safeReturnTo("/some/other/page", { allowedPrefixes: ["/dashboard", "/account"] })).toBe(
      "/dashboard",
    );
  });

  it("safeReturnTo accepts a safe-shaped path inside the given allowlist", () => {
    expect(safeReturnTo("/dashboard/connected-accounts", { allowedPrefixes: ["/dashboard"] })).toBe(
      "/dashboard/connected-accounts",
    );
  });

  it("safeReturnTo treats an exact allowlisted path (no trailing segment) as allowed", () => {
    expect(safeReturnTo("/dashboard", { allowedPrefixes: ["/dashboard"] })).toBe("/dashboard");
  });
});

// Phase 10 checklist task 6 ("Redirect rules that cannot loop") / explicit
// test 3 ("No loop for any session and profile state") — exhaustive over
// every combination of the decision function's boolean inputs.
describe("resolveAuthRedirect (checklist: redirect rules that cannot loop)", () => {
  const BOOLEANS = [true, false];

  it("never redirects FROM the login page back TO the login page, for any input combination", () => {
    for (const isAuthenticated of BOOLEANS) {
      for (const next of [null, "/dashboard", "//evil.example", "/login", "/login?x=1"]) {
        const { redirectTo } = resolveAuthRedirect({
          isLoginPage: true,
          requiresAuth: false,
          isAuthenticated,
          currentPath: "/login",
          next,
        });
        expect(redirectTo === null || !redirectTo.startsWith("/login")).toBe(true);
      }
    }
  });

  it("never redirects an authenticated visitor on a protected, non-login page", () => {
    for (const requiresAuth of BOOLEANS) {
      const { redirectTo } = resolveAuthRedirect({
        isLoginPage: false,
        requiresAuth,
        isAuthenticated: true,
        currentPath: "/dashboard",
      });
      expect(redirectTo).toBeNull();
    }
  });

  it("redirects an unauthenticated visitor on a protected page to /login, carrying the current path as next", () => {
    const { redirectTo } = resolveAuthRedirect({
      isLoginPage: false,
      requiresAuth: true,
      isAuthenticated: false,
      currentPath: "/dashboard/sessions",
    });
    expect(redirectTo).toBe("/login?next=%2Fdashboard%2Fsessions");
  });

  it("never redirects an unauthenticated visitor on a page that doesn't require auth", () => {
    const { redirectTo } = resolveAuthRedirect({
      isLoginPage: false,
      requiresAuth: false,
      isAuthenticated: false,
      currentPath: "/forgot-password",
    });
    expect(redirectTo).toBeNull();
  });

  it("redirects an authenticated visitor on login to a safe next, or /dashboard if none/unsafe given", () => {
    expect(
      resolveAuthRedirect({
        isLoginPage: true,
        requiresAuth: false,
        isAuthenticated: true,
        currentPath: "/login",
        next: "/dashboard/sessions",
      }).redirectTo,
    ).toBe("/dashboard/sessions");

    expect(
      resolveAuthRedirect({
        isLoginPage: true,
        requiresAuth: false,
        isAuthenticated: true,
        currentPath: "/login",
        next: "https://evil.example",
      }).redirectTo,
    ).toBe("/dashboard");
  });

  it("applying the decision twice in a row (simulating a browser following two redirects) never cycles, for every state combination", () => {
    // Models a two-hop traversal: start on login, get redirected somewhere;
    // land there, get redirected again (if at all) — the second redirect
    // must never point back at the page the first redirect came FROM, for
    // every reachable session/profile state this function's inputs can
    // represent.
    for (const isAuthenticated of BOOLEANS) {
      for (const requiresAuth of BOOLEANS) {
        const first = resolveAuthRedirect({
          isLoginPage: true,
          requiresAuth: false,
          isAuthenticated,
          currentPath: "/login",
        });
        if (first.redirectTo === null) continue; // stayed on login — no second hop
        // Landed on `first.redirectTo` — simulate requireUser() there. It's
        // never the login page itself (proven by the first test above), so
        // isLoginPage is always false for this second hop.
        const second = resolveAuthRedirect({
          isLoginPage: false,
          requiresAuth,
          isAuthenticated,
          currentPath: first.redirectTo,
        });
        // The second hop must never send the browser BACK to /login when it
        // was already proven authenticated enough to leave login in the
        // first place.
        if (isAuthenticated) {
          expect(second.redirectTo).toBeNull();
        }
      }
    }
  });
});
