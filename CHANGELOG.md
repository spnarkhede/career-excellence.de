# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.9.0] - 2026-10-07

### Added

- `requestPasswordReset`: per-email resend cooldown (60s) and invalidation of
  any previous unused reset token before issuing a new one, matching the
  OTP/magic-link resend pattern.
- `apps/api/src/common/email-queue.ts`: a BullMQ producer letting `AuthService`
  hand emails to apps/worker's already-existing (previously API-unused) email
  queue instead of sending them synchronously in-request. Opted in for the
  password-reset-request email and the new password-changed confirmation
  email only (checklist "email sent from a queue").
- `passwordChangedEmailTemplate` (`packages/email`) and a confirmation email
  sent on every successful password reset.
- Structured error codes on `resetPassword` failures (`RESET_TOKEN_INVALID`,
  `RESET_TOKEN_USED`, `RESET_TOKEN_EXPIRED`) plus a failure `auth_event` for
  each, previously only recorded on success.
- `@Throttle` on `POST /auth/password-reset/confirm` (10/60s) — previously
  unthrottled.
- Reset-password page rewrite: token stripped from the URL after load,
  `referrer: no-referrer` page metadata, distinct expired/used/invalid states
  each with a "Request a new link" link to `/forgot-password`, and redirect
  through the shared `isAllowedRedirect`/`next`-param safe-redirect helper
  (previously hardcoded to `/login` with no `next` support).
- 10 new tests in `apps/api/test/phase8-password-reset.integration.spec.ts`,
  covering every Phase 8 checklist item including two simultaneous submits
  with one token (exactly one succeeds) and session revocation across two
  independent logins ("a second browser context").

### Fixed

- **BUG-012 (high severity)**: `resetPassword()`'s token consumption used a
  non-atomic read-then-update — the same race already fixed for OTP as
  BUG-009 — letting two concurrent submissions of the same reset token both
  succeed. Fixed with an atomic `updateMany` guarded by `usedAt: null`.
- **BUG-013 (medium severity)**: `POST /auth/password-reset/confirm` had no
  rate limiting at all, unlike every sibling verify/confirm endpoint. Fixed
  by adding the same 10/60s limit used by OTP/magic-link verify.

### Notes

- Same environment limitation as every prior phase: no live Postgres database
  was available, so every new DB-dependent test is written as a real
  integration test that skips cleanly rather than being claimed as "Confirmed
  working." No browser automation was run against the rewritten
  reset-password page.
- `requestPasswordReset`'s enumeration-protection narrows, but does not fully
  close, a timing side-channel between known and unknown emails — flagged as
  a documented Potential risk, not claimed as fully timing-safe. See
  `docs/auth/PROGRESS.md` Phase 8 detail.
- Queue adoption is scoped to this phase's two new email sends only; every
  other email type in the codebase still sends synchronously, unchanged.

## [0.8.0] - 2026-10-07

### Added

- Access tokens re-signed with asymmetric RS256 (replacing the shared-secret
  HS256 used since Phase 3), with a `kid` header enabling key rotation
  (`AUTH_JWT_PRIVATE_KEY`/`PUBLIC_KEY`/`KID`, plus `AUTH_JWT_PREVIOUS_*` for a
  rotation grace period), an explicit algorithm allowlist (rejects `alg: none`
  and anything else), and `iss`/`aud`/`exp`/`nbf` checks with a 5-second clock
  skew tolerance.
- Refresh-token reuse grace window (`AUTH_REFRESH_REUSE_GRACE_MS`, default
  10s): a rotated token replayed within the window resolves to the live
  session (benign race) instead of revoking the whole family; outside the
  window, the same replay still revokes the family exactly as before.
- Idle-timeout (`AUTH_IDLE_TIMEOUT_SECONDS`, default 30 min) and
  absolute-expiry enforcement added to `SessionGuard`, plus
  `Cache-Control: no-store` on every authenticated response.
- `CsrfGuard`: double-submit-cookie CSRF token + explicit Origin re-check,
  applied to every cookie-authenticated state-changing route (logout,
  logout-all-devices, refresh, session revoke/revoke-others,
  change-password).
- Cookie hardening: `API_COOKIE_DOMAIN` now defaults to unset (host-only
  cookies); the `__Host-` prefix is applied automatically whenever a cookie is
  Secure with no Domain attribute; the refresh cookie now uses
  `SameSite=Strict` (the session cookie stays `Lax`).
- `packages/api-client`: single-flight refresh-and-retry-once on a 401 (one
  shared in-flight promise per client instance), automatic CSRF header
  attachment on state-changing requests, and `broadcastLogout`/
  `onLogoutBroadcast` (BroadcastChannel with a `localStorage`-ping fallback)
  for cross-tab logout sync.
- New authenticated endpoints: `POST /auth/change-password` (revokes every
  other session), `POST /auth/logout-all-devices` (revokes every session
  including the calling one).
- New frontend: `/dashboard/sessions` (device list with per-row revoke and
  "log out other devices"), a logout button on the dashboard that broadcasts
  to other tabs.
- 23 new tests across `apps/api`, `packages/api-client`, `packages/security`,
  and `packages/observability`, covering the Phase 7 checklist.

### Fixed

- **BUG-010 (medium severity)**: log redaction (`packages/observability`)
  used exact-match key matching, silently letting `accessToken`/
  `refreshToken`/`csrfToken` bypass redaction despite `token`/`refresh`
  already being on the sensitive-keyword list. Switched to substring
  matching.
- **BUG-011 (low severity)**: `SessionGuard` read the session cookie name
  directly from `process.env` instead of the validated config, which would
  have caused a silent total lockout as soon as the new `__Host-` prefix
  logic made the controller's actual cookie name diverge from the guard's
  hardcoded fallback. Fixed by routing through a new shared
  `cookie-names.ts`.

### Notes

- Same environment limitation as every prior phase: no live Postgres was
  available, so every session-row-dependent test is written as a real
  integration test that skips cleanly rather than being claimed as "Confirmed
  working." Unlike prior phases, a large share of this phase's logic (JWT
  signing/verification, cookie-name computation, the CSRF guard, the
  api-client refresh/CSRF/broadcast logic, log redaction) is pure and
  needed no database — 23 of this phase's new tests were actually run.
- RS256 was used instead of EdDSA (both allowed by the task) because
  `@types/jsonwebtoken@9.0.10` doesn't type `"EdDSA"` yet; not a security
  downgrade, see `docs/auth/PROGRESS.md` Phase 7 detail.
- No browser testing was performed against the new sessions page or the
  dashboard logout button.

## [0.7.0] - 2026-10-07

### Added

- OTP authentication rewritten (`AuthService.requestOtp`/`verifyOtp`): CSPRNG
  6-digit code, hash-only storage, 5-minute expiry, 5-attempt lockout, atomic
  single-use consume, resend invalidates the previous code, 30-second
  per-destination resend cooldown, identical responses for known/unknown
  destinations.
- Magic link authentication (`AuthService.requestMagicLink`/`verifyMagicLink`),
  added to pragmatically resolve open question D4 — implements both mechanisms
  rather than waiting on a human pick, since the Phase 6 task list itself
  described both as in scope: CSPRNG 32-byte token, hash-only storage, 10-minute
  expiry, same atomic single-use consume and resend/cooldown guarantees as OTP.
  Two new endpoints: `POST /auth/magic-link/request`, `POST /auth/magic-link/verify`.
- `AuthController.resolveExistingSessionId`: deduplicated the session-fixation
  check (first written for `login()` in Phase 5) into one shared helper, now also
  used by `/otp/verify` and `/magic-link/verify`.
- Magic-link confirm page (`apps/web/src/app/(auth)/magic-link/`): Confirm-button
  - POST pattern (mirrors Phase 4's verify-email page) so an automated link
    scanner following the raw GET link cannot consume the token; `no-referrer` page
    metadata; token stripped from the URL on load.
- OTP request/verify UI (`apps/web/src/app/(auth)/otp/`): single code input with
  `autocomplete="one-time-code"`, `inputMode="numeric"`, native paste support, a
  30-second resend countdown, and distinct error states per attempt.
- 12 new tests in `apps/api/test/phase6-otp.integration.spec.ts`, covering every
  item in the Phase 6 TESTS list (expired code, wrong-code-until-lockout,
  replayed code, resend invalidation, concurrent use, enumeration-safe responses,
  no raw code in the database) plus magic-link equivalents.

### Fixed

- **BUG-009 (high severity)**: `verifyOtp()`'s code-consumption step used a
  non-atomic `findFirst` + `update` pair, letting two concurrent correct
  submissions of the same code both succeed, each issuing its own session.
  Fixed by replacing it with a single atomic `updateMany` guarded by
  `usedAt: null`, rejecting whichever concurrent caller loses the race. The same
  (already-correct) pattern was used for the new `verifyMagicLink` from the
  start.

### Notes

- Same environment limitation as every prior phase: no live Postgres database
  was available in this session, so every new DB-dependent test is written as a
  real (non-mocked) integration test that skips cleanly rather than being
  claimed as "Confirmed working." No browser automation was run against the new
  frontend pages either — see `docs/auth/PROGRESS.md` Phase 6 detail.
- D4 (OTP vs. magic link vs. both) is resolved pragmatically, not by human
  confirmation — see `docs/auth/ARCHITECTURE.md`. D6 (TOTP MFA) remains
  unresolved and unimplemented; OTP/magic-link verification each independently
  create a new session, not as a second factor after password login.

## [0.6.0] - 2026-10-07

### Added

- `apps/api/src/common/redis-throttler-storage.ts`: Redis-backed `ThrottlerStorage`,
  replacing `@nestjs/throttler`'s in-process-memory default globally.
- Growing-delay account lockout (`computeLockoutDuration`): 5 failed attempts locks
  the account, each additional failure doubles the lockout duration (capped at 24h).
- Dummy-hash timing protection in `AuthService.login`: an unknown email is compared
  against a fixed-cost hash computed once at startup, so response time doesn't
  distinguish "no such account" from "wrong password."
- Session-fixation prevention: `login()` accepts the caller's existing session (if
  any, resolved by the controller from the current cookie) and discards it on a
  successful new login.
- `apps/api/src/common/all-exceptions.filter.ts`: maps Prisma connection failures to
  503 with a safe message (never a raw Prisma error); sets a `Retry-After` header
  when an exception's details carry `retryAfterSeconds`.
- `ZodValidationPipe` now throws `422 Unprocessable Entity` with per-field messages
  instead of a generic `400`, across every Zod-validated endpoint.
- `packages/api-client`: per-request timeout (`AbortController`, default 10s,
  `ApiClientTimeoutError`) and offline detection (`ApiClientOfflineError`), both
  checked before/instead of a hanging or failing fetch.
- Login page: double-submit guard (a ref alongside `isSubmitting`), redirect to the
  dashboard if already authenticated (checked via a real `GET /auth/me`, never
  assumed), and distinct timeout/offline/server-error messages.
- Dashboard: a visible retry state (`<DashboardError>`) instead of a blank page or
  crash on any `/auth/me` failure other than 401 (which still redirects to login).
- 19 new tests: `packages/api-client/src/index.spec.ts` (8, actually run),
  `apps/api/test/all-exceptions-filter.spec.ts` (5, actually run), and
  `apps/api/test/phase5-login.integration.spec.ts` (14, DB-dependent).

### Fixed

- **BUG-008 (medium severity)**: `login()` checked `locked`/`disabled`/`deleted`
  account status BEFORE verifying the password — the same enumeration pattern as
  BUG-007, letting anyone learn a known email's exact account status using any
  password at all. Fixed in the same rewrite that added dummy-hash timing
  protection; every account-state check now runs only after the password matches.

### Notes

- Same environment limitation as Phases 3/4: no live Postgres database was
  available. This phase adds a new category of limitation on top: items requiring
  real browser automation (double-click guard, multi-tab, offline mode in an actual
  browser, slow-network throttling) were not exercised either — see
  `docs/auth/PROGRESS.md` Phase 5 detail for the full breakdown.

## [0.5.0] - 2026-10-07

### Added

- NIST SP 800-63B password policy (`packages/validation`): minimum 8, hard cap 128,
  no composition rules, every printable character allowed; replaces the previous
  min-12-plus-composition-rules policy. Added `estimatePasswordStrength` (client-safe,
  UX-only) and wired a strength meter + policy text into the signup page.
- `packages/security/src/server.ts`: explicit OWASP argon2id parameters
  (`ARGON2_PARAMS`: 19 MiB, t=2, p=1), `needsRehash` (rehash-on-login when parameters
  change), and `isPasswordBreached` (HIBP k-anonymity range API, fails open), gated
  behind the new `FEATURE_BREACHED_PASSWORD_CHECK` env var (default off).
- `AuthService.signUp`: timing/response-neutral duplicate handling — hashes and
  (optionally) breach-checks the password before ever branching on whether the email
  exists; a duplicate creates nothing and sends a notice email to the real account
  owner, while the caller sees the same response shape either way.
- `AuthService.sendVerificationEmail`: resend now invalidates every older unused
  token before issuing a new one. New `POST /auth/resend-verification` endpoint,
  rate-limited per-IP (`@Throttle`) and per-email (a cooldown inside the service).
- `AuthService.verifyEmail`: returns one of 5 distinct states (`valid`, `expired`,
  `already_used`, `invalid`, `already_verified`) instead of a single generic error,
  so the UI can offer the right recovery action for each.
- `AuthService.sendEmail`: delivery-failure-tolerant wrapper — logs with the request
  ID and records a distinct `auth_event` on failure, but never throws (signup/resend
  still succeeds; the user can retry).
- Rewrote the verify-email page: a Confirm **button** (no auto-POST on page load),
  `referrer: no-referrer` page metadata, the token stripped from the visible URL on
  load, and a redirect-after-verification target validated through
  `isAllowedRedirect`.
- 15 new integration tests (`apps/api/test/phase4-signup-verification.integration.spec.ts`,
  `get-verification-url.integration.spec.ts`) covering all 16 of this phase's checklist
  items plus the 3 extra named tests (GET doesn't verify, no raw token in DB/logs,
  forced mid-transaction failure leaves no rows).

### Fixed

- **BUG-007 (high severity)**: `login()` never checked for `pending_verification`
  status — an account that never verified its email could sign in exactly as if it
  had, completely bypassing the verification gate. Fixed by rejecting login for
  unverified accounts, checked only _after_ password verification succeeds (checking
  before would itself be an enumeration vector).

### Notes

- Same environment limitation as Phase 3: no live Postgres database was available in
  this session. Every DB-dependent test is written and will run for real in CI; two
  test suites needed no database and were actually run
  (`packages/validation/src/index.spec.ts` 8/8, `packages/security/src/server.spec.ts`
  25/25).

## [0.4.0] - 2026-10-07

### Added

- Phase 3 database schema: `users` (citext email, `passwordHash`, `status`/
  `failedLoginCount`/`lockedUntil`, `deletedAt`), `profiles` (+`createdAt`),
  `oauth_accounts` (replaces password rows in the old `auth_identities` table),
  `sessions` (+`familyId`, `absoluteExpiresAt`, `ipHash`), `one_time_tokens`
  (replaces `verification_tokens`, enum `purpose`), `auth_events` (replaces
  `security_events`, +`ipHash`, `requestId`).
- Two reversible migrations (`00000000000000_init`, `00000000000001_phase3_auth_tables`),
  each with a companion `down.sql`, generated via schema-to-schema diffing (no live
  database connection required) — see `packages/database/prisma/migrations/README.md`.
- Row-level security: `app_anon` (zero grants) and `app_authenticated` (own-row-only
  SELECT/UPDATE, no INSERT/DELETE) roles and policies on every auth table, as
  defense-in-depth — resolves `ARCHITECTURE.md` decision D10.
- `AuthService.signUp` now creates the user, profile, and default role assignment in
  a single transaction (closing a previously-known non-atomicity gap), hashes
  passwords directly onto `users.passwordHash` (argon2id via `@saas/security/server`)
  instead of a separate in-memory stub provider, and adds login lockout
  (10 failed attempts → 15-minute lock), refresh-token-reuse detection (revokes the
  entire session family), and `softDeleteAccount`.
- `packages/security/src/server.ts`: `hashIp` (HMAC-SHA256) so sessions/auth_events
  never store a raw client IP.
- `scripts/check-db-consistency.ts`: finds orphaned users, users without roles,
  duplicate profiles, and dangling sessions; wired into CI after tests.
- `packages/database/prisma/seed.ts`: now also seeds 5 generated test users (clearly
  fake `@example.test` emails, a shared dev-only password) alongside roles/permissions.
- Integration tests for all 8 of this phase's named TESTS (email case-insensitivity,
  signup concurrency, RLS, anonymous access, profile immutability, cascade/soft-delete,
  transaction atomicity, consistency script) — written to skip cleanly without a
  reachable database and run for real in CI.

### Fixed

- **BUG-006 (critical, caught before being committed)**: an early draft of the Phase 3
  migration would have dropped and recreated every table's primary/foreign key
  column, silently orphaning every relationship on a populated database. Caught by
  manual review of the generated migration SQL; fixed by removing the mistaken
  `@db.Uuid` type annotations.

### Changed

- `AccountStatus` enum: `suspended` → split into `disabled`/`locked` (backfilled on
  migration); `pending_verification` kept beyond the Phase 3 spec's 4 named statuses
  to preserve the existing email-verification gate (documented decision).

### Notes

- No live Postgres database was available in this session (no Docker; port 5432 is
  occupied by an unrelated, pre-existing instance with unknown credentials). Every
  DB-dependent test is written and will run for real in CI; none were executed
  against a real database in this session — see `docs/auth/FINDINGS.md` and
  `docs/auth/PROGRESS.md` Phase 3 detail.

## [0.3.0] - 2026-10-07

### Added

- `apps/api/test/https-redirect.spec.ts`: tests for the production-only HTTP→HTTPS
  redirect (test requirement 5 for this phase).
- `scripts/check-bundle-for-secrets.spec.ts`: unit tests for the bundle-secret-leak
  scanner's pure logic (test requirement 6).
- `"otp"` added to the structured logger's redaction key list (both the pure
  `deepRedact` walk and pino's static `redact.paths`), with a test.
- Global `unhandledRejection`/`uncaughtException` handlers in `apps/api` and
  `apps/worker`, logging safely through the redacting logger.
- Quality tooling: `knip.json` (dead code/unused dependencies), `.jscpd.json` +
  `madge` (duplicate code / circular dependency detection), stricter
  `eslint.config.js` (`no-floating-promises`, `no-misused-promises`,
  `await-thenable`, `no-deprecated`, React Hooks rules for `apps/web`/`apps/admin`).
- `playwright.config.ts`: Firefox, WebKit, and a mobile-viewport project, alongside
  the existing Chromium project.
- CI: circular-dependency check, duplicate-code check, dead-code check
  (informational), Playwright end-to-end test run.
- `packages/security/server/package.json`: a classic-resolution subpath shim so
  `apps/api` (which uses `moduleResolution: "Node"`) can resolve `@saas/security/server`.
- `vitest.scripts.config.ts`: a dedicated, non-auto-discovered Vitest config so
  root-level `scripts/` tests run without interfering with every workspace package's
  own `vitest run`.

### Fixed

- **BUG-001**: the client-bundle secret scanner scanned all of `.next/` (including
  server-only SSR output that legitimately bundles private env var names), making it
  fail on every real build. Narrowed to `.next/static`.
- **BUG-002**: `apps/api` failed `tsc --noEmit` (pre-existing, confirmed via a
  `git stash` bisect) due to a `CorsOptions` type conflict between the `cors` and
  `@nestjs/common` packages, an unresolvable `express-serve-static-core` module
  augmentation (undeclared transitive type dependency), and a Prisma `Json` type
  mismatch.
- **BUG-004**: a circular import between `packages/auth/src/index.ts` and
  `stub-provider.ts`; extracted shared interfaces into `packages/auth/src/types.ts`.
- **BUG-005**: all 4 auth forms (login, signup, forgot-password, reset-password)
  passed an async handler directly to `<form onSubmit>`, flagged by the newly-added
  `no-misused-promises` rule; now explicitly voided.

### Notes

- `knip` (`pnpm check:deadcode`) reports real, pre-existing unused dependencies/exports
  — mostly reserved for not-yet-wired features documented in
  `docs/auth/ARCHITECTURE.md`. Wired into CI as informational only; not fixed in this
  phase to avoid unrelated-scope changes.

## [0.2.0] - 2026-10-06

### Added

- docs/auth/ARCHITECTURE.md: added "Project layout" (folder structure, module
  boundaries, layer ownership) and "Data connection diagram" (every table, FK, and
  which component reads/writes it) sections; added decision D10 and open question 9
  on database-level row-level security.
- docs/auth/FLOWS.md: Mermaid sequence diagrams for all 8 auth lifecycles (login,
  logout, refresh, signup, verification, password reset, OAuth, session expiration),
  each with failure branches and the HTTP status code produced.
- docs/auth/COMPONENTS.md: rewritten with a "Planned" entry, answering all 8
  component questions, for every item in the Authentication map checklist.
- docs/TRACEABILITY.md: filled in implementing files, tests, and status for every
  Phase 1 checklist item (System understanding, Lifecycle tracing, Authentication
  map), all marked "Requires manual verification" pending human confirmation.

### Notes

- No application code was written in this phase.
- Human confirmation of 9 open questions (listed in docs/auth/ARCHITECTURE.md and
  docs/auth/PROGRESS.md) is required before Phase 2 begins.

## [0.1.0] - 2026-10-06

### Added

- AUTH_RULES.md: the 13 governing rules for all authentication, authorization, and
  session work in this repository.
- docs/TRACEABILITY.md: traceability matrix covering every checklist item across
  Phases 0-21 of the authentication workstream.
- docs/auth/PROGRESS.md: phase-by-phase status tracker (Phase, Name, Status, Date,
  Version, Tests run, Notes).
- docs/auth/FINDINGS.md: root-cause finding template and log.
- docs/auth/COMPONENTS.md: component inventory template.
- docs/devlog/: development log folder with entry-format README.
- Conventional Commits enforcement via commitlint and a husky commit-msg hook.
- scripts/release.mjs: release script that bumps the version, updates CHANGELOG.md,
  and creates a git tag.
- References to AUTH_RULES.md from CLAUDE.md and AGENTS.md.

[Unreleased]: https://example.com/compare/v0.9.0...HEAD
[0.9.0]: https://example.com/compare/v0.8.0...v0.9.0
[0.8.0]: https://example.com/compare/v0.7.0...v0.8.0
[0.7.0]: https://example.com/compare/v0.6.0...v0.7.0
[0.6.0]: https://example.com/compare/v0.5.0...v0.6.0
[0.5.0]: https://example.com/compare/v0.4.0...v0.5.0
[0.4.0]: https://example.com/compare/v0.3.0...v0.4.0
[0.3.0]: https://example.com/compare/v0.2.0...v0.3.0
[0.2.0]: https://example.com/compare/v0.1.0...v0.2.0
[0.1.0]: https://example.com/releases/tag/v0.1.0
