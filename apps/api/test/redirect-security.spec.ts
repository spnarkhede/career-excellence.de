import { describe, expect, it } from "vitest";
import { isAllowedRedirect } from "@saas/security";

describe("isAllowedRedirect", () => {
  it("allows relative paths", () => {
    expect(isAllowedRedirect("/dashboard", [])).toBe(true);
  });

  it("rejects protocol-relative URLs", () => {
    expect(isAllowedRedirect("//evil.com", [])).toBe(false);
  });

  it("allows allowlisted origins", () => {
    expect(isAllowedRedirect("https://app.example.com/x", ["https://app.example.com"])).toBe(true);
  });

  it("rejects non-allowlisted origins", () => {
    expect(isAllowedRedirect("https://evil.com", ["https://app.example.com"])).toBe(false);
  });
});
