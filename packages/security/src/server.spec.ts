import { describe, expect, it } from "vitest";
import { hashIp, hashPassword, hashToken, verifyPassword } from "./server";

describe("hashPassword / verifyPassword", () => {
  it("round-trips a correct password", async () => {
    const hash = await hashPassword("a-long-enough-password-123");
    expect(await verifyPassword(hash, "a-long-enough-password-123")).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("a-long-enough-password-123");
    expect(await verifyPassword(hash, "wrong-password")).toBe(false);
  });

  it("never stores the plaintext in the hash output", async () => {
    const plain = "a-long-enough-password-123";
    const hash = await hashPassword(plain);
    expect(hash).not.toContain(plain);
  });
});

describe("hashToken", () => {
  it("is deterministic", () => {
    expect(hashToken("same-token")).toBe(hashToken("same-token"));
  });

  it("never returns the raw input", () => {
    expect(hashToken("raw-value")).not.toBe("raw-value");
    expect(hashToken("raw-value")).not.toContain("raw-value");
  });
});

describe("hashIp", () => {
  it("is deterministic for the same ip + key", () => {
    expect(hashIp("203.0.113.5", "k")).toBe(hashIp("203.0.113.5", "k"));
  });

  it("never returns the raw ip", () => {
    const hashed = hashIp("203.0.113.5", "k");
    expect(hashed).not.toBe("203.0.113.5");
    expect(hashed).not.toContain("203.0.113.5");
  });

  it("produces a different hash for a different key (not a plain, unkeyed digest)", () => {
    expect(hashIp("203.0.113.5", "key-a")).not.toBe(hashIp("203.0.113.5", "key-b"));
  });
});
