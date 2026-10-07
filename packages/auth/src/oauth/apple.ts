import { importPKCS8, SignJWT } from "jose";
import type { ExternalIdentity, OAuthProviderAdapter } from "../types.js";
import { OAuthProviderError } from "../types.js";
import { verifyIdToken } from "./id-token.js";

const AUTHORIZATION_ENDPOINT = "https://appleid.apple.com/auth/authorize";
const TOKEN_ENDPOINT = "https://appleid.apple.com/auth/token";
const JWKS_URI = "https://appleid.apple.com/auth/keys";
const ISSUER = "https://appleid.apple.com";
// Apple's own client-secret JWTs are allowed to live up to 6 months; minting
// one fresh per request is simpler than caching one across process restarts
// and ES256 signing is cheap, so there's no real cost to not caching it.
const CLIENT_SECRET_TTL_SECONDS = 5 * 60;

export interface AppleAdapterConfig {
  /** The Services ID — the OAuth client_id for web auth, distinct from the app's Bundle ID. */
  clientId: string;
  teamId: string;
  keyId: string;
  /** PKCS8 PEM of the private key downloaded from the Apple Developer portal. */
  privateKey: string;
}

async function signClientSecret(config: AppleAdapterConfig): Promise<string> {
  const key = await importPKCS8(config.privateKey, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt()
    .setExpirationTime(`${CLIENT_SECRET_TTL_SECONDS}s`)
    .setAudience(ISSUER)
    .setSubject(config.clientId)
    .sign(key);
}

/** Apple's user-info payload on the FIRST authorization only — never sent
 * again on subsequent sign-ins, so the callback handler must capture and
 * store it the first time it ever arrives (checklist 4.2: "Name arrives only
 * on first authorization, so store it then"). */
export interface AppleFormPostBody {
  code: string;
  state: string;
  user?: string; // JSON string: { name?: { firstName, lastName }, email?: string }
}

export function parseAppleUserField(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { name?: { firstName?: string; lastName?: string } };
    const first = parsed.name?.firstName ?? "";
    const last = parsed.name?.lastName ?? "";
    const full = `${first} ${last}`.trim();
    return full || null;
  } catch {
    return null;
  }
}

/**
 * Sign in with Apple is OIDC-shaped (an ID token, JWKS-verifiable) but with
 * two web-specific quirks the checklist calls out: the callback is a
 * cross-site POST (`response_mode=form_post`), and the user's name is only
 * ever included in that POST body on the FIRST authorization — this adapter
 * resolves the ID-token identity; capturing the one-time name field is the
 * callback handler's job (see `parseAppleUserField`/`AppleFormPostBody` above),
 * since the adapter's `resolveIdentity` only sees the token exchange, not the
 * raw form body.
 */
export function createAppleAdapter(config: AppleAdapterConfig): OAuthProviderAdapter {
  return {
    name: "apple",
    callbackMethod: "POST",

    buildAuthorizationUrl({ redirectUri, state, codeChallenge, nonce }) {
      const url = new URL(AUTHORIZATION_ENDPOINT);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      // Requesting `name`/`email` forces Apple to require form_post.
      url.searchParams.set("response_mode", "form_post");
      url.searchParams.set("scope", "name email");
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      if (nonce) url.searchParams.set("nonce", nonce);
      return url.toString();
    },

    async resolveIdentity({ code, redirectUri, codeVerifier, nonce }): Promise<ExternalIdentity> {
      const clientSecret = await signClientSecret(config);
      const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: config.clientId,
          client_secret: clientSecret,
          code_verifier: codeVerifier,
        }),
      });
      if (!response.ok) {
        throw new OAuthProviderError("Apple token exchange failed.", "token_exchange_failed");
      }

      const tokens = (await response.json()) as { id_token?: string };
      if (!tokens.id_token) {
        throw new OAuthProviderError("Apple did not return an ID token.", "missing_id_token");
      }

      const payload = await verifyIdToken({
        idToken: tokens.id_token,
        jwksUri: JWKS_URI,
        issuer: ISSUER,
        audience: config.clientId,
        nonce,
      });

      // Apple sends `email_verified` as either a boolean or the strings
      // "true"/"false" depending on the calling client — handle both. A
      // private-relay address (`@privaterelay.appleid.com`) is a normal,
      // Apple-verified, usable email for our purposes (checklist "Handle
      // private relay emails") — it still uniquely and durably identifies
      // this user's inbox via Apple's relay, so no special-casing is needed
      // beyond treating it like any other verified email.
      const emailVerifiedClaim = payload.email_verified;
      const emailVerified = emailVerifiedClaim === true || emailVerifiedClaim === "true";

      return {
        providerAccountId: String(payload.sub),
        email: typeof payload.email === "string" ? payload.email : null,
        emailVerified,
        // The ID token never carries a name — only the one-time form_post
        // body does (see module doc comment above); the callback handler is
        // responsible for merging that in on first authorization.
        displayName: null,
      };
    },
  };
}
