import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { OAuthProviderError } from "../types.js";

// One JWKS fetcher per URI, reused across calls — `createRemoteJWKSet` already
// caches the key set internally and re-fetches only on a cache miss/rotation,
// but that caching is per-instance, so a fresh instance per call would never
// benefit from it. Memoized at module scope, not per-request.
const jwksCache = new Map<string, JWTVerifyGetKey>();

/** Exported so an adapter that needs to call `jwtVerify` directly (Microsoft,
 * which validates the issuer manually against the token's own tenant claim
 * rather than through `verifyIdToken`'s fixed-issuer check) still shares the
 * same memoized/testable JWKS resolver, instead of creating its own
 * `createRemoteJWKSet` instance that `setJwksResolverForTesting` can't reach. */
export function getJwks(jwksUri: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksCache.set(jwksUri, jwks);
  }
  return jwks;
}

/** Test-only seam: clears the memoized JWKS fetchers so a test that reuses
 * the same jwksUri with freshly generated keys isn't served a stale
 * cached key set from an earlier test. Never called in production. */
export function clearJwksCacheForTesting(): void {
  jwksCache.clear();
}

/** Test-only seam: `createRemoteJWKSet` makes a real network request using
 * its own internal HTTP client — it does NOT go through `globalThis.fetch`,
 * so stubbing `fetch` in a test has no effect on it. This injects a resolver
 * function directly for a given jwksUri, bypassing the network entirely.
 * Never called in production. */
export function setJwksResolverForTesting(jwksUri: string, resolver: JWTVerifyGetKey): void {
  jwksCache.set(jwksUri, resolver);
}

export interface VerifyIdTokenParams {
  idToken: string;
  jwksUri: string;
  /** A single issuer, or every issuer value acceptable (some providers use
   * more than one historical issuer string for the same tokens). */
  issuer: string | string[];
  audience: string;
  /** Checked against the token's own `nonce` claim when provided — omit only
   * for a provider/flow that genuinely has no nonce to check. */
  nonce?: string;
}

/** Full OIDC ID token validation: signature (via JWKS), issuer, audience,
 * expiry (jose checks `exp`/`nbf` automatically), and nonce — checklist "full
 * ID token validation (signature, issuer, audience, expiry, nonce)." Throws
 * `OAuthProviderError` on any failure, never returns a partially-checked
 * payload. */
export async function verifyIdToken({
  idToken,
  jwksUri,
  issuer,
  audience,
  nonce,
}: VerifyIdTokenParams): Promise<JWTPayload> {
  let payload: JWTPayload;
  try {
    const result = await jwtVerify(idToken, getJwks(jwksUri), { issuer, audience });
    payload = result.payload;
  } catch {
    throw new OAuthProviderError(
      "ID token signature/claims validation failed.",
      "id_token_invalid",
    );
  }

  if (nonce !== undefined && payload.nonce !== nonce) {
    throw new OAuthProviderError("ID token nonce did not match.", "id_token_nonce_mismatch");
  }

  return payload;
}
