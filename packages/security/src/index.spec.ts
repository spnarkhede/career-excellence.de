import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  generateNonce,
  isOriginAllowed,
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
