# Authentication

## Trust chain

Identity is established by the authentication provider (`@saas/auth`'s `AuthProvider`
interface — swap the stub implementation for a managed provider in production).
Authorization is established independently by the API. An authenticated user does not
automatically have permission to perform any given operation.

## Sessions

- Access token: short-lived JWT (`AUTH_ACCESS_TOKEN_TTL`, default 15 min), stored in an
  `HttpOnly`, `Secure` (outside local dev), `SameSite=Lax` cookie.
- Refresh token: opaque random token, stored **hashed** in the `sessions` table, rotated
  on every use (`AUTH_REFRESH_TOKEN_TTL`, default 30 days).
- Server-side session metadata (`sessions` table): id, user id, created/last-active/expiry
  timestamps, user agent, IP, revocation time + reason.
- Users can list and revoke their own sessions (`GET/DELETE /auth/sessions`) and revoke
  all other sessions (`POST /auth/sessions/revoke-others`).

## Login lifecycle

1. Client validates the form (Zod), then `POST /auth/login`.
2. Rate limiting (`@nestjs/throttler`) and the auth provider verify credentials.
3. Account status is checked (`suspended`/`deleted` accounts are rejected).
4. A new session is created, tokens are issued, cookies are set.
5. A `login_succeeded` (or `login_failed`) security event is recorded.
6. The client fetches `/auth/me` to resolve the authenticated principal and permissions.

## Signup lifecycle

1. Client validates, then `POST /auth/signup`.
2. The auth provider creates a password identity; a `User` + `Profile` row is created with
   `pending_verification` status and the default `user` role is assigned.
3. A one-time, hashed, short-lived verification token is created and emailed.
4. The user follows the verification link → `POST /auth/verify-email` → token is validated,
   single-use enforced, and the account becomes `active`.

## Password reset lifecycle

1. `POST /auth/password-reset/request` always returns the same neutral message — it never
   reveals whether the account exists.
2. A one-time, hashed, 1-hour token is emailed.
3. `POST /auth/password-reset/confirm` validates the token (not expired, not consumed),
   changes the password, invalidates the token, and revokes every existing session.

## OTP lifecycle

1. `POST /auth/otp/request` — rate limited, neutral response, emails a 6-digit code
   (hashed before storage, 5 minute expiry).
2. `POST /auth/otp/verify` — tracks failed attempts (locks out after 5), single-use,
   issues a session on success.

## OAuth lifecycle (Google, optional Microsoft/GitHub)

Implemented via the `OAuthProvider` interface in `@saas/auth`. Follow PKCE + `state`
verification, validate the callback against the exact registered redirect URI, and link
to an existing account only through an explicit, safe linking flow (never silently
auto-link on email match alone).

## Refresh lifecycle

`POST /auth/refresh` reads the refresh cookie, validates it against the database
(not expired, not revoked), rotates it (old token is revoked, a new session + tokens are
issued), and updates `lastActiveAt`. If validation fails, the client must treat the user
as logged out and redirect to login.

## Logout lifecycle

`POST /auth/logout` revokes the current session server-side, clears both cookies, and
records a `logout` security event. A revoked session cannot be reused via browser history
because the API independently validates on every request.

## Security events

Every lifecycle step above writes to the `security_events` table: `signup`,
`email_verified`, `login_succeeded`, `login_failed`, `login_blocked`, `logout`,
`password_reset_requested`, `password_reset_completed`, `otp_requested`,
`otp_login_succeeded`, `session_revoked`, `sessions_revoked_all_others`.
