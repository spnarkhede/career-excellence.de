# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://example.com/compare/v0.5.0...HEAD
[0.5.0]: https://example.com/compare/v0.4.0...v0.5.0
[0.4.0]: https://example.com/compare/v0.3.0...v0.4.0
[0.3.0]: https://example.com/compare/v0.2.0...v0.3.0
[0.2.0]: https://example.com/compare/v0.1.0...v0.2.0
[0.1.0]: https://example.com/releases/tag/v0.1.0
