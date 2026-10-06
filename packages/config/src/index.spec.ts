import { describe, expect, it } from "vitest";
import { loadPrivateEnv, assertNoPublicSecretLeakage } from "./index";

const validEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  REDIS_URL: "redis://localhost:6379",
  AUTH_JWT_SECRET: "a".repeat(32),
  ENCRYPTION_KEY: "b".repeat(32),
};

describe("loadPrivateEnv", () => {
  it("parses a valid environment", () => {
    const env = loadPrivateEnv(validEnv as NodeJS.ProcessEnv);
    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
  });

  it("fails fast naming the missing variable, without ever including a value", () => {
    const { DATABASE_URL: _omit, ...rest } = validEnv;
    let thrown: unknown;
    try {
      loadPrivateEnv(rest as NodeJS.ProcessEnv);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain("DATABASE_URL");
    // Confirm no value from the (valid) env leaked into the error message.
    expect(message).not.toContain(validEnv.REDIS_URL);
    expect(message).not.toContain(validEnv.AUTH_JWT_SECRET);
  });

  it("fails fast naming an invalid variable without its value", () => {
    let thrown: unknown;
    try {
      loadPrivateEnv({ ...validEnv, AUTH_JWT_SECRET: "too-short" } as NodeJS.ProcessEnv); // secret-scan-ignore-line: fake fixture, asserts rejection
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain("AUTH_JWT_SECRET");
    expect(message).not.toContain("too-short");
  });
});

describe("assertNoPublicSecretLeakage", () => {
  it("passes for the real public/private schema key sets", () => {
    expect(() =>
      assertNoPublicSecretLeakage(
        ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_ANALYTICS_WRITE_KEY"],
        ["AUTH_JWT_SECRET", "DATABASE_URL"],
      ),
    ).not.toThrow();
  });

  it("throws when a secret-looking name is declared public", () => {
    expect(() =>
      assertNoPublicSecretLeakage(["NEXT_PUBLIC_DATABASE_PASSWORD"], ["AUTH_JWT_SECRET"]),
    ).toThrow(/NEXT_PUBLIC_DATABASE_PASSWORD/);
  });

  it("throws when a private variable uses the public prefix", () => {
    expect(() =>
      assertNoPublicSecretLeakage(["NEXT_PUBLIC_APP_URL"], ["NEXT_PUBLIC_AUTH_JWT_SECRET"]),
    ).toThrow(/NEXT_PUBLIC_AUTH_JWT_SECRET/);
  });
});
