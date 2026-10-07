import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthModule } from "../src/auth/auth.module.js";
import { isDatabaseReachable } from "./db-test-helpers.js";

/**
 * Extra test (beyond the 16 checklist items): "GET on the verification URL does not
 * verify." The verify-email page the user opens is a GET request to apps/web (a
 * static/dynamic Next.js route, not this API) — that page load alone never calls the
 * API. Only an explicit POST from the Confirm button hits /auth/verify-email. This
 * test proves the API side of that contract directly: the route exists only as POST,
 * so a mail scanner (or anything else) issuing a bare GET to the same path cannot
 * consume the token, because there is no handler to consume it.
 */
describe("GET on the verification endpoint does not verify (real database)", () => {
  let app: INestApplication | null = null;
  let dbReachable = false;

  beforeAll(async () => {
    dbReachable = await isDatabaseReachable();
    if (!dbReachable) return;

    const moduleRef = await Test.createTestingModule({ imports: [AuthModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("GET /auth/verify-email does not exist as a route (405/404, never a verification)", async ({
    skip,
  }) => {
    if (!dbReachable || !app) skip();
    const res = await request(app!.getHttpServer()).get("/auth/verify-email?token=anything");
    expect([404, 405]).toContain(res.status);
  });

  it("POST /auth/verify-email is the only way to submit a token", async ({ skip }) => {
    if (!dbReachable || !app) skip();
    const res = await request(app!.getHttpServer())
      .post("/auth/verify-email")
      .send({ token: "not-a-real-token" }); // secret-scan-ignore-line
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reason: "invalid" });
  });
});
