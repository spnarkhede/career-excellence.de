import { describe, expect, it, vi } from "vitest";
import { logger } from "@saas/observability";
import { AnalyticsService } from "../src/analytics/analytics.service.js";
import { ANALYTICS_EVENT_NAMES, analyticsEventSchema } from "@saas/validation";

/**
 * Phase 14 task 5: "never send emails, tokens or IDs in URLs or events."
 * `analyticsEventSchema` (checked elsewhere by the ZodValidationPipe) only
 * allows the 4 named events; this file covers what the SCHEMA alone can't:
 * a syntactically valid properties object whose VALUES happen to look like
 * an email/JWT/UUID must still never reach a log line unredacted.
 */
describe("AnalyticsService strips PII-shaped property values", () => {
  it("drops a property value that looks like an email address", () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);
    const service = new AnalyticsService();
    service.record({ event: "login", properties: { plan: "free", leaked: "user@example.com" } });

    const loggedArg = infoSpy.mock.calls[0]?.[0] as { properties: Record<string, unknown> };
    expect(loggedArg.properties).toEqual({ plan: "free" });
    expect(JSON.stringify(loggedArg)).not.toContain("user@example.com");
    infoSpy.mockRestore();
  });

  it("drops a property value that looks like a JWT", () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);
    const service = new AnalyticsService();
    const jwtLike = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl"; // secret-scan-ignore-line: fake fixture
    service.record({ event: "login", properties: { token: jwtLike } });

    const loggedArg = infoSpy.mock.calls[0]?.[0] as { properties: Record<string, unknown> };
    expect(loggedArg.properties).toEqual({});
    infoSpy.mockRestore();
  });

  it("drops a property value that looks like a UUID", () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);
    const service = new AnalyticsService();
    service.record({
      event: "signup_completed",
      properties: { userId: "11111111-1111-1111-1111-111111111111" },
    });

    const loggedArg = infoSpy.mock.calls[0]?.[0] as { properties: Record<string, unknown> };
    expect(loggedArg.properties).toEqual({});
    infoSpy.mockRestore();
  });

  it("keeps an ordinary, non-PII-shaped property value", () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);
    const service = new AnalyticsService();
    service.record({ event: "signup_started", properties: { source: "landing_page" } });

    const loggedArg = infoSpy.mock.calls[0]?.[0] as { properties: Record<string, unknown> };
    expect(loggedArg.properties).toEqual({ source: "landing_page" });
    infoSpy.mockRestore();
  });
});

describe("analyticsEventSchema rejects any event name outside the allowlist", () => {
  it("accepts every name the checklist actually requires", () => {
    for (const event of ANALYTICS_EVENT_NAMES) {
      expect(analyticsEventSchema.safeParse({ event }).success).toBe(true);
    }
  });

  it("rejects an arbitrary, attacker-chosen event name", () => {
    expect(analyticsEventSchema.safeParse({ event: "literally_anything" }).success).toBe(false);
  });
});
