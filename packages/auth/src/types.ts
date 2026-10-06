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

export interface OAuthStartResult {
  authorizationUrl: string;
  state: string;
  codeVerifier?: string;
}

export interface OAuthCallbackInput {
  code: string;
  state: string;
  expectedState: string;
  codeVerifier?: string;
}

export interface OAuthProvider {
  name: "google" | "microsoft" | "github";
  start(redirectUri: string): Promise<OAuthStartResult>;
  handleCallback(input: OAuthCallbackInput): Promise<IdentityResult>;
}
