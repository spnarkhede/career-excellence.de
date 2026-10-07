/**
 * Application authentication abstraction.
 *
 * The rest of the application (NestJS controllers, services) depends only on this
 * interface, never on a specific managed authentication provider's SDK. Swapping
 * providers means writing a new adapter here, not rewriting application code.
 */

export interface IdentityResult {
  providerId: string;
  email: string;
}

export interface AuthProvider {
  /** Verifies email + password and returns the provider identity, or null if invalid. */
  verifyPassword(email: string, password: string): Promise<IdentityResult | null>;
  /** Creates a new identity for the given email/password. Throws if the email is already registered. */
  createPasswordIdentity(email: string, password: string): Promise<IdentityResult>;
  changePassword(providerId: string, newPassword: string): Promise<void>;
}

/**
 * Phase 9: the normalized shape every OAuthProviderAdapter resolves an
 * external identity to, regardless of whether the provider speaks OIDC (an
 * ID token) or plain OAuth2 (a userinfo API call). `emailVerified` is the
 * single signal the rest of the app uses to decide whether an email can be
 * trusted at all — a provider that can't assert this reliably (Microsoft) or
 * sometimes returns no email (Facebook, GitHub with no verified primary)
 * reports `emailVerified: false`, which routes through the same
 * "collect-and-verify-an-email-ourselves" flow regardless of provider.
 */
export interface ExternalIdentity {
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
}

export interface OAuthAuthorizationRequest {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  /** OIDC providers only. */
  nonce?: string;
}

export interface OAuthTokenExchangeInput {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  /** OIDC providers only — validated against the ID token's own `nonce` claim. */
  nonce?: string;
}

/** Thrown by an adapter for any provider-side failure (exchange error, token
 * validation failure, provider error response) — carries a stable `code` the
 * callback handler maps to a specific user-facing retry state, without ever
 * surfacing the provider's raw error text. */
export class OAuthProviderError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "OAuthProviderError";
  }
}

/**
 * One implementation per provider, all behind this same interface (checklist
 * "one provider module per provider behind a shared interface" / "any other
 * provider: same interface and the same tests"). `name` doubles as the
 * `OauthAccount.provider` DB value and the `/auth/oauth/:name/...` URL
 * segment.
 */
export interface OAuthProviderAdapter {
  name: string;
  /**
   * Apple's web callback arrives as a cross-site POST (`response_mode=form_post`)
   * — every other provider here redirects back with a GET. This controls
   * which HTTP method the callback route accepts and, critically, the state
   * cookie's SameSite attribute (None+Secure for a cross-site POST to even be
   * able to carry the cookie; Lax is sufficient and safer for a top-level GET
   * redirect).
   */
  callbackMethod: "GET" | "POST";
  buildAuthorizationUrl(request: OAuthAuthorizationRequest): string;
  /**
   * Exchanges the authorization code for tokens, then validates whatever the
   * provider returns — full ID token validation (signature, issuer, audience,
   * expiry, nonce) for OIDC providers, or a userinfo API call plus whatever
   * provider-specific email rule applies (GitHub's primary-verified-email
   * list, Facebook's possibly-absent email) for plain OAuth2 providers.
   * Throws `OAuthProviderError` on any failure — never returns a partial or
   * unvalidated identity.
   */
  resolveIdentity(input: OAuthTokenExchangeInput): Promise<ExternalIdentity>;
}
