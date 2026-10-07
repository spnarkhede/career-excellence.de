import { describe, expect, it } from "vitest";
import { deepRedact } from "./redact";

describe("deepRedact", () => {
  it("redacts every listed key at the top level", () => {
    const input = {
      authorization: "Bearer abc",
      cookie: "a=b",
      "set-cookie": "a=b; HttpOnly",
      password: "hunter2",
      token: "t.o.k",
      secret: "shh",
      refresh: "r",
      code: "123456",
      apiKey: "sk_live_x", // secret-scan-ignore-line: fake fixture, asserts redaction
      otp: "654321",
    };
    const result = deepRedact(input) as Record<string, string>;
    for (const key of Object.keys(input)) {
      expect(result[key]).toBe("[redacted]");
    }
  });

  it("redacts sensitive keys nested at arbitrary depth", () => {
    const input = {
      user: { email: "a@example.com", password: "hunter2" },
      meta: { request: { headers: { authorization: "Bearer abc", "Set-Cookie": "x=y" } } },
      deeply: { nested: { object: { with: { a: { code: "999999" } } } } },
    };
    const result = deepRedact(input) as any;
    expect(result.user.email).toBe("a@example.com");
    expect(result.user.password).toBe("[redacted]");
    expect(result.meta.request.headers.authorization).toBe("[redacted]");
    expect(result.meta.request.headers["Set-Cookie"]).toBe("[redacted]");
    expect(result.deeply.nested.object.with.a.code).toBe("[redacted]");
  });

  it("redacts sensitive keys inside arrays of objects", () => {
    const input = { sessions: [{ token: "a" }, { token: "b", ok: true }] };
    const result = deepRedact(input) as any;
    expect(result.sessions[0].token).toBe("[redacted]");
    expect(result.sessions[1].token).toBe("[redacted]");
    expect(result.sessions[1].ok).toBe(true);
  });

  it("leaves non-sensitive values untouched", () => {
    const input = { id: "123", status: "active", count: 4 };
    expect(deepRedact(input)).toEqual(input);
  });

  it("redacts compound key names built around a sensitive word (BUG-010)", () => {
    // accessToken/refreshToken normalize to accesstoken/refreshtoken, which never
    // equaled the literal words token/refresh under the old exact-match check —
    // see docs/auth/FINDINGS.md BUG-010.
    const input = { accessToken: "a.b.c", refreshToken: "r", csrfToken: "x" };
    const result = deepRedact(input) as Record<string, string>;
    expect(result.accessToken).toBe("[redacted]");
    expect(result.refreshToken).toBe("[redacted]");
    expect(result.csrfToken).toBe("[redacted]");
  });
});
