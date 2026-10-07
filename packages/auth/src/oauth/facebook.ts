import type { ExternalIdentity, OAuthProviderAdapter } from "../types.js";
import { OAuthProviderError } from "../types.js";

const AUTHORIZATION_ENDPOINT = "https://www.facebook.com/v19.0/dialog/oauth";
const TOKEN_ENDPOINT = "https://graph.facebook.com/v19.0/oauth/access_token";
const ME_ENDPOINT = "https://graph.facebook.com/v19.0/me";

export interface FacebookAdapterConfig {
  clientId: string;
  clientSecret: string;
}

/** Plain OAuth2, like GitHub — no ID token. Checklist 4.4: "email can be
 * missing. Ask the user for an email and verify it before linking" — handled
 * by reporting `emailVerified: false` whenever Facebook returns no email,
 * which the orchestration layer routes through the same collect-and-verify
 * flow used for Microsoft's untrusted email claim. */
export function createFacebookAdapter(config: FacebookAdapterConfig): OAuthProviderAdapter {
  return {
    name: "facebook",
    callbackMethod: "GET",

    buildAuthorizationUrl({ redirectUri, state, codeChallenge }) {
      const url = new URL(AUTHORIZATION_ENDPOINT);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", "email public_profile");
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      return url.toString();
    },

    async resolveIdentity({ code, redirectUri, codeVerifier }): Promise<ExternalIdentity> {
      const tokenUrl = new URL(TOKEN_ENDPOINT);
      tokenUrl.searchParams.set("client_id", config.clientId);
      tokenUrl.searchParams.set("client_secret", config.clientSecret);
      tokenUrl.searchParams.set("redirect_uri", redirectUri);
      tokenUrl.searchParams.set("code", code);
      tokenUrl.searchParams.set("code_verifier", codeVerifier);

      const tokenResponse = await fetch(tokenUrl);
      if (!tokenResponse.ok) {
        throw new OAuthProviderError("Facebook token exchange failed.", "token_exchange_failed");
      }
      const tokens = (await tokenResponse.json()) as { access_token?: string };
      if (!tokens.access_token) {
        throw new OAuthProviderError(
          "Facebook did not return an access token.",
          "token_exchange_failed",
        );
      }

      const meUrl = new URL(ME_ENDPOINT);
      meUrl.searchParams.set("fields", "id,name,email");
      meUrl.searchParams.set("access_token", tokens.access_token);
      const meResponse = await fetch(meUrl);
      if (!meResponse.ok) {
        throw new OAuthProviderError("Fetching the Facebook profile failed.", "userinfo_failed");
      }
      const me = (await meResponse.json()) as { id: string; name?: string; email?: string };

      return {
        providerAccountId: me.id,
        email: me.email ?? null,
        // Facebook enforces its own email verification at signup, so a
        // PRESENT email is trusted; a MISSING one (the checklist's explicit
        // concern) is not — never silently treated as verified-but-blank.
        emailVerified: Boolean(me.email),
        displayName: me.name ?? null,
      };
    },
  };
}
