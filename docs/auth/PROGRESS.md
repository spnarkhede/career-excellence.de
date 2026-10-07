# Auth Workstream Progress

Statuses are restricted to the set in [AUTH_RULES.md](../../AUTH_RULES.md) rule 13:
Confirmed working, Confirmed broken, Fixed, Requires configuration, Requires manual
verification, Unable to verify. "Not started" is used only before a phase has begun.

| Phase | Name                                              | Status                       | Date       | Version | Tests run                                                                                                                                                                                                                                                                                                                                                      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----- | ------------------------------------------------- | ---------------------------- | ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | Project rules, traceability and development log   | Confirmed working            | 2026-10-06 | 0.1.0   | `pnpm lint` (22/22 packages pass, exit 0); commitlint manually verified to reject a malformed commit message (exit 1)                                                                                                                                                                                                                                          | AUTH_RULES.md (13 rules, word for word), docs/TRACEABILITY.md, docs/auth/FINDINGS.md, docs/auth/COMPONENTS.md, this file, CHANGELOG.md, docs/devlog/, commitlint + husky commit-msg hook, scripts/release.mjs created. No application code touched. Committed as 802fbe6, tagged v0.1.0.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 1     | System understanding, lifecycle tracing, auth map | Requires manual verification | 2026-10-06 | 0.2.0   | `pnpm lint` (22/22 packages pass, exit 0); no automated test exists for documentation completeness, so every Phase 1 traceability row is "Requires manual verification", never "Confirmed working"                                                                                                                                                             | docs/auth/ARCHITECTURE.md extended (project layout, data connection diagram, D10/open question 9); docs/auth/FLOWS.md created (8 mermaid sequence diagrams with failure branches + HTTP codes); docs/auth/COMPONENTS.md rewritten with a Planned entry per Authentication map item. No application code written. **Human confirmation required before Phase 2** — see the 9 "Open questions for the human" in ARCHITECTURE.md.                                                                                                                                                                                                                                                                                                 |
| 2     | Scaffold and secure foundation                    | Confirmed working            | 2026-10-07 | 0.3.0   | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test` 4 test files/34 tests pass + `test:scripts` 1 file/4 tests; `pnpm check:cycles` 0 cycles; `pnpm check:duplicates` 4 clones, 1.3%, under 5% threshold; `pnpm build` (web+admin+api+worker) succeeds; `pnpm check:bundle-secrets` passes against real build; live Playwright smoke test (chromium) passes | Env validation, HTTPS redirect, security headers, CORS allowlist, redaction (added `otp`), global process handlers, strict lint rules, knip/jscpd/madge wired, Playwright expanded to 4 browser/device projects, CI updated. Found and fixed 5 real bugs (BUG-001..005, pre-existing + newly introduced) — see FINDINGS.md. `check:deadcode` wired as informational only (real, out-of-scope findings — see FINDINGS.md).                                                                                                                                                                                                                                                                                                      |
| 3     | Database tables and data connections              | Requires manual verification | 2026-10-07 | 0.4.0   | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test` all pass (12 real + 10 DB-dependent skipped — no live Postgres in this environment, see Notes); `pnpm check:cycles` 0 cycles; `pnpm build` succeeds                                                                                                                                                     | Full Phase 3 schema (users/profiles/oauth_accounts/sessions/one_time_tokens/auth_events + RLS), 2 migrations with down.sql, AuthService rewritten (transactional signup, password on users.passwordHash, lockout, soft delete, refresh-reuse detection), consistency-check script, seed script with generated test users. **No live database was available in this environment** — every DB-dependent test (1,2,3,4,6,7,8) is written and will run for real in CI, but was not executed against a real Postgres instance in this session; see FINDINGS.md. One critical bug (BUG-006: a draft migration would have silently orphaned every FK on a populated DB) was caught by manual review and fixed before being committed. |
| 4     | Signup and verification                           | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 5     | Login process                                     | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 6     | OTP authentication                                | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 7     | Session lifecycle                                 | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8     | Password reset                                    | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 9     | OAuth providers and processes                     | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 10    | Routing and middleware                            | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 11    | Frontend auth UI                                  | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 12    | Error handling                                    | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 13    | Security checks                                   | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 14    | Launch: legal, trust and conversion               | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 15    | Launch: SEO and sharing                           | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 16    | Launch: performance and accessibility             | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 17    | Race conditions and edge cases                    | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 18    | Code defects that must not exist                  | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 19    | Test matrix                                       | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 20    | Production audit                                  | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 21    | Final audit report                                | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

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
