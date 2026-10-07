import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger";

/**
 * Phase 12 checklist test: "A log capture test fails if any value matches
 * password, token, OTP or cookie patterns." Unlike redact.spec.ts (which
 * calls `deepRedact` directly), this builds a REAL pino logger via the same
 * `createLogger` factory the exported singleton uses, pointed at an
 * in-memory stream — exercising pino's own `redact.paths` config AND the
 * `deepRedact` hook together, the same pipeline every real log call in
 * apps/api/apps/worker goes through. (The singleton itself can't be
 * captured this way: pino's default destination writes directly to the fd
 * via sonic-boom, bypassing anything a test could spy on from the outside.)
 */
function captureLoggerOutput(): { logger: ReturnType<typeof createLogger>; output: () => string } {
  let buffer = "";
  const stream = new Writable({
    write(chunk, _enc, callback) {
      buffer += chunk.toString();
      callback();
    },
  });
  return { logger: createLogger(stream), output: () => buffer };
}

describe("logger (real log-capture)", () => {
  const SECRET_PATTERNS: Array<{ name: string; value: string }> = [
    { name: "password", value: "hunter2-super-secret" }, // secret-scan-ignore-line: fake fixture
    { name: "token", value: "tok_live_abcdef123456" }, // secret-scan-ignore-line: fake fixture
    { name: "otp code", value: "839201" },
    { name: "cookie", value: "app_session=abcdef.ghijkl.mnopqr; HttpOnly" },
  ];

  it("never writes a raw password/token/otp/cookie value to the real log stream", () => {
    const { logger, output } = captureLoggerOutput();
    logger.info(
      {
        password: "hunter2-super-secret", // secret-scan-ignore-line: fake fixture
        token: "tok_live_abcdef123456", // secret-scan-ignore-line: fake fixture
        otp: "839201",
        cookie: "app_session=abcdef.ghijkl.mnopqr; HttpOnly",
        refreshToken: "r.t.k",
        accessToken: "a.t.k",
        authorization: "Bearer tok_live_abcdef123456",
      },
      "test log line with secrets",
    );

    const captured = output();
    for (const { name, value } of SECRET_PATTERNS) {
      expect(captured, `${name} value leaked into the real log stream`).not.toContain(value);
    }
    // Sanity: the log line itself DID make it through — proves this test
    // isn't vacuously passing because nothing was captured.
    expect(captured).toContain("test log line with secrets");
  });

  it("redacts a secret nested inside an auth-route-shaped request/response log object", () => {
    const { logger, output } = captureLoggerOutput();
    logger.error(
      {
        req: {
          headers: { cookie: "app_session=abcdef.ghijkl.mnopqr", authorization: "Bearer x" },
          body: { password: "hunter2-super-secret", otp: "839201" }, // secret-scan-ignore-line: fake fixture
        },
      },
      "auth route error",
    );

    const captured = output();
    for (const { name, value } of SECRET_PATTERNS) {
      expect(captured, `${name} value leaked into a nested log object`).not.toContain(value);
    }
    expect(captured).toContain("auth route error");
  });
});
