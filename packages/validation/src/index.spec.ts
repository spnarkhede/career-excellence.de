import { describe, expect, it } from "vitest";
import { emailSchema, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordSchema } from "./index";

describe("emailSchema", () => {
  it("trims and lowercases", () => {
    expect(emailSchema.parse("  User@Example.com  ")).toBe("user@example.com");
  });
});

// Checklist item 7: Password creation.
describe("passwordSchema — NIST SP 800-63B policy", () => {
  it("accepts a password at exactly the minimum length", () => {
    expect(passwordSchema.parse("a".repeat(PASSWORD_MIN_LENGTH))).toHaveLength(PASSWORD_MIN_LENGTH);
  });

  it("accepts a password at exactly the maximum length", () => {
    expect(passwordSchema.parse("a".repeat(PASSWORD_MAX_LENGTH))).toHaveLength(PASSWORD_MAX_LENGTH);
  });

  it("has a hard cap of at least 64 characters, per the Phase 4 spec", () => {
    expect(PASSWORD_MAX_LENGTH).toBeGreaterThanOrEqual(64);
  });

  it("enforces no composition rules — a password of only lowercase letters is accepted", () => {
    expect(() => passwordSchema.parse("alllowercase")).not.toThrow();
  });

  it("allows spaces and arbitrary printable characters", () => {
    expect(() => passwordSchema.parse("correct horse battery staple!")).not.toThrow();
    expect(() => passwordSchema.parse("p@$$w0rd~!#%^&*()_+-=[]{}|;:,.<>?")).not.toThrow();
  });

  // Checklist item 8: Weak password handling.
  it("rejects a password shorter than the minimum length", () => {
    expect(() => passwordSchema.parse("a".repeat(PASSWORD_MIN_LENGTH - 1))).toThrow();
  });

  it("rejects a password longer than the maximum length (hard cap)", () => {
    expect(() => passwordSchema.parse("a".repeat(PASSWORD_MAX_LENGTH + 1))).toThrow();
  });
});
