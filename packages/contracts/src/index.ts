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
    oauthGoogleStart: "/auth/oauth/google/start",
    oauthGoogleCallback: "/auth/oauth/google/callback",
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
