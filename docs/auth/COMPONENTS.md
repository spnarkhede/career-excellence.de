# Components

One entry per item in the "Authentication map" checklist, per
[AUTH_RULES.md](../../AUTH_RULES.md). Every entry answers all 8 questions. Phase 1
entries are marked **Planned** — they describe intent and, where code already exists
from prior work, the current real file. Later phases change each entry's status to the
real, verified file paths once implemented/audited and update the 8 answers to match
actual behavior, not the plan.

## Template

Copy this block for new components discovered in later phases.

```
### <Component name> (<file path>) — <Planned | Implemented>

1. **What it does:**
2. **What calls it:**
3. **What it calls:**
4. **What data it receives:**
5. **What data it returns:**
6. **What happens when it fails:**
7. **Whether it is secure:**
8. **Whether it can create inconsistent state:**
```

## Phase 2 components (scaffold and secure foundation)

These are real, implemented components created or changed in Phase 2 — not planned
entries. They sit outside the 17-item Authentication map checklist (which covers
auth-specific pieces built from Phase 3 onward) but are the secure foundation Phase 2
was scoped to deliver.

### Environment config (`packages/config/src/index.ts`, `guard.ts`) — Implemented

1. Validates every env var against a Zod schema at startup; separates public
   (browser-safe) from private (server-only) schemas; `assertNoPublicSecretLeakage`
   throws if a secret-shaped name is declared public, or a private name uses the
   `NEXT_PUBLIC_` prefix.
2. Called by `apps/api/src/main.ts`, `apps/web/src/lib/env.ts`, `apps/admin/src/lib/env.ts`.
3. Calls nothing (pure validation).
4. Receives `process.env`.
5. Returns a typed, validated env object, or throws.
6. On failure: throws synchronously with the variable name and validation message —
   **never the value** — so the process never finishes booting with bad config.
7. Secure: the guard specifically prevents a secret-shaped name ever being declared
   public, closing off the "remove frontend secrets" checklist item at the config layer.
8. No inconsistent state risk — pure functions, no I/O.

### Bundle secret check (`scripts/check-bundle-for-secrets.ts`) — Implemented

1. Scans `.next/static` output (the directory actually served to the browser, not
   `.next/server`) for literal occurrences of private env var _names_.
2. Called by `pnpm check:bundle-secrets` (CI, after `pnpm build`).
3. Calls `privateEnvSchema.shape` (names only) and the filesystem.
4. Receives built bundle files.
5. Returns nothing; exits non-zero and prints file:name pairs if a leak is found.
6. On failure: exits 1 with a clear message, no value ever printed.
7. Secure: names-only, never reads/prints a value.
8. No inconsistent state risk — read-only scan.
9. **Bug found and fixed in this phase**: the original version scanned all of `.next/`,
   including server-only SSR chunks that legitimately bundle the schema's variable
   _names_ (as object keys) via the shared `@saas/config` import — producing false
   positives on every real build and making the check useless as a CI gate. Root cause:
   conflated "appears in `.next/`" with "served to the browser." Fixed by scanning only
   `.next/static`. See FINDINGS.md BUG-001.

### HTTPS redirect (`apps/api/src/common/https-redirect.middleware.ts`) — Implemented

1. Redirects (308) a plain-HTTP request to HTTPS, only when `APP_ENV=production`.
2. Called via `app.use(...)` in `apps/api/src/main.ts`, before any other middleware.
3. Calls nothing; reads `req.secure` / `x-forwarded-proto`.
4. Receives the Express request/response.
5. Returns a redirect response, or calls `next()`.
6. On failure: n/a — it's a pure conditional, no fallible operation.
7. Secure: trusts `X-Forwarded-Proto` only because `app.set("trust proxy", 1)` is set in
   production, matching the real load-balancer topology.
8. No inconsistent state risk.

### Security headers (`apps/api/src/common/security-headers.middleware.ts`, `@saas/security`) — Implemented

1. Sets CSP (per-request nonce, no `unsafe-inline`), `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'`,
   `Permissions-Policy`, and HSTS (production only) on every response.
2. Called via `app.use(...)` in `main.ts`.
3. Calls `@saas/security`'s `buildSecurityHeaders`/`generateNonce`.
4. Receives the Express request/response; writes `res.locals.nonce` for templates.
5. Returns via `res.setHeader(...)`, then `next()`.
6. On failure: n/a — header-setting can't meaningfully fail.
7. Secure: this is the literal implementation of the checklist's "Security headers"
   item; `/docs` (Swagger, dev-only) is deliberately exempted since its vendored HTML
   ships inline scripts that can't be nonce'd.
8. No inconsistent state risk.

### CORS allowlist (`apps/api/src/common/cors.ts`) — Implemented

1. Builds CORS options from an explicit origin allowlist (`API_CORS_ALLOWED_ORIGINS`);
   never combines a wildcard with `credentials: true`.
2. Called by `apps/api/src/main.ts` (`app.enableCors(...)`) and the test suite (bare
   Express + `cors()`).
3. Calls `@saas/security`'s `isOriginAllowed`.
4. Receives the request `Origin` header.
5. Returns `callback(null, true/false)` — never throws, so a disallowed origin fails
   closed (no CORS headers) rather than a 500.
6. On failure (disallowed origin): no CORS headers are sent; the browser blocks the
   response, the server still returns 200 (correct — CORS is a browser-enforced
   control, not a server authorization boundary).
7. Secure: this is the literal "CORS allowlist, never a wildcard with credentials"
   checklist item.
8. No inconsistent state risk.
9. **Bug found and fixed in this phase**: previously typed against the `cors` npm
   package's own `CorsOptions`, which structurally conflicts with `@nestjs/common`'s
   duplicate interface (`boolean` vs `string|RegExp` for `origin`), making
   `app.enableCors(buildCorsOptions(...))` fail `tsc --noEmit`. Fixed by dropping the
   conflicting type import — the returned object still matches both libraries
   structurally; only the type annotation was wrong. See FINDINGS.md BUG-002.

### Structured logger with redaction (`@saas/observability`) — Implemented

1. Pino logger with request-ID child loggers; redacts `authorization`, `cookie`,
   `set-cookie`, `password`, `token`, `secret`, `refresh`, `code`, `otp`, `apikey` at
   any depth, via both pino's static `redact.paths` and a `deepRedact` hook that walks
   every log argument before serialization.
2. Called by `apps/api/src/main.ts`, `apps/worker/src/main.ts`, and anywhere importing
   `logger` from `@saas/observability`.
3. Calls `deepRedact` (pure recursive walk).
4. Receives arbitrary log payloads.
5. Returns redacted payloads to pino's serializer.
6. On failure: n/a — redaction can't throw; `deepRedact` caps recursion depth at 20 to
   avoid a pathological/cyclic object hanging the logger.
7. Secure: this is the literal "redaction at any depth" checklist item, including the
   previously-missing `otp` key, added and tested in this phase.
8. No inconsistent state risk.

### Global unhandled-rejection / uncaught-exception handlers (`apps/api/src/main.ts`, `apps/worker/src/main.ts`) — Implemented

1. Logs (via the redacting logger) any unhandled promise rejection or uncaught
   exception at the process level, instead of letting Node crash silently or dump a raw
   object to stderr.
2. Registered once at process startup, before `bootstrap()`.
3. Calls `logger.error`.
4. Receives the rejection reason / exception object.
5. Returns nothing; an uncaught exception still exits the process (`process.exit(1)`)
   after logging — a crashed process should not keep serving requests in a broken
   state, but it must log safely on the way out.
6. On failure: n/a — this _is_ the failure handler.
7. Secure: routes through the same redacting logger, so a thrown error that happens to
   contain a token/password in its message/stack is still redacted by `deepRedact`'s
   key-based matching wherever the error is a plain object; a raw `Error`'s `.message`
   string itself is not pattern-scanned, which is a known limitation — see
   FINDINGS.md BUG-003.
8. No inconsistent state risk — logging only.

### Quality tooling (`eslint.config.js`, `knip.json`, `.jscpd.json`, `check:cycles`) — Implemented

1. `eslint.config.js`: adds `no-floating-promises`, `no-misused-promises`,
   `await-thenable`, `no-deprecated` (typed, via `projectService`), plus
   `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` for `apps/web`,
   `apps/admin`, `packages/ui`. `knip.json`: dead-code/unused-dependency detection.
   `.jscpd.json` + `madge`: duplicate-code and circular-dependency detection.
2. Called by `pnpm lint`, `pnpm check:deadcode`, `pnpm check:duplicates`,
   `pnpm check:cycles`, and CI.
3. Calls nothing at runtime — static analysis only.
4. Receives the TypeScript/TSX source tree.
5. Returns lint diagnostics / clone reports / dependency graphs.
6. On failure: `check:cycles` and `check:duplicates` are hard CI gates (both pass
   clean). `check:deadcode` (knip) surfaces real, pre-existing findings (dependencies
   reserved for not-yet-wired features per `ARCHITECTURE.md`'s TanStack Query gap,
   e.g. `@tanstack/react-query`/`zod`/`zustand` in `apps/web`) that are **out of scope
   to remove in this phase** — wired as informational (`|| true`) rather than a hard
   gate, to avoid silently modifying unrelated functionality per `AUTH_RULES.md` rule 7.
   See FINDINGS.md for the full list.
7. Secure: `no-floating-promises`/`no-misused-promises` directly catch the class of bug
   where an auth form's async submit handler is silently dropped by React/DOM — this
   phase's own type-checked lint pass found and fixed exactly that in all 4 auth forms
   (login, signup, forgot-password, reset-password) before any auth logic exists yet.
8. No inconsistent state risk.
9. **Bug found and fixed in this phase**: `packages/auth/src/index.ts` and
   `stub-provider.ts` had a circular import (barrel re-exporting a file that imports
   back from the barrel). Fixed by extracting the shared interfaces into
   `packages/auth/src/types.ts`. See FINDINGS.md BUG-004.

## Phase 3 components (database tables and data connections)

### Schema (`packages/database/prisma/schema.prisma`) — Implemented

1. Defines users (citext email, passwordHash, status/failedLoginCount/lockedUntil,
   deletedAt), profiles, oauth_accounts, sessions (familyId, absoluteExpiresAt,
   ipHash), one_time_tokens, auth_events (ipHash, requestId), roles/permissions/
   role_permissions/user_roles, plus the unchanged Phase 2 audit/compliance tables.
2. Read by `prisma generate` (produces the typed client every service imports).
3. Calls nothing — declarative schema file.
4. N/A.
5. N/A.
6. On failure: `prisma validate`/`prisma generate` fail loudly with a line number.
7. Secure: `passwordHash` nullable only for OAuth/OTP-only accounts; no raw IP or
   secret columns anywhere (`ipHash` only); CITEXT gives case-insensitive email
   uniqueness at the database level, not just app-side.
8. No inconsistent-state risk by itself — see the migration below for the real
   data-integrity guarantees (FKs, constraints, RLS).

### Migrations (`packages/database/prisma/migrations/`) — Implemented

1. `00000000000000_init`: the baseline schema as it stood before this phase.
   `00000000000001_phase3_auth_tables`: every Phase 3 schema change, plus RLS roles/
   policies and a `users.email` trimmed-CHECK constraint, as raw SQL.
2. Applied by `prisma migrate deploy` (CI) / `migrate dev` (local).
3. Calls Postgres directly.
4. Receives nothing; DDL only.
5. Returns nothing; throws on failure (e.g. a constraint violation on existing data).
6. On failure: the whole migration transaction (where Postgres allows transactional
   DDL — the enum swaps are explicitly wrapped in `BEGIN`/`COMMIT`) rolls back; no
   partial schema state.
7. Secure: RLS policies deny all anonymous access and restrict authenticated access
   to each row's own data; service-role (schema owner) usage is documented, not
   silently assumed.
8. **Known limitation, documented in this migration's own header comments**: the
   `'suspended'` → `'disabled'` status backfill and the CITEXT email-case
   normalization are best-effort safe on a populated table but have not been
   exercised against real production-shaped data (no database was available this
   phase — see `FINDINGS.md`).
9. **Bug found and fixed in this phase (BUG-006)**: an early draft of this migration
   would have dropped and recreated every table's primary key column, orphaning every
   foreign key on a populated database. Caught by manual review before being applied
   anywhere. See `FINDINGS.md` BUG-006.

### Row-level security (`migration.sql`, `app_anon`/`app_authenticated` roles) — Implemented

1. Enables RLS on every auth table; `app_anon` has zero grants (no anonymous access);
   `app_authenticated` can only SELECT/UPDATE its own rows (keyed by
   `current_setting('app.current_user_id', true)`), with no INSERT/DELETE policy on
   any table.
2. Not currently wired into Prisma's actual connection (which continues to use the
   schema-owner role and bypasses RLS, unchanged from before this phase) — exercised
   directly in tests via `SET LOCAL ROLE` inside a transaction. See the documented
   decision in `ARCHITECTURE.md`/`FINDINGS.md`.
3. Calls the `app_current_user_id()` SQL function.
4. Receives the session variable `app.current_user_id`, set via `set_config(...,
true)` (transaction-scoped).
5. Returns a filtered row set (SELECT) or an affected-row count of 0 (UPDATE/DELETE
   blocked by policy) or a `permission denied` error (no GRANT at all for that
   action).
6. On failure: fails closed — a missing/mismatched `current_user_id` session variable
   means every RLS-scoped query returns zero rows, never another user's data.
7. Secure: this is the literal "Row-level security... No anonymous access" checklist
   item, implemented as real, independently-testable Postgres objects.
8. No inconsistent-state risk — read/write filtering only, no data mutation of its
   own beyond what a normal UPDATE/DELETE would do.

### `AuthService.signUp` transactional atomicity (`apps/api/src/auth/auth.service.ts`) — Implemented

1. Creates the user + profile (nested, same statement) + default role assignment
   inside one `prisma.$transaction`, closing the previously-known gap where role
   assignment was a separate, non-atomic round trip (see Phase 0's PROGRESS.md).
2. Called by `AuthController.signUp`.
3. Calls Prisma inside the transaction callback; `skipDuplicates` on the role-assign
   `createMany` makes a retried transaction idempotent.
4. Receives the signup DTO + request context.
5. Returns the created user, or throws (rolling back the entire transaction).
6. On failure: no partial user — Prisma's `$transaction` guarantees all-or-nothing.
7. Secure: password is hashed (`@saas/security/server` argon2id) before ever reaching
   the transaction; never logged.
8. **Previously a Confirmed bug, now fixed**: see FINDINGS.md's Phase 0 discovery note
   and this phase's resolution.

### `PrincipalService.resolve` self-healing profile guard (`apps/api/src/auth/principal.service.ts`) — Implemented

1. On every authenticated request, checks (one SELECT) whether the resolved user has
   a profile row; creates one only if missing, swallowing the rare concurrent-create
   race via the profile's unique `userId` primary key.
2. Called by `SessionGuard` on every guarded request.
3. Calls Prisma.
4. Receives a `userId`.
5. Returns the `AuthenticatedPrincipal`, or throws 401 if the account isn't active.
6. On failure: a lost race (`P2002`) is swallowed as success (the other concurrent
   call already created the row); any other error propagates.
7. Secure: this is purely a data-integrity guard, not an authorization decision.
8. **This is itself the fix for "orphaned users" (checklist items 21/22)** — it is the
   second, independent line of defense behind the transactional signUp above.

### `AuthService.softDeleteAccount` (`apps/api/src/auth/auth.service.ts`) — Implemented

1. Sets `deletedAt` + `status=deleted` and revokes every active session, in one
   transaction.
2. Not yet wired to a public HTTP endpoint (no account-settings UI exists yet) — the
   capability exists and is directly tested at the service layer per this phase's
   scope (database tables and data connections), not the HTTP surface.
3. Calls Prisma.
4. Receives a `userId`.
5. Returns nothing; throws on failure.
6. On failure: the whole transaction rolls back — never a half-deleted account.
7. Secure: `AuthService.login` already checks `deletedAt`/`status` and rejects with
   the same neutral "Invalid email or password" message as any other login failure.
8. **Documented decision**: email is not released for reuse by a soft delete — the
   row (and its unique email constraint) remains indefinitely. See `FINDINGS.md`.

### `scripts/check-db-consistency.ts` — Implemented

1. Finds orphaned users (no profile), users without roles, duplicate profile
   `userId`s (structurally impossible, checked defensively anyway), and dangling
   sessions (referencing a deleted user).
2. Called by `pnpm db:check-consistency` (CI, after tests).
3. Calls Postgres via 4 read-only raw queries.
4. Receives nothing.
5. Returns a report; the CLI exits non-zero (printing ids, never secrets) if anything
   is found.
6. On failure (a problem found): exits 1, printing exactly which ids and categories —
   never a password/token/hash.
7. Secure: read-only; ids only, never credential data.
8. No inconsistent-state risk — it only reports, never fixes.

## Phase 4 components (signup, password creation, email verification)

### `AuthService.signUp` — timing/response-neutral duplicate handling (`apps/api/src/auth/auth.service.ts`) — Implemented

1. Hashes the password and (if the breach-check flag is on) checks it against HIBP
   _before_ branching on whether the email already exists, so both branches do the
   same work in the same order — timing alone can't reveal which case it was. If the
   email exists, sends a notice email to the real owner and creates nothing; otherwise
   creates user+profile+role in one transaction.
2. Called by `AuthController.signUp`.
3. Calls `hashPassword`, `isPasswordBreached`, `prisma.$transaction`, `sendEmail`.
4. Receives the signup DTO + request context.
5. Returns `{ email, status: "pending_verification" }` on **both** branches — never
   the real existing user's id, only an echo of the caller's own submitted email.
6. On failure: the transaction rolls back entirely; a breached password throws a
   typed 400, but only on the real (non-duplicate) path.
7. Secure: never reveals account existence via response shape or (by design intent)
   timing; the duplicate-branch notice email goes only to the real account's address,
   never surfaced to the caller.
8. No inconsistent-state risk — the duplicate branch writes nothing to `users`.

### `AuthService.sendEmail` / delivery-failure handling (`apps/api/src/auth/auth.service.ts`) — Implemented

1. Wraps every outbound email in try/catch; on success records a `*_sent` auth_event,
   on failure logs via the redacting logger (with `requestId`) and records a distinct
   `*_failed` auth_event — never throws either way.
2. Called by `sendVerificationEmail` and the duplicate-signup-notice path in `signUp`.
3. Calls the module-level `EmailProvider` singleton, `logger.error`, `recordAuthEvent`.
4. Receives recipient, subject, HTML, context, and the two event-type names to log.
5. Returns `void` always.
6. On failure: the caller's own action (signup, resend) still succeeds — delivery
   failure is recoverable via the resend endpoint, never a hard failure of signup.
7. Secure: the logged error object is passed through the structured logger, which
   deep-redacts sensitive keys; the email body/token are never logged.
8. No inconsistent-state risk.

### `AuthService.sendVerificationEmail` — resend invalidation (`apps/api/src/auth/auth.service.ts`) — Implemented

1. Marks every existing unused `verify_email` token for the user as used (i.e.
   invalidated) before issuing a new one, so only the most recently sent link is ever
   valid.
2. Called by `signUp` and `resendVerification`.
3. Calls `prisma.oneTimeToken.updateMany`/`create`, `issueOneTimeToken`, `hashToken`,
   `sendEmail`.
4. Receives `userId`, `email`, request context.
5. Returns `void`.
6. On failure: an invalidation that succeeds followed by a failed new-token create
   would leave the user with zero valid tokens (recoverable via resend) rather than
   two valid ones simultaneously — fails toward the safer state.
7. Secure: the raw token is never persisted, only `hashToken(token)`; never logged.
8. **Documented decision**: reuses `usedAt` as "no longer valid" for both "actually
   consumed" and "superseded by a newer token" — see `FINDINGS.md`/`ARCHITECTURE.md`
   for the reasoning (avoids a schema change this late in the phase for a UI-only
   distinction).

### `AuthService.verifyEmail` — 5 distinct states (`apps/api/src/auth/auth.service.ts`) — Implemented

1. Returns one of `valid | expired | already_used | invalid | already_verified`
   instead of throwing — lets the controller/UI present a specific recovery action per
   state without ever branching on whether an _email_ (as opposed to a _token_) is
   registered.
2. Called by `AuthController.verifyEmail`.
3. Calls `prisma.oneTimeToken.findUnique`, `prisma.user.findUnique`, `$transaction`.
4. Receives the raw token from the request body (never the URL — see the frontend
   component below).
5. Returns a `VerifyEmailReason` string.
6. On failure: n/a — every outcome is a normal return value, not an exception.
7. Secure: none of the 5 reasons reveal whether any particular email is registered —
   they describe the token's state only.
8. No inconsistent-state risk — the only state-mutating branch (`valid`) is itself a
   transaction.

### `AuthController` `/auth/resend-verification` (`apps/api/src/auth/auth.controller.ts`) — Implemented

1. New endpoint (did not exist before this phase) accepting `{ email }`, rate-limited
   per-IP via `@Throttle` (3/min) and per-email via a cooldown inside
   `AuthService.resendVerification`.
2. Called by the verify-email page's resend form.
3. Calls `AuthService.resendVerification`.
4. Receives a Zod-validated email.
5. Returns the same message regardless of whether the email exists or is already
   verified.
6. On failure: n/a — the service method never throws.
7. Secure: this is the literal "same response for known and unknown emails" checklist
   item.
8. No inconsistent-state risk.

### `VerifyEmailClient` (`apps/web/src/app/(auth)/verify-email/verify-email-client.tsx`) — Implemented

1. Renders a "Confirm email" **button** (no auto-submit on page load); only an
   explicit click POSTs the token. Strips the token from the visible URL via
   `history.replaceState` immediately on mount, before any confirmation happens.
   Renders distinct UI (with a resend form where relevant) for each of the 5
   `VerifyEmailReason` values.
2. Rendered by `apps/web/src/app/(auth)/verify-email/page.tsx` (a server component
   that also sets `metadata.referrer = "no-referrer"` for this route).
3. Calls `POST /auth/verify-email`, `POST /auth/resend-verification`,
   `isAllowedRedirect` (from `@saas/security`) for the post-verification redirect
   target.
4. Receives the `token` and optional `next` query params.
5. Returns rendered UI; on success, a link to the allowlisted redirect target (never
   an arbitrary `next` value).
6. On failure: shows the specific reason's message + a resend form; never auto-
   retries, never silently redirects.
7. Secure: this is the literal implementation of checklist items 5 ("Confirm button...
   mail scanners using GET cannot consume it", "Referrer Policy no-referrer", "token
   removed from the address bar") and 14 ("Verification redirect only to allowlisted
   internal paths through the safe redirect helper").
8. No inconsistent-state risk — purely client-side rendering logic.

### Password policy & strength estimate (`packages/validation/src/index.ts`) — Implemented

1. `passwordSchema`: NIST SP 800-63B — minimum 8, hard cap 128, no composition rules,
   every printable character allowed. `estimatePasswordStrength`: a pure, client-safe
   UX estimate (length + character-class variety) for the signup form's meter — never
   used for enforcement.
2. `passwordSchema` is called by every signup/reset DTO (server, via
   `ZodValidationPipe`) and by the signup/reset forms (client, via
   `zodResolver`). `estimatePasswordStrength` is called only by the signup page.
3. Calls nothing — pure functions.
4. Receives a password string.
5. Returns a parsed/validated string, or a `{score, label}` pair.
6. On failure: Zod throws with a field-level message; the client form shows it inline.
7. Secure: replaces the previous min-12-plus-composition-rules policy, which NIST
   800-63B specifically advises against (composition rules push users toward
   predictable, guessable patterns without improving real resistance to attack).
8. No inconsistent-state risk.

### `isPasswordBreached` / `needsRehash` / explicit argon2id params (`packages/security/src/server.ts`) — Implemented

1. `isPasswordBreached`: k-anonymity check against the HIBP range API (only a 5-char
   SHA-1 prefix ever leaves the process); fails open on any network/API error.
   `needsRehash`: compares an existing hash's parameters against the current
   `ARGON2_PARAMS` target. `ARGON2_PARAMS` itself: explicit OWASP-recommended values
   (19 MiB, t=2, p=1) instead of the argon2 library's own defaults.
2. `isPasswordBreached` called by `AuthService.signUp`/`resetPassword`, gated behind
   `env.FEATURE_BREACHED_PASSWORD_CHECK` (default off). `needsRehash` called by
   `AuthService.login` after a successful password verification.
3. `isPasswordBreached` calls the HIBP API via `fetch`. `needsRehash` calls
   `argon2.needsRehash`.
4. Receive a plaintext password / an existing hash, respectively.
5. Return a boolean.
6. On failure: `isPasswordBreached` returns `false` (fails open — an HIBP outage must
   never block signup/reset) rather than throwing.
7. Secure: the real password and even its full hash never leave the process — only a
   5-character hex prefix is sent, matching the k-anonymity protocol exactly.
8. No inconsistent-state risk.

## Phase 5 components (login process)

### `AuthService.login` — dummy-hash timing protection + correct status-check ordering (`apps/api/src/auth/auth.service.ts`) — Implemented

1. Looks up by normalized email; verifies against a real hash if the user exists, or
   a fixed-cost dummy hash (computed once at process startup) if not — so an unknown
   email and a wrong password on a known one take statistically similar time. Every
   account-state check (`disabled`/`deleted`/`locked`/`pending_verification`) runs
   only after the password is confirmed correct.
2. Called by `AuthController.login`.
3. Calls `verifyPassword`, `recordFailedAttempt`, `recordAuthEvent`, `createSession`.
4. Receives the login DTO, request context, and (new) an optional
   `existingSessionId` to discard on success.
5. Returns `IssuedTokens & { userId }`, or throws a typed exception (401/403/423).
6. On failure: never reveals which of "no such email" / "wrong password" it was;
   account-status responses (403/423) are only reachable with the correct password.
7. Secure: this is the direct fix for BUG-007 and BUG-008 (see `FINDINGS.md`) — the
   entire reason this method was rewritten this phase.
8. No inconsistent-state risk — failure-count/lockout updates and session creation
   are each their own atomic DB operation.

### `AuthService.recordFailedAttempt` — growing-delay lockout (`apps/api/src/auth/auth.service.ts`) — Implemented

1. Increments `failedLoginCount`; once it reaches the 5-attempt threshold, locks the
   account for a duration that DOUBLES for each failure beyond the threshold (capped
   at 24h) — a persistent attacker is slowed exponentially faster than a one-off
   typo-prone legitimate user.
2. Called by `login` on a wrong-password attempt against a real account.
3. Calls `prisma.user.update`.
4. Receives the user's id and current `failedLoginCount`.
5. Returns `void`.
6. On failure: n/a (a DB write failure here propagates and the login attempt itself
   fails closed with a 5xx, never silently skipping the lockout).
7. Secure: this is the literal "growing delay" checklist requirement.
8. No inconsistent-state risk.

### `RedisThrottlerStorage` (`apps/api/src/common/redis-throttler-storage.ts`) — Implemented

1. Implements `@nestjs/throttler`'s `ThrottlerStorage` interface backed by Redis
   (`INCR`/`PEXPIRE`/`PTTL`) instead of the library's own in-process-memory default —
   replaces it globally for every `@Throttle`-guarded route, not only login.
2. Called by `ThrottlerGuard` (wired via `ThrottlerModule.forRootAsync` in
   `app.module.ts`).
3. Calls the shared `ioredis` client (`RedisModule`).
4. Receives a rate-limit key, TTL, limit, block duration, and throttler name.
5. Returns a `ThrottlerStorageRecord` (hit count, block state, retry timing).
6. On failure: a Redis outage would make every throttled route fail (no silent
   fallback to unlimited) — intentional: the Phase 5 spec requires rate limiting to
   live in a shared store, "never process memory," so there is no in-process fallback
   to degrade to.
7. Secure: this is the literal "shared store... never process memory" checklist
   requirement, previously violated by the library's own default.
8. No inconsistent-state risk — Redis is the single source of truth for every
   instance of the API.

### `AllExceptionsFilter` — Prisma connection-error mapping + Retry-After (`apps/api/src/common/all-exceptions.filter.ts`) — Implemented

1. Maps a Prisma connection-level error (`PrismaClientInitializationError`, or a
   known-request error with a connection-failure code) to 503 with a safe, generic
   message — never the raw Prisma error (which can include hostnames/connection
   strings). Also now sets a `Retry-After` header whenever an exception's `details`
   carry a `retryAfterSeconds` value.
2. Called by Nest's global exception-handling pipeline for every unhandled error.
3. Calls `logger.error` (redacting).
4. Receives any thrown exception.
5. Returns a normalized `{ requestId, code, message, details }` body.
6. On failure: n/a — this _is_ the failure handler.
7. Secure: this is the literal "map auth provider errors, database errors... to safe
   codes (503 or 502) with a retry path" checklist requirement.
8. No inconsistent-state risk.

### `ZodValidationPipe` — 422 instead of 400 (`apps/api/src/common/zod-validation.pipe.ts`) — Implemented

1. Validation failures now return `422 Unprocessable Entity` (the semantically
   correct code for "syntactically valid, semantically invalid") with per-field
   messages, instead of a generic `400`. Applies to every Zod-validated endpoint in
   the app, not only login.
2. Called by every controller method annotated `@UsePipes(new ZodValidationPipe(...))`.
3. Calls the given Zod schema's `safeParse`.
4. Receives the raw request body.
5. Returns the parsed, typed body, or throws `UnprocessableEntityException`.
6. On failure: field-level errors (`details.fieldErrors`) let the client show exactly
   which field was wrong, never a raw Zod error object.
7. Secure: this is the literal "reject... with 422 and field messages" checklist item.
8. No inconsistent-state risk.

### `createApiClient` — timeout, offline detection (`packages/api-client/src/index.ts`) — Implemented

1. Adds a per-request timeout (`AbortController`, default 10s) and a fail-fast,
   distinguishable error when `navigator.onLine` is `false`, both ahead of touching
   the network.
2. Called by every page using `apiClient`.
3. Calls `fetch` with an abort signal.
4. Receives a path, method, body, and an optional `timeoutMs`.
5. Returns the parsed response, or throws `ApiClientTimeoutError`/
   `ApiClientOfflineError`/`ApiClientError` (each distinct and narrowable by the
   caller).
6. On failure: a genuine network failure (e.g. DNS/connection refused) propagates
   as-is, distinct from a timeout — the caller can tell the two apart.
7. Secure: no secret is ever logged by these new error paths.
8. No inconsistent-state risk.

### `LoginForm` — double-submit guard, existing-session redirect, server-derived auth state (`apps/web/src/app/(auth)/login/page.tsx`) — Implemented

1. Checks `GET /auth/me` on mount and redirects to the dashboard if already
   authenticated (checklist "Existing session"); guards the submit handler with a
   ref (in addition to react-hook-form's own `isSubmitting`) against a double-click
   race; never sets local "logged in" state from the login response itself — every
   page that needs auth state re-derives it from the server.
2. Rendered by `apps/web/src/app/(auth)/login/page.tsx`.
3. Calls `GET /auth/me`, `POST /auth/login`, `resolveRedirectTarget` (via
   `isAllowedRedirect`).
4. Receives the `next` query param.
5. Returns rendered UI; on success, navigates to the resolved redirect target.
6. On failure: distinguishes timeout/offline/server error in the shown message.
7. Secure: redirect target is always allowlist-checked; this is the literal
   "Redirect after login through the safe return URL helper" + "Signed in users
   visiting login go to the dashboard" checklist items.
8. No inconsistent-state risk — purely client-side rendering logic.

### `DashboardError` / hardened dashboard fetch (`apps/web/src/app/dashboard/{page,dashboard-error}.tsx`) — Implemented

1. The dashboard's server-side `/auth/me` fetch is now wrapped so a 401 still
   redirects to `/login`, but every OTHER failure (network error, 5xx, malformed
   body) renders a visible retry state instead of crashing or showing a blank page.
2. Rendered for every request to `/dashboard`.
3. Calls `GET /auth/me` (server-side, forwarding the session cookie).
4. Receives the request's cookies.
5. Returns the dashboard, a redirect, or `<DashboardError>`.
6. On failure: never a blank page or an uncaught exception — this is the literal
   "Login succeeding but dashboard/profile/permissions failing" checklist items.
7. Secure: no session data is ever logged; the error message is generic.
8. **Implementation note**: `redirect()` throws a Next.js-internal control-flow
   error that must not be swallowed — the fetch is isolated in its own try/catch
   that only ever produces a plain `Response | null`, and every status-based branch
   (the redirect included) happens outside that block. Getting this wrong would have
   silently broken the 401 redirect (the exact "Redirect loops" / blank-page failure
   mode this component exists to prevent) — a bug worth documenting even though it
   was caught before being committed.

### `AuthService.requestOtp` / `verifyOtp` — rewritten for Phase 6 (`apps/api/src/auth/auth.service.ts`) — Implemented

1. Issues a CSPRNG 6-digit OTP (hash-only storage), invalidates any previous unused
   OTP before issuing a new one, enforces a 30-second per-destination resend
   cooldown, and consumes a code atomically on verify (`updateMany` guarded by
   `usedAt: null`) so two concurrent submissions of the same code cannot both
   succeed — fixes BUG-009 (see FINDINGS.md). On success, discards any session the
   caller's existing cookie points at before issuing a new one (session-fixation
   prevention, same pattern as Phase 5's `login()`).
2. Called by `AuthController.requestOtp`/`verifyOtp` (`/auth/otp/request`,
   `/auth/otp/verify`).
3. Calls `prisma.oneTimeToken`, `generateSecureCode`/`hashToken`
   (`@saas/security`), `this.sendEmail` (wraps `otpEmailTemplate`), `createSession`.
4. Receives `{ email }` / `{ email, code }`, a request context, and (verify only)
   an optional `existingSessionId`.
5. Returns `void` (request) or `IssuedTokens & { userId }` (verify); throws
   `UnauthorizedException("Invalid or expired code.")` on any failure.
6. On failure: the SAME error message covers wrong code, expired code, exhausted
   attempts, and unknown destination — no branch reveals which (checklist "OTP
   enumeration protection").
7. Secure: only `tokenHash` is ever persisted or logged; the raw code never reaches
   the database, a log line, or a thrown error.
8. **Fixed inconsistent-state risk**: the previous implementation consumed a code
   via a separate `findFirst` then `update`, which let two concurrent correct
   submissions both pass the `findFirst` before either flipped `usedAt` — i.e. the
   same code could issue two sessions. The atomic `updateMany`-with-`usedAt: null`
   guard closes this; see BUG-009.

### `AuthService.requestMagicLink` / `verifyMagicLink` — new in Phase 6 (`apps/api/src/auth/auth.service.ts`) — Implemented

1. Added to pragmatically resolve open question D4 (ARCHITECTURE.md), since the
   Phase 6 task list itself specifies both an OTP code and a magic-link token.
   Issues a 32-byte CSPRNG token (hash-only storage), same cooldown/invalidate-on-
   resend pattern as OTP, and the same atomic-consume-via-`updateMany` guard (no
   attempt counter, since the token's entropy makes guessing infeasible).
2. Called by `AuthController.requestMagicLink`/`verifyMagicLink`
   (`/auth/magic-link/request`, `/auth/magic-link/verify`), and by the confirm page
   at `apps/web/src/app/(auth)/magic-link/magic-link-client.tsx`.
3. Calls `prisma.oneTimeToken`, `generateSecureToken`/`hashToken`
   (`@saas/security`), `this.sendEmail` (wraps `magicLinkEmailTemplate`),
   `createSession`.
4. Receives `{ email }` / `{ token }`, a request context, and (verify only) an
   optional `existingSessionId`.
5. Returns `void` (request) or `IssuedTokens & { userId }` (verify); throws
   `UnauthorizedException("This sign-in link is invalid or has already been used.")`
   on any failure.
6. On failure: the same message covers an expired, already-used, or never-issued
   token — enumeration-safe by construction.
7. Secure: only `tokenHash` is persisted; the raw token never reaches the database,
   a log line, or a thrown error.
8. No inconsistent-state risk beyond the one shared with OTP (addressed by the same
   atomic consume).

### `resolveExistingSessionId` helper — deduplicated session-fixation check (`apps/api/src/auth/auth.controller.ts`) — Implemented

1. Extracts the previously-inline "read the caller's current session cookie and
   verify it, swallowing any error" logic (first written for `login()` in Phase 5)
   into one shared private method, now also used by `/otp/verify` and
   `/magic-link/verify`.
2. Called by `login`, `verifyOtp`, `verifyMagicLink`.
3. Calls `AuthService.verifyAccessToken`.
4. Receives the raw `Request` (reads its cookie).
5. Returns the existing session's id, or `null` if there is none or it's invalid.
6. On failure: any verification error (expired/malformed/missing cookie) is treated
   identically — `null`, never thrown.
7. Secure: never logs the cookie value; a forged/expired cookie simply yields `null`
   rather than being trusted.
8. No inconsistent-state risk — read-only.

### `MagicLinkClient` — confirm-page POST pattern (`apps/web/src/app/(auth)/magic-link/magic-link-client.tsx`) — Implemented

1. Reads the token from the URL on mount, immediately strips it from the visible
   address bar (same pattern as `VerifyEmailClient`), and only submits it via an
   explicit `POST /auth/magic-link/verify` triggered by a user click on "Confirm
   sign-in" — satisfies task 6 ("magic links open a confirm page that POSTs, so
   link scanners cannot consume them") because a GET made by an automated link
   scanner never reaches a route that consumes the token.
2. Rendered by `apps/web/src/app/(auth)/magic-link/page.tsx` (also sets
   `referrer: "no-referrer"` metadata, same rationale as `verify-email/page.tsx`).
3. Calls `POST /auth/magic-link/verify`.
4. Receives the `token` and `next` query params.
5. Returns rendered UI; on success, links to the resolved (allowlist-checked)
   redirect target.
6. On failure: a single generic "this link no longer works" state covers expired,
   already-used, and invalid tokens alike — never distinguishes which.
7. Secure: `no-referrer` page metadata; redirect target is always allowlist-checked
   via `isAllowedRedirect`.
8. No inconsistent-state risk — purely client-side rendering logic.

### `OtpClient` — request/verify UI with countdown (`apps/web/src/app/(auth)/otp/otp-client.tsx`) — Implemented

1. Two-step UI (request email → enter code) satisfying task 8: a single code
   input with `autoComplete="one-time-code"`, `inputMode="numeric"`, native paste
   support (a plain text input accepts a pasted 6-digit string with no extra
   handler), a resend button disabled during a 30-second countdown mirroring the
   backend's cooldown, and cleared/distinct error states per attempt.
2. Rendered by `apps/web/src/app/(auth)/otp/page.tsx`.
3. Calls `POST /auth/otp/request`, `POST /auth/otp/verify`.
4. Receives the `next` query param (for the post-verify redirect).
5. Returns rendered UI; on success, navigates to the resolved redirect target.
6. On failure: distinguishes timeout/offline/server error in the shown message,
   same `describeError` pattern as `LoginForm`.
7. Secure: redirect target is always allowlist-checked; the raw code only ever
   lives in component state, never logged or persisted client-side.
8. No inconsistent-state risk — a `submitLock` ref guards both the request and
   verify handlers against a double-submit race, same pattern as `LoginForm`.

### `AuthService.signAccessToken` / `verifyAccessToken` — asymmetric RS256, kid rotation, iss/aud/nbf (`apps/api/src/auth/auth.service.ts`) — Implemented

1. Access tokens are now signed with RS256 (asymmetric) instead of the Phase
   3-6 shared-secret HS256 — a leaked PUBLIC key can't be used to forge tokens.
   Carries a `kid` header; verification picks the matching public key (current
   or previous), rejects any algorithm but RS256 (including `alg: none`), and
   checks `iss`/`aud`/`exp`/`nbf` with a 5-second clock-skew tolerance. If
   `AUTH_JWT_PRIVATE_KEY`/`PUBLIC_KEY` aren't configured, an ephemeral RSA
   keypair is generated once at process startup (same pattern as
   `dummyHashPromise`).
2. Called by every session-issuing method (`login`, `verifyOtp`,
   `verifyMagicLink`, `refresh`) and by `SessionGuard`/
   `AuthController.resolveExistingSessionId` (verify).
3. Calls `jsonwebtoken`'s `sign`/`verify`/`decode`.
4. Receives a userId+sessionId pair (sign) or a raw token string (verify).
5. Returns a signed JWT string, or `{ userId, sessionId }`; throws
   `UnauthorizedException("Invalid or expired session.")` on any verification
   failure — malformed, wrong algorithm, wrong key, wrong issuer/audience,
   expired, not-yet-valid, all collapse to the same message.
6. On failure: never reveals which specific check failed — this is the literal
   "allowlists the algorithm, reject none" + "checks issuer, audience, expiry
   and not before" checklist requirement.
7. Secure: the private key never leaves this module; the public key is safe to
   expose (used only to verify, never to sign).
8. **Deliberate deviation from the task's literal wording**: EdDSA was the
   spec's first-listed algorithm, but `@types/jsonwebtoken@9.0.10`'s `Algorithm`
   type doesn't include `"EdDSA"` yet (even though the underlying library and
   Node both support it) — RS256, the spec's explicitly-allowed alternative,
   avoids fighting the type definitions for no functional benefit. See
   FINDINGS.md.

### `AuthService.refresh` / `rotateAndRecord` / `followRotationChain` — reuse-grace window (`apps/api/src/auth/auth.service.ts`) — Implemented

1. Rotation (already correct from Phase 5/6) is now paired with a short grace
   window: presenting an already-rotated token within
   `AUTH_REFRESH_REUSE_GRACE_MS` (default 10s) resolves to the live session at
   the end of the rotation chain instead of being treated as a stolen-token
   replay — handles the benign case of two tabs refreshing near-simultaneously,
   or a client retrying a request whose response it never saw. Outside the
   grace window, the same presentation still revokes the entire family exactly
   as before.
2. Called by `AuthController.refresh` (`POST /auth/refresh`).
3. Calls `prisma.session` (find/update/create), `rotateSession`.
4. Receives a raw refresh token and a request context.
5. Returns new `IssuedTokens`, or throws `UnauthorizedException`.
6. On failure: identical "Session expired or revoked" message for every
   failure mode (unknown token, revoked-outside-grace, absolute-expired).
7. Secure: never logs the raw refresh token; only its hash is ever looked up.
8. No inconsistent-state risk: the rotation-chain pointer (`rotatedToSessionId`)
   is written after the new session is created, so a crash between the two
   leaves the chain one hop short rather than pointing at a nonexistent row —
   `followRotationChain` treats a missing/already-revoked-with-no-further-
   pointer session as "not live," falling through to the stolen-token path,
   which is the safe default on ambiguity.

### `AuthService.changePassword` / `logoutAllDevices` — new in Phase 7 (`apps/api/src/auth/auth.service.ts`) — Implemented

1. `changePassword` requires the current password, then revokes every OTHER
   session (checklist "Password change revokes other sessions") while leaving
   the calling session alive. `logoutAllDevices` revokes every session
   including the calling one (checklist "Log out of all devices").
2. Called by `AuthController.changePassword`/`logoutAllDevices`
   (`POST /auth/change-password`, `POST /auth/logout-all-devices`), both behind
   `SessionGuard` + `CsrfGuard`.
3. Calls `verifyPassword`, `hashPassword`, `isPasswordBreached`,
   `prisma.session.updateMany`.
4. Receives userId, the calling sessionId, and (for changePassword) the
   current+new password.
5. Returns `void`; `changePassword` throws `UnauthorizedException` on a wrong
   current password.
6. On failure: a wrong current password never reveals anything about the new
   password's validity, or vice versa — checked in that order deliberately.
7. Secure: an account with no password hash (OAuth-only) can never pass the
   current-password check — there is no fallback path that would let this
   endpoint silently create a password for such an account.
8. No inconsistent-state risk — a single transaction covers the password
   update and the other-session revocation together.

### `CsrfGuard` — double-submit CSRF + Origin check (`apps/api/src/common/csrf.guard.ts`) — Implemented

1. New guard applied to every cookie-authenticated state-changing route
   (`logout`, `logout-all-devices`, `refresh`, session revoke/revoke-others,
   `change-password`): on POST/PUT/PATCH/DELETE, re-checks the `Origin` header
   against the CORS allowlist (defense-in-depth beyond browser-enforced CORS)
   and requires a `X-CSRF-Token` header matching the `csrf_token`/
   `__Host-csrf_token` cookie (double-submit pattern), compared in constant
   time.
2. Called via `@UseGuards(..., CsrfGuard)` on the routes above.
3. Calls nothing external — pure request inspection.
4. Receives the `Request` (method, Origin header, cookies, X-CSRF-Token header).
5. Returns `true`, or throws `ForbiddenException`.
6. On failure: a missing/mismatched token or disallowed Origin is rejected
   identically — no information about which check failed.
7. Secure: this is the literal "CSRF token plus Origin check on every cookie
   authenticated state change" checklist requirement. The CSRF cookie is
   deliberately NOT HttpOnly (the client must be able to read and echo it) —
   safe under the double-submit pattern because an attacker's cross-site page
   can make the browser SEND the cookie but can't READ its value.
8. No inconsistent-state risk — stateless, per-request check.

### `SessionGuard` — idle-timeout + absolute-expiry enforcement, Cache-Control (`apps/api/src/auth/session.guard.ts`) — Implemented

1. Now also rejects a session past its `absoluteExpiresAt` (previously checked
   only in `refresh()`, not here) and past `AUTH_IDLE_TIMEOUT_SECONDS` of
   inactivity (`lastUsedAt`, which this guard now updates on every successful
   check — previously it was only ever set at session creation, never touched
   again). Also sets `Cache-Control: no-store` on every authenticated
   response. Fixed to read the cookie name via the shared, env-driven
   `cookie-names.ts` instead of reading `process.env` directly (BUG-011; see
   FINDINGS.md).
2. Called by every `@UseGuards(SessionGuard)` route.
3. Calls `AuthService.verifyAccessToken`/`touchSessionActivity`,
   `PrincipalService.resolve`, `prisma.session.findUnique`.
4. Receives the request's session cookie.
5. Returns `true` (attaches `request.principal`), or throws
   `UnauthorizedException`.
6. On failure: revoked, absolute-expired, and idle-timed-out sessions all get
   the same rejection — no distinguishable response.
7. Secure: idle timeout is enforced server-side against the database row, not
   trusted from any client-supplied timestamp.
8. **Design note (not a bug)**: idleness is measured by activity against
   _protected resources_ (anything behind `SessionGuard`), not by `refresh()`
   calls — a client that only ever calls `/auth/refresh` without ever hitting a
   protected route could keep a session's refresh-token chain alive indefinitely
   without ever touching `lastUsedAt`. This is a deliberate interpretation
   (idle = unused for its actual purpose), flagged as a potential risk in
   FINDINGS.md for a future phase to revisit if a stricter reading is wanted.

### `createApiClient` refresh-and-retry, CSRF header, cross-tab logout (`packages/api-client/src/index.ts`) — Implemented

1. Adds single-flight refresh-and-retry-once on a 401 (one shared in-flight
   promise per client instance — checklist "5 parallel requests... exactly one
   refresh"), automatic `X-CSRF-Token` header attachment on state-changing
   requests (reads the double-submit cookie), and `broadcastLogout`/
   `onLogoutBroadcast` (BroadcastChannel, with a `localStorage`-ping fallback
   for browsers that block it).
2. Called by every page using `apiClient` in apps/web and apps/admin.
3. Calls `fetch` (including `POST /auth/refresh`), `BroadcastChannel`/
   `localStorage`/`addEventListener` (structurally, via `globalThis` casts —
   this package has no DOM lib).
4. Receives the same inputs as before, plus an internal `__isRetry` flag.
5. Returns the parsed response, or throws one of the existing typed errors.
6. On failure: a failed refresh still calls `onUnauthorized` exactly once,
   same as before this change — the new retry path only adds a SUCCESS case
   that previously didn't exist.
7. Secure: the CSRF token is read from a cookie, never a JS-accessible token
   store; `broadcastLogout`'s fallback never writes anything sensitive to
   `localStorage` (only a timestamp ping).
8. No inconsistent-state risk — the shared refresh promise is cleared the
   moment it settles, so a later, unrelated 401 starts a fresh attempt.

### Session management UI (`apps/web/src/app/dashboard/{sessions/*,dashboard-actions}.tsx`) — Implemented

1. New `/dashboard/sessions` page lists every active session (device/browser,
   last-active time, a "this device" marker) with a per-row Revoke button and
   a "Log out other devices" button — checklist task 7. A new logout button on
   the dashboard itself calls `/auth/logout`, broadcasts the logout to other
   tabs, then redirects; the dashboard also subscribes to logout broadcasts
   from OTHER tabs and redirects itself when one arrives.
2. Rendered by `apps/web/src/app/dashboard/{page,sessions/page}.tsx`.
3. Calls `GET /auth/sessions`, `DELETE /auth/sessions/:id`,
   `POST /auth/sessions/revoke-others`, `POST /auth/logout`,
   `broadcastLogout`/`onLogoutBroadcast`.
4. Receives no route params beyond navigation.
5. Returns rendered UI; revoking refreshes the list; logging out navigates to
   `/login`.
6. On failure: a failed list/revoke/logout shows an inline error message, never
   a blank page or an uncaught exception.
7. Secure: never renders `refreshTokenHash` or any field the controller
   doesn't already strip server-side (see the controller change below).
8. No inconsistent-state risk — purely client-side rendering logic.

### `AuthController.listSessions` response shaping (`apps/api/src/auth/auth.controller.ts`) — Implemented

1. `GET /auth/sessions` now maps each row to `{ id, current, userAgent,
createdAt, lastUsedAt, expiresAt }` instead of returning
   `AuthService.listSessions`'s raw Prisma rows, which included
   `refreshTokenHash`, `ipHash`, and the new `rotatedToSessionId` — none of
   which a frontend session-list view should ever receive, even hashed.
2. Called by the new sessions page above.
3. Calls `AuthService.listSessions`.
4. Receives the resolved principal (for the `current` flag).
5. Returns the shaped array described above.
6. On failure: n/a — pure read, no state change.
7. Secure: this is the literal "never expose... in... responses" spirit of
   AUTH_RULES rule 4, applied to a hashed-but-still-unnecessary-to-expose field,
   not just raw secrets.
8. No inconsistent-state risk.

### `AuthService.requestPasswordReset` / `resetPassword` — rewritten for Phase 8 (`apps/api/src/auth/auth.service.ts`) — Implemented

1. `requestPasswordReset` now adds a per-email resend cooldown and invalidates
   any previous unused reset token before issuing a new one (same pattern as
   OTP/magic-link), narrows (but does not fully close — see FINDINGS.md) the
   timing gap between known/unknown emails, and sends the reset email through
   the BullMQ queue instead of directly. `resetPassword` now consumes the
   token atomically (`updateMany` guarded by `usedAt: null`, fixing BUG-012 —
   the same TOCTOU race as BUG-009), returns a distinct `code`
   (`RESET_TOKEN_INVALID`/`RESET_TOKEN_USED`/`RESET_TOKEN_EXPIRED`) per failure
   reason, records a failure `auth_event` for each, and sends a "password
   changed" confirmation email (queued) on success.
2. Called by `AuthController.requestPasswordReset`/`resetPassword`
   (`/auth/password-reset/request`, `/auth/password-reset/confirm`).
3. Calls `prisma.oneTimeToken`/`prisma.session`/`prisma.user`,
   `issueOneTimeToken`/`hashToken` (`@saas/auth`/`@saas/security`),
   `this.sendEmail` (now supports queued delivery), `enqueueEmail`.
4. Receives `{ email }` / `{ token, password }` and a request context.
5. Returns `void`; `resetPassword` throws a `BadRequestException` with a
   structured `{ code, message }` body on any failure.
6. On failure: `RESET_TOKEN_INVALID`/`USED`/`EXPIRED` each describe the
   TOKEN's state only — none reveal whether the underlying account exists
   (same enumeration-safe shape as `verifyEmail`'s reason enum).
7. Secure: only `tokenHash` is ever persisted or logged; the raw token never
   reaches the database, a log line, or a thrown error.
8. **Fixed inconsistent-state risk**: the previous implementation consumed a
   token via a separate read-then-`update` (BUG-012), which let two concurrent
   submissions of the same token both succeed. The atomic `updateMany`-with-
   `usedAt: null` guard closes this.

### `enqueueEmail` — BullMQ email-queue producer (`apps/api/src/common/email-queue.ts`) — Implemented

1. New module letting `AuthService` hand an email off to apps/worker's
   already-existing `emailWorker` (BullMQ, `apps/worker/src/processors/
email.processor.ts`) instead of sending it synchronously in-request —
   checklist "email sent from a queue." The Redis connection is created lazily
   on first use, not at module import time, because every existing test file
   transitively imports this module via `auth.service.ts` and an eager
   connection would attempt to reach Redis in every one of them regardless of
   whether that test ever triggers an email.
2. Called by `AuthService.sendEmail` when its new `queued` parameter is `true`
   (currently opted in only for the two password-reset-related emails — see
   that method's own entry above).
3. Calls `bullmq`'s `Queue.add`.
4. Receives a `SendEmailInput` (`to`/`subject`/`html`).
5. Returns `void`; a Redis-connection failure rejects, which the caller
   (`sendEmail`) already catches, logs, and records a `*_failed` auth event
   for — never thrown further.
6. On failure: never crashes the process — the lazily-created connection has
   an `error` listener attached specifically so an unhandled Redis error
   (which would otherwise crash the process per Node's EventEmitter
   semantics) just logs instead.
7. Secure: no email content is logged beyond what `sendEmail`'s existing
   failure-path logging already does (no raw token is ever part of the
   logged fields, only the error and request/user IDs).
8. No inconsistent-state risk — a failed enqueue is equivalent to a failed
   direct send from the caller's perspective (both are caught the same way).

### Reset-password page rewrite (`apps/web/src/app/(auth)/reset-password/{page,reset-password-client}.tsx`) — Implemented

1. Now strips the token from the visible address bar after reading it
   (previously left it in the URL/history for the page's lifetime), sets
   `referrer: "no-referrer"` page metadata, differentiates
   expired/used/invalid token states (each with a distinct message and a
   "Request a new link" affordance pointing at `/forgot-password`), and
   redirects through the same `isAllowedRedirect`/`next`-param safe-redirect
   helper used by login/verify-email/magic-link — previously hardcoded
   `router.push("/login?reason=password_reset")` with no `next` support.
2. Rendered by `apps/web/src/app/(auth)/reset-password/page.tsx`.
3. Calls `POST /auth/password-reset/confirm`, `isAllowedRedirect`.
4. Receives the `token` and `next` query params.
5. Returns rendered UI; on success, navigates to the resolved (allowlisted)
   redirect target with `?reason=password_reset`.
6. On failure: a structured `code` from the API response
   (`RESET_TOKEN_INVALID`/`USED`/`EXPIRED`) selects a dedicated recovery
   state; any other error (e.g. a validation or breached-password rejection)
   shows an inline form error instead, letting the user simply retry with a
   different password rather than being sent to the "request a new link"
   dead end.
7. Secure: `no-referrer` page metadata; redirect target is always
   allowlist-checked.
8. No inconsistent-state risk — purely client-side rendering logic.

### `OAuthProviderAdapter` registry — Google/Microsoft/GitHub/Facebook/Apple/generic (`packages/auth/src/oauth/*.ts`) — Implemented

1. One module per provider behind a single shared interface
   (`{ name, callbackMethod, buildAuthorizationUrl, resolveIdentity }`), built
   with PKCE (S256) on every provider and full OIDC ID-token validation
   (signature via JWKS, issuer, audience, expiry, nonce) for the OIDC
   providers (Google, Microsoft, Apple, generic); GitHub and Facebook (plain
   OAuth2, no ID token) instead call a userinfo REST endpoint and apply their
   own email-trust rule. The sixth, "any other provider" slot is a single
   OIDC-discovery-driven adapter (`generic-oidc.ts`), not a hardcoded sixth
   named provider — proving the interface genuinely generalizes.
2. Called by `OAuthService` (`buildOAuthProviderRegistry`).
3. Calls `fetch` (token exchange, userinfo), `jose` (`jwtVerify`,
   `createRemoteJWKSet`, `SignJWT`/`importPKCS8` for Apple's client-secret
   JWT).
4. Receives per-provider client credentials from env (see
   `packages/config/src/index.ts`); `resolveIdentity` receives the
   authorization code, redirect URI, PKCE verifier, and (OIDC only) nonce.
5. Returns a normalized `ExternalIdentity { providerAccountId, email,
emailVerified, displayName }`; throws `OAuthProviderError` (a stable
   `code`, never the provider's raw error text) on any failure.
6. On failure: every adapter throws the same error TYPE regardless of which
   specific thing failed (exchange, missing token, signature, issuer,
   audience, nonce) — the caller (`OAuthService`) decides what to show the
   user, the adapter never does.
7. Secure: `emailVerified` is the sole signal the rest of the app trusts to
   decide whether an email can anchor account creation/matching — Microsoft
   always reports `false` (checklist "do not trust the email claim for
   linking"), GitHub reports `false` whenever there's no primary+verified
   address, Facebook reports `false` only when no email is returned at all.
   No adapter ever logs a raw access/ID token.
8. **Caught-before-shipping note**: the controller's `mode=link` session
   check initially used a bare `jwt.decode()` (no signature verification) to
   read the calling user's id from their session cookie before this was
   caught in review and replaced with `AuthService.verifyAccessToken` (full
   signature/claims verification) — see FINDINGS.md BUG-014. No inconsistent-
   state risk in the shipped code; flagged here because this class of mistake
   is exactly the kind AUTH_RULES.md exists to catch.

### `verifyIdToken` / JWKS resolution (`packages/auth/src/oauth/id-token.ts`) — Implemented

1. Shared full-OIDC-validation helper (signature + issuer + audience + expiry
   - nonce) used by Google/Apple/generic directly, and by Microsoft (which
     validates issuer manually against its own tenant claim) via the same
     underlying memoized JWKS resolver (`getJwks`) rather than its own separate
     `createRemoteJWKSet` instance — keeping exactly one cached fetcher per
     jwksUri across every provider, not one per adapter.
2. Called by every OIDC adapter's `resolveIdentity`.
3. Calls `jose`'s `jwtVerify`/`createRemoteJWKSet`.
4. Receives the raw ID token, jwksUri, expected issuer(s)/audience, and an
   optional nonce.
5. Returns the verified `JWTPayload`; throws `OAuthProviderError` on any
   validation failure.
6. On failure: a single generic "ID token signature/claims validation
   failed" / "nonce did not match" — never reveals which specific claim check
   tripped.
7. Secure: this is the literal "full ID token validation (signature, issuer,
   audience, expiry, nonce)" checklist requirement — `algorithms` is
   implicitly constrained by `jose`'s JWKS-key-type matching (a JWKS entry
   has one key type/algorithm; there is no "alg: none" path through a remote
   key set at all).
8. No inconsistent-state risk — pure verification, no writes.

### `OAuthService` — account resolution, linking, pending-email flow (`apps/api/src/auth/oauth/oauth.service.ts`) — Implemented

1. The orchestration layer: resolves an `ExternalIdentity` to a signed-in
   session, a newly linked account, a pending-email-verification redirect, or
   a typed error — implementing every account-linking rule in the checklist
   (identity matched on provider+providerAccountId never email; email
   collision never auto-links; unverified provider emails never link;
   provider identity collision shows a clear error; linking requires an
   authenticated caller).
2. Called by `OAuthController`.
3. Calls `prisma.{user,oauthAccount,oauthPendingIdentity,role,userRole}`,
   `AuthService.issueSessionForUser`/`recordAuthEvent`,
   `@saas/auth`'s registry/PKCE/token helpers.
4. Receives a provider name, the callback's code/state-cookie contents, and
   (for linking) the calling user's id.
5. Returns a discriminated `OAuthCallbackResult` (`signed_in` / `linked` /
   `pending_email` / `error`).
6. On failure: every branch is enumeration-safe except the one the task
   itself specifies otherwise (`email_collision`, which deliberately reveals
   an account exists — see FINDINGS.md for why this is a documented exception,
   not an oversight).
7. Secure: a brand-new account is only ever created from a verified email;
   an unverified/missing email always routes through
   `OauthPendingIdentity` (its own short-lived, hash-only-storage table — see
   schema) rather than ever being trusted directly.
8. **Test-only seam**: `useRegistryForTesting` lets tests inject fake
   adapters instead of building the real env-driven registry — never called
   outside `phase9-oauth*.spec.ts`.

### `OAuthController` — start/callback/link/unlink routes, in-app-browser detection (`apps/api/src/auth/oauth/oauth.controller.ts`) — Implemented

1. `GET /auth/oauth/:provider/start` detects an in-app browser (checklist
   4.1) and shows a plain "open in your browser" page instead of ever
   redirecting to the provider; otherwise sets the state cookie (SameSite
   None+Secure for Apple's cross-site POST callback, Lax for every GET-
   callback provider) and does a full-page redirect (never a popup).
   `GET`/`POST :provider/callback` validate state (missing/mismatched),
   cancellation (`access_denied`), and missing code BEFORE ever calling
   `OAuthService` — the state cookie is consumed (read-and-cleared) in one
   step, so a replayed callback URL always finds no cookie the second time.
2. Called by the browser (via a full-page navigation from the frontend's
   `OAuthButtons`) and by the OAuth provider itself (the callback).
3. Calls `OAuthService`, `AuthService.verifyAccessToken` (for the `mode=link`
   session check).
4. Receives query params (`start`) or query/body params (`callback`,
   GET/POST respectively), plus the state cookie.
5. Returns an HTML page (in-app-browser warning) or an HTTP redirect in every
   other case — never a JSON body for these two routes, since both are
   browser navigations, not API calls.
6. On failure: every distinct failure reason maps to its own `?code=` on the
   `/oauth/error` redirect, so the frontend can show a specific, non-generic
   message.
7. Secure: the `mode=link` session check uses full signature verification
   (`AuthService.verifyAccessToken`), not a bare decode — see the "caught-
   before-shipping" note on the adapter registry entry above, and BUG-014 in
   FINDINGS.md.
8. No inconsistent-state risk — the state cookie's single-use consumption is
   the only piece of request-scoped state, and it's always cleared
   unconditionally at the top of the callback handler.

### Reset/Connected-accounts/OAuth frontend pages (`apps/web/src/{components/oauth-buttons,app/oauth/*,app/dashboard/connected-accounts/*}.tsx`) — Implemented

1. `OAuthButtons` lists only whichever providers `GET /auth/oauth/providers`
   reports as actually configured, each a full-page-navigation button (never
   `window.open`, so there is no popup-blocked/closed state — checklist item
   12 is N/A by construction, see TRACEABILITY.md). `/oauth/error` renders a
   specific message per failure code with a "Back to login" retry.
   `/oauth/verify-email` is the Facebook/Microsoft collect-and-verify-email
   sub-flow (two steps: submit email, confirm code — same shape as the
   Phase 6 OTP UI). `/dashboard/connected-accounts` lists linked providers
   with per-row unlink buttons and `OAuthButtons mode="link"` for linking a
   new one.
2. Rendered by `apps/web/src/app/{(auth)/login,(auth)/signup,oauth/error,oauth/verify-email,dashboard/connected-accounts}/page.tsx`.
3. Calls `GET /auth/oauth/providers`, `POST /auth/oauth/pending/{submit-email,verify}`,
   `GET /auth/oauth/accounts`, `DELETE /auth/oauth/accounts/:provider`.
4. Receives the `code`/`token` query params the API's redirects attach.
5. Returns rendered UI; a full-page `window.location.href` navigation starts
   every OAuth flow.
6. On failure: distinct per-reason messages on `/oauth/error`; inline form
   errors elsewhere.
7. Secure: `/oauth/verify-email` sets no special metadata beyond the
   standard page shell (it carries a lookup token, not a reusable secret —
   the token is single-use server-side regardless of URL exposure).
8. No inconsistent-state risk — purely client-side rendering logic.

### Provider session behavior (documented, not implemented) — checklist task 8

This app's own session is always ended by the existing `POST /auth/logout`
(Phase 5) — true for a session created via password, OTP, magic link, OR any
OAuth provider, since a `Session` row doesn't record how it was created.
**None of the five providers' own SSO/IdP session is ever touched** by this
logout — a user who signs out of this app is NOT automatically signed out of
google.com, their Microsoft 365 tenant, GitHub.com, Facebook, or their Apple
ID session. Concretely: visiting `/auth/oauth/google/start` again right after
local logout, with an active Google browser session, will silently re-
authenticate via Google's own SSO without prompting for a password — this is
expected OAuth/SSO behavior, not a bug, but worth a user-facing note if this
ever becomes confusing in practice (e.g. "signed out of \[app\], but still
signed in to Google" on a shared computer). No per-provider "federated
logout" (e.g. Google's own end-session endpoint) is implemented this phase —
flagged as a potential future enhancement, not a current requirement.

## Component inventory (Authentication map checklist)

### 1. Every login page — Planned

`apps/web/src/app/(auth)/login/page.tsx` _(existing, pre-dates this phase)_

1. Renders the email/password login form and OAuth entry points.
2. Routed to by unauthenticated visitors to `/login`, and by middleware/guard redirects.
3. Calls `apps/web` login form component → `@saas/api-client` → `POST /auth/login`.
4. Receives `?next=` query param (redirect target) and user input (email, password).
5. Returns rendered HTML; on success, browser navigation to dashboard.
6. On failure, renders the error returned by the API inline; never throws unhandled.
7. **Planned to be secure**: no credentials persisted client-side, `next` passed through `isAllowedRedirect`. To be confirmed in Phase 3/9.
8. **Planned**: none — page itself is stateless; risk lives in the API, not here.

### 2. Every login component — Planned

`apps/web/src/components/auth/login-form.tsx` _(existing, pre-dates this phase)_

1. Collects and client-validates email/password via React Hook Form + Zod, submits to the API.
2. Called by the login page.
3. Calls `@saas/api-client`'s auth client.
4. Receives form field values.
5. Returns a submit result (success/redirect or typed error) to the page.
6. On failure, surfaces the API's error message without echoing raw request/response bodies.
7. **Planned to be secure**: no logging of password value; disabled-while-submitting to reduce double-submit (Phase 11 hardens this explicitly).
8. **Planned**: double-click/double-submit race is a known edge case, owned by Phase 11/17.

### 3. Every authentication function — Planned

`apps/api/src/auth/auth.service.ts` (`AuthService`) _(existing, pre-dates this phase)_

1. Implements signup, login, refresh, logout, verify-email, password-reset, OTP, OAuth, session revocation business logic.
2. Called only by `AuthController`.
3. Calls the `AuthProvider` adapter (Phase 2+ concrete implementation), Prisma (`packages/database`), `@saas/email`.
4. Receives validated DTOs plus request context (IP, user agent).
5. Returns domain results (tokens, session metadata) or throws typed Nest exceptions.
6. On failure, throws a structured exception mapped to a stable HTTP status by `AllExceptionsFilter`; never leaks internals.
7. **Planned to be secure**: never logs raw secrets (rule 3); hashes all stored tokens.
8. **Known risk carried from prior discovery**: signup's user-create and role-assign are not yet in one atomic transaction — flagged for Phase 2/3 to fix, to be recorded as a finding once confirmed against current code.

### 4. Every API endpoint — Planned

`apps/api/src/auth/auth.controller.ts` (`AuthController`) _(existing, pre-dates this phase)_

1. Exposes REST endpoints: `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/refresh`, `/auth/me`, `/auth/verify-email`, `/auth/password-reset/request`, `/auth/password-reset/confirm`, OTP endpoints, OAuth start/callback endpoints (Phase 6+), `/auth/sessions/revoke-others`.
2. Called by `apps/web`/`apps/admin` via `@saas/api-client`.
3. Calls `AuthService`, `PrincipalService`.
4. Receives Zod-validated DTOs (`ZodValidationPipe`).
5. Returns JSON + `Set-Cookie` headers where applicable.
6. On failure, returns a normalized `ApiError` shape via `AllExceptionsFilter`.
7. **Planned to be secure**: per-route `@Throttle()` rate limits; no endpoint trusts client-asserted identity.
8. **Planned**: none at the controller layer — it is intentionally thin.

### 5. Every server action — Planned

Not applicable in the current architecture: `apps/web`/`apps/admin` use client/server
components calling REST endpoints via `@saas/api-client`, not Next.js Server Actions, for
auth flows. **Status: Planned — no change proposed.** If a future phase introduces a
Server Action for any auth-adjacent mutation, it must be added here with all 8 answers
before merging, per `AUTH_RULES.md` rule 1.

### 6. Every auth hook — Planned

`apps/web/src/lib/` _(not yet implemented — TanStack Query wiring is an open gap, see ARCHITECTURE.md §1.1)_

1. **Planned**: a `useSession`/`useAuth` hook wrapping `GET /auth/me` via TanStack Query, exposing principal + loading/error state.
2. Called by any component needing current-user/auth state (nav, protected layouts).
3. Calls `@saas/api-client`.
4. Receives nothing (reads cookies implicitly via `credentials: "include"`).
5. Returns `{ principal, isLoading, error }` shape.
6. On failure (401), triggers the refresh flow before surfacing a logged-out state.
7. **Planned to be secure**: never stores the principal/tokens outside the TanStack Query cache (in-memory only).
8. **Planned risk to track**: stale cache after logout in another tab — owned by Phase 11/17 (cross-tab synchronization).

### 7. Every auth context/provider — Planned

`apps/web/src/app/providers.tsx` (or equivalent root providers file) _(not yet implemented for auth; QueryClientProvider wiring is an open gap)_

1. **Planned**: wraps the app in `QueryClientProvider` so the auth hook (#6) has a cache.
2. Called by the root layout.
3. Calls nothing directly; configures TanStack Query client.
4. Receives children.
5. Returns the wrapped React tree.
6. On failure, a query error renders the hook's error state, not a provider-level crash.
7. **Planned to be secure**: holds no secrets; query cache lives client-side (acceptable since it only ever holds the already-public-to-the-user principal shape, never raw tokens).
8. **Planned**: none beyond the cache staleness risk tracked under #6.

### 8. Every middleware — Planned

`apps/web/src/middleware.ts` _(existing, pre-dates this phase)_ and
`apps/api` `SessionGuard` (`apps/api/src/auth/session.guard.ts`) _(existing)_

1. `apps/web` middleware: UX-only redirect for cookie-less requests to known protected paths. `SessionGuard`: verifies the access JWT and re-checks the DB `Session` row on every guarded request — this is the real security boundary.
2. Middleware is invoked by Next.js routing; `SessionGuard` is invoked via `@UseGuards(SessionGuard)` on protected controllers.
3. Middleware checks cookie presence only (no DB call). `SessionGuard` calls `AuthService.verifyAccessToken` and Prisma.
4. Middleware receives the request path + cookies. `SessionGuard` receives the `app_session` cookie.
5. Middleware returns a redirect or pass-through. `SessionGuard` attaches `request.principal` or throws 401.
6. Middleware fails open to pass-through on a matcher miss (documented, non-authoritative). `SessionGuard` fails closed — throws 401 on any failure.
7. **Explicitly documented**: `apps/web` middleware is never the security boundary (`AUTH_RULES.md` rule 6); `SessionGuard` is.
8. **Planned**: none — this split is already the correct pattern per the stack's requirements; Phase 1 confirms it, future phases re-verify it hasn't regressed.

### 9. Every protected route — Planned

`apps/web/src/app/(dashboard)/**`, `apps/admin/src/app/**` _(existing shells, pre-date this phase)_

1. Renders authenticated-only UI (dashboard, settings, admin screens).
2. Reached via navigation after login, or direct URL entry.
3. Calls the API (`/auth/me`, resource endpoints) server-side (admin) or client-side (web) to confirm/fetch data.
4. Receives forwarded cookies.
5. Returns rendered page, or a redirect to `/login` / `/forbidden` on 401/403 from the API.
6. On API failure, redirects rather than rendering a partial authenticated page.
7. **Planned to be secure**: every protected route's real authorization is the API's response, not the route's own client-side check.
8. **Planned**: flash-of-protected-content before redirect is a known edge case, owned by Phase 11.

### 10. Every redirect — Planned

`apps/web/src/lib/redirect-allowlist.ts` (or equivalent `isAllowedRedirect` helper) _(existing, pre-dates this phase)_

1. Validates any `?next=`/callback redirect target against an allowlist of same-origin, known-safe paths.
2. Called by login/signup/OAuth-callback pages before navigating.
3. Calls nothing (pure function).
4. Receives a candidate redirect string.
5. Returns a safe path or a default fallback.
6. On an invalid target, silently falls back to the default dashboard — never follows an attacker-supplied external URL.
7. **Planned to be secure**: this is the open-redirect control named in the threat model (ARCHITECTURE.md §4).
8. **Planned**: none.

### 11. Every token/session handler — Planned

`apps/api/src/auth/auth.service.ts` (token issuance/rotation), `Session`/`VerificationToken` Prisma models

1. Issues/verifies/rotates access JWTs, refresh tokens, and purpose-scoped verification tokens (email verification, password reset, OTP).
2. Called by `AuthService`'s login/refresh/signup/verify/reset/OTP methods.
3. Calls Prisma (`Session`, `VerificationToken` tables) and a signing library (`jsonwebtoken` or equivalent).
4. Receives a user id, purpose, and TTL.
5. Returns a signed/opaque token plus its hashed, stored counterpart.
6. On failure (DB write error), the action that requested the token fails closed — no token is returned to the client without a persisted record.
7. **Planned to be secure**: tokens are hashed before storage; raw tokens never logged (rule 3); JWT `issuer`/`audience`/algorithm-allowlist hardening is a named gap for Phase 3 (see threat model).
8. **Planned risk**: no transactional guarantee today between a token-consuming auth action and its `security_events` write — flagged in ARCHITECTURE.md §3, owned by Phase 2/3.

### 12. Every database table related to users/auth — Planned

`packages/database/prisma/schema.prisma`: `users`, `profiles`, `auth_identities`,
`sessions`, `roles`, `permissions`, `role_permissions`, `user_roles`, `security_events`,
`audit_logs`, `verification_tokens` _(existing, pre-date this phase — see ARCHITECTURE.md §5 for the full data connection diagram)_

1. Store user identity, credentials-linkage, session, role/permission, and audit state.
2. Read/written exclusively through Prisma from `apps/api`/`apps/worker`.
3. N/A (leaf data layer).
4. Receives typed rows via Prisma Client.
5. Returns typed rows via Prisma Client.
6. On a constraint violation (e.g. duplicate email), Prisma throws a typed error `AuthService` maps to `409`.
7. **Planned to be secure**: no RLS policies exist (see D10, open question); access control is Prisma/API-layer only today.
8. **Known gap**: `audit_logs` is not yet written to by any code — recorded in ARCHITECTURE.md §5 as a confirmed gap, not a live risk since nothing uses it yet.

### 13. Every database policy — Planned

**Status: Planned — none exist today.** No Postgres RLS policies are defined in the
current schema (see D10 in ARCHITECTURE.md §7). If the human confirms RLS is required
(open question #9), this entry becomes real policies with full answers to all 8
questions in a later phase.

### 14. Every trigger — Planned

**Status: Planned — none exist today.** No Postgres triggers/functions are defined in
the current schema. User/profile creation and role assignment happen in Prisma
application code (`AuthService`), not database triggers. No change proposed unless a
later phase identifies a race condition (see TRACEABILITY.md Phase 3, item 24) that a
trigger would close more reliably than application-level transaction handling.

### 15. Every edge/server function — Planned

**Status: Planned — not applicable in the current architecture.** There are no
Vercel Edge Functions or Next.js Route Handlers used for auth; all server-side auth
logic lives in `apps/api` (NestJS). If a future phase introduces one (e.g. an OAuth
callback handled at the edge), it must be added here with all 8 answers first.

### 16. Every environment variable — Planned

See [ARCHITECTURE.md](ARCHITECTURE.md) §6 for the full inventory (name, purpose,
server-only/public, required environment, build-time/runtime). Not duplicated here to
avoid drift between two sources of truth; ARCHITECTURE.md §6 is authoritative.

### 17. Every external authentication dependency — Planned

1. Managed auth provider (Supabase Auth — proposed, pending human confirmation per D2),
   email delivery provider (`EMAIL_PROVIDER`), and OAuth providers (Google required;
   Microsoft/GitHub optional, pending D5).
2. Called by the `AuthProvider`/`OAuthProvider` adapter implementations (concrete
   adapters are Phase 2+ work; only interfaces exist today in `@saas/auth`).
3. Each dependency calls back into our `/auth/*` endpoints (OAuth redirect) or is called
   directly by `AuthService` (password/OTP/email verification via the provider SDK).
4. Receives credentials/authorization codes/tokens scoped to the minimum needed per
   provider.
5. Returns identity confirmation, tokens, or delivery confirmation.
6. On failure, `AuthService` maps provider errors to a generic `ApiError` — provider
   error details are never surfaced raw to the client (rule 3/8 — avoid leaking
   provider internals as a side channel).
7. **Planned to be secure**: all provider secrets are server-only env vars (ARCHITECTURE.md §6); no provider SDK call is ever made from `apps/web`/`apps/admin`.
8. **Planned risk**: a provider outage must degrade to a clear, safe error (not a silent
   hang or an exposed stack trace) — to be verified against real adapter code once
   implemented in Phase 2+.
