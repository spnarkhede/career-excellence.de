import { jwtVerify } from "jose";
import type { ExternalIdentity, OAuthProviderAdapter } from "../types.js";
import { OAuthProviderError } from "../types.js";
import { getJwks } from "./id-token.js";

const JWKS_URI = "https://login.microsoftonline.com/common/discovery/v2.0/keys";
// Multi-tenant: the issuer embeds the tenant actually used, so it can't be a
// single fixed string the way Google's can — checklist "validate the issuer
// against the tenant ID."
const ISSUER_PATTERN = /^https:\/\/login\.microsoftonline\.com\/([^/]+)\/v2\.0$/;

export interface MicrosoftAdapterConfig {
  clientId: string;
  clientSecret: string;
  /** "common", "organizations", "consumers", or a specific tenant GUID. */
  tenant: string;
}

function endpoint(tenant: string, segment: "authorize" | "token"): string {
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/${segment}`;
}

export function createMicrosoftAdapter(config: MicrosoftAdapterConfig): OAuthProviderAdapter {
  return {
    name: "microsoft",
    callbackMethod: "GET",

    buildAuthorizationUrl({ redirectUri, state, codeChallenge, nonce }) {
      const url = new URL(endpoint(config.tenant, "authorize"));
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("response_mode", "query");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      if (nonce) url.searchParams.set("nonce", nonce);
      return url.toString();
    },

    async resolveIdentity({ code, redirectUri, codeVerifier, nonce }): Promise<ExternalIdentity> {
      const response = await fetch(endpoint(config.tenant, "token"), {
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
        throw new OAuthProviderError("Microsoft token exchange failed.", "token_exchange_failed");
      }

      const tokens = (await response.json()) as { id_token?: string };
      if (!tokens.id_token) {
        throw new OAuthProviderError("Microsoft did not return an ID token.", "missing_id_token");
      }

      // Signature/audience/expiry checked by jose; issuer is validated
      // manually below since it's tenant-dependent, not a fixed string.
      let payload;
      try {
        ({ payload } = await jwtVerify(tokens.id_token, getJwks(JWKS_URI), {
          audience: config.clientId,
        }));
      } catch {
        throw new OAuthProviderError(
          "ID token signature/claims validation failed.",
          "id_token_invalid",
        );
      }

      const issuerMatch = ISSUER_PATTERN.exec(String(payload.iss ?? ""));
      const tid = typeof payload.tid === "string" ? payload.tid : null;
      // The tenant embedded in the issuer URL must agree with the token's own
      // `tid` claim — checklist "validate the issuer against the tenant ID."
      if (!issuerMatch || !tid || issuerMatch[1] !== tid) {
        throw new OAuthProviderError(
          "Unexpected Microsoft issuer/tenant.",
          "issuer_tenant_mismatch",
        );
      }
      if (nonce !== undefined && payload.nonce !== nonce) {
        throw new OAuthProviderError("ID token nonce did not match.", "id_token_nonce_mismatch");
      }

      const oid = typeof payload.oid === "string" ? payload.oid : null;
      if (!oid) {
        throw new OAuthProviderError("Microsoft token missing an object id.", "missing_oid");
      }

      return {
        // Checklist 4.5 (Microsoft): identify by tenant ID + object ID, never
        // email — `email`/`preferred_username` can be a UPN, a guest's home-
        // tenant address, or otherwise unreliable for identity.
        providerAccountId: `${tid}:${oid}`,
        email: typeof payload.email === "string" ? payload.email : null,
        // Microsoft has no standard, reliably-present "this email is
        // verified" claim the way Google does — checklist "do not trust the
        // email claim for linking." Reported as unverified unconditionally,
        // which routes it through the same collect-and-verify-an-email flow
        // used for Facebook's missing-email case, rather than ever trusting
        // it enough to auto-match an existing account.
        emailVerified: false,
        displayName: typeof payload.name === "string" ? payload.name : null,
      };
    },
  };
}
