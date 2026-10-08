import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

/**
 * Phase 14 task 9 ("spam protection on public forms") / explicit test:
 * "Honeypot and fast submissions rejected. Missing challenge token
 * rejected." Mocks `turnstile.ts`'s network call so these run as pure
 * unit tests — no database, no real Cloudflare request.
 */

async function loadContactService(turnstileResult: boolean) {
  vi.resetModules();
  vi.doMock("../src/contact/turnstile.js", () => ({
    verifyTurnstileToken: vi.fn().mockResolvedValue(turnstileResult),
  }));
  const { ContactService } = await import("../src/contact/contact.service.js");
  return new ContactService();
}

const ctx = { ipAddress: "203.0.113.50", userAgent: "vitest", requestId: "test-request" };

function validInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Jane Doe",
    email: "jane@example.com",
    message: "Hello, I have a question about your product.",
    website: "",
    renderedAt: Date.now() - 10_000, // 10s ago — comfortably past the min fill time
    turnstileToken: "a-real-looking-token",
    ...overrides,
  } as never;
}

describe("ContactService spam protection", () => {
  it("rejects a submission with the honeypot field filled in", async () => {
    const service = await loadContactService(true);
    await expect(
      service.submit(validInput({ website: "http://spam.example" }), ctx),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a submission that arrives faster than the minimum fill time", async () => {
    const service = await loadContactService(true);
    await expect(
      service.submit(validInput({ renderedAt: Date.now() }), ctx), // 0ms elapsed
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a submission whose Turnstile challenge fails verification", async () => {
    const service = await loadContactService(false);
    await expect(service.submit(validInput(), ctx)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("every rejection reason produces the IDENTICAL generic code/message (never reveals which check failed)", async () => {
    const honeypotService = await loadContactService(true);
    const timingService = await loadContactService(true);
    const challengeService = await loadContactService(false);

    const results = await Promise.all([
      honeypotService.submit(validInput({ website: "spam" }), ctx).catch((e: unknown) => e),
      timingService.submit(validInput({ renderedAt: Date.now() }), ctx).catch((e: unknown) => e),
      challengeService.submit(validInput(), ctx).catch((e: unknown) => e),
    ]);

    const bodies = results.map((e) => (e as BadRequestException).getResponse());
    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[1]).toEqual(bodies[2]);
    expect((bodies[0] as { code: string }).code).toBe("SPAM_REJECTED");
  });

  it("accepts a genuine submission: real-shaped input, filled honeypot empty, past the min fill time, valid challenge", async () => {
    const service = await loadContactService(true);
    await expect(service.submit(validInput(), ctx)).resolves.toBeUndefined();
  });
});
