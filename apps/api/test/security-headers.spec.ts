import cors from "cors";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildCorsOptions } from "../src/common/cors.js";
import { createSecurityHeadersMiddleware } from "../src/common/security-headers.middleware.js";

/**
 * Exercises the real middleware/CORS-option builders used by apps/api's main.ts against a
 * bare Express app — intentionally avoids bootstrapping the full Nest AppModule, which
 * transitively requires a generated Prisma client not available in this environment.
 */
function createTestApp(opts: { isProduction: boolean; allowedOrigins: string[] }) {
  const app = express();
  app.use(cors(buildCorsOptions(opts.allowedOrigins)));
  app.use(createSecurityHeadersMiddleware({ isProduction: opts.isProduction }));
  app.get("/health/live", (_req, res) => res.json({ status: "ok" }));
  return app;
}

describe("security headers", () => {
  it("includes CSP, X-Content-Type-Options, Referrer-Policy, and frame-ancestors on every response", async () => {
    const app = createTestApp({ isProduction: false, allowedOrigins: [] });
    const res = await request(app).get("/health/live");

    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers["content-security-policy"]).not.toContain("unsafe-inline' script");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("only includes Strict-Transport-Security when running in production", async () => {
    const dev = createTestApp({ isProduction: false, allowedOrigins: [] });
    const prod = createTestApp({ isProduction: true, allowedOrigins: [] });

    const devRes = await request(dev).get("/health/live");
    const prodRes = await request(prod).get("/health/live");

    expect(devRes.headers["strict-transport-security"]).toBeUndefined();
    expect(prodRes.headers["strict-transport-security"]).toContain("max-age");
  });
});

describe("CORS allowlist", () => {
  it("sends Access-Control-Allow-Origin for an allowlisted origin", async () => {
    const app = createTestApp({ isProduction: false, allowedOrigins: ["https://app.example.com"] });
    const res = await request(app).get("/health/live").set("Origin", "https://app.example.com");

    expect(res.headers["access-control-allow-origin"]).toBe("https://app.example.com");
  });

  it("sends no CORS allow headers for a non-allowlisted origin", async () => {
    const app = createTestApp({ isProduction: false, allowedOrigins: ["https://app.example.com"] });
    const res = await request(app).get("/health/live").set("Origin", "https://evil.example.com");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
