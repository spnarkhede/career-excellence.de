# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://example.com/compare/v0.3.0...HEAD
[0.3.0]: https://example.com/compare/v0.2.0...v0.3.0
[0.2.0]: https://example.com/compare/v0.1.0...v0.2.0
[0.1.0]: https://example.com/releases/tag/v0.1.0
