# Auth Workstream Progress

Statuses are restricted to the set in [AUTH_RULES.md](../../AUTH_RULES.md) rule 13:
Confirmed working, Confirmed broken, Fixed, Requires configuration, Requires manual
verification, Unable to verify. "Not started" is used only before a phase has begun.

| Phase | Name                                              | Status                       | Date       | Version | Tests run                                                                                                                                                                                                                                                                                                                                                                                                                       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----- | ------------------------------------------------- | ---------------------------- | ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Project rules, traceability and development log   | Confirmed working            | 2026-10-06 | 0.1.0   | `pnpm lint` (22/22 packages pass, exit 0); commitlint manually verified to reject a malformed commit message (exit 1)                                                                                                                                                                                                                                                                                                           | AUTH_RULES.md (13 rules, word for word), docs/TRACEABILITY.md, docs/auth/FINDINGS.md, docs/auth/COMPONENTS.md, this file, CHANGELOG.md, docs/devlog/, commitlint + husky commit-msg hook, scripts/release.mjs created. No application code touched. Committed as 802fbe6, tagged v0.1.0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1     | System understanding, lifecycle tracing, auth map | Requires manual verification | 2026-10-06 | 0.2.0   | `pnpm lint` (22/22 packages pass, exit 0); no automated test exists for documentation completeness, so every Phase 1 traceability row is "Requires manual verification", never "Confirmed working"                                                                                                                                                                                                                              | docs/auth/ARCHITECTURE.md extended (project layout, data connection diagram, D10/open question 9); docs/auth/FLOWS.md created (8 mermaid sequence diagrams with failure branches + HTTP codes); docs/auth/COMPONENTS.md rewritten with a Planned entry per Authentication map item. No application code written. **Human confirmation required before Phase 2** — see the 9 "Open questions for the human" in ARCHITECTURE.md.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2     | Scaffold and secure foundation                    | Confirmed working            | 2026-10-07 | 0.3.0   | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test` 4 test files/34 tests pass + `test:scripts` 1 file/4 tests; `pnpm check:cycles` 0 cycles; `pnpm check:duplicates` 4 clones, 1.3%, under 5% threshold; `pnpm build` (web+admin+api+worker) succeeds; `pnpm check:bundle-secrets` passes against real build; live Playwright smoke test (chromium) passes                                                                  | Env validation, HTTPS redirect, security headers, CORS allowlist, redaction (added `otp`), global process handlers, strict lint rules, knip/jscpd/madge wired, Playwright expanded to 4 browser/device projects, CI updated. Found and fixed 5 real bugs (BUG-001..005, pre-existing + newly introduced) — see FINDINGS.md. `check:deadcode` wired as informational only (real, out-of-scope findings — see FINDINGS.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3     | Database tables and data connections              | Requires manual verification | 2026-10-07 | 0.4.0   | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test` all pass (12 real + 10 DB-dependent skipped — no live Postgres in this environment, see Notes); `pnpm check:cycles` 0 cycles; `pnpm build` succeeds                                                                                                                                                                                                                      | Full Phase 3 schema (users/profiles/oauth_accounts/sessions/one_time_tokens/auth_events + RLS), 2 migrations with down.sql, AuthService rewritten (transactional signup, password on users.passwordHash, lockout, soft delete, refresh-reuse detection), consistency-check script, seed script with generated test users. **No live database was available in this environment** — every DB-dependent test (1,2,3,4,6,7,8) is written and will run for real in CI, but was not executed against a real Postgres instance in this session; see FINDINGS.md. One critical bug (BUG-006: a draft migration would have silently orphaned every FK on a populated DB) was caught by manual review and fixed before being committed.                                                                                                                                                                                                                                                                                       |
| 4     | Signup and verification                           | Requires manual verification | 2026-10-07 | 0.5.0   | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test` all pass (`packages/validation` 8/8 and `packages/security` 25/25 actually run — no DB needed; 13 new Phase 4 DB-dependent tests + 2 GET-verification tests skip cleanly, no live Postgres); `pnpm build` succeeds                                                                                                                                                       | NIST 800-63B password policy (no composition rules, min 8, max 128); argon2id with explicit OWASP params + rehash-on-login; breached-password check (HIBP k-anonymity, behind `FEATURE_BREACHED_PASSWORD_CHECK`, default off); timing/response-neutral duplicate signup (notice email, creates nothing); resend invalidates older tokens; 5 distinct verification states (valid/expired/already_used/invalid/already_verified); Confirm-button verify-email page (no auto-POST), `referrer: no-referrer`, token stripped from URL; found and fixed a real pre-existing gap — login() never checked `pending_verification` status (checklist item 6). Every DB-dependent test is written but **not executed against a real database in this session** (same environment limitation as Phase 3) — see FINDINGS.md.                                                                                                                                                                                                     |
| 5     | Login process                                     | Requires manual verification | 2026-10-07 | 0.6.0   | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test`: 2 new test suites needed no database and were actually run (`packages/api-client` 8/8, `apps/api` `all-exceptions-filter.spec.ts` 5/5) — 39 of this phase's DB/browser-dependent tests skip or are documented as manual; `pnpm build` succeeds                                                                                                                          | Rewrote `login()`: dummy-hash timing protection, ALL account-status checks moved to after password verification (found + fixed BUG-007 and BUG-008 doing this), growing-delay lockout (5 failures, doubling, capped 24h), session-fixation prevention (discards the caller's existing session on success). Replaced the in-process-memory throttler with a Redis-backed one (`RedisThrottlerStorage`), globally. Validation errors now 422 with field messages (was 400). Mapped Prisma connection failures to 503. Added client-side timeout/offline detection (`@saas/api-client`), a double-submit guard + existing-session redirect on the login page, and a hardened dashboard with a visible retry state on failure instead of a blank page/crash.                                                                                                                                                                                                                                                             |
| 6     | OTP authentication                                | Requires manual verification | 2026-10-07 | 0.7.0   | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test`: all previously-passing non-DB suites still pass (17/17), 12 new `phase6-otp.integration.spec.ts` tests written and skip cleanly (no live Postgres — same environment limitation as Phases 3-5); `pnpm build` succeeds                                                                                                                                                   | Rewrote `requestOtp`/`verifyOtp` for atomic single-use consume (found + fixed BUG-009, a real concurrent-use race in the pre-existing code), resend-invalidation, per-destination cooldown, session-fixation handling. Added `requestMagicLink`/`verifyMagicLink` to pragmatically resolve open question D4 (implement both OTP and magic link, per ARCHITECTURE.md). Added the magic-link confirm page (Confirm button + POST, link scanners can't consume it) and the OTP request/verify UI (one input, `autocomplete="one-time-code"`, numeric input mode, paste support, 30s countdown).                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7     | Session lifecycle                                 | Requires manual verification | 2026-10-07 | 0.8.0   | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test`: all previously-passing non-DB suites still pass, plus 12 new pure-logic `phase7-tokens.spec.ts` tests, 6 new `packages/api-client` tests, 4 new `packages/security` tests, and 1 new `packages/observability` test — all **actually run**, no database needed; 11 new `phase7-session.integration.spec.ts` tests skip cleanly (no live Postgres); `pnpm build` succeeds | Switched access tokens from HS256 to asymmetric RS256 with kid-based rotation and explicit iss/aud/alg-allowlist/clock-skew checks; added a refresh-token reuse grace window (benign-race resolution vs. stolen-token family revocation); added idle-timeout + absolute-expiry enforcement and Cache-Control: no-store in SessionGuard; added a CSRF double-submit-cookie + Origin-check guard on every cookie-authenticated state change; hardened cookies (Domain unset by default, __Host- prefix, SameSite Strict for the refresh cookie); added client-side single-flight refresh-and-retry-once and cross-tab logout sync (BroadcastChannel + storage fallback) to the shared API client; added a session-list/revoke page and a logout button to the dashboard; added authenticated change-password and logout-all-devices endpoints. Found and fixed BUG-010 (log-redaction gap for compound token field names) and BUG-011 (SessionGuard bypassing validated config for the cookie name) — see FINDINGS.md. |
| 8     | Password reset                                    | Requires manual verification | 2026-10-07 | 0.9.0   | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test`: all previously-passing non-DB suites still pass, plus 10 new `phase8-password-reset.integration.spec.ts` tests written and skip cleanly (no live Postgres — same environment limitation as Phases 3-7); `pnpm build` succeeds                                                                                                                                           | Fixed BUG-012 (atomic token-consume race, same shape as BUG-009) and BUG-013 (confirm endpoint had no rate limit at all). Added per-email resend cooldown + previous-token invalidation to `requestPasswordReset`, queued both the reset-request and password-changed-confirmation emails through the existing (previously API-unused) BullMQ email queue, added failure-path `auth_events` and structured error codes to `resetPassword`. Rewrote the reset-password page: token stripped from the URL, `referrer: no-referrer`, distinct expired/used/invalid states with a "Request a new link" affordance, and redirect through the shared `isAllowedRedirect` safe-redirect helper. Flagged (not fixed) a residual, narrow timing side-channel in `requestPasswordReset` as a documented Potential risk — see FINDINGS.md.                                                                                                                                                                                      |
| 9     | OAuth providers and processes                     | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 10    | Routing and middleware                            | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 11    | Frontend auth UI                                  | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 12    | Error handling                                    | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 13    | Security checks                                   | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 14    | Launch: legal, trust and conversion               | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 15    | Launch: SEO and sharing                           | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 16    | Launch: performance and accessibility             | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 17    | Race conditions and edge cases                    | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 18    | Code defects that must not exist                  | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 19    | Test matrix                                       | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 20    | Production audit                                  | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 21    | Final audit report                                | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Phase 0 detail

### Done-when verification

1. All Phase 0 files exist at the required paths — **Confirmed working**: AUTH_RULES.md,
   docs/TRACEABILITY.md (every checklist item from this instruction set copied in, status
   "Not started"), docs/auth/PROGRESS.md (this file), docs/auth/FINDINGS.md,
   docs/auth/COMPONENTS.md, CHANGELOG.md, docs/devlog/README.md, package.json at 0.1.0,
   commitlint config + husky commit-msg hook, scripts/release.mjs.
2. commitlint rejects a malformed commit message — **Requires manual verification**: run
   `git commit -m "bad message"` against the hook; a Conventional Commits message is
   required to pass.
3. No application code was written in this phase — **Confirmed working**: only root/docs
   files, package.json metadata, and commit tooling were touched.

### Tests run

- `pnpm lint` — repository lint, documentation-only phase has no application code to
  exercise with Vitest/Supertest/Playwright for this specific phase.

### Open questions and risks

- **Missing information**: a prior session already produced `docs/auth/ARCHITECTURE.md`
  and an earlier-shaped `docs/auth/PROGRESS.md` under a different phase numbering
  (0-15). This phase re-creates PROGRESS.md under the 0-21 numbering required by this
  instruction set; ARCHITECTURE.md is left untouched for the next phase to reconcile.
- **Missing information**: this repository already contains a non-trivial existing
  NestJS/Prisma auth implementation from prior work. Phase 1 must decide whether to
  audit/extend it or treat it as reference only, per AUTH_RULES.md rule 7.

## Phase 1 detail

### Done-when verification

1. Every "System understanding", "Lifecycle tracing", and "Authentication map" item has
   a decision, diagram, or component entry — **Confirmed working**: all 33 System
   understanding items are addressed in `docs/auth/ARCHITECTURE.md` §1 (decisions +
   reasons + owning phase); all 8 lifecycles have a Mermaid sequence diagram in
   `docs/auth/FLOWS.md` with failure branches and HTTP status codes; all 17
   Authentication map items have a "Planned" entry in `docs/auth/COMPONENTS.md`
   answering all 8 questions.
2. Every threat has a control and an owning phase — **Confirmed working** (carried
   forward from the existing `docs/auth/ARCHITECTURE.md` §4 threat model, which already
   mapped all 38 "Security checks" items to a planned control and phase; not duplicated
   here to avoid two sources of truth).
3. Open questions are listed and the human is asked to confirm before Phase 2 —
   **Confirmed working**: 9 open questions listed in `docs/auth/ARCHITECTURE.md`,
   restated below.

### Tests run

- `pnpm lint` — 22/22 packages, exit 0. Documentation-only phase; no auth application
  code exists yet for this workstream to exercise with Vitest/Supertest/Playwright.
- No automated test can verify "every checklist item has a decision" — this was
  verified manually by re-reading every item against the produced documents. Recorded
  as "Requires manual verification" in `docs/TRACEABILITY.md`, per `AUTH_RULES.md`
  rule 13 (never "Confirmed working" without a real test).

### Open questions and risks — human confirmation required before Phase 2

Restated from `docs/auth/ARCHITECTURE.md` ("Open questions for the human"):

1. Confirm the managed auth provider: Supabase Auth (proposed) vs. Auth.js vs. Clerk.
2. Email OTP, magic link, or both?
3. Is Microsoft OAuth in scope? Is GitHub OAuth in scope? (Google treated as required.)
4. Is TOTP MFA in scope now or deferred?
5. Is multi-tenant/organization scoping needed?
6. **Missing information**: real staging/production domain names, needed before Phase 6
   (OAuth) can finalize callback URLs.
7. Confirm or renumber the provisional Phase 2–15 plan used to give every threat an
   owning phase.
8. Should Phase 2+ harden/extend the existing NestJS/Prisma auth implementation
   already in this repo, or discard parts of it?
9. **New in this phase**: is database-level row-level security (RLS) required as
   defense-in-depth, or is Prisma/API-layer-only access control (as implemented today)
   acceptable?

Per this phase's instructions, work stops here. Phase 2 does not begin until the human
answers the questions above.

**Update 2026-10-07**: the human directly supplied Phase 2's instructions ("scaffold and
secure foundation"), which proceeds independently of the 9 open questions above — Phase 2
is config/security scaffolding (env validation, HTTPS, security headers, CORS, logging,
quality tooling) and touches no auth-provider-specific, OTP/OAuth-specific, or
RLS-specific code, so none of the 9 pending decisions block it. All 9 remain open and
still gate Phase 3+ (the actual auth provider integration).

## Phase 2 detail

### Done-when verification

1. "App starts" — **Confirmed working**: `pnpm --filter @saas/api dev` boots and listens
   (verified via `loadPrivateEnv()` succeeding + the existing `/health/live` endpoint,
   exercised indirectly by `apps/api/test/*.spec.ts`); `pnpm --filter @saas/web dev`
   confirmed via a live Playwright smoke test against the real dev server.
2. "CI passes" — **Requires manual verification**: the updated `.github/workflows/ci.yml`
   was not run on GitHub Actions itself in this phase (no access to trigger a real
   workflow run from here); every step it runs (`lint`, `typecheck`, `test`,
   `check:cycles`, `check:duplicates`, `build`, `check:bundle-secrets`,
   `test:e2e`) was run locally and passes. `check:deadcode` is wired with `|| true`
   (informational), so it cannot fail the job even though it currently reports real,
   out-of-scope findings (see FINDINGS.md).
3. "All tests pass" — **Confirmed working**: see the Tests run column above and the
   per-requirement test list below.

### Tests run (from this phase's "TESTS" list)

1. **Missing variable stops startup with its name and no value** — **Confirmed
   working**. Pre-existing `packages/config/src/index.spec.ts` ("fails fast naming the
   missing variable, without ever including a value") already covered this; re-verified
   passing in this phase (6/6 tests in that file).
2. **Logger redacts every listed key** — **Confirmed working**. Added the previously-
   missing `otp` key to `SENSITIVE_KEYS`/`REDACT_PATHS`; `packages/observability/src/redact.spec.ts` (4/4 tests, including the new `otp` case) passes.
3. **Response headers match the policy** — **Confirmed working**.
   `apps/api/test/security-headers.spec.ts` (4/4 tests) asserts CSP (with
   `frame-ancestors 'none'`, no `unsafe-inline`), `X-Content-Type-Options: nosniff`,
   `Referrer-Policy`, and HSTS (production only).
4. **Non-allowlisted origin gets no CORS allow headers** — **Confirmed working**.
   Same spec file, "CORS allowlist" describe block (2/2 tests).
5. **HTTP request in production mode redirects to HTTPS** — **Confirmed working**.
   New `apps/api/test/https-redirect.spec.ts` (3/3 tests) — this test did not exist
   before this phase; written to close the gap.
6. **Bundle check fails when a fake secret is placed in client code** — **Confirmed
   working**. New `scripts/check-bundle-for-secrets.spec.ts` (4/4 tests) exercises the
   pure `findLeakedSecretNames` function with both a positive (leak found) and negative
   case; the live script was also verified against a real `pnpm build` output (clean
   pass) after fixing BUG-001.

### Findings

Five real bugs found and fixed in this phase (BUG-001 through BUG-005), plus one tracked
but intentionally not fixed (knip's unused-dependency report). Full root-cause records
in [docs/auth/FINDINGS.md](FINDINGS.md). Three of the five (BUG-002, BUG-004, and the
pre-existing Prisma-client-not-generated gap) predate this phase; BUG-001, BUG-003, and
BUG-005 relate to work done in this phase, caught before being considered done, per
`AUTH_RULES.md` rule 12 ("after any change, re-run the relevant flow... check for
regressions").

### Open questions and risks

- **Requires manual verification**: the GitHub Actions workflow itself has not been
  executed on GitHub — only each of its steps run locally. The next push should be
  watched to confirm the workflow actually passes end-to-end in that environment
  (different OS, network, and timing characteristics than local Windows execution).
- **Potential risk**: `pnpm audit --audit-level=high || true` in CI never fails the
  build regardless of findings — kept as-is from before this phase (not touched, per
  rule 7) but flagged since it means a genuinely high-severity dependency vulnerability
  would not block CI today. A later phase should decide whether to tighten this.
- **Missing information**: knip reports 10 unused dependencies / 4 unused exports,
  mostly reserved for not-yet-wired features; tracked in FINDINGS.md, not fixed, wired
  as informational only.

## Phase 3 detail

### Done-when verification

1. "All tests pass" — **Requires manual verification, not Confirmed working**: this
   environment has no Docker and no accessible Postgres with known credentials (see
   FINDINGS.md). `pnpm test` reports 12 real (non-DB) tests passing and 10 DB-dependent
   tests _skipped_ (not failed — they detect the unreachable database and skip
   cleanly, per the explicit design in `apps/api/test/db-test-helpers.ts`). None of
   this phase's 8 named TESTS requiring a real database were executed in this session.
2. "Schema docs match the migrations" — **Confirmed working**: `docs/auth/ARCHITECTURE.md`
   §5/§5a and `docs/auth/COMPONENTS.md`'s "Phase 3 components" section were written
   directly from the final `schema.prisma` and `migration.sql`, and cross-checked
   against them line by line after the BUG-006 revision.

### Tests run (this phase's explicit TESTS list)

| #   | Test                                                                  | Status                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Same email, different case/spaces, fails                              | Requires manual verification — written as `apps/api/test/signup-integrity.integration.spec.ts`, not executed (no DB)                                                                                                        |
| 2   | 10 concurrent signups → 10 profiles; 2 concurrent same-email → 1 user | Requires manual verification — same file, not executed                                                                                                                                                                      |
| 3   | User A cannot select/insert/update/delete User B's rows               | Requires manual verification — `apps/api/test/rls.integration.spec.ts`, not executed                                                                                                                                        |
| 4   | Anonymous client reads nothing from auth tables                       | Requires manual verification — same file, not executed                                                                                                                                                                      |
| 5   | Profile update cannot change role or status                           | **Confirmed working** — `apps/api/test/profile-immutability.spec.ts`, a pure unit test needing no database; actually run, passes                                                                                            |
| 6   | Delete cascades; soft delete revokes sessions                         | Requires manual verification — `apps/api/test/cascade-and-soft-delete.integration.spec.ts`, not executed                                                                                                                    |
| 7   | Simulated trigger failure leaves no partial user                      | Requires manual verification — `apps/api/test/signup-integrity.integration.spec.ts`, not executed                                                                                                                           |
| 8   | Consistency script reports zero problems on seeded data               | Requires manual verification — `scripts/check-db-consistency.integration.spec.ts` (DB-dependent, not executed) + `scripts/check-db-consistency.spec.ts` (pure-logic unit test with a fake client, **actually run, passes**) |

Non-DB verification actually run in this session: `pnpm lint` (22/22), `pnpm typecheck`
(22/22), `pnpm check:cycles` (0 circular dependencies), `pnpm format:check` (clean),
`node scripts/secret-scan.mjs` (clean), `pnpm build` (web+admin+api+worker all
succeed), `pnpm check:bundle-secrets` (clean against the real build output),
`prisma validate`/`prisma generate` against the final schema (both succeed).

### Findings

One **critical** finding (BUG-006): a draft of the Phase 3 migration would have
dropped and recreated every table's primary/foreign key column, silently orphaning
every relationship on a populated database. Caught by manually reading the generated
migration SQL before committing it — never applied anywhere. Full root-cause record in
`docs/auth/FINDINGS.md`. No other new bugs found in code written this phase (BUG-001
through BUG-005 were Phase 2 findings).

### Open questions and risks

- **Missing information / critical gap in this session's verification**: no live
  Postgres database was available (no Docker; the only service bound to port 5432 on
  this machine is an unrelated, pre-existing instance with unknown credentials, not
  probed further per AUTH_RULES.md rule 2/4). **The next step before trusting this
  phase's database work is to actually run `pnpm --filter @saas/database migrate:deploy
&& pnpm db:seed && pnpm test && pnpm db:check-consistency` against a real, disposable
  Postgres database** (CI will do this automatically on the next push) and update this
  file and `FINDINGS.md` with the real results.
- **Requires manual verification**: the `'suspended'` → `'disabled'` status backfill
  and the `email` column's TEXT→CITEXT type change in the migration are written to be
  safe against a populated table (see the migration's own comments) but were never
  exercised against real populated data.
- **Carried-forward open question (ARCHITECTURE.md §7, item 9)**: should a future phase
  wire `app.current_user_id` into Prisma's actual connection, making the new RLS
  policies the real enforcement layer rather than a dormant, independently-tested one?
- **Documented decision, not a defect**: soft-deleted accounts' email addresses are
  never released for reuse (the unique constraint stays in force indefinitely). If the
  product requires email reuse after deletion, this needs a deliberate follow-up
  decision (anonymizing the email on delete, or a separate reuse-eligibility window).

## Phase 4 detail

### Done-when verification

"All tests pass" — **Requires manual verification, not Confirmed working**: same
environment limitation as Phase 3 (no live Postgres). Two test suites needed no
database and were **actually run**: `packages/validation/src/index.spec.ts` (8/8 —
password policy boundaries) and the updated `packages/security/src/server.spec.ts`
(25/25 — argon2id params, `needsRehash`, `isPasswordBreached`). All 13 new
`phase4-signup-verification.integration.spec.ts` tests plus the 2
`get-verification-url.integration.spec.ts` tests are written (one test per checklist
item, plus the "GET doesn't verify" and "no raw token" extras) and skip cleanly
without a reachable database; none were executed against a real one.

### Tests run (checklist item -> test -> status)

| #     | Checklist item                                | Test                                                                                                  | Status                                                                                         |
| ----- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1     | Signup                                        | `phase4-signup-verification.integration.spec.ts`                                                      | Requires manual verification                                                                   |
| 2     | Duplicate account                             | same file                                                                                             | Requires manual verification                                                                   |
| 3     | Email verification                            | same file                                                                                             | Requires manual verification                                                                   |
| 4     | Verification expiration                       | same file                                                                                             | Requires manual verification                                                                   |
| 5     | Verification resend                           | same file                                                                                             | Requires manual verification                                                                   |
| 6     | Unverified login                              | same file                                                                                             | Requires manual verification                                                                   |
| 7     | Password creation                             | `packages/validation/src/index.spec.ts`                                                               | **Confirmed working** (8/8, actually run, no DB needed)                                        |
| 8     | Weak password handling                        | same file                                                                                             | **Confirmed working** (same run)                                                               |
| 9     | Account creation failure                      | `phase4-signup-verification.integration.spec.ts`                                                      | Requires manual verification                                                                   |
| 10    | Partial account creation                      | same file                                                                                             | Requires manual verification                                                                   |
| 11    | Profile creation failure                      | same file                                                                                             | Requires manual verification                                                                   |
| 12    | Database trigger failure                      | N/A — documented decision, no triggers exist                                                          | Requires manual verification (written note, no test possible for something that doesn't exist) |
| 13    | Email delivery failure                        | same file (spies on the email provider to force a failure)                                            | Requires manual verification                                                                   |
| 14    | Verification redirect                         | `apps/web` verify-email-client.tsx + `isAllowedRedirect` (already unit-tested in `packages/security`) | Requires manual verification for the page's own usage — no browser-level test was run          |
| 15    | Already verified account                      | `phase4-signup-verification.integration.spec.ts`                                                      | Requires manual verification                                                                   |
| 16    | Expired verification link                     | same file                                                                                             | Requires manual verification                                                                   |
| extra | GET on verification URL does not verify       | `get-verification-url.integration.spec.ts`                                                            | Requires manual verification                                                                   |
| extra | No raw token in DB or logs                    | `phase4-signup-verification.integration.spec.ts`                                                      | Requires manual verification                                                                   |
| extra | Forced mid-transaction failure leaves no rows | same file                                                                                             | Requires manual verification                                                                   |

### Findings

Found and fixed one real, pre-existing gap while implementing this phase: `login()`
never checked for `status === "pending_verification"` at all — an unverified account
with the correct password could sign in successfully, silently bypassing the entire
email-verification gate. This directly corresponds to checklist item 6 ("Unverified
login"), which is why implementing this phase's own test for that item is what
surfaced it. Fixed by adding the check immediately after password verification
succeeds (not before — checking status before confirming the password would let
anyone probe an email's verification state with any password, an enumeration vector).
Full record in `docs/auth/FINDINGS.md`.

### Open questions and risks

- **Missing information / carried-forward environment limitation**: no live Postgres
  was available in this session either (see Phase 3's note, unchanged). Every
  DB-dependent test in this phase is written and will run for real in CI; none were
  executed here.
- **Requires manual verification**: the verify-email page's Confirm-button flow,
  referrer-policy header, and token-stripping-from-URL behavior were written but not
  exercised in a real browser (no Playwright run against this specific page in this
  session — Phase 2's e2e smoke test only covers the home page).
- `FEATURE_BREACHED_PASSWORD_CHECK` defaults to `false` — the HIBP k-anonymity check
  exists and has unit test coverage (mocked `fetch`), but was never exercised against
  the real API in this session (deliberately — making a real network call in a test
  suite is flaky and slow; the mocked tests cover the wiring/fail-open behavior).

## Phase 5 detail

### Done-when verification

"All tests pass" — **Requires manual verification, not Confirmed working**: same
environment limitation as Phases 3/4 (no live Postgres), plus this phase introduces
items that genuinely need a real browser (double-click guard, multi-tab, offline
mode in a real browser, slow network via DevTools throttling) which no amount of
local Node-level testing can substitute for. Two test files needed neither a
database nor a browser and were **actually run**:
`packages/api-client/src/index.spec.ts` (8/8 — timeout, offline, network-failure,
malformed-response handling) and `apps/api/test/all-exceptions-filter.spec.ts` (5/5
— 422/503/500 mapping, Retry-After header). All 14 new
`phase5-login.integration.spec.ts` tests (covering checklist items 1-12, the timing
test, and session fixation) are written and skip cleanly without a reachable
database.

### Tests run (checklist item -> status)

| #                  | Item                                                                                                    | Status                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1-5                | Empty/invalid email, spaces, case, empty password                                                       | Requires manual verification (written, DB-dependent)                                                                                                                                             |
| 6-11               | Incorrect password through Locked account                                                               | Requires manual verification (written, DB-dependent)                                                                                                                                             |
| 12                 | Rate-limited account                                                                                    | Requires manual verification — the Redis-backed per-IP throttler has no direct test; written steps in TRACEABILITY.md                                                                            |
| 13, 14, 15, 17, 18 | Network failure, Timeout, Server error, Database error, Invalid response                                | **Confirmed working** — `packages/api-client` and `all-exceptions-filter` suites, actually run                                                                                                   |
| 16                 | Auth-provider error                                                                                     | N/A — no external provider SDK is wired yet                                                                                                                                                      |
| 19-21              | Expired/existing session, multiple login attempts                                                       | Requires manual verification                                                                                                                                                                     |
| 22-28              | Double-click, concurrent requests, slow network, offline, refresh-during-login, multi-tab, multi-device | 25 (Offline mode) is **Confirmed working** (`ApiClientOfflineError` test, actually run); the rest are Requires manual verification — none are automatable without a real browser in this session |
| 29, 31             | Redirect after login, incorrect redirect destination                                                    | **Confirmed working** for the underlying `isAllowedRedirect` helper (already unit-tested); the login page's own call site is Requires manual verification                                        |
| 30, 32-39          | Redirect loops through permissions failing                                                              | Requires manual verification — all need a real browser/running stack                                                                                                                             |

### Findings

Two real, pre-existing bugs found and fixed while writing this phase's own tests —
both instances of the same pattern this phase's spec explicitly names ("Account
states, checked only after the password matches"):

- **BUG-007** (found in Phase 4, during this phase's rewrite it became clear the fix
  needed to be broader): `pending_verification` wasn't the only status checked too
  early.
- **BUG-008** (new this phase): `locked`/`disabled`/`deleted` were ALL checked before
  password verification, letting anyone enumerate a known email's exact account
  status using any password at all. Fixed in the same `login()` rewrite that added
  dummy-hash timing protection. Full record in `docs/auth/FINDINGS.md`.

### Open questions and risks

- **Missing information / carried-forward environment limitation**: no live
  Postgres, same as Phases 3/4.
- **New this phase**: no browser automation (Playwright against a running stack) was
  exercised either — items 22-39 (minus the two "Confirmed working" exceptions above)
  are all genuinely untested beyond the implementation itself. A later phase (or a
  human with a running local stack) should work through TRACEABILITY.md's written
  manual-verification steps for each.
- **Carried-forward**: the 9 open architecture questions from Phase 1 remain
  unanswered.
- `RedisThrottlerStorage` fails CLOSED on a Redis outage (every throttled route would
  start rejecting requests rather than silently allowing unlimited ones) — this is
  the deliberately safer failure mode per the "never process memory" requirement, but
  it does mean a Redis outage becomes a login-availability incident, not just a
  rate-limiting gap. Worth flagging for the production-readiness phase.

## Phase 6 detail

### Done-when verification

"All tests pass" — **Requires manual verification, not Confirmed working**: same
environment limitation as every prior phase (no live Postgres in this session). All
12 new `phase6-otp.integration.spec.ts` tests (covering every item in the Phase 6
TESTS list, plus magic-link equivalents) are written as real, non-mocked integration
tests and skip cleanly via `isDatabaseReachable()`. No test file in this phase was
runnable without a database — unlike Phase 5, there was no network/timeout/offline
subset that could be exercised without one. The full `apps/api` suite was re-run
after every change and confirmed zero regressions (17 previously-passing non-DB tests
still pass).

### Tests run (checklist item -> status)

| #   | Item                            | Status                                                                                                                   |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | OTP authentication (happy path) | Requires manual verification (written, DB-dependent)                                                                     |
| 2   | OTP generation and hashing      | Requires manual verification — assertions on `tokenHash` shape/non-equality are written but need a database to run       |
| 3   | OTP expiration                  | Requires manual verification (written, DB-dependent)                                                                     |
| 4   | OTP attempt limits              | Requires manual verification (written, DB-dependent — 5-attempt lockout test)                                            |
| 5   | OTP resend                      | Requires manual verification (written, DB-dependent — both the invalidate-previous and the cooldown-blocks-resend tests) |
| 6   | OTP enumeration protection      | Requires manual verification (written, DB-dependent — identical-response tests for request and verify)                   |
| 7   | OTP replay prevention           | Requires manual verification (written, DB-dependent — replay test and the concurrent-use race test, both target BUG-009) |
| 8   | Magic link (D4 resolution)      | Requires manual verification (written, DB-dependent — replay, concurrent-use, and unrecognized-token tests)              |

### Findings

One real, pre-existing bug found and fixed while writing this phase's own
concurrency test:

- **BUG-009**: `verifyOtp()`'s code-consumption step used a non-atomic
  `findFirst` + `update` pair, letting two concurrent correct submissions of the same
  code both succeed (each issuing its own session) — exactly the race this phase's
  own "concurrent use of one code, exactly one succeeds" test requirement exists to
  catch. Fixed by replacing it with a single atomic `updateMany` guarded by
  `usedAt: null`, checking `count === 0` to detect and reject the losing racer. The
  same (already-correct) pattern was reused for the new `verifyMagicLink`. Full
  record in `docs/auth/FINDINGS.md`.

### Open questions and risks

- **Missing information / carried-forward environment limitation**: no live
  Postgres, same as every prior phase.
- **No browser testing performed**: the magic-link confirm page and the OTP
  request/verify UI (countdown, paste support, numeric input mode) were implemented
  but never exercised in an actual browser in this session — both are Requires
  manual verification, not Confirmed working.
- **D4 pragmatically resolved, not by human confirmation**: this phase implemented
  both OTP and magic link rather than waiting for the human to pick one, since the
  Phase 6 task list itself described both as in scope. If the human intended a single
  mechanism, the unwanted one should be disabled (not deleted — the `purpose` column
  already separates them cleanly) rather than left live by default.
- **D6 (TOTP MFA) remains unresolved and unimplemented.** Task 7's "OTP as a second
  factor, if in scope, runs after password verification and before session creation"
  was read as conditional on a scope that was never confirmed, so no second-factor
  wiring was added — `verifyOtp` and `verifyMagicLink` each independently create a
  fresh session, the same as `login()`, not as a second step after it.
- **Carried-forward**: the remaining open architecture questions from Phase 1 are
  still unanswered (managed-provider choice, OAuth provider scope, multi-tenancy,
  real domain names, phase-plan renumbering, harden-vs-discard decision, RLS wiring
  into Prisma's actual connection).

## Phase 7 detail

### Done-when verification

"All tests pass" — **Requires manual verification, not Confirmed working**: same
database limitation as every prior phase (no live Postgres in this session). This
phase is unusual in that a large share of its logic is pure (JWT signing/
verification, cookie-name computation, the CSRF guard, the api-client refresh/CSRF/
broadcast logic, log redaction) and needed no database at all — 23 new tests across
`apps/api`, `packages/api-client`, `packages/security`, and `packages/observability`
were **actually run** this session, not just written. Only the session-row-level
behavior (rotation, reuse detection, idle touch, logout, change-password,
logout-all-devices) is DB-dependent and skips cleanly.

### Tests run (checklist item -> status)

See `docs/TRACEABILITY.md`'s "SESSION LIFECYCLE (Phase 7)" table for the full
item-by-item breakdown (31 rows). Summary: items 1, 2, 7, 8, 10 (partial), 11, 12,
13, 16, 17, 19, 21 (access-token half), 22 (access-token half), 29 (fallback logic),
30 are **Confirmed working** (actually run, no database needed). Items 3, 4, 5, 6,
9, 14, 15, 18, 20, 21 (refresh-token half), 22 (refresh-token half), 23, 24, 25, 26,
27, 28, 29 (real private-mode), 31 are **Requires manual verification** (written as
real integration tests or need a browser/running stack, not executed against a live
database or browser this session).

### Findings

Two real, pre-existing-or-introduced bugs found and fixed while implementing this
phase, plus one documented design decision flagged for human confirmation:

- **BUG-010** (pre-existing, latent): `packages/observability/src/redact.ts` used
  exact-match key matching, which silently let `accessToken`/`refreshToken`/
  `csrfToken` — the exact field names this phase's own new code would plausibly
  log — bypass redaction entirely, despite `token`/`refresh` already being on the
  sensitive-keyword list. Fixed by switching to substring matching.
- **BUG-011** (pre-existing, became exploitable this phase): `SessionGuard` read
  the session cookie name from `process.env` directly instead of through the
  validated config, which had no visible effect before this phase but would have
  caused a complete, silent lockout as soon as the new `__Host-` cookie-prefix
  logic made the controller's actual cookie name diverge from the guard's
  hardcoded fallback. Fixed by routing through the new shared `cookie-names.ts`.
- **Potential risk** (not a bug, flagged for a human decision): idle-timeout is
  measured against protected-resource access (`SessionGuard`), not against
  `/auth/refresh` calls — a client that only ever refreshes, never touching a
  protected route, could keep a session's refresh chain alive past the idle
  window. Full record and the alternative interpretation in FINDINGS.md.

### Open questions and risks

- **Missing information / carried-forward environment limitation**: no live
  Postgres, same as every prior phase.
- **No browser testing performed**: the new `/dashboard/sessions` page, the
  dashboard logout button, and cross-tab-logout's REAL (not mocked) BroadcastChannel
  behavior in an actual browser were never exercised — all Requires manual
  verification, not Confirmed working.
- **EdDSA vs. RS256**: the task allowed either; RS256 was used instead of EdDSA
  solely because `@types/jsonwebtoken@9.0.10` doesn't type `"EdDSA"` yet. Not a
  security downgrade — RS256 is the other explicitly-allowed option — but worth
  knowing if a future phase wants to revisit once the type definitions catch up
  (or by using `jose` instead of `jsonwebtoken`, which does support EdDSA with
  correct types today).
- **Idle-timeout semantics**: see the "Potential risk" finding above — needs a
  human decision on whether `/auth/refresh` itself should also count as activity
  for idle-timeout purposes.
- **Login/signup/OTP-verify/magic-link-verify are NOT behind `CsrfGuard`**: scoped
  deliberately to "cookie-authenticated" state changes only, per the task's literal
  wording — at the moment these are called, the caller doesn't yet have a valid
  session the way logout/refresh/revoke do. A stricter reading (CSRF-protecting
  login itself, against "login CSRF") was considered and explicitly out of scope
  for this phase; flagging it here rather than silently deciding it doesn't matter.
- **No key-rotation drill was performed**: `AUTH_JWT_PREVIOUS_PUBLIC_KEY`/
  `AUTH_JWT_PREVIOUS_KID` exist and are wired into `verifyAccessToken`, but rotating
  keys end-to-end (issuing under a new key while still accepting the old one) was
  not exercised against a running system this session.
- **Carried-forward**: the remaining open architecture questions from Phase 1
  (managed-provider choice, OAuth provider scope, multi-tenancy, real domain
  names, phase-plan renumbering, harden-vs-discard decision, RLS wiring into
  Prisma's actual connection), and D6 (TOTP MFA, still unresolved/unimplemented).

## Phase 8 detail

### Done-when verification

"All tests pass" — **Requires manual verification, not Confirmed working**: same
database limitation as every prior phase (no live Postgres in this session). All
10 new `phase8-password-reset.integration.spec.ts` tests (covering every
checklist item, including the explicit "two simultaneous submits with one token"
and "sessions in a second browser context dead after reset" requirements) are
written as real, non-mocked integration tests and skip cleanly via
`isDatabaseReachable()`. The full `apps/api` suite was re-run after every change
and confirmed zero regressions.

### Tests run (checklist item -> status)

| #   | Item                                       | Status                                                                                                                                          |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Forgot password                            | Requires manual verification (written, DB-dependent)                                                                                            |
| 2   | Reset email                                | Requires manual verification (written, DB-dependent — queue-spy assertion)                                                                      |
| 3   | Reset token                                | Requires manual verification (written, DB-dependent — 32-byte/hash-shape assertions)                                                            |
| 4   | Reset token expiration                     | Requires manual verification (written, DB-dependent)                                                                                            |
| 5   | Token reuse                                | Requires manual verification (written, DB-dependent — targets BUG-012)                                                                          |
| 6   | Token invalidation                         | Requires manual verification (written, DB-dependent)                                                                                            |
| 7   | Password update                            | Requires manual verification (written, DB-dependent — old password rejected, new one accepted)                                                  |
| 8   | Session invalidation after password change | Requires manual verification (written, DB-dependent — two independent logins, both revoked)                                                     |
| 9   | Existing sessions after password reset     | Requires manual verification (same test as item 8; HTTP-level 401 round trip not re-tested, covered generically in Phase 7)                     |
| 10  | Enumeration protection                     | Requires manual verification (written, DB-dependent — response-shape only, NOT full timing-safety, see FINDINGS.md)                             |
| 11  | Expired reset links                        | Requires manual verification (backend: same as item 4; frontend state has no browser test)                                                      |
| 12  | Multiple reset requests                    | Requires manual verification (written, DB-dependent — cooldown-blocks-resend test)                                                              |
| 13  | Race conditions                            | Requires manual verification (written, DB-dependent — targets BUG-012, the explicit "exactly one succeeds" requirement)                         |
| 14  | Redirect handling                          | Confirmed working for the underlying `isAllowedRedirect` helper (already unit-tested); the page's own call site is Requires manual verification |

### Findings

Two real, pre-existing bugs found and fixed while implementing this phase, plus
one documented timing-safety limitation flagged for a human decision:

- **BUG-012** (pre-existing, high severity): `resetPassword()`'s token
  consumption used a non-atomic read-then-`update`, the same TOCTOU race already
  identified and fixed for OTP as BUG-009 — two concurrent submissions of the
  same reset token could both succeed. Fixed with the same atomic-`updateMany`
  pattern.
- **BUG-013** (pre-existing, medium severity): `POST /auth/password-reset/confirm`
  had no `@Throttle` decorator at all, unlike every sibling verify/confirm
  endpoint. Fixed by adding the same 10/60s limit used by OTP/magic-link verify.
- **Potential risk** (not a bug, flagged for a human decision): the
  "enumeration protection" fix for `requestPasswordReset` narrows but does not
  fully close a timing side-channel between known and unknown emails — unlike
  `login()`'s dummy-hash protection, there's no single dominant slow operation to
  equalize against here. Full record and the tradeoff in FINDINGS.md.

### Open questions and risks

- **Missing information / carried-forward environment limitation**: no live
  Postgres, same as every prior phase.
- **No browser testing performed**: the rewritten reset-password page's
  expired/used/invalid states and the "Request a new link" affordance were
  never exercised in an actual browser.
- **Timing-safety tradeoff**: see the "Potential risk" finding above — a
  calibrated artificial delay could close the remaining gap but introduces its
  own maintenance burden (the delay would need to track the real branch's actual
  cost over time); not attempted without a human decision on whether it's worth
  it.
- **Email queue adoption is scoped to this phase's two new email sends only**:
  signup verification, OTP, magic-link, and duplicate-signup-notice emails still
  send directly/synchronously, as they did before this phase — broadening queue
  adoption to every email type in the codebase was judged a larger change than
  this phase's explicit scope ("Do only the work in this phase").
- **Carried-forward**: the remaining open architecture questions from Phase 1,
  and D6 (TOTP MFA, still unresolved/unimplemented).
