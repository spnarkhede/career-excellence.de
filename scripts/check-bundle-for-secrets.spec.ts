import { describe, expect, it } from "vitest";
import {
  findLeakedSecretNames,
  getSensitiveNames,
  SENSITIVE_NAME_PATTERN,
} from "./check-bundle-for-secrets";

describe("getSensitiveNames", () => {
  it("selects only secret-shaped variable names from a schema shape", () => {
    const shape = {
      DATABASE_URL: true,
      AUTH_JWT_SECRET: true,
      ENCRYPTION_KEY: true,
      NODE_ENV: true,
    };
    expect(getSensitiveNames(shape).sort()).toEqual(["AUTH_JWT_SECRET", "ENCRYPTION_KEY"].sort());
  });
});

describe("findLeakedSecretNames (bundle check)", () => {
  it("fails when a fake secret variable name is placed in client bundle output", () => {
    const files = [
      { path: "apps/web/.next/static/chunk.js", content: "const x = window.AUTH_JWT_SECRET;" },
    ];
    const leaks = findLeakedSecretNames(files, ["AUTH_JWT_SECRET"]);

    expect(leaks).toHaveLength(1);
    expect(leaks[0]).toEqual({
      file: "apps/web/.next/static/chunk.js",
      name: "AUTH_JWT_SECRET",
    });
  });

  it("passes when no sensitive name appears in any bundle file", () => {
    const files = [
      { path: "apps/web/.next/static/chunk.js", content: "const x = window.NEXT_PUBLIC_APP_URL;" },
    ];
    expect(findLeakedSecretNames(files, ["AUTH_JWT_SECRET", "ENCRYPTION_KEY"])).toHaveLength(0);
  });

  it(SENSITIVE_NAME_PATTERN.source + " matches common secret-shaped names", () => {
    for (const name of ["AUTH_JWT_SECRET", "EMAIL_API_KEY", "ENCRYPTION_KEY"]) {
      expect(SENSITIVE_NAME_PATTERN.test(name)).toBe(true);
    }
    expect(SENSITIVE_NAME_PATTERN.test("NODE_ENV")).toBe(false);
  });
});
