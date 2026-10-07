import type { AuthenticatedPrincipal, SessionMetadata, User } from "@saas/types";

/** REST contract shared between apps/web, apps/admin and apps/api. Keep in sync with the OpenAPI spec. */

export interface LoginResponse {
  user: Pick<User, "id" | "email" | "status">;
}

export interface MeResponse {
  principal: AuthenticatedPrincipal;
}

export interface ListSessionsResponse {
  sessions: SessionMetadata[];
}

export interface ApiError {
  requestId: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export const API_ROUTES = {
  auth: {
    signup: "/auth/signup",
    login: "/auth/login",
    logout: "/auth/logout",
    refresh: "/auth/refresh",
    me: "/auth/me",
    verifyEmail: "/auth/verify-email",
    resendVerification: "/auth/resend-verification",
    requestPasswordReset: "/auth/password-reset/request",
    resetPassword: "/auth/password-reset/confirm",
    requestOtp: "/auth/otp/request",
    verifyOtp: "/auth/otp/verify",
    // Phase 9: one provider module per provider behind the same two routes —
    // `provider` is whatever @saas/auth's OAuthProviderAdapter registry has
    // registered (google/microsoft/github/facebook/apple, or the configured
    // "any other provider" generic adapter), never hardcoded per name.
    oauthProviders: "/auth/oauth/providers",
    oauthStart: (provider: string) => `/auth/oauth/${provider}/start`,
    oauthCallback: (provider: string) => `/auth/oauth/${provider}/callback`,
    oauthAccounts: "/auth/oauth/accounts",
    oauthUnlinkAccount: (provider: string) => `/auth/oauth/accounts/${provider}`,
    oauthSubmitPendingEmail: "/auth/oauth/pending/submit-email",
    oauthVerifyPendingEmail: "/auth/oauth/pending/verify",
    sessions: "/auth/sessions",
    revokeSession: (sessionId: string) => `/auth/sessions/${sessionId}`,
    revokeOtherSessions: "/auth/sessions/revoke-others",
  },
  profile: {
    me: "/profile/me",
  },
  health: {
    liveness: "/health/live",
    readiness: "/health/ready",
  },
} as const;
