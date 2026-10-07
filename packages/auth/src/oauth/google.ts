import type { ExternalIdentity, OAuthProviderAdapter } from "../types.js";
import { OAuthProviderError } from "../types.js";
import { verifyIdToken } from "./id-token.js";

const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
// Google has historically used both forms for the same tokens.
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export interface GoogleAdapterConfig {
  clientId: string;
  clientSecret: string;
}

export function createGoogleAdapter(config: GoogleAdapterConfig): OAuthProviderAdapter {
  return {
    name: "google",
    callbackMethod: "GET",

    buildAuthorizationUrl({ redirectUri, state, codeChallenge, nonce }) {
      const url = new URL(AUTHORIZATION_ENDPOINT);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      if (nonce) url.searchParams.set("nonce", nonce);
      return url.toString();
    },

    async resolveIdentity({ code, redirectUri, codeVerifier, nonce }): Promise<ExternalIdentity> {
      const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code_verifier: codeVerifier,
        }),
      });
      if (!response.ok) {
        throw new OAuthProviderError("Google token exchange failed.", "token_exchange_failed");
      }

      const tokens = (await response.json()) as { id_token?: string };
      if (!tokens.id_token) {
        throw new OAuthProviderError("Google did not return an ID token.", "missing_id_token");
      }

      const payload = await verifyIdToken({
        idToken: tokens.id_token,
        jwksUri: JWKS_URI,
        issuer: ISSUERS,
        audience: config.clientId,
        nonce,
      });

      // Checklist 4.1 (Google): use the `email_verified` claim explicitly —
      // never assume an email is verified just because Google returned one.
      return {
        providerAccountId: String(payload.sub),
        email: typeof payload.email === "string" ? payload.email : null,
        emailVerified: payload.email_verified === true,
        displayName: typeof payload.name === "string" ? payload.name : null,
      };
    },
  };
}
