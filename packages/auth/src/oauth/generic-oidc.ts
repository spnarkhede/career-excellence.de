import type { ExternalIdentity, OAuthProviderAdapter } from "../types.js";
import { OAuthProviderError } from "../types.js";
import { verifyIdToken } from "./id-token.js";

export interface OidcDiscoveryDocument {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

/** Standard OIDC discovery (`${issuer}/.well-known/openid-configuration`) —
 * called once by the registry at startup, not per sign-in, since the document
 * changes essentially never during a process's lifetime. */
export async function discoverOidcConfiguration(issuer: string): Promise<OidcDiscoveryDocument> {
  const response = await fetch(`${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`);
  if (!response.ok) {
    throw new OAuthProviderError("OIDC discovery failed.", "discovery_failed");
  }
  return (await response.json()) as OidcDiscoveryDocument;
}

export interface GenericOidcAdapterConfig {
  /** Registry key / DB provider value / URL segment — anything but the five named providers. */
  name: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Pre-resolved by the registry (see `discoverOidcConfiguration`) — the
   * interface's `buildAuthorizationUrl` is synchronous, so discovery can't
   * happen lazily inside this adapter on first use. */
  discovery: OidcDiscoveryDocument;
}

/**
 * Checklist item 6 ("Any other provider: same interface and the same
 * tests"): a single adapter driven entirely by standard OIDC discovery
 * rather than a provider-specific class, proving `OAuthProviderAdapter`
 * genuinely generalizes beyond the five named providers. Any OIDC-compliant
 * provider (Okta, Auth0, a self-hosted Keycloak, ...) works by pointing
 * `OAUTH_GENERIC_ISSUER` at it — no new adapter code.
 */
export function createGenericOidcAdapter(config: GenericOidcAdapterConfig): OAuthProviderAdapter {
  return {
    name: config.name,
    callbackMethod: "GET",

    buildAuthorizationUrl({ redirectUri, state, codeChallenge, nonce }) {
      const url = new URL(config.discovery.authorization_endpoint);
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
      const response = await fetch(config.discovery.token_endpoint, {
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
        throw new OAuthProviderError(
          `${config.name} token exchange failed.`,
          "token_exchange_failed",
        );
      }

      const tokens = (await response.json()) as { id_token?: string };
      if (!tokens.id_token) {
        throw new OAuthProviderError(
          `${config.name} did not return an ID token.`,
          "missing_id_token",
        );
      }

      const payload = await verifyIdToken({
        idToken: tokens.id_token,
        jwksUri: config.discovery.jwks_uri,
        issuer: config.issuer,
        audience: config.clientId,
        nonce,
      });

      return {
        providerAccountId: String(payload.sub),
        email: typeof payload.email === "string" ? payload.email : null,
        emailVerified: payload.email_verified === true,
        displayName: typeof payload.name === "string" ? payload.name : null,
      };
    },
  };
}
