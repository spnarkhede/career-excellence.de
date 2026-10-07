# Error Handling

Phase 12 of the auth workstream. Covers every HTTP status family the API can
return, every network/timeout/provider/database failure class, and every
named error code in `apps/api/src/common/error-catalog.ts`
(`AUTH_ERROR_CATALOG`) — that file is the machine-checkable source of truth;
this document is the human-readable one. `apps/api/test/phase12-error-catalog.spec.ts`
and `apps/api/test/all-exceptions-filter.spec.ts` assert they agree.

## Response shape

Every error response from `apps/api` (via `AllExceptionsFilter`,
`apps/api/src/common/all-exceptions.filter.ts`) is exactly:

```json
{
  "requestId": "string",
  "code": "STRING_CODE",
  "message": "Human-readable sentence.",
  "details": { "...": "optional" }
}
```

- `requestId` — from `apps/api/src/common/request-id.middleware.ts` (echoes
  the client's `x-request-id` if present and ≤128 chars, else a fresh
  `randomUUID()`), also echoed back as the `x-request-id` response header.
  Always present; `"unknown"` only if middleware somehow never ran.
- `code` — a stable, machine-readable string. Never the raw exception class
  name, never a Prisma/provider error code.
- `message` — always gives a recovery path (see "Recovery paths" below);
  never a bare "Something went wrong" when a more specific cause is known
  (checklist item 16).
- `details` — optional, small, pre-vetted object (e.g.
  `{ unlockAt: "2026-10-08T00:00:00Z" }`, `{ fieldErrors: {...} }`). Never a
  stack trace, SQL fragment, raw provider error, or internal database ID.
- No stack traces, ever, in any environment. `AllExceptionsFilter` never
  branches on `NODE_ENV` — the same safe shape is produced in local dev,
  CI, and production, so "production mode shows no stack traces" isn't a
  separate code path that could regress independently; it's the only path.
  (Tested directly: `all-exceptions-filter.spec.ts` → "never includes a
  stack trace or internal error identifiers in the response body,
  regardless of environment".)

## Recovery paths (checklist task 4)

Every catalog entry's `recovery` field (`apps/api/src/common/error-catalog.ts`)
is one of: `retry`, `resend`, `reset_password`, `sign_in`, `sign_up`, `wait`,
`contact_support` — never `null` in this catalog (every entry has a real
action). `INTERNAL_ERROR` and `SERVICE_UNAVAILABLE` are the only two entries
whose message is deliberately generic ("something went wrong on our end" /
"temporarily unavailable") — that's correct, not a violation of checklist
item 16, because by construction nothing MORE specific is known about an
unexpected exception or a down database; the generic message still carries
a recovery path (retry, or contact support with the request ID) rather than
dead-ending. `apps/api/test/phase12-error-catalog.spec.ts`'s "no catalog
entry other than INTERNAL_ERROR/SERVICE_UNAVAILABLE uses a generic message"
test enforces this hasn't drifted for every OTHER entry, which all have a
cause-specific message.

## Mapping layer (checklist task 3)

`AllExceptionsFilter` is the single mapping layer from provider/database
exceptions to catalog codes — there is no second place in the codebase that
maps an exception to an HTTP response. In order of precedence:

1. `ThrottlerException` (`@nestjs/throttler`) → `TOO_MANY_REQUESTS` (429).
   Fixes a real gap this phase found: the library's default exception
   leaked `"ThrottlerException: Too Many Requests"` verbatim and carried no
   `code` at all.
2. Any `HttpException` with a `{code, message, details}` response body →
   passed through as-is (this is how every auth-specific catalog code
   above reaches the client — `UnauthorizedException({code, message})` etc.
   in `auth.service.ts`).
3. Any other `HttpException` → `code` defaults to `HttpStatus[status]`
   (e.g. `"BAD_REQUEST"`), `message` from the exception's own string/body.
4. `@saas/authorization`'s `ForbiddenError` (a plain `Error`, not an
   `HttpException`) → 403 `FORBIDDEN` (BUG-015, Phase 10).
5. `Prisma.PrismaClientInitializationError` or
   `PrismaClientKnownRequestError` with code in `{P1001, P1002, P1008, P1017}`
   (all mean "the database itself is unreachable/misconfigured," never a
   query-level failure) → 503 `SERVICE_UNAVAILABLE`, logging the real
   Prisma error server-side only.
6. Anything else (`instanceof Error` or not) → 500 `INTERNAL_ERROR`,
   logging the real error server-side only.

## Logging and scrubbing (checklist task 5)

- `packages/observability`'s `logger` (pino) redacts via two layers on
  every single log call, auth routes included: a static `redact.paths`
  list (`password`, `newPassword`, `token`, `code`, `otp`, `refreshToken`,
  `accessToken`, `authorization`, plus depth-1 wildcards), AND a
  `deepRedact` hook that recurses into any object/array argument (depth
  cap 20) and redacts any key whose normalized form CONTAINS
  `authorization`, `cookie`, `setcookie`, `password`, `token`, `secret`,
  `refresh`, `code`, `apikey`, or `otp` — substring match, deliberately, so
  `refreshToken`/`accessToken`/`Set-Cookie`/`apiKey` are all caught
  regardless of casing (BUG-010, Phase 7).
- No interceptor anywhere logs a full raw request body or header set —
  every `logger.error(...)` call in `auth.service.ts`/`all-exceptions.filter.ts`
  logs `{ err, requestId }` (and occasionally `userId`), never
  `req`/`request` itself. This means cookies/headers/bodies on auth routes
  are scrubbed structurally (never logged at all), not by hoping a
  redaction rule catches every case.
- Tested directly: `packages/observability/src/logger.spec.ts` — builds a
  real pino logger (via the same `createLogger` factory the production
  singleton uses) pointed at an in-memory stream, logs objects containing
  real-shaped password/token/OTP/cookie values, and asserts the captured
  output text never contains any of those raw values. This exercises the
  actual pipeline (pino's `redact.paths` + the `deepRedact` hook together),
  not just `deepRedact` in isolation (which `redact.spec.ts` already
  covered from Phase 7).
- Error tracking (Sentry) scrubbing: **N/A, not implemented.** Sentry and
  OpenTelemetry are named in the project's stack but not actually wired
  anywhere in this codebase — no dependency installed, no `Sentry.init(...)`
  call exists. See `docs/auth/COMPONENTS.md`'s entry for this; marked
  **Requires configuration**, not **Confirmed working**. The structural
  scrubbing above (never logging raw bodies) would still apply to whatever
  Sentry breadcrumb/context data a future integration attaches, since that
  data would come from the same `logger` calls — but no managed error
  tracker is live to confirm scrubbing against today.

## Metrics and alerts (checklist task 6)

**No managed metrics backend (Prometheus, Datadog, CloudWatch) is wired in
this codebase.** `recordAuthMetric()` (`packages/observability/src/metrics.ts`)
is the minimum real plumbing: one structured log line per event
(`{event: "auth_metric", metric, labels}`), with a stable metric name and
small label set — the kind of structured log line a log-based metrics
pipeline (e.g. a Datadog/CloudWatch log-metric filter, or a future
Prometheus pushgateway) can key off of without this application code
needing to change when a backend is actually chosen. Wired at:

| Metric                   | Fires when                                                                                                                                                                                                               | Call site                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `login_failure`          | Any failed login/OTP/magic-link attempt, with a `reason` label (`invalid_credentials`, `account_disabled`, `account_locked`, `email_not_verified`, `otp_invalid_or_expired`, `magic_link_invalid`, `magic_link_expired`) | `auth.service.ts` `login()`/`verifyOtp()`/`verifyMagicLink()`                         |
| `login_success`          | A successful login/OTP/magic-link sign-in                                                                                                                                                                                | Same three methods                                                                    |
| `rate_limited`           | Any `ThrottlerException` reaching the filter, with a `path` label                                                                                                                                                        | `all-exceptions.filter.ts`                                                            |
| `refresh_reuse_detected` | A refresh token presented again outside the benign-race grace window (checklist's explicit "refresh reuse detections" target)                                                                                            | `auth.service.ts` `refresh()`                                                         |
| `auth_5xx`               | Any 5xx response on a `/auth/*` route, with `path`+`status` labels                                                                                                                                                       | `all-exceptions.filter.ts`                                                            |
| `email_send_failed`      | Any auth email (verification, reset, OTP, magic link, password-changed) fails to send, with a `failedEventType` label                                                                                                    | `auth.service.ts` `sendEmail()` (the single chokepoint every auth email goes through) |

**Alerting itself — threshold rules, paging, dashboards — is Requires
configuration, not implemented.** Wiring a real alert (e.g. "page on-call
if `login_failure` rate exceeds N/min") needs a metrics backend to define
the threshold against, which doesn't exist yet. This phase's job was
making the underlying events observably countable; the alerting policy on
top of them is a deployment-time/ops decision, not application code.

## Error types

### 400 Bad Request

1. **Source:** Zod validation (`apps/api/src/common/zod-validation.pipe.ts`), or an explicit `BadRequestException` (e.g. password-reset token errors, breached-password check).
2. **Trigger:** Malformed/invalid request body or query, or a validated-but-semantically-rejected input (e.g. a breached password).
3. **User-visible:** 400 + specific `code`/`message`, often `details.fieldErrors` for validation.
4. **Internal:** No side effects beyond the validation check itself.
5. **Handled:** Yes — passes through `AllExceptionsFilter`'s `HttpException` branch unchanged.
6. **Logged:** No (not an error worth a server-side log line — it's a client input problem, not a system fault).
7. **Message correct:** Yes — field-level messages from Zod, or a specific catalog message.
8. **Leaks sensitive info:** No — never echoes back the invalid value itself if it was a secret field (passwords aren't echoed in validation errors).
9. **Recovery possible:** Yes — fix the input and resubmit (`retry`).

### 401 Unauthorized

1. **Source:** `UnauthorizedException` throws across `auth.service.ts` (login, refresh, OTP, magic link, change-password) and `SessionGuard`.
2. **Trigger:** Wrong credentials, invalid/expired/reused session or token, wrong current password.
3. **User-visible:** 401 + a catalog code (`INVALID_CREDENTIALS`, `SESSION_EXPIRED`, `SESSION_REVOKED`, `INVALID_TOKEN`, `CURRENT_PASSWORD_INCORRECT`, `OTP_INVALID_OR_EXPIRED`, `MAGIC_LINK_INVALID`/`MAGIC_LINK_EXPIRED`).
4. **Internal:** An `auth_events` row is recorded for every failure (`login_failed`, `refresh_token_reuse_detected`, etc.) before the exception is thrown; `recordAuthMetric("login_failure"|"refresh_reuse_detected", ...)` fires alongside.
5. **Handled:** Yes.
6. **Logged:** Only the `auth_events` DB row + the metric log line — never a `logger.error` call for an ordinary 401 (these are expected, not faults).
7. **Message correct:** Yes, and deliberately enumeration-safe where required (e.g. `INVALID_CREDENTIALS` is identical whether the email exists or not).
8. **Leaks sensitive info:** No.
9. **Recovery possible:** Yes — `retry`/`sign_in`/`resend`, per code.

### 403 Forbidden

1. **Source:** `ForbiddenException` (account-state checks in `login()`), `ForbiddenError` from `@saas/authorization`'s `assertPermission`/`PermissionsGuard`.
2. **Trigger:** Account disabled/deleted, email not verified, or an authenticated-but-unauthorized action (missing permission).
3. **User-visible:** 403 + `ACCOUNT_DISABLED`/`EMAIL_NOT_VERIFIED`/`FORBIDDEN`.
4. **Internal:** `auth_events` row for account-state cases.
5. **Handled:** Yes (BUG-015 fixed the `ForbiddenError` case specifically — see FINDINGS.md).
6. **Logged:** No server-side log line (expected outcome, not a fault).
7. **Message correct:** Yes, each gives its specific reason and recovery (`contact_support`/`resend`).
8. **Leaks sensitive info:** No.
9. **Recovery possible:** Yes.

### 404 Not Found

1. **Source:** Object-level ownership checks (Phase 10: `revokeSession`, `unlinkAccount`) throwing `NotFoundException`; unmatched routes (Nest's own default).
2. **Trigger:** A session/OAuth-account id that doesn't exist OR belongs to a different user (deliberately the SAME 404 either way — see FINDINGS.md Phase 10, "never 403, which would leak existence").
3. **User-visible:** 404, generic "not found" message.
4. **Internal:** None beyond the lookup itself.
5. **Handled:** Yes.
6. **Logged:** No.
7. **Message correct:** Yes — deliberately uninformative about WHICH of "doesn't exist" / "not yours" is true.
8. **Leaks sensitive info:** No — this IS the anti-leak design.
9. **Recovery possible:** N/A for the specific resource; the user can navigate elsewhere (no single "recovery" action makes sense for "this thing isn't there").

### 409 Conflict

1. **Source:** No current auth/profile code path throws a 409 today.
2. **Trigger:** N/A.
   3–9. **N/A — not yet produced anywhere in this codebase.** Signup's duplicate-email case deliberately does NOT use 409 (it would leak that the email is registered) — it returns the same success-shaped response as a new signup (enumeration-safety, Phase 4). Documented here per AUTH_RULES.md rule 10 ("do not invent errors the code cannot support") rather than fabricating a 409 scenario to fill the checklist slot.

### 422 Unprocessable Entity

1. **Source:** `zod-validation.pipe.ts` via `UnprocessableEntityException`.
2. **Trigger:** A request body that parses as JSON but fails Zod schema validation with field-level errors.
3. **User-visible:** 422 + `details.fieldErrors` (per-field messages).
4. **Internal:** None.
5. **Handled:** Yes (tested: `all-exceptions-filter.spec.ts` → "passes through an UnprocessableEntityException's status, code, and field errors").
6. **Logged:** No.
7. **Message correct:** Yes, from Zod's own field-level messages.
8. **Leaks sensitive info:** No — a password field's validation error never echoes the submitted value.
9. **Recovery possible:** Yes — `retry` with corrected input.

### 429 Too Many Requests

1. **Source:** `@nestjs/throttler`'s `ThrottlerGuard` (global, `RedisThrottlerStorage`-backed), raising `ThrottlerException`.
2. **Trigger:** Exceeding a route's configured `@Throttle()` limit (login, signup, OTP, password-reset, OAuth routes all have explicit limits).
3. **User-visible (fixed this phase):** 429 + `TOO_MANY_REQUESTS` + "Too many attempts. Please wait a moment and try again." — previously leaked `"ThrottlerException: Too Many Requests"` with no code at all.
4. **Internal:** `recordAuthMetric("rate_limited", {path})`.
5. **Handled:** Yes (new `AllExceptionsFilter` branch this phase).
6. **Logged:** Via the metric log line only; no `logger.error` (expected, not a fault).
7. **Message correct:** Yes, now.
8. **Leaks sensitive info:** No.
9. **Recovery possible:** Yes — `wait`. **Known limitation:** no `Retry-After` header is set for a throttled response specifically (the header mechanism exists and IS used when an exception's `details.retryAfterSeconds` is set — e.g. account lockout — but `@nestjs/throttler`'s default `ThrottlerException` doesn't carry that value without overriding the guard itself, which is out of this phase's scope). Documented as a **Potential risk** in FINDINGS.md.

### 500 Internal Server Error

1. **Source:** The `AllExceptionsFilter`'s final fallback branch — anything not otherwise recognized.
2. **Trigger:** A genuine bug or truly unexpected condition.
3. **User-visible:** 500 + `INTERNAL_ERROR` + a message that still offers `retry`/`contact_support` with the request ID.
4. **Internal:** `logger.error({err, requestId}, "Unhandled exception")` — the real error, with stack trace, logged server-side ONLY, never in the response.
5. **Handled:** Yes.
6. **Logged:** Yes, always.
7. **Message correct:** Yes — intentionally generic (nothing more specific is knowable about an unexpected exception) but still gives a recovery path, satisfying checklist item 16 rather than violating it.
8. **Leaks sensitive info:** No (tested: "maps an unrecognized error to a generic 500 without leaking its message" / "never includes a stack trace or internal error identifiers in the response body").
9. **Recovery possible:** Yes — `retry`, or `contact_support` with the request ID if it persists.

### 502 Bad Gateway

1. **Source:** No current code path in this codebase produces a 502 — no upstream proxy/gateway exists in front of `apps/api` in this environment that would originate one, and no outbound HTTP call to a third party (email provider, OAuth provider) is mapped to 502 specifically.
   2–9. **N/A — not yet producible.** An OAuth provider's own failure (e.g. Google's token endpoint erroring) currently surfaces as a generic `callback_failed` OAuth error (Phase 9), not a 502 — documented honestly as a gap rather than fabricating a 502 test case. A future reverse-proxy/CDN layer (Vercel, a load balancer) may originate real 502s that never reach this filter at all.

### 503 Service Unavailable

1. **Source:** `AllExceptionsFilter`'s Prisma-unreachable branch.
2. **Trigger:** `PrismaClientInitializationError`, or `PrismaClientKnownRequestError` with code `P1001`/`P1002`/`P1008`/`P1017` (connection refused, timeout, operations timeout, server closed connection).
3. **User-visible:** 503 + `SERVICE_UNAVAILABLE` + "The service is temporarily unavailable. Please try again."
4. **Internal:** `logger.error({err, requestId}, "Database unreachable")` — the real Prisma error (which can include a hostname/connection string) logged server-side only.
5. **Handled:** Yes (tested: both the `PrismaClientInitializationError` and `P1001` cases).
6. **Logged:** Yes, always.
7. **Message correct:** Yes.
8. **Leaks sensitive info:** No (tested: "maps a Prisma connection failure to 503... without leaking its hostname").
9. **Recovery possible:** Yes — `retry`.

### Network errors (client-side)

1. **Source:** `packages/api-client`'s `fetch` call rejecting with a non-`AbortError` (DNS failure, connection refused, offline).
2. **Trigger:** The browser's own network stack failing before any HTTP response exists.
3. **User-visible:** `ApiClientOfflineError` (if `navigator.onLine === false`, fails fast without even attempting the request) or the raw rejection propagated to the caller's `catch`, shown as "Something went wrong. Please try again." in most forms (Phase 4-11's forms) — this IS an appropriate use of a generic message, since no server ever responded with a specific cause.
4. **Internal:** No server-side involvement at all — purely client-side.
5. **Handled:** Yes (`packages/api-client/src/index.spec.ts` — "propagates a genuine network failure distinctly from a timeout").
6. **Logged:** Not server-side (no request ever reached the server to log against); not sent to any client-side error tracker either (none wired — see Metrics section).
7. **Message correct:** Yes — distinct offline-specific copy when detectable, generic "try again" otherwise (correctly generic, since nothing more specific is knowable).
8. **Leaks sensitive info:** No.
9. **Recovery possible:** Yes — `retry` once connectivity returns.

### Timeout errors

1. **Source:** `packages/api-client`'s internal `AbortController` + `DEFAULT_TIMEOUT_MS` (10s), or an externally-supplied signal (Phase 11's `AuthProvider` generation guard).
2. **Trigger:** No response within the timeout window.
3. **User-visible:** `ApiClientTimeoutError`, "That took too long. Please try again." (distinct message, several forms already use this verbatim).
4. **Internal:** None server-side (the server may still be processing — this is purely a client-side give-up).
5. **Handled:** Yes (`packages/api-client/src/index.spec.ts` — "throws ApiClientTimeoutError when the request exceeds the timeout"; Phase 11 added `ApiClientAbortedError` to distinguish an intentional cancellation from a real timeout).
6. **Logged:** Not server-side; not client-tracked (no error tracker wired).
7. **Message correct:** Yes.
8. **Leaks sensitive info:** No.
9. **Recovery possible:** Yes — `retry`.

### Auth-provider errors

1. **Source:** `packages/auth/src/oauth/*.ts` adapters (Google/Microsoft/GitHub/Facebook/Apple/generic OIDC) — a failed token exchange, ID-token validation failure, or userinfo call failure.
2. **Trigger:** The external provider rejects the authorization code, returns an error, or returns a malformed/unverifiable ID token.
3. **User-visible:** Redirect to `/oauth/error?code=callback_failed` (or a more specific code — `state_missing`, `access_denied` for user cancellation, etc. — Phase 9), never the raw provider error.
4. **Internal:** The real provider error is caught and logged (not surfaced); no `auth_events` row distinguishes this from other OAuth failures today (a documented Phase 9 gap, not new to this phase).
5. **Handled:** Yes, per-provider, since Phase 9.
6. **Logged:** Via the generic catch-and-log pattern in `oauth.service.ts`/`oauth.controller.ts` — goes through the same redacting `logger`.
7. **Message correct:** Yes, distinct per-reason messages on `/oauth/error` (Phase 9).
8. **Leaks sensitive info:** No — never echoes the provider's raw error body (which could contain client secrets echoed back by a misconfigured provider, in the worst case).
9. **Recovery possible:** Yes — `retry` via "Back to login."

### Database errors

1. **Source:** Prisma, every query site.
2. **Trigger:** Connection failure (→ 503, see above) OR a query-level failure (constraint violation, not found via `findUniqueOrThrow`, etc.).
3. **User-visible:** 503 for connection failures; a query-level Prisma error NOT in `DB_UNREACHABLE_PRISMA_CODES` falls through to the generic 500 `INTERNAL_ERROR` branch today (e.g. an unexpected unique-constraint violation that no calling code anticipated) — this is intentional: a constraint violation the calling code DIDN'T specifically handle is, by definition, unexpected from the application's point of view, so treating it as a genuine 500 (log the real error, give the user a generic-but-recoverable response) is correct, not a gap. Known, anticipated constraint violations (e.g. duplicate email) are caught by the SERVICE layer with its own specific handling before Prisma's own error class ever reaches the filter (Phase 4's enumeration-safe duplicate-signup handling).
4. **Internal:** `logger.error` for both branches.
5. **Handled:** Yes.
6. **Logged:** Yes, always (connection failures explicitly; generic Prisma errors via the generic 500 branch's log line).
7. **Message correct:** Yes.
8. **Leaks sensitive info:** No — never the raw Prisma error (which can include the full failing query and parameter values) in the response.
9. **Recovery possible:** Yes — `retry` (503) or `contact_support` (an unexpected 500).

### Unexpected exceptions

1. **Source:** Anything not an `HttpException`/`ForbiddenError`/recognized Prisma error — a genuine bug (null-pointer-shaped TypeError, a thrown non-Error value, etc.).
2. **Trigger:** A real defect.
3. **User-visible:** 500 `INTERNAL_ERROR`, same as above.
4. **Internal:** `logger.error({err, requestId}, "Unhandled exception")`.
5. **Handled:** Yes — `@Catch()` with no argument means this filter catches literally everything Nest's pipeline can throw; nothing escapes unhandled.
6. **Logged:** Yes, always, with the real stack trace server-side.
7. **Message correct:** Yes (generic, appropriately).
8. **Leaks sensitive info:** No.
9. **Recovery possible:** Yes — `retry`/`contact_support` with the request ID.

### No generic "Something went wrong" where a safe recovery path exists

Audited directly via `apps/api/test/phase12-error-catalog.spec.ts`'s "no
catalog entry other than INTERNAL_ERROR/SERVICE_UNAVAILABLE uses a generic
message" test. Every catalog entry with a KNOWN specific cause
(`INVALID_CREDENTIALS`, `RESET_TOKEN_EXPIRED`, `ACCOUNT_LOCKED`,
`OTP_INVALID_OR_EXPIRED`, etc.) has its own specific message and recovery
action — none of them are collapsed into a generic "something went wrong."
The ONLY two entries using deliberately generic language
(`INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`) are the two cases where nothing
more specific is actually knowable (an unexpected exception; the database
itself being down) — using a generic message THERE is correct, not a
violation, because inventing a more specific-sounding message for an
unknown cause would be dishonest, not more helpful.

## Catalog (per-code detail)

Every entry below lives in `apps/api/src/common/error-catalog.ts`. The 9
checklist questions are answered once per entry here; "trigger" and "exact
source" point at the real file:function; "handled"/"logged" follow the
patterns described in the Error types section above, by code family.

| Code                                         | Status | Source (file)                                                     | Trigger                                                                                | Logged                       | Recovery        |
| -------------------------------------------- | ------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------- | --------------- |
| `INVALID_CREDENTIALS`                        | 401    | `auth.service.ts` `login()`                                       | Wrong password or unknown email (identical either way)                                 | `auth_events` + metric only  | retry           |
| `ACCOUNT_DISABLED`                           | 403    | `auth.service.ts` `login()`                                       | Account disabled/deleted                                                               | `auth_events` + metric only  | contact_support |
| `ACCOUNT_LOCKED`                             | 423    | `auth.service.ts` `login()`                                       | 5+ consecutive failed attempts                                                         | `auth_events` + metric only  | wait            |
| `EMAIL_NOT_VERIFIED`                         | 403    | `auth.service.ts` `login()`                                       | Account still `pending_verification`                                                   | `auth_events` + metric only  | resend          |
| `SESSION_EXPIRED`                            | 401    | `auth.service.ts` `refresh()`                                     | Refresh token nonexistent, or rolling/absolute expiry passed                           | No                           | sign_in         |
| `SESSION_REVOKED`                            | 401    | `auth.service.ts` `refresh()`                                     | Refresh-token reuse detected outside the grace window                                  | `auth_events` + metric       | sign_in         |
| `INVALID_TOKEN`                              | 401    | `auth.service.ts` `verifyAccessToken()`                           | Access-token signature/issuer/audience/expiry check fails                              | No                           | sign_in         |
| `CURRENT_PASSWORD_INCORRECT`                 | 401    | `auth.service.ts` `changePassword()`                              | Wrong current password on an authenticated change                                      | `auth_events`                | retry           |
| `RESET_TOKEN_INVALID` / `_USED` / `_EXPIRED` | 400    | `auth.service.ts` `resetPassword()`                               | Reset token doesn't exist / already consumed / past its 45-min TTL                     | `auth_events` (used/expired) | resend          |
| `PASSWORD_BREACHED`                          | 400    | `auth.service.ts` `resetPassword()`/`changePassword()`            | New password found via HIBP k-anonymity check (feature-flagged)                        | No                           | retry           |
| `OTP_INVALID_OR_EXPIRED`                     | 401    | `auth.service.ts` `verifyOtp()`                                   | Unknown email, no live code, expired, too many attempts, or wrong code — all identical | metric only                  | resend          |
| `MAGIC_LINK_INVALID` / `_EXPIRED`            | 401    | `auth.service.ts` `verifyMagicLink()`                             | Token doesn't exist/already used, or past its TTL                                      | metric only                  | resend          |
| `FORBIDDEN`                                  | 403    | `@saas/authorization` `assertPermission()` via `PermissionsGuard` | Authenticated caller lacks the required permission                                     | No                           | contact_support |
| `TOO_MANY_REQUESTS`                          | 429    | `all-exceptions.filter.ts` (maps `ThrottlerException`)            | Any throttled route's limit exceeded                                                   | metric only                  | wait            |
| `SERVICE_UNAVAILABLE`                        | 503    | `all-exceptions.filter.ts` (maps Prisma connection errors)        | Database unreachable                                                                   | Yes, always                  | retry           |
| `INTERNAL_ERROR`                             | 500    | `all-exceptions.filter.ts` (fallback)                             | Any unrecognized/unexpected exception                                                  | Yes, always                  | contact_support |

Not in the thrown-exception catalog above (different design, documented
separately): `apps/api/src/auth/oauth/oauth.service.ts`'s pending-identity/
account-linking outcomes (`identity_already_linked`, `link_session_missing`,
`unverified_email`, `email_collision`, `pending_identity_invalid`) are
returned as `200 OK` JSON result objects
(`{kind: "error", code: "..."}`), not as HTTP error statuses — these are
expected BRANCHES of the OAuth flow's own result type (Phase 9's own
design), not failures of the HTTP request itself, so they deliberately sit
outside `AllExceptionsFilter`'s mapping layer entirely. Flagged here as a
**Potential risk** only in that their `lowercase_snake` casing is
inconsistent with every thrown exception's `UPPER_SNAKE` code convention
above — a cross-reference a future reader should know about, not a bug to
fix (reconciling it would mean widening this phase's scope into a Phase 9
behavioral change, not an error-handling documentation/mapping fix).
