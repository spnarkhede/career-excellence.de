import type { ExternalIdentity, OAuthProviderAdapter } from "../types.js";
import { OAuthProviderError } from "../types.js";

const AUTHORIZATION_ENDPOINT = "https://github.com/login/oauth/authorize";
const TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const USER_ENDPOINT = "https://api.github.com/user";
const EMAILS_ENDPOINT = "https://api.github.com/user/emails";

export interface GitHubAdapterConfig {
  clientId: string;
  clientSecret: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/** GitHub is plain OAuth2, not OIDC — there is no ID token to validate; the
 * identity comes from two REST calls instead (checklist 4.3: "fetch the email
 * list and use only a primary verified email"). PKCE is still used on the
 * authorization-code exchange (GitHub supports it), even though there's no
 * ID token at the end of it. */
export function createGitHubAdapter(config: GitHubAdapterConfig): OAuthProviderAdapter {
  return {
    name: "github",
    callbackMethod: "GET",

    buildAuthorizationUrl({ redirectUri, state, codeChallenge }) {
      const url = new URL(AUTHORIZATION_ENDPOINT);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", "read:user user:email");
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      return url.toString();
    },

    async resolveIdentity({ code, redirectUri, codeVerifier }): Promise<ExternalIdentity> {
      const tokenResponse = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          code,
          redirect_uri: redirectUri,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code_verifier: codeVerifier,
        }),
      });
      if (!tokenResponse.ok) {
        throw new OAuthProviderError("GitHub token exchange failed.", "token_exchange_failed");
      }
      const tokens = (await tokenResponse.json()) as { access_token?: string; error?: string };
      if (!tokens.access_token) {
        throw new OAuthProviderError(
          "GitHub did not return an access token.",
          "token_exchange_failed",
        );
      }

      const authHeaders = {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "career-excellence-auth",
      };

      const userResponse = await fetch(USER_ENDPOINT, { headers: authHeaders });
      if (!userResponse.ok) {
        throw new OAuthProviderError("Fetching the GitHub user failed.", "userinfo_failed");
      }
      const user = (await userResponse.json()) as { id: number; name?: string | null };

      const emailsResponse = await fetch(EMAILS_ENDPOINT, { headers: authHeaders });
      if (!emailsResponse.ok) {
        throw new OAuthProviderError(
          "Fetching the GitHub user's emails failed.",
          "userinfo_failed",
        );
      }
      const emails = (await emailsResponse.json()) as GitHubEmail[];
      // Checklist 4.3: the primary email can be private/unverified — only a
      // primary AND verified email is usable; anything else (including a
      // merely-verified-but-not-primary address) is treated the same as "no
      // usable email," routing through the collect-and-verify-an-email flow.
      const primaryVerified = emails.find((e) => e.primary && e.verified);

      return {
        providerAccountId: String(user.id),
        email: primaryVerified?.email ?? null,
        emailVerified: Boolean(primaryVerified),
        displayName: user.name ?? null,
      };
    },
  };
}
