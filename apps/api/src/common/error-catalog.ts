/**
 * Phase 12 task 3: "one mapping layer from provider and database errors to
 * catalog codes." This is that layer's data half — `docs/auth/ERRORS.md` is
 * the human-readable catalog; this file is the machine-checkable one, so a
 * test can assert "this code's documented status/message is actually what
 * gets thrown" without hand-copying literals into every test file.
 *
 * Every code any auth/profile/common route can produce, with its HTTP
 * status, the exact user-facing message, and whether a safe recovery path
 * exists. `recovery: null` is only valid when the error is genuinely
 * terminal for the user (e.g. `ACCOUNT_DISABLED` — contact support IS the
 * recovery path, so it's never actually null in this catalog; kept as a
 * type for completeness/future entries).
 */
export interface ErrorCatalogEntry {
  status: number;
  message: string;
  /** Checklist task 4: "messages give a recovery path... and do not hide
   * real failures behind 'Something went wrong'." One of a fixed set of
   * recovery actions, or null only when truly none exists. */
  recovery:
    | "retry"
    | "resend"
    | "reset_password"
    | "sign_in"
    | "sign_up"
    | "wait"
    | "contact_support"
    | null;
}

export const AUTH_ERROR_CATALOG: Record<string, ErrorCatalogEntry> = {
  // --- Credentials / login ---
  INVALID_CREDENTIALS: {
    status: 401,
    message: "Invalid email or password.",
    recovery: "retry",
  },
  ACCOUNT_DISABLED: {
    status: 403,
    message: "This account is disabled. Contact support for help.",
    recovery: "contact_support",
  },
  ACCOUNT_LOCKED: {
    status: 423,
    message: "This account is temporarily locked due to repeated failed attempts.",
    recovery: "wait",
  },
  EMAIL_NOT_VERIFIED: {
    status: 403,
    message: "Please verify your email address before signing in.",
    recovery: "resend",
  },

  // --- Session / tokens ---
  SESSION_EXPIRED: {
    status: 401,
    message: "Session expired or revoked. Please sign in again.",
    recovery: "sign_in",
  },
  SESSION_REVOKED: {
    status: 401,
    message: "Session expired or revoked. Please sign in again.",
    recovery: "sign_in",
  },
  INVALID_TOKEN: {
    status: 401,
    message: "Invalid or expired session.",
    recovery: "sign_in",
  },
  CURRENT_PASSWORD_INCORRECT: {
    status: 401,
    message: "Current password is incorrect.",
    recovery: "retry",
  },

  // --- Password reset ---
  RESET_TOKEN_INVALID: {
    status: 400,
    message: "This link is invalid.",
    recovery: "resend",
  },
  RESET_TOKEN_USED: {
    status: 400,
    message: "This link has already been used.",
    recovery: "resend",
  },
  RESET_TOKEN_EXPIRED: {
    status: 400,
    message: "This link has expired.",
    recovery: "resend",
  },
  PASSWORD_BREACHED: {
    status: 400,
    message: "This password has appeared in a known data breach. Please choose a different one.",
    recovery: "retry",
  },

  // --- OTP / magic link ---
  OTP_INVALID_OR_EXPIRED: {
    status: 401,
    message: "Invalid or expired code.",
    recovery: "resend",
  },
  MAGIC_LINK_INVALID: {
    status: 401,
    message: "This sign-in link is invalid or has already been used.",
    recovery: "resend",
  },
  MAGIC_LINK_EXPIRED: {
    status: 401,
    message: "This sign-in link has expired.",
    recovery: "resend",
  },

  // --- Authorization ---
  FORBIDDEN: {
    status: 403,
    message: "You do not have permission to do that.",
    recovery: "contact_support",
  },

  // --- Rate limiting ---
  TOO_MANY_REQUESTS: {
    status: 429,
    message: "Too many attempts. Please wait a moment and try again.",
    recovery: "wait",
  },

  // --- Infrastructure ---
  SERVICE_UNAVAILABLE: {
    status: 503,
    message: "The service is temporarily unavailable. Please try again.",
    recovery: "retry",
  },
  INTERNAL_ERROR: {
    status: 500,
    message:
      "Something went wrong on our end. Please try again, and contact support with the request ID below if it keeps happening.",
    recovery: "contact_support",
  },
} satisfies Record<string, ErrorCatalogEntry>;

export type AuthErrorCode = keyof typeof AUTH_ERROR_CATALOG;
