import { generateKeyPairSync, type KeyObject } from "node:crypto";
import { exportJWK, importJWK, SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFacebookAdapter } from "./facebook.js";
import { createGenericOidcAdapter } from "./generic-oidc.js";
import { createGitHubAdapter } from "./github.js";
import { createGoogleAdapter } from "./google.js";
import { clearJwksCacheForTesting, setJwksResolverForTesting, verifyIdToken } from "./id-token.js";
import { createMicrosoftAdapter } from "./microsoft.js";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateNonce,
  generateState,
} from "./pkce.js";
import { isInAppBrowser, oauthStateCookieSameSite } from "./registry.js";
import { OAuthProviderError } from "../types.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearJwksCacheForTesting();
});

describe("PKCE/state helpers (checklist: PKCE, state)", () => {
  it("generates a code_verifier/code_challenge pair where the challenge is the SHA-256(verifier)", () => {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    expect(verifier).not.toBe(challenge);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/); // base64url SHA-256, no padding
    expect(generateCodeChallenge(verifier)).toBe(challenge);
  });

  it("generates non-repeating state and nonce values", () => {
    expect(generateState()).not.toBe(generateState());
    expect(generateNonce()).not.toBe(generateNonce());
  });
});

describe("isInAppBrowser (checklist 4.1 / 'in app browser behavior')", () => {
  it("detects known embedded-webview user agents", () => {
    expect(isInAppBrowser("Mozilla/5.0 ... FBAN/FB4A;FBAV/300.0")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 10; wv) AppleWebKit")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 ... Instagram 123.0")).toBe(true);
  });

  it("does not flag a normal desktop/mobile browser", () => {
    expect(
      isInAppBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
      ),
    ).toBe(false);
  });

  it("treats a missing user agent as not an in-app browser", () => {
    expect(isInAppBrowser(undefined)).toBe(false);
    expect(isInAppBrowser(null)).toBe(false);
  });
});

describe("oauthStateCookieSameSite (checklist 4.2: Apple needs SameSite=None)", () => {
  it("is 'none' for a POST (form_post) callback provider", () => {
    expect(oauthStateCookieSameSite({ callbackMethod: "POST" } as never)).toBe("none");
  });

  it("is 'lax' for a GET-callback provider", () => {
    expect(oauthStateCookieSameSite({ callbackMethod: "GET" } as never)).toBe("lax");
  });
});

/** Generates a fresh ES256/EC keypair and registers its PUBLIC half as the
 * JWKS resolver for `jwksUri` — `createRemoteJWKSet` makes its own real
 * network request and never goes through `globalThis.fetch`, so stubbing
 * fetch has no effect on it; `setJwksResolverForTesting` is the only way to
 * supply a key for it in a test. Returns the PRIVATE key for signing tokens. */
async function registerTestKey(jwksUri: string): Promise<KeyObject> {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = await exportJWK(publicKey);
  setJwksResolverForTesting(jwksUri, (async () => importJWK(jwk, "ES256")) as never);
  return privateKey as unknown as KeyObject;
}

// The token-exchange/userinfo calls each adapter makes DO go through
// `globalThis.fetch` (unlike JWKS verification, handled above) — building
// real `Response` instances here keeps that part faithful to a real HTTP call.
function stubFetchSequence(responses: Array<{ ok: boolean; json: () => unknown }>) {
  let call = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      const entry = responses[call++];
      if (!entry) throw new Error("stubFetchSequence: no more responses queued");
      return Promise.resolve(
        new Response(JSON.stringify(entry.json()), {
          status: entry.ok ? 200 : 400,
          headers: { "content-type": "application/json" },
        }),
      );
    }),
  );
}

const TEST_JWKS_URI = "https://issuer.test/jwks";

describe("verifyIdToken (checklist: full ID token validation)", () => {
  it("accepts a correctly signed token with matching issuer/audience/nonce", async () => {
    const privateKey = await registerTestKey(TEST_JWKS_URI);
    const token = await new SignJWT({ sub: "user-1", nonce: "nonce-abc" })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setIssuer("https://issuer.test")
      .setAudience("client-1")
      .setExpirationTime("5m")
      .sign(privateKey);

    const payload = await verifyIdToken({
      idToken: token,
      jwksUri: TEST_JWKS_URI,
      issuer: "https://issuer.test",
      audience: "client-1",
      nonce: "nonce-abc",
    });
    expect(payload.sub).toBe("user-1");
  });

  it("rejects a token with the wrong issuer", async () => {
    const privateKey = await registerTestKey(TEST_JWKS_URI);
    const token = await new SignJWT({ sub: "user-1" })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setIssuer("https://someone-else.test")
      .setAudience("client-1")
      .setExpirationTime("5m")
      .sign(privateKey);

    await expect(
      verifyIdToken({
        idToken: token,
        jwksUri: TEST_JWKS_URI,
        issuer: "https://issuer.test",
        audience: "client-1",
      }),
    ).rejects.toThrow(OAuthProviderError);
  });

  it("rejects a token with the wrong audience", async () => {
    const privateKey = await registerTestKey(TEST_JWKS_URI);
    const token = await new SignJWT({ sub: "user-1" })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setIssuer("https://issuer.test")
      .setAudience("someone-elses-app")
      .setExpirationTime("5m")
      .sign(privateKey);

    await expect(
      verifyIdToken({
        idToken: token,
        jwksUri: TEST_JWKS_URI,
        issuer: "https://issuer.test",
        audience: "client-1",
      }),
    ).rejects.toThrow(OAuthProviderError);
  });

  it("rejects an expired token", async () => {
    const privateKey = await registerTestKey(TEST_JWKS_URI);
    const token = await new SignJWT({ sub: "user-1" })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setIssuer("https://issuer.test")
      .setAudience("client-1")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(privateKey);

    await expect(
      verifyIdToken({
        idToken: token,
        jwksUri: TEST_JWKS_URI,
        issuer: "https://issuer.test",
        audience: "client-1",
      }),
    ).rejects.toThrow(OAuthProviderError);
  });

  it("rejects a token whose nonce doesn't match", async () => {
    const privateKey = await registerTestKey(TEST_JWKS_URI);
    const token = await new SignJWT({ sub: "user-1", nonce: "wrong-nonce" })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setIssuer("https://issuer.test")
      .setAudience("client-1")
      .setExpirationTime("5m")
      .sign(privateKey);

    await expect(
      verifyIdToken({
        idToken: token,
        jwksUri: TEST_JWKS_URI,
        issuer: "https://issuer.test",
        audience: "client-1",
        nonce: "expected-nonce",
      }),
    ).rejects.toThrow(OAuthProviderError);
  });

  it("rejects a token signed with a key not present in the JWKS (forged/wrong key)", async () => {
    await registerTestKey(TEST_JWKS_URI);
    const { privateKey: otherPrivateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const forged = await new SignJWT({ sub: "attacker" })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setIssuer("https://issuer.test")
      .setAudience("client-1")
      .setExpirationTime("5m")
      .sign(otherPrivateKey);

    await expect(
      verifyIdToken({
        idToken: forged,
        jwksUri: TEST_JWKS_URI,
        issuer: "https://issuer.test",
        audience: "client-1",
      }),
    ).rejects.toThrow(OAuthProviderError);
  });

  it("rejects a token signed with alg:none", async () => {
    await registerTestKey(TEST_JWKS_URI);
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "attacker" })).toString("base64url");
    const forged = `${header}.${payload}.`;

    await expect(
      verifyIdToken({
        idToken: forged,
        jwksUri: TEST_JWKS_URI,
        issuer: "https://issuer.test",
        audience: "client-1",
      }),
    ).rejects.toThrow(OAuthProviderError);
  });
});

describe("Google adapter (checklist 4.1: use email_verified)", () => {
  const JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";

  it("builds an authorization URL with PKCE S256 and the openid/email/profile scope", () => {
    const adapter = createGoogleAdapter({ clientId: "g-client", clientSecret: "g-secret" });
    const url = new URL(
      adapter.buildAuthorizationUrl({
        redirectUri: "https://app.test/callback",
        state: "s1",
        codeChallenge: "c1",
        nonce: "n1",
      }),
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toContain("email");
    expect(url.searchParams.get("state")).toBe("s1");
  });

  it("reports emailVerified: false when Google's email_verified claim is false", async () => {
    const privateKey = await registerTestKey(JWKS_URI);
    const idToken = await new SignJWT({
      sub: "google-user-1",
      email: "unverified@example.com",
      email_verified: false,
    })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setIssuer("https://accounts.google.com")
      .setAudience("g-client")
      .setExpirationTime("5m")
      .sign(privateKey);

    stubFetchSequence([{ ok: true, json: () => ({ id_token: idToken }) }]);

    const adapter = createGoogleAdapter({ clientId: "g-client", clientSecret: "g-secret" });
    const identity = await adapter.resolveIdentity({
      code: "code-1",
      redirectUri: "https://app.test/callback",
      codeVerifier: "v1",
    });
    expect(identity.emailVerified).toBe(false);
    expect(identity.providerAccountId).toBe("google-user-1");
  });

  it("reports emailVerified: true when Google's email_verified claim is true", async () => {
    const privateKey = await registerTestKey(JWKS_URI);
    const idToken = await new SignJWT({
      sub: "google-user-2",
      email: "verified@example.com",
      email_verified: true,
      name: "Ada",
    })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setIssuer("accounts.google.com")
      .setAudience("g-client")
      .setExpirationTime("5m")
      .sign(privateKey);

    stubFetchSequence([{ ok: true, json: () => ({ id_token: idToken }) }]);

    const adapter = createGoogleAdapter({ clientId: "g-client", clientSecret: "g-secret" });
    const identity = await adapter.resolveIdentity({
      code: "code-1",
      redirectUri: "https://app.test/callback",
      codeVerifier: "v1",
    });
    expect(identity.emailVerified).toBe(true);
    expect(identity.email).toBe("verified@example.com");
    expect(identity.displayName).toBe("Ada");
  });

  it("throws OAuthProviderError when the token exchange fails", async () => {
    stubFetchSequence([{ ok: false, json: () => ({}) }]);
    const adapter = createGoogleAdapter({ clientId: "g-client", clientSecret: "g-secret" });
    await expect(
      adapter.resolveIdentity({
        code: "bad",
        redirectUri: "https://app.test/callback",
        codeVerifier: "v1",
      }),
    ).rejects.toThrow(OAuthProviderError);
  });
});

describe("Microsoft adapter (checklist 4.5: tenant+object-id identity, don't trust email)", () => {
  const JWKS_URI = "https://login.microsoftonline.com/common/discovery/v2.0/keys";

  it("identifies the user by tenant+object id, not email, and never trusts the email claim", async () => {
    const privateKey = await registerTestKey(JWKS_URI);
    const idToken = await new SignJWT({
      sub: "ignored-subject",
      tid: "tenant-123",
      oid: "object-456",
      email: "someone@example.com",
    })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setIssuer("https://login.microsoftonline.com/tenant-123/v2.0")
      .setAudience("ms-client")
      .setExpirationTime("5m")
      .sign(privateKey);

    stubFetchSequence([{ ok: true, json: () => ({ id_token: idToken }) }]);

    const adapter = createMicrosoftAdapter({
      clientId: "ms-client",
      clientSecret: "ms-secret",
      tenant: "common",
    });
    const identity = await adapter.resolveIdentity({
      code: "code-1",
      redirectUri: "https://app.test/callback",
      codeVerifier: "v1",
    });
    expect(identity.providerAccountId).toBe("tenant-123:object-456");
    expect(identity.emailVerified).toBe(false);
  });

  it("rejects a token whose tid doesn't match the tenant embedded in the issuer", async () => {
    const privateKey = await registerTestKey(JWKS_URI);
    const idToken = await new SignJWT({ sub: "x", tid: "tenant-999", oid: "object-456" })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setIssuer("https://login.microsoftonline.com/tenant-123/v2.0") // mismatched tenant
      .setAudience("ms-client")
      .setExpirationTime("5m")
      .sign(privateKey);

    stubFetchSequence([{ ok: true, json: () => ({ id_token: idToken }) }]);

    const adapter = createMicrosoftAdapter({
      clientId: "ms-client",
      clientSecret: "ms-secret",
      tenant: "common",
    });
    await expect(
      adapter.resolveIdentity({
        code: "code-1",
        redirectUri: "https://app.test/callback",
        codeVerifier: "v1",
      }),
    ).rejects.toThrow(OAuthProviderError);
  });
});

describe("GitHub adapter (checklist 4.3: only a primary verified email)", () => {
  it("uses only the primary AND verified email from the email list", async () => {
    stubFetchSequence([
      { ok: true, json: () => ({ access_token: "gh-token" }) }, // secret-scan-ignore-line: fake fixture
      { ok: true, json: () => ({ id: 42, name: "Ada" }) },
      {
        ok: true,
        json: () => [
          { email: "secondary@example.com", primary: false, verified: true },
          { email: "primary-unverified@example.com", primary: true, verified: false },
          { email: "primary-verified@example.com", primary: true, verified: true },
        ],
      },
    ]);

    const adapter = createGitHubAdapter({ clientId: "gh-client", clientSecret: "gh-secret" });
    const identity = await adapter.resolveIdentity({
      code: "code-1",
      redirectUri: "https://app.test/callback",
      codeVerifier: "v1",
    });
    expect(identity.email).toBe("primary-verified@example.com");
    expect(identity.emailVerified).toBe(true);
    expect(identity.providerAccountId).toBe("42");
  });

  it("reports emailVerified: false when there is no primary+verified email", async () => {
    stubFetchSequence([
      { ok: true, json: () => ({ access_token: "gh-token" }) }, // secret-scan-ignore-line: fake fixture
      { ok: true, json: () => ({ id: 42, name: "Ada" }) },
      {
        ok: true,
        json: () => [{ email: "primary-unverified@example.com", primary: true, verified: false }],
      },
    ]);

    const adapter = createGitHubAdapter({ clientId: "gh-client", clientSecret: "gh-secret" });
    const identity = await adapter.resolveIdentity({
      code: "code-1",
      redirectUri: "https://app.test/callback",
      codeVerifier: "v1",
    });
    expect(identity.email).toBeNull();
    expect(identity.emailVerified).toBe(false);
  });

  it("throws OAuthProviderError when the token exchange fails", async () => {
    stubFetchSequence([{ ok: false, json: () => ({}) }]);
    const adapter = createGitHubAdapter({ clientId: "gh-client", clientSecret: "gh-secret" });
    await expect(
      adapter.resolveIdentity({
        code: "bad",
        redirectUri: "https://app.test/callback",
        codeVerifier: "v1",
      }),
    ).rejects.toThrow(OAuthProviderError);
  });
});

describe("Facebook adapter (checklist 4.4: email can be missing)", () => {
  it("reports emailVerified: false when Facebook returns no email", async () => {
    stubFetchSequence([
      { ok: true, json: () => ({ access_token: "fb-token" }) }, // secret-scan-ignore-line: fake fixture
      { ok: true, json: () => ({ id: "fb-1", name: "Sam" }) },
    ]);

    const adapter = createFacebookAdapter({ clientId: "fb-client", clientSecret: "fb-secret" });
    const identity = await adapter.resolveIdentity({
      code: "code-1",
      redirectUri: "https://app.test/callback",
      codeVerifier: "v1",
    });
    expect(identity.email).toBeNull();
    expect(identity.emailVerified).toBe(false);
    expect(identity.providerAccountId).toBe("fb-1");
  });

  it("trusts a present email as verified", async () => {
    stubFetchSequence([
      { ok: true, json: () => ({ access_token: "fb-token" }) }, // secret-scan-ignore-line: fake fixture
      { ok: true, json: () => ({ id: "fb-1", name: "Sam", email: "sam@example.com" }) },
    ]);

    const adapter = createFacebookAdapter({ clientId: "fb-client", clientSecret: "fb-secret" });
    const identity = await adapter.resolveIdentity({
      code: "code-1",
      redirectUri: "https://app.test/callback",
      codeVerifier: "v1",
    });
    expect(identity.email).toBe("sam@example.com");
    expect(identity.emailVerified).toBe(true);
  });
});

describe("Generic OIDC adapter (checklist item 6: any other provider, same interface)", () => {
  const JWKS_URI = "https://generic.test/jwks";

  it("builds an authorization URL and resolves an identity using a discovered endpoint set", async () => {
    const privateKey = await registerTestKey(JWKS_URI);
    const idToken = await new SignJWT({
      sub: "generic-user-1",
      email: "generic@example.com",
      email_verified: true,
    })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setIssuer("https://generic.test")
      .setAudience("generic-client")
      .setExpirationTime("5m")
      .sign(privateKey);

    stubFetchSequence([{ ok: true, json: () => ({ id_token: idToken }) }]);

    const adapter = createGenericOidcAdapter({
      name: "okta",
      issuer: "https://generic.test",
      clientId: "generic-client",
      clientSecret: "generic-secret",
      discovery: {
        authorization_endpoint: "https://generic.test/authorize",
        token_endpoint: "https://generic.test/token",
        jwks_uri: JWKS_URI,
      },
    });

    const url = adapter.buildAuthorizationUrl({
      redirectUri: "https://app.test/callback",
      state: "s1",
      codeChallenge: "c1",
    });
    expect(url).toContain("https://generic.test/authorize");

    const identity = await adapter.resolveIdentity({
      code: "code-1",
      redirectUri: "https://app.test/callback",
      codeVerifier: "v1",
    });
    expect(identity.providerAccountId).toBe("generic-user-1");
    expect(identity.emailVerified).toBe(true);
  });
});
