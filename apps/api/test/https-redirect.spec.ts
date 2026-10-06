import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHttpsRedirectMiddleware } from "../src/common/https-redirect.middleware.js";

function createTestApp(isProduction: boolean) {
  const app = express();
  app.use(createHttpsRedirectMiddleware(isProduction));
  app.get("/health/live", (_req, res) => res.json({ status: "ok" }));
  return app;
}

describe("HTTPS redirect", () => {
  it("redirects a plain-HTTP request to HTTPS when running in production", async () => {
    const app = createTestApp(true);
    const res = await request(app).get("/health/live").set("host", "api.example.com");

    expect(res.status).toBe(308);
    expect(res.headers.location).toBe("https://api.example.com/health/live");
  });

  it("does not redirect when the request already arrives over HTTPS (via X-Forwarded-Proto)", async () => {
    const app = createTestApp(true);
    const res = await request(app)
      .get("/health/live")
      .set("host", "api.example.com")
      .set("x-forwarded-proto", "https");

    expect(res.status).toBe(200);
  });

  it("does not redirect outside production", async () => {
    const app = createTestApp(false);
    const res = await request(app).get("/health/live").set("host", "localhost:4000");

    expect(res.status).toBe(200);
  });
});
