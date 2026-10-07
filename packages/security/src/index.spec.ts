import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  cookieName,
  generateNonce,
  isOriginAllowed,
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
