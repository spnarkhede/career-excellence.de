import argon2 from "argon2";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hashIp,
  hashPassword,
  hashToken,
  isPasswordBreached,
  needsRehash,
  verifyPassword,
} from "./server";

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

  it("hashes with the OWASP-recommended argon2id parameters (19 MiB, t=2, p=1)", async () => {
    const hash = await hashPassword("a-long-enough-password-123");
    expect(hash).toContain("m=19456");
    expect(hash).toContain("t=2");
    expect(hash).toContain("p=1");
  });
});

describe("needsRehash", () => {
  it("is false for a hash produced with the current parameters", async () => {
    const hash = await hashPassword("a-long-enough-password-123");
    expect(needsRehash(hash)).toBe(false);
  });

  it("is true for a hash produced with different (e.g. weaker/older) parameters", async () => {
    const oldHash = await argon2.hash("a-long-enough-password-123", {
      type: argon2.argon2id,
      memoryCost: 4 * 1024,
      timeCost: 3,
      parallelism: 1,
    });
    expect(needsRehash(oldHash)).toBe(true);
  });
});

describe("isPasswordBreached", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when the API reports the password's suffix as breached", async () => {
    const plain = "password";
    const sha1 = createHash("sha1").update(plain).digest("hex").toUpperCase();
    const suffix = sha1.slice(5);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => `${suffix}:3730471\nUNRELATEDSUFFIX0000000000000000000:1`,
      }),
    );
    expect(await isPasswordBreached(plain)).toBe(true);
  });

  it("returns false when the API's response doesn't contain the password's suffix", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "UNRELATEDSUFFIX0000000000000000000:1",
      }),
    );
    expect(await isPasswordBreached("a-genuinely-unique-passphrase-xyz")).toBe(false);
  });

  it("fails open (returns false) when the API call throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await isPasswordBreached("whatever")).toBe(false);
  });

  it("fails open (returns false) when the API responds non-OK", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, text: async () => "" }));
    expect(await isPasswordBreached("whatever")).toBe(false);
  });

  it("never sends the plaintext password to the API (only a k-anonymized hash prefix)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    await isPasswordBreached("my-secret-password");
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).not.toContain("my-secret-password");
    expect(calledUrl).toMatch(/^https:\/\/api\.pwnedpasswords\.com\/range\/[0-9A-F]{5}$/);
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
