# Findings

Root cause records for bugs found in the authentication workstream, per
[AUTH_RULES.md](../../AUTH_RULES.md) rule 9. One entry per bug. Every entry must be
labeled per rule 10 and scored per the severity scale in rule 11. Do not mark a bug
"Fixed" unless it was re-verified per rule 12.

## Template

Copy this block for each new finding.

```
### BUG-NNN: <short title>

- **Label:** Confirmed bug | Likely bug | Potential risk | Configuration issue | Missing information
- **Severity:** CRITICAL | HIGH | MEDIUM | LOW
- **Status:** Confirmed working | Confirmed broken | Fixed | Requires configuration | Requires manual verification | Unable to verify
- **Component/file:**
- **Exact location:** (file:line or function name)
- **Problem:**
- **Root cause:**
- **Trigger:**
- **Impact:**
- **Reproduction steps:**
  1.
- **Expected behavior:**
- **Actual behavior:**
- **Why it happens:**
- **Related components:** (chain of connected issues, per rule 8)
- **Recommended fix:**
- **Regression risk:**
- **How to test the fix:**
```

## Findings log

### BUG-001: Bundle secret check scanned server-only output, producing false positives on every real build

- **Label:** Confirmed bug
- **Severity:** MEDIUM — the check could not run against a real build at all (always
  failed), which would have blocked `pnpm build`/CI for every future PR once wired in,
  not an exploitable security hole itself, but it defeats the control's purpose.
- **Status:** Fixed
- **Component/file:** `scripts/check-bundle-for-secrets.ts`
- **Exact location:** `targetDirs` constant (originally `["apps/web/.next", "apps/admin/.next"]`)
- **Problem:** The script's own comment says it scans "built client bundle output," but
  it walked the entire `.next/` tree, including `.next/server/` — Node-only SSR code
  that never reaches the browser.
- **Root cause:** Next.js bundles the shared `@saas/config` module (whose Zod schema
  literally lists every private env var name as an object key) into server-side SSR
  chunks for any page/middleware that imports it transitively. Scanning `.next/server/`
  for those names will always find them, because they are legitimately present there —
  conflating "appears somewhere under `.next/`" with "shipped to the browser."
- **Trigger:** Running `pnpm check:bundle-secrets` (or the CI step) after any `pnpm build`.
- **Impact:** The check would fail on every build, for every PR, regardless of whether a
  real leak existed — making it noise that would train reviewers to ignore it, or get
  disabled outright, defeating its purpose (checklist item "Remove frontend secrets").
- **Reproduction steps:** 1) `pnpm build` with public env vars set. 2) Run the original
  script. 3) Observe ~40 false "leak" reports, all under `apps/*/\.next/server/`.
- **Expected behavior:** Pass cleanly when no private var name appears in
  browser-shipped code.
- **Actual behavior:** Always failed, even on a clean build with no real leak.
- **Why it happens:** See root cause above.
- **Related components:** `packages/config` (the schema whose names get bundled),
  Next.js's own server/client code-splitting.
- **Recommended fix:** Scan only `apps/*/.next/static` (applied in this phase).
- **Regression risk:** Low — the fix only narrows the scan target; a real leak into
  `.next/static` is still caught (verified via `scripts/check-bundle-for-secrets.spec.ts`
  and a clean run against a real `pnpm build`).
- **How to test the fix:** `pnpm build && pnpm check:bundle-secrets` passes; the pure
  function `findLeakedSecretNames` has unit tests asserting both a positive (leak found)
  and negative (no leak) case.

### BUG-002: `apps/api` failed `tsc --noEmit` — conflicting `CorsOptions` types, missing `@types/express-serve-static-core`, Prisma `Json` type mismatch

- **Label:** Confirmed bug
- **Severity:** HIGH — this blocked `pnpm typecheck` for the entire API app, including
  all pre-existing auth code (`auth.service.ts`, `session.guard.ts`,
  `request-id.middleware.ts`), from before this phase's changes. Confirmed pre-existing
  by `git stash`-ing this phase's edits and re-running typecheck against the prior
  commit — it failed identically.
- **Status:** Fixed
- **Component/file:** `apps/api/src/common/cors.ts`, `apps/api/package.json`,
  `apps/api/src/auth/auth.service.ts`
- **Exact location:**
  - `cors.ts`: `buildCorsOptions` return type annotated as the `cors` npm package's
    `CorsOptions`.
  - `package.json`: `@types/express-serve-static-core` not declared as a direct
    devDependency.
  - `auth.service.ts:59`: `metadata: Record<string, unknown>` assigned directly to a
    Prisma `Json` field.
- **Problem:** Three independent `tsc` errors, all blocking `pnpm typecheck`:
  1. `app.enableCors(buildCorsOptions(...))` — `@types/cors`'s `CorsOptions.origin`
     allows `boolean` in its union; `@nestjs/common`'s own duplicate `CorsOptions`
     interface does not, so the structurally-compatible-at-runtime object fails to
     type-check.
  2. `declare module "express-serve-static-core"` (used to add `principal`/`requestId`
     to `Request`) couldn't resolve that module at all.
  3. `Record<string, unknown>` isn't assignable to Prisma's generated `InputJsonValue`
     union without a cast.
- **Root cause:**
  1. Two npm packages independently re-declare an incompatible `CorsOptions` shape;
     importing either one's type for a value that must satisfy both is a type error
     even though the runtime object is fine for both.
  2. pnpm's strict dependency isolation does not hoist `@types/express-serve-static-core`
     (a transitive dependency of `@types/express`) to a path `apps/api` can resolve a
     bare module-augmentation specifier against, unless it is declared directly.
  3. Prisma's generated `Json` input type is a closed union that doesn't include a bare
     `Record<string, unknown>`, by design (to keep `JsonNull`/array cases explicit).
- **Trigger:** Running `pnpm typecheck` (or `tsc --noEmit` inside `apps/api`) at all —
  not conditional on any specific input.
- **Impact:** `pnpm typecheck` (a CI gate) would fail on every run, for every PR,
  regardless of changes — same class of impact as BUG-001 (a broken gate trains people
  to ignore or disable it).
- **Reproduction steps:** 1) `git stash` any Phase 2 changes. 2) `pnpm --filter @saas/api typecheck`. 3) Observe the same 3 error clusters on the untouched baseline.
- **Expected behavior:** `pnpm typecheck` passes with zero errors.
- **Actual behavior:** 3 error clusters, present since before this phase.
- **Why it happens:** See root cause above.
- **Related components:** `apps/api/src/auth/session.guard.ts`,
  `apps/api/src/common/request-id.middleware.ts`,
  `apps/api/src/common/all-exceptions.filter.ts` (all depend on the `Request`
  augmentation resolving).
- **Recommended fix (applied):** Drop the conflicting `CorsOptions` type import in
  `cors.ts` (the literal object still satisfies both consumers structurally); add
  `@types/express-serve-static-core` as a direct devDependency; cast `metadata as
Prisma.InputJsonValue` at the one call site.
- **Regression risk:** Low — all three fixes are type-only; no runtime behavior changed.
  Verified via `pnpm typecheck` (22/22 packages pass) and the full existing + new test
  suite still passing.
- **How to test the fix:** `pnpm typecheck` passes with zero errors across all 22
  packages.

### BUG-003: Uncaught-exception/unhandled-rejection handler doesn't redact secrets inside a raw `Error.message`/`.stack` string

- **Label:** Potential risk
- **Severity:** LOW — `deepRedact`'s key-based matching only redacts object _properties_
  named like a secret; a thrown `Error` whose `.message` string happens to interpolate a
  token/password value (e.g. a third-party SDK error that echoes the request body) would
  still have that value logged, since pino logs the `Error` object but `.message` is a
  plain string, not a keyed property `deepRedact` walks into.
- **Status:** Requires manual verification
- **Component/file:** `apps/api/src/main.ts`, `apps/worker/src/main.ts`,
  `packages/observability/src/redact.ts`
- **Exact location:** `process.on("uncaughtException", ...)` / `process.on("unhandledRejection", ...)` handlers added in this phase.
- **Problem:** No code path in this codebase today is known to construct an `Error`
  whose message embeds a secret value — this is a structural gap in the redaction
  design, not a demonstrated leak.
- **Root cause:** `deepRedact` only redacts object keys; it has no string-content
  scanning (by design — scanning every log string for secret-shaped substrings would be
  both slow and prone to false positives, the same class of bug as BUG-001/BUG-004 but
  in the opposite direction).
- **Trigger:** Not currently triggerable — no existing code throws an `Error` with a
  secret embedded in `.message`.
- **Impact:** None today; a future dependency (e.g. an OAuth/payment SDK) throwing an
  error that echoes a request body including a credential could leak it to logs.
- **Reproduction steps:** None — this is a design-gap finding, not a reproduced bug.
- **Expected behavior:** No secret ever reaches a log line, including inside an error
  message string.
- **Actual behavior:** Unverified either way for string-embedded secrets specifically.
- **Why it happens:** See root cause.
- **Related components:** Any future code that constructs an `Error` from external,
  potentially credential-bearing input.
- **Recommended fix:** When a Phase 3+ auth provider adapter is written, ensure it never
  constructs an `Error` by interpolating raw request/response bodies that could contain
  a password/token; prefer catching the provider SDK's own error and re-throwing a new
  `Error` with a safe, static message.
- **Regression risk:** N/A — no fix applied in this phase; this is a forward-looking
  note for the engineers writing Phase 3's provider adapter.
- **How to test the fix:** When Phase 3 lands, add a test asserting that a provider
  error containing a credential-shaped string in its raw form is never passed through to
  `logger.error` unmodified.

### BUG-004: Circular import between `packages/auth/src/index.ts` and `stub-provider.ts`

- **Label:** Confirmed bug
- **Severity:** LOW — type-only circular import (interfaces, erased at runtime), so it
  caused no runtime failure, but it is exactly the class of structural issue
  `madge --circular` (this phase's new `check:cycles` gate) exists to catch, and barrel
  cycles can become real runtime cycles the moment a non-type export is added to either
  side.
- **Status:** Fixed
- **Component/file:** `packages/auth/src/index.ts`, `packages/auth/src/stub-provider.ts`
- **Exact location:** `index.ts`'s `export * from "./stub-provider"` combined with
  `stub-provider.ts`'s `import type { AuthProvider, IdentityResult } from "./index"`.
- **Problem:** The barrel file (`index.ts`) re-exports a file that imports back from the
  barrel — a cycle.
- **Root cause:** The shared `AuthProvider`/`IdentityResult`/etc. interfaces were defined
  directly in the barrel file instead of their own module, so any other file in the
  package that needed them had no choice but to import from the barrel, creating a cycle
  for any file the barrel itself re-exports.
- **Trigger:** Running `madge --circular` (or any bundler/tool that detects import
  cycles) against `packages/auth`.
- **Impact:** None observed at runtime (type-only cycle); would have blocked this
  phase's new `check:cycles` CI gate from passing if left unfixed.
- **Reproduction steps:** `pnpm check:cycles` on the pre-fix code: 1 circular dependency
  reported.
- **Expected behavior:** Zero circular dependencies.
- **Actual behavior:** 1 circular dependency, present since the package was first
  written (pre-dates this phase).
- **Why it happens:** See root cause.
- **Related components:** Any future consumer of `packages/auth`'s interfaces.
- **Recommended fix (applied):** Extracted the interfaces into `packages/auth/src/types.ts`; both `index.ts` and `stub-provider.ts` now import from `types.ts` instead of each other.
- **Regression risk:** Low — pure extraction, no behavior change. Verified via
  `pnpm --filter @saas/auth typecheck`, `pnpm --filter @saas/auth lint`, and
  `pnpm check:cycles` (now reports zero cycles).
- **How to test the fix:** `pnpm check:cycles` passes with zero circular dependencies.

### BUG-005: All 4 auth forms passed an async handler directly to `<form onSubmit>` (misused-promise)

- **Label:** Confirmed bug
- **Severity:** LOW — React/the DOM silently ignore a handler's returned Promise, so
  this did not cause a visible failure; it is the exact footgun pattern
  `@typescript-eslint/no-misused-promises` (added in this phase) exists to catch: a
  double-submit race or an unhandled rejection becomes much easier to introduce later
  when the handler's returned promise is implicitly discarded rather than explicitly
  voided.
- **Status:** Fixed
- **Component/file:** `apps/web/src/app/(auth)/{login,signup,forgot-password,reset-password}/page.tsx`
- **Exact location:** `<form onSubmit={handleSubmit(onSubmit)}>` in each file.
- **Problem:** `handleSubmit(onSubmit)` (React Hook Form) returns a function typed as
  returning `Promise<void>`; the DOM's `onSubmit` prop expects a `void`-returning
  handler.
- **Root cause:** TypeScript's JSX typing for `onSubmit` doesn't forbid a
  Promise-returning function at the language level (it's structurally assignable), so
  this only surfaces with an explicit lint rule, not a type error.
- **Trigger:** Submitting any of the 4 auth forms (not a crash — a type-safety gap, not
  a runtime bug).
- **Impact:** None observed; flagged preventively before any of these forms are wired
  to a real backend in a later phase.
- **Reproduction steps:** `pnpm lint` on the pre-fix code: 4 `no-misused-promises` errors.
- **Expected behavior:** Zero lint errors.
- **Actual behavior:** 4 errors, one per form.
- **Why it happens:** See root cause.
- **Related components:** None beyond the 4 listed files.
- **Recommended fix (applied):** `onSubmit={(e) => void handleSubmit(onSubmit)(e)}` in
  all 4 files — explicitly voids the returned promise rather than returning it to the
  DOM.
- **Regression risk:** None — identical runtime behavior, verified via `pnpm lint` and
  a live Playwright smoke test of the app.
- **How to test the fix:** `pnpm lint` passes with zero errors.

### Tracked, not fixed in this phase: `knip` reports real unused dependencies/exports

- **Label:** Missing information / Potential risk
- **Severity:** LOW
- **Status:** Requires manual verification
- **Component/file:** `apps/admin/package.json`, `apps/api/package.json`,
  `apps/web/package.json`, `packages/auth/package.json`,
  `packages/database/package.json`, `packages/ui/package.json`, plus 4 unused exports
  (`publicEnv` in both web/admin `lib/env.ts`, `cleanupWorker`, `emailWorker`).
- **Problem:** `pnpm check:deadcode` (knip) reports 10 unused dependencies and 4 unused
  exports.
- **Root cause:** Most of these are dependencies reserved for features
  `docs/auth/ARCHITECTURE.md` already documents as "not yet wired" (e.g.
  `@tanstack/react-query`, `zod`, `zustand` in `apps/web` — the TanStack Query
  integration gap named in ARCHITECTURE.md §1.1), not accidental leftovers. The 4
  "unused exports" are worker queue processors and a config object that are consumed for
  their side effects (`import "./processors/..."`) or by a framework convention knip's
  static analysis doesn't trace.
- **Trigger:** `pnpm check:deadcode`.
- **Impact:** None currently; left in place deliberately.
- **Recommended fix:** Do not remove in this phase (would be unrelated-scope changes
  per `AUTH_RULES.md` rule 7, and several are intentionally reserved for later phases).
  A later phase should either wire up the reserved dependencies or remove them, and
  re-run `pnpm check:deadcode` as a hard gate once the list reflects only genuine dead
  code.
- **Regression risk:** N/A — no change made.
- **How to test the fix:** Not applicable until a later phase addresses each item;
  wired into CI as informational (`|| true`) in the meantime.

### BUG-006: Generated Phase 3 migration would have dropped and re-added every table's primary key column, silently orphaning every relationship on a populated database

- **Label:** Confirmed bug
- **Severity:** CRITICAL — this was caught before being committed, so it never ran
  against any real data, but had it shipped as-is and been applied to a populated
  database, every `id`/`userId`/`roleId`/`permissionId` primary/foreign key in the
  schema would have been dropped and recreated with brand-new random values, breaking
  every foreign-key relationship in the database (every session, profile, role
  assignment, etc. would point at ids that no longer matched any row) with no error
  raised at migration time.
- **Status:** Fixed
- **Component/file:** `packages/database/prisma/schema.prisma`
- **Exact location:** Every `id`/`userId`/`roleId`/`permissionId` field across every
  model, briefly annotated with `@db.Uuid` while drafting the Phase 3 schema.
- **Problem:** Adding `@db.Uuid` to a field that previously had no native-type
  annotation (and was therefore stored as `TEXT`) changes the underlying Postgres
  column type. Prisma's migration diff engine cannot `ALTER COLUMN ... TYPE uuid` a
  `TEXT` column holding arbitrary UUID-formatted strings via a simple cast in every
  case it generates, so its generated migration instead did `DROP COLUMN "id"; ADD
COLUMN "id" UUID NOT NULL` — on a non-empty table, this is equivalent to assigning
  every row a new, unrelated id with no connection to any existing foreign key
  reference.
- **Root cause:** The Phase 3 instructions' "id uuid" for the `users` table was
  interpreted, during drafting, as "use Postgres's native `uuid` column type," when the
  existing schema already satisfied the actual requirement — ids being
  UUID-_formatted_ values — via `String @id @default(uuid())`, stored as `TEXT`.
  Native-type-casting an existing TEXT primary key is a materially different, far
  riskier operation than what the instruction called for.
- **Trigger:** Running `prisma migrate diff` against the drafted schema and reading
  the generated SQL (`packages/database/prisma/migrations/00000000000001_phase3_auth_tables/migration.sql`)
  before applying it — the risk was caught by inspection, not by running the migration
  against real data (no live database was used in this phase at all; see FINDINGS
  note on database access below).
- **Impact:** None — caught before any migration was applied anywhere.
- **Reproduction steps:** 1) Add `@db.Uuid` to a `String @id @default(uuid())` field in
  a schema that previously had no native type override. 2) Run `prisma migrate diff`
  from the prior schema to the new one. 3) Observe `DROP COLUMN "id"; ADD COLUMN "id"
... NOT NULL` in the output, with no `USING` cast preserving existing values.
- **Expected behavior:** A migration that changes an id column's representation
  without changing its logical identity should never be able to silently disconnect
  every foreign key referencing it.
- **Actual behavior:** It would have, had this not been caught by manual review of the
  generated SQL before committing it.
- **Why it happens:** See root cause.
- **Related components:** Every model in `schema.prisma` with a primary or foreign key
  (all of them) — the blast radius of this one mistake was the entire schema.
- **Recommended fix (applied):** Removed every `@db.Uuid` annotation; ids remain
  `String @id @default(uuid())` (TEXT-backed, UUID-formatted). Regenerated the
  migration diff, which shrank from ~300 lines (mostly destructive drop/recreate pairs)
  to ~130 lines of only the actually-intended changes.
- **Regression risk:** None — the fix is a pure revert of the mistaken annotation; the
  resulting migration was re-reviewed line by line (see this file's and
  `ARCHITECTURE.md`'s discussion of the final migration content).
- **How to test the fix:** Manual review of `migration.sql` confirms no table's primary
  key column is dropped; `prisma validate` and `prisma generate` both succeed against
  the corrected schema.
- **Process note:** This is exactly the scenario `AUTH_RULES.md` rule 1 ("do not assume
  configuration is correct... trace the actual code path") and rule 7 ("prefer the
  smallest safe change") are for — every generated migration in this phase was read in
  full before being treated as final, specifically to catch this class of mistake.

### Note: no live database was available to execute migrations or DB-dependent tests in this phase

- **Label:** Missing information
- **Severity:** N/A (process constraint, not a defect)
- **Status:** Requires manual verification
- **Problem:** This phase's environment has no Docker and no accessible Postgres
  instance with known credentials (port 5432 is occupied by an unrelated, pre-existing
  Postgres instance on the machine with unknown credentials — not probed further, per
  `AUTH_RULES.md` rule 2/4). `prisma migrate dev`/`deploy` could not be run against a
  real database; none of the 8 explicitly-named Phase 3 TESTS that require a database
  (tests 1, 2, 3, 4, 6, 7, 8) were executed for real in this session.
- **What was done instead:** `prisma migrate diff` (schema-to-schema, no DB connection
  required) was used to generate both migrations from the actual schema change, and
  every line was manually reviewed (catching BUG-006 above). All 8 DB-dependent tests
  were written as real integration tests (not mocks) against the actual Prisma client
  and the actual migration SQL's RLS policies, structured to skip cleanly (not fail)
  when no database is reachable, and to run for real in CI, which provisions a genuine
  Postgres service container and already runs migrations + (now) seeding before tests
  — see `.github/workflows/ci.yml`.
- **Impact:** Every status in `docs/TRACEABILITY.md` for this phase's checklist items
  is `Requires manual verification`, per `AUTH_RULES.md` rule 13 — none are marked
  `Confirmed working`, because no test was actually run against a real Postgres
  instance to confirm it in this session.
- **Recommended next step:** The next CI run on this branch (or a human running `pnpm
--filter @saas/database migrate:deploy && pnpm db:seed && pnpm test` against a real
  local Postgres) will execute all 8 tests for real. If any fails, update this file
  with the real failure and its root cause before claiming Phase 3 done.
- **How to test:** `pnpm --filter @saas/database migrate:deploy && pnpm db:seed &&
pnpm test && pnpm db:check-consistency` against a real, disposable Postgres database.

### BUG-007: `login()` never checked for an unverified (`pending_verification`) account — the email-verification gate could be silently bypassed

- **Label:** Confirmed bug
- **Severity:** HIGH — an account whose email was never verified could sign in and
  use the application exactly as if it had been verified, defeating the entire point
  of the email-verification flow (e.g. confirming the email address is reachable and
  really belongs to the signer-upper) with no error, no warning, and no trace other
  than `emailVerifiedAt` being `null` on an otherwise-functioning account.
- **Status:** Fixed
- **Component/file:** `apps/api/src/auth/auth.service.ts`, method `login`
- **Exact location:** The sequence of status checks at the top of `login()` (checks
  for `locked`, `disabled`, `deleted` existed; `pending_verification` was never
  checked at all).
- **Problem:** `AuthService.login` validated credentials and several other status
  values but had no branch for `pending_verification` — the status every account
  starts in and stays in until `verifyEmail` succeeds.
- **Root cause:** When `login()` was first written (Phase 3), the status-check list
  was built against the enum's _other_ values (`locked`/`disabled`/`deleted`) as a
  blocklist, and `pending_verification` — being the _default_, not an edge case — was
  never added to it. The gap had no test exercising it until this phase's explicit
  checklist item 6 ("Unverified login") required writing one.
- **Trigger:** Sign up, skip verification entirely, log in with the correct password.
- **Impact:** Complete bypass of the email-verification security control for any
  account, from the moment of signup, prior to this fix.
- **Reproduction steps:** 1) `POST /auth/signup` with a new email/password. 2) Without visiting the verification link, `POST /auth/login` with the same
  credentials. 3) Observe a successful session is issued.
- **Expected behavior:** Login is rejected with a message telling the user to verify
  their email first.
- **Actual behavior:** Login succeeded, prior to this fix.
- **Why it happens:** See root cause.
- **Related components:** `PrincipalService.resolve` (checked separately and
  correctly rejects `disabled`/`deleted`/`locked`, but — same gap — never checked
  `pending_verification` either; not fixed there since the login-time check is
  sufficient to prevent an unverified session from ever being _issued_ in the first
  place, so `PrincipalService` never sees one post-fix).
- **Recommended fix (applied):** Added an explicit `pending_verification` check in
  `login()`, placed **after** password verification succeeds — checking status before
  confirming the password would let anyone probe whether an email is registered and
  unverified using any password at all, which is itself an enumeration vector this fix
  had to avoid introducing.
- **Regression risk:** Low — the added branch only narrows existing behavior (rejects
  a case that previously incorrectly succeeded); every other status/credential
  combination is unchanged. Verified via
  `apps/api/test/phase4-signup-verification.integration.spec.ts`'s "Unverified login"
  test (written, not yet executed against a real database — see the environment-
  limitation note above).
- **How to test the fix:** Sign up, attempt login before verifying, confirm it's
  rejected with the "verify your email" message (not the generic invalid-credentials
  message); confirm a _wrong_ password on the same unverified account still gets the
  generic message (proving the distinct message is unreachable without the correct
  password first).

### BUG-008: `login()` checked `locked`/`disabled`/`deleted` account status BEFORE verifying the password — the same enumeration side-channel as BUG-007, for three more statuses

- **Label:** Confirmed bug
- **Severity:** MEDIUM — narrower than BUG-007 (this didn't let anyone _in_, it only
  let an attacker learn an email's exact status — locked vs. disabled vs. merely
  wrong-password — without ever supplying the correct password), but it is the exact
  enumeration pattern `AUTH_RULES.md` and this phase's own spec explicitly call out.
- **Status:** Fixed
- **Component/file:** `apps/api/src/auth/auth.service.ts`, method `login`
- **Exact location:** The `locked`/`disabled`/`deleted` status checks, which ran
  immediately after the `user`-exists check and before `verifyPassword` was ever
  called.
- **Problem:** Submitting _any_ password for a known email returned a status-specific
  response (a locked account's distinct rejection, a disabled account's) regardless
  of whether the password was right — an attacker could fully enumerate which emails
  exist and their exact account status using the login endpoint alone, no valid
  credentials required.
- **Root cause:** Same root cause pattern as BUG-007 — status checks were written as
  an early blocklist ("get these out of the way first") rather than being deliberately
  sequenced after credential verification, which is the only point in this handler
  that doesn't trivially leak information to an unauthenticated caller.
- **Trigger:** `POST /auth/login` with a real (locked/disabled/deleted) account's
  email and literally any password.
- **Impact:** Full account-status enumeration via the login endpoint for any known or
  guessed email address, prior to this fix.
- **Reproduction steps:** 1) Lock an account (5 failed attempts). 2) `POST /auth/login`
  with that email and an obviously-wrong password. 3) Observe a "locked" response,
  distinct from the generic invalid-credentials response a nonexistent email gets.
- **Expected behavior:** Every unauthenticated login attempt against a real email
  gets the identical generic message until a correct password is supplied.
- **Actual behavior:** Status-specific responses leaked before credential checking,
  prior to this fix.
- **Why it happens:** See root cause.
- **Related components:** Directly caught and fixed alongside BUG-007 in the same
  `login()` rewrite — both are instances of "checked only after the password matches"
  from this phase's own task list, which is why writing this phase's tests surfaced
  both at once.
- **Recommended fix (applied):** Moved every account-state check (`disabled`/
  `deleted`/`locked`/`pending_verification`) to after `verifyPassword` succeeds, and
  added dummy-hash timing protection (`dummyHashPromise`) so even the
  exists/doesn't-exist distinction is no longer separable by response time.
- **Regression risk:** Low — purely a reordering plus one added timing-protection
  branch; every existing status/credential combination's final outcome is unchanged,
  only _when_ it's decided relative to the password check.
- **How to test the fix:** `apps/api/test/phase5-login.integration.spec.ts`'s locked/
  disabled/deleted tests all submit the correct password to reach the status check —
  written, not yet executed against a real database (see the environment-limitation
  note carried forward from Phases 3/4).

### BUG-009: `verifyOtp()` consumed a one-time code via a non-atomic `findFirst` + `update`, letting two concurrent correct submissions both succeed

- **Label:** Confirmed bug
- **Severity:** HIGH — this is exactly the "exactly one succeeds" guarantee Phase 6's
  own task list and test list require for a one-time code; failing it means a single
  OTP or magic-link token could be used to create two independent sessions, which for
  a code delivered over a channel with any chance of interception (email forwarding,
  a shared inbox, a slow network causing a user to double-submit) weakens the
  "single use" security property the whole mechanism exists to provide.
- **Status:** Fixed
- **Component/file:** `apps/api/src/auth/auth.service.ts`, method `verifyOtp` (the
  pre-existing implementation, before this phase's rewrite)
- **Exact location:** The code-consumption step at the end of `verifyOtp` — a
  `prisma.oneTimeToken.findFirst({ where: { ..., usedAt: null } })` followed by a
  separate `prisma.oneTimeToken.update({ where: { id: record.id }, data: { usedAt: new Date() } })`.
- **Problem:** Between the `findFirst` read and the `update` write there is a window
  in which a second, concurrent call with the same code can also pass the same
  `findFirst` (since neither call has written `usedAt` yet), so both calls proceed to
  `update` and both succeed — each issuing its own session.
- **Root cause:** The check-then-act sequence (`findFirst` to decide validity, then a
  separate `update` to mark it used) is not atomic at the database level; Postgres
  gives no isolation between the two statements unless they are combined into one
  conditional write. This is a textbook TOCTOU (time-of-check to time-of-use) race,
  and this phase's explicit test requirement ("concurrent use of one code, exactly
  one succeeds") was written specifically to catch exactly this class of bug.
- **Trigger:** Two requests hitting `POST /auth/otp/verify` (or the magic-link
  equivalent) with the same valid, unused code/token at nearly the same time — e.g. a
  user double-clicking "Verify," a retried request after a slow/ambiguous response, or
  a deliberate replay attempt timed to race the original.
- **Impact:** Prior to this fix, a single one-time code could issue more than one
  session, undermining the "single use" guarantee required by task 2 ("Single use,
  marked used atomically") and checklist item 7 ("OTP replay prevention").
- **Reproduction steps:** 1) Request an OTP. 2) Fire two `verifyOtp` calls with the
  identical correct code via `Promise.allSettled` (no `await` between them). 3) Prior
  to the fix, observe both resolve successfully with distinct session tokens.
- **Expected behavior:** Exactly one of the two concurrent calls succeeds; the other
  is rejected with the same "invalid or expired" response as any other failed
  verification (enumeration-safe — it must not reveal "someone else already used
  this").
- **Actual behavior:** Both succeeded, prior to this fix.
- **Why it happens:** See root cause.
- **Related components:** The same non-atomic pattern did not exist in
  `verifyEmail`/`resetPassword` (Phase 4), which already used this correct atomic
  pattern — `verifyOtp` was the one method that had drifted from it, which is why this
  phase's dedicated concurrency test was written to check explicitly rather than
  assuming consistency across sibling methods. The new `verifyMagicLink` (Phase 6) was
  written directly against the corrected pattern from the start, so it was never
  exposed to this bug.
- **Recommended fix (applied):** Replaced the `findFirst` + `update` pair with a
  single atomic `prisma.oneTimeToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } })`, then checked `result.count === 0` to detect
  and reject the losing racer. Postgres's row-level locking during the `UPDATE`
  guarantees only one concurrent caller can match `usedAt: null` and complete the
  write; the other sees `count === 0` and is rejected. The same pattern was reused
  for `verifyMagicLink`.
- **Regression risk:** Low — the external behavior for the non-concurrent (overwhelming
  majority) case is unchanged; the only behavioral difference is specifically in the
  concurrent-race case, which previously succeeded incorrectly and now correctly
  rejects the loser.
- **How to test the fix:** `apps/api/test/phase6-otp.integration.spec.ts`'s "lets
  exactly one of two concurrent verifications with the same code succeed" test (and
  its magic-link equivalent) — written as a real (non-mocked) integration test using
  `Promise.allSettled`, structured to skip cleanly via `isDatabaseReachable()` since no
  live database is available in this session; status is Requires manual verification,
  not Confirmed working, per AUTH_RULES.md rule 13.

### BUG-010: Log-redaction key matching used exact-match, silently letting `accessToken`/`refreshToken`/`csrfToken` bypass redaction

- **Label:** Confirmed bug
- **Severity:** MEDIUM — the redaction list already covered the literal words
  `token`/`refresh`/`secret`/etc., so the intent was clearly to catch exactly these
  field names; the compound names an actual session-token field would realistically
  be called (`accessToken`, `refreshToken`) were the ones that slipped through,
  which is the worst case for a redaction allowlist — it fails exactly where it
  matters most, silently, with no error or warning.
- **Status:** Fixed
- **Component/file:** `packages/observability/src/redact.ts`, function `deepRedact`
- **Exact location:** The matching check `SENSITIVE_KEYS.has(normalizeKey(key))` —
  an exact-equality lookup against a `Set` of single words.
- **Problem:** `normalizeKey("accessToken")` produces `"accesstoken"`, and
  `normalizeKey("refreshToken")` produces `"refreshtoken"` — neither equals the
  literal strings `"token"` or `"refresh"` already in `SENSITIVE_KEYS`, so neither
  key was ever redacted, despite the redaction list's own stated intent ("token,"
  "refresh") obviously being written with exactly these kinds of fields in mind.
- **Root cause:** The original design matched on exact normalized key equality,
  which works for a field literally named `token` but not for any compound name
  built around that word — a single-word allowlist checked by `===` can never catch
  a two-word compound unless every compound is listed individually, which doesn't
  scale and wasn't attempted.
- **Trigger:** Any `logger.error`/`logger.info`/etc. call anywhere in the codebase
  that logs an object with a key literally named `accessToken`, `refreshToken`, or
  similarly compound-around-a-sensitive-word name — none currently exist in
  `auth.service.ts`'s own logging calls (verified: it logs `err`/`requestId`/
  `userId` only), so this was a **latent** gap, not one with a known live
  exploitation path in the current codebase, but exactly the kind of gap a future
  change (e.g. a debug log added during incident response) could trip over
  silently.
- **Impact:** If ever triggered, a token value would appear in plaintext in
  structured logs — a direct violation of AUTH_RULES rule 4.
- **Reproduction steps:** 1) Call `deepRedact({ accessToken: "secret-value" })`
  (prior to the fix). 2) Observe the result's `accessToken` field is the raw
  value, not `[redacted]`.
- **Expected behavior:** Any key whose normalized form contains a listed sensitive
  keyword is redacted, regardless of what else is concatenated onto it.
- **Actual behavior:** Only an exact match was redacted, prior to this fix.
- **Why it happens:** See root cause.
- **Related components:** None — isolated to `deepRedact`'s own matching logic;
  every call site (the pino logger's `deepRedact` hook, and any direct caller)
  benefits from the fix with no change needed on their end.
- **Recommended fix (applied):** Replaced the exact-match `Set.has` check with
  `isSensitiveKey()`, which checks whether the normalized key **contains** any
  listed keyword as a substring, not just equals one.
- **Regression risk:** Low — strictly widens what gets redacted; the existing
  "leaves non-sensitive values untouched" test (`id`, `status`, `count`) still
  passes unchanged, confirming no innocuous field name accidentally contains one
  of the 10 keywords.
- **How to test the fix:** `packages/observability/src/redact.spec.ts`'s new
  "redacts compound key names built around a sensitive word (BUG-010)" test —
  actually run, no database needed.

### BUG-011: `SessionGuard` read the session cookie name from `process.env` directly, bypassing the validated/defaulted config

- **Label:** Confirmed bug
- **Severity:** LOW — the default value happened to match (`"app_session"` either
  way), so this had no observable effect before Phase 7; it became a real problem
  only once Phase 7 introduced the `__Host-` prefix, which is computed from several
  env inputs together (`AUTH_SESSION_COOKIE_NAME` + `secure` + `domain`) in
  `cookie-names.ts` — `SessionGuard`'s direct `process.env` read had no way to
  apply that same computed prefix, so it would have looked for the wrong cookie
  name entirely as soon as the prefix applied (any non-local environment).
- **Status:** Fixed
- **Component/file:** `apps/api/src/auth/session.guard.ts`, method `canActivate`
- **Exact location:** `const cookieName = process.env.AUTH_SESSION_COOKIE_NAME ?? "app_session";`
- **Problem:** Every other cookie-name read in the codebase (the controller's
  `setSessionCookies`/`clearSessionCookies`/`resolveExistingSessionId`) went
  through `loadPrivateEnv()`'s validated, defaulted config; this one call site
  read straight from `process.env`, skipping validation and, after this phase,
  skipping the `__Host-` prefix computation entirely.
- **Root cause:** Written before the controller's own helper functions existed in
  their current form; never revisited to match once the pattern was established
  elsewhere.
- **Trigger:** Any environment where `AUTH_SESSION_COOKIE_NAME` differs from its
  default, OR (after this phase) any non-local environment where the `__Host-`
  prefix applies — in either case this guard would never find the cookie the
  controller actually set, rejecting every authenticated request with "Authentication
  required."
- **Impact:** Complete, silent lockout of every user in any environment where the
  computed cookie name differs from the literal `process.env.AUTH_SESSION_COOKIE_NAME`
  value (or its hardcoded fallback) — caught during this phase's own implementation
  work, before being exercised against a real deployment.
- **Reproduction steps:** 1) Deploy with `APP_ENV` set to something other than
  `"local"` (so `isSecureCookies` is true) and no `API_COOKIE_DOMAIN` set (so the
  `__Host-` prefix applies). 2) Log in successfully (cookie is set as
  `__Host-app_session`). 3) Call any `SessionGuard`-protected route. 4) Prior to the
  fix, observe a 401 even with a valid, unexpired session — the guard was looking
  for a cookie named `app_session`, which was never set.
- **Expected behavior:** The guard finds the cookie under whatever name the
  controller actually used to set it.
- **Actual behavior:** Lockout, prior to this fix.
- **Why it happens:** See root cause.
- **Related components:** `apps/api/src/auth/cookie-names.ts` (new in this phase) —
  now the single source of truth every cookie-reading/writing call site uses.
- **Recommended fix (applied):** Replaced the direct `process.env` read with the
  shared `sessionCookieName` export from `cookie-names.ts`.
- **Regression risk:** Low — this makes the guard agree with the controller, which
  is strictly more correct; the only behavior change is fixing the
  previously-latent mismatch.
- **How to test the fix:** No dedicated automated test (would need a running HTTP
  server + a non-local `APP_ENV` to exercise the `__Host-` prefix path) — Requires
  manual verification; covered implicitly by any `SessionGuard`-protected
  integration test passing with the shared cookie name once a real server is
  stood up.

### Potential risk: idle-timeout enforcement is scoped to protected-resource access, not to every authenticated request including `/auth/refresh`

- **Label:** Potential risk
- **Severity:** LOW — this is a documented design choice, not a defect; flagging it
  because a stricter reading of "idle timeout... enforced on the server" is
  plausible and a future phase or reviewer might expect it.
- **Status:** Requires manual verification (this is a design decision to confirm
  with the human, not a bug to fix)
- **Component/file:** `apps/api/src/auth/session.guard.ts` (touches/checks
  `lastUsedAt`) vs. `apps/api/src/auth/auth.service.ts` `refresh()` (does not)
- **Problem:** `SessionGuard` updates and checks `lastUsedAt` on every
  protected-route request, but `refresh()` does neither — a client that only ever
  calls `POST /auth/refresh` on a timer, without ever calling a protected route,
  keeps its refresh-token chain alive indefinitely without ever tripping the idle
  timeout, because nothing about that activity pattern ever touches `lastUsedAt`.
- **Root cause:** "Idle" was interpreted as "unused for its actual purpose"
  (accessing protected resources), not "the client process is still alive and
  calling the API at all." Both are defensible readings of the task's wording.
- **Trigger:** A client (malicious or just a buggy keep-alive loop) that calls
  `/auth/refresh` on an interval shorter than `AUTH_REFRESH_TOKEN_TTL` without ever
  calling anything else.
- **Impact:** A session could remain refreshable indefinitely despite the user
  never actually using the application, which is the scenario idle-timeout exists
  to prevent.
- **Reproduction steps:** 1) Log in. 2) Script a loop that calls `POST
/auth/refresh` every `AUTH_IDLE_TIMEOUT_SECONDS / 2` seconds, never calling any
  other endpoint. 3) Observe the session never gets idle-timed-out.
- **Expected behavior:** Depends on the intended semantics — not yet confirmed with
  the human.
- **Recommended fix (if the stricter reading is wanted):** Have `refresh()` also
  check and update `lastUsedAt` (or a separate `lastRefreshedAt`), rejecting a
  refresh whose session has been idle (by that measure) too long.
- **Regression risk:** N/A — no fix has been applied; this is flagged for a future
  decision.
- **How to test:** N/A until a decision is made on which semantics are intended.

### BUG-012: `resetPassword()` consumed a reset token via a non-atomic read-then-write, letting two concurrent submissions of the same token both succeed

- **Label:** Confirmed bug
- **Severity:** HIGH — identical in shape and impact to BUG-009 (OTP), applied to
  password reset: the "single use" guarantee a reset token exists to provide could
  be defeated by two concurrent submissions, each changing the password and
  revoking sessions independently, which is exactly the race this phase's own test
  requirement ("two simultaneous submits with one token, exactly one succeeds")
  exists to catch.
- **Status:** Fixed
- **Component/file:** `apps/api/src/auth/auth.service.ts`, method `resetPassword`
  (the Phase 4 implementation, before this phase's rewrite)
- **Exact location:** The sequence `if (record.usedAt) throw ...` (a read-only
  check) followed much later by `prisma.oneTimeToken.update({ where: { id: record.id }, data: { usedAt: new Date() } })` inside a `$transaction` array — the
  `update` only matches on `id`, not `usedAt: null`, so it unconditionally
  succeeds regardless of what another concurrent call already did.
- **Problem:** Between the `usedAt` check and the `update`, a second concurrent
  call with the same token can pass the same check before either call writes
  `usedAt`, so both proceed to update the password hash and revoke sessions.
- **Root cause:** Same TOCTOU (time-of-check to time-of-use) pattern already
  identified and fixed for OTP in BUG-009 — a check-then-act sequence split across
  two separate statements has no atomicity guarantee from Postgres unless combined
  into one conditional write.
- **Trigger:** Two requests hitting `POST /auth/password-reset/confirm` with the
  same valid, unused token at nearly the same time — a double-click on "Reset
  password," a retried request after an ambiguous network response, or a
  deliberate replay timed to race the original.
- **Impact:** Prior to this fix, a single reset link could be used to set the
  password twice (last-write-wins, non-deterministic which password "wins"),
  undermining task 4's "mark the token used atomically so only one concurrent
  request proceeds."
- **Reproduction steps:** 1) Request a password reset. 2) Fire two
  `resetPassword` calls with the identical token via `Promise.allSettled` (no
  `await` between them), each with a different new password. 3) Prior to the fix,
  observe both could resolve successfully.
- **Expected behavior:** Exactly one of the two concurrent calls succeeds; the
  other is rejected with the same `RESET_TOKEN_USED` response as any other
  already-consumed token (enumeration-safe — it must not reveal "someone else
  just used this").
- **Actual behavior:** Both could succeed, prior to this fix.
- **Why it happens:** See root cause.
- **Related components:** Identical pattern/fix to BUG-009 (`verifyOtp`) and the
  refresh-token rotation logic (Phase 7) — all three now use the same atomic
  `updateMany` guarded by the one-time-use field being `null` at the moment of
  the write, not just at an earlier read.
- **Recommended fix (applied):** Replaced the plain `update` with
  `prisma.oneTimeToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } })`, checking `result.count === 0` to detect and
  reject the losing racer, before proceeding to the password-hash/session-revoke
  transaction.
- **Regression risk:** Low — the non-concurrent (overwhelming majority) case is
  unchanged; only the concurrent-race case's outcome changes, from "both
  incorrectly succeed" to "exactly one correctly succeeds."
- **How to test the fix:** `apps/api/test/phase8-password-reset.integration.spec.ts`'s
  "lets exactly one of two concurrent resetPassword submissions with the same
  token succeed" test — written as a real (non-mocked) integration test,
  structured to skip cleanly via `isDatabaseReachable()` since no live database is
  available in this session; status is Requires manual verification, not
  Confirmed working, per AUTH_RULES.md rule 13.

### BUG-013: `POST /auth/password-reset/confirm` had no rate limiting at all

- **Label:** Confirmed bug
- **Severity:** MEDIUM — a 32-byte token is not practically guessable, so this is
  not a token-guessing vulnerability in the cryptographic sense, but an unthrottled
  endpoint that accepts a token and a password is still an unnecessary amplifier
  for any other weakness (e.g. a leaked/logged token, or simple resource
  exhaustion) — every other sensitive unauthenticated endpoint in this codebase
  (`/otp/verify`, `/magic-link/verify`, `/password-reset/request` itself) has a
  `@Throttle` decorator; this one, alone, did not.
- **Status:** Fixed
- **Component/file:** `apps/api/src/auth/auth.controller.ts`, method
  `resetPassword` (route `POST /auth/password-reset/confirm`)
- **Exact location:** The handler had no `@Throttle(...)` decorator at all, unlike
  every sibling confirm/verify endpoint.
- **Problem:** No per-IP request limit on this route.
- **Root cause:** Likely an oversight when the endpoint was first written in
  Phase 4 — `/password-reset/request` got a `@Throttle` (5/60s), and its
  natural pair, `/password-reset/confirm`, didn't.
- **Trigger:** Any sustained request volume against this endpoint.
- **Impact:** No defense-in-depth rate limit on a sensitive unauthenticated
  endpoint, prior to this fix.
- **Reproduction steps:** 1) Send 100 requests/second to
  `POST /auth/password-reset/confirm` with garbage tokens. 2) Prior to the fix,
  observe no 429 responses at any volume.
- **Expected behavior:** The same per-IP throttling discipline applied to every
  other confirm/verify endpoint.
- **Actual behavior:** Unthrottled, prior to this fix.
- **Why it happens:** See root cause.
- **Related components:** None — isolated to this one route's decorator.
- **Recommended fix (applied):** Added `@Throttle({ default: { limit: 10, ttl: 60_000 } })`, matching the OTP/magic-link verify endpoints' limit.
- **Regression risk:** Low — a legitimate user submits this form once per reset
  attempt; 10 requests/60s has no realistic chance of blocking normal use.
- **How to test the fix:** No dedicated automated test (would need a running HTTP
  server and the Redis-backed throttler wired up) — Requires manual verification;
  written steps: send 11+ requests/minute from one IP, confirm the 11th gets 429.

### Potential risk: `requestPasswordReset` is not fully timing-safe between known and unknown emails

- **Label:** Potential risk
- **Severity:** LOW — this is the same shape of limitation already present (and
  previously accepted without a fix) in `resendVerification` and `requestOtp`;
  flagging it here because this phase's own task list explicitly says "same
  response and similar timing for all emails," which is a stronger claim than
  "same response" alone.
- **Status:** Requires manual verification (an honest limitation, not something
  this phase's change claims to have fully solved)
- **Component/file:** `apps/api/src/auth/auth.service.ts`, method
  `requestPasswordReset`
- **Problem:** The unknown/deleted-account branch now does a LITTLE extra work
  (generates and hashes a 32-byte token, discarding both) to narrow the timing gap
  against the real branch (which also writes to the database and enqueues an
  email job), but this is not a true constant-time guarantee — the real branch
  still does strictly more work (a DB write, a cooldown lookup, a queue `add`
  call) than the fake branch does.
- **Root cause:** Unlike `login()`'s dummy-hash protection — which works because
  argon2id hashing is deliberately, overwhelmingly the slowest operation in that
  function, so matching its cost on both branches closes the gap almost
  completely — there is no single dominant slow operation in `requestPasswordReset`
  to equalize against; the remaining asymmetry is a handful of fast operations
  (one DB write, one Redis round trip) that a sufficiently sensitive timing
  measurement could still in principle distinguish.
- **Recommended fix (if full timing-safety is required):** Add an artificial,
  calibrated delay to the fake branch sized to match the real branch's typical
  total latency — introduces its own complexity (the delay must track the real
  branch's cost as that cost changes, e.g. if Redis latency grows) and was judged
  out of scope for this phase without a human decision on how much engineering
  effort this residual, narrow timing side-channel warrants.
- **Regression risk:** N/A — no further fix applied this phase.
- **How to test:** N/A until a decision is made on whether the residual gap
  warrants a calibrated-delay fix.

### BUG-014: `OAuthController`'s link-mode session check initially used a bare JWT decode with no signature verification

- **Label:** Confirmed bug
- **Severity:** CRITICAL (as initially written; never shipped/committed) —
  this is a textbook authentication bypass: anyone could forge a
  `{sub: "<any user id>"}` JWT payload (no valid signature required, since
  `jwt.decode()` performs zero verification) and have the OAuth "link a new
  provider to my account" flow treat it as that user, letting an attacker
  link an arbitrary OAuth identity to ANY victim's account purely by crafting
  an unsigned-but-correctly-shaped cookie value.
- **Status:** Fixed (caught during this phase's own implementation, before
  any commit)
- **Component/file:** `apps/api/src/auth/oauth/oauth.controller.ts`, method
  `start` (the `mode === "link"` branch)
- **Exact location:** A first-draft private helper that called
  `jwt.decode(token)` (not `jwt.verify`) and trusted the resulting `sub`
  claim directly as the user to link the new provider identity to.
- **Problem:** `jwt.decode()` parses a JWT's payload without checking its
  signature at all — it will happily "decode" a token with a garbage or
  missing signature, or one signed by a completely different key, as long as
  the payload is syntactically a JWT. There is no cryptographic guarantee the
  token was ever actually issued by this server.
- **Root cause:** Written as a quick stand-in to avoid a circular import back
  into `AuthController` for its (also private) `resolveExistingSessionId`
  helper, and the quick version used the wrong jsonwebtoken function
  (`decode` instead of `verify`) — an easy mistake because both return the
  same-shaped payload object on success, so the code "worked" in casual
  testing with a legitimately-issued cookie.
- **Trigger:** Any request to `GET /auth/oauth/:provider/start?mode=link`
  carrying a cookie whose value is a JWT-shaped (three dot-separated base64url
  segments) string with an arbitrary `sub` claim — no valid signature needed.
- **Impact:** Complete authentication bypass of the "linking requires an
  already-authenticated caller" guarantee, had this shipped — an attacker
  could link a provider identity THEY control to a VICTIM's account, which
  (depending on how account recovery/password-reset interacts with linked
  providers in a later phase) could be a path to full account takeover.
- **Reproduction steps (of the vulnerable draft, not the shipped code):**
  1. Construct `header.payload.` with `payload` decoding to `{"sub": "<victim-user-id>"}` and any garbage/empty signature segment. 2) Set it as the session
     cookie. 3) Call `/auth/oauth/google/start?mode=link`. 4) The draft code would
     have accepted `<victim-user-id>` as the authenticated caller with no
     signature check at all.
- **Expected behavior:** Only a cookie containing a genuinely
  signed-by-this-server, unexpired, non-revoked access token should ever
  resolve to a user id for linking.
- **Actual behavior:** N/A — never shipped; caught in review before being
  committed (same category as the Phase 7 dashboard-error `redirect()`
  control-flow note: "a bug worth documenting even though it was caught
  before being committed").
- **Why it happens:** See root cause.
- **Related components:** `AuthService.verifyAccessToken` (Phase 7) already
  existed and does full RS256 signature + issuer/audience/expiry/nonce
  validation — the fix was simply to call that instead of hand-rolling a
  second, weaker check.
- **Recommended fix (applied):** Replaced the bare `jwt.decode()` call with
  `this.authService.verifyAccessToken(token).userId`, injecting `AuthService`
  into `OAuthController`'s constructor. Removed the now-dead helper method and
  its `require("jsonwebtoken")`/`eslint-disable` workaround entirely.
- **Regression risk:** None — this was never in a committed state; the fix
  simply uses the same verification every other `SessionGuard`-protected
  route already relies on.
- **How to test the fix:** No dedicated automated test specifically targets
  "a forged/unsigned cookie is rejected for linking" (would duplicate
  `AuthService.verifyAccessToken`'s own test coverage from Phase 7's
  `phase7-tokens.spec.ts`, which already covers forged/malformed/wrong-key
  tokens exhaustively) — Requires manual verification via a running server:
  send `mode=link` with a cookie containing an unsigned JWT-shaped value,
  confirm a redirect to `link_session_missing`, never a successful link.

### Potential risk: a successful OAuth email collision deliberately reveals that an account exists

- **Label:** Potential risk (a documented, task-mandated exception — not a
  bug)
- **Severity:** LOW — the behavior is explicitly specified by this phase's
  own task list, not an accidental enumeration leak; flagging it only because
  every OTHER flow in this codebase (password reset, signup, OTP) goes out of
  its way to be enumeration-safe, and a future reviewer might otherwise
  assume this is inconsistent by mistake rather than by design.
- **Status:** Requires manual verification (confirmed intentional per spec,
  not something to "fix")
- **Component/file:** `apps/api/src/auth/oauth/oauth.service.ts`,
  `resolveIdentity` (the `existingUser` branch), and
  `apps/web/src/app/oauth/error/error-client.tsx` (the `email_collision`
  message)
- **Problem:** When an OAuth identity's verified email matches an EXISTING
  account, the response (`{ kind: "error", code: "email_collision" }`, and
  the frontend copy "An account already exists with this email...") directly
  confirms an account exists for that email — something every other flow in
  this codebase (password reset, signup, change-password) is carefully
  designed never to reveal.
- **Root cause / why it happens:** Task 5 explicitly specifies this exact UX:
  "An email collision with an existing account never auto links. The user
  signs in to the existing account, then links from settings." Telling the
  user to "sign in to the existing account" necessarily implies one exists —
  there's no way to give that instruction without revealing the fact it's
  based on.
- **Impact:** An attacker could probe arbitrary emails via any configured
  OAuth provider's consent screen to learn which ones have existing accounts
  on this app — a slower, more visible enumeration vector than a timing
  attack (it requires completing an OAuth consent flow per guess, which rate
  limiting and the OAuth provider's own abuse detection both make
  impractical at scale, but it is still a confirmed information disclosure
  by design).
- **Recommended fix:** None recommended — this is working as specified.
  If a stricter enumeration-safety posture is wanted for this flow
  specifically, the task's own UX requirement would need to change first
  (e.g. to a generic "couldn't sign you in with that provider — try signing
  in with your password instead" message that never distinguishes collision
  from any other failure).
- **How to test:** `apps/api/test/phase9-oauth.integration.spec.ts`'s "never
  auto-links on an email collision with an existing account" test confirms
  the CODE path; the frontend message is unverified in an actual browser
  this session.

### BUG-015: `ForbiddenError` fell through to the generic exception branch and returned HTTP 500 instead of 403

- **Label:** Confirmed bug
- **Severity:** HIGH — every permission-denied case in the codebase that
  uses `assertPermission` returned a 500 Internal Server Error instead of a
  403 Forbidden, misreporting a routine authorization failure as a server
  fault, and giving the client no structured `code` to branch on.
- **Status:** Fixed
- **Component/file:** `apps/api/src/common/all-exceptions.filter.ts`
- **Exact location:** `AllExceptionsFilter.catch` — the `instanceof Error`
  branch, which ran for `ForbiddenError` too since it was never checked for
  specifically.
- **Problem:** `ForbiddenError` (from `@saas/authorization`, used by
  `assertPermission`) is a plain `Error` subclass, not a Nest
  `HttpException`. `AllExceptionsFilter` only special-cased `HttpException`
  and a couple of other named error types; anything else — including
  `ForbiddenError` — fell through to a generic `instanceof Error` branch
  that always set `status = 500`.
- **Root cause:** `ForbiddenError` was introduced in an earlier phase as a
  plain `Error` (not extending `HttpException`), and at the time
  `assertPermission` had exactly one call site (`profile.controller.ts`),
  so the 500-instead-of-403 misclassification existed but had limited
  reach. This phase's new `PermissionsGuard`/`@RequirePermission` pattern
  was expected to make `assertPermission` failures common on every
  permission-protected route going forward, surfacing the bug's blast
  radius before it spread further.
- **Trigger:** Any call to `assertPermission(principal, permission)` where
  `principal` lacks `permission` — i.e. any authenticated-but-forbidden
  request to a route guarded by `PermissionsGuard` or calling
  `assertPermission` directly.
- **Impact:** Clients saw a 500 for what is actually a routine, expected
  authorization failure — breaking any client-side logic that branches on
  403 specifically (e.g. redirecting to a "forbidden" page), and polluting
  error-rate monitoring/alerting with authorization failures misclassified
  as server faults.
- **Reproduction steps:**
  1. Authenticate as a user lacking a given permission. 2. Call a route
     protected by `@RequirePermission(<that permission>)` (e.g.
     `GET /profile/me` with a principal lacking `profile.read.own`). 3.
     Observe `500` instead of the expected `403`.
- **Expected behavior:** A `ForbiddenError` should produce HTTP 403 with
  `code: "FORBIDDEN"`.
- **Actual behavior (before fix):** HTTP 500 with the generic internal-error
  response shape.
- **Why it happens:** See root cause — `ForbiddenError` was never one of
  `AllExceptionsFilter`'s recognized exception types.
- **Related components:** `PermissionsGuard`, `@RequirePermission`
  (both new this phase) — this bug would have affected every route using
  them, not just `profile.controller.ts`'s pre-existing inline
  `assertPermission` calls.
- **Recommended fix (applied):** Added an explicit
  `else if (exception instanceof ForbiddenError)` branch in
  `AllExceptionsFilter.catch` before the generic `instanceof Error` branch,
  setting `status = HttpStatus.FORBIDDEN`, `code = exception.code`,
  `message = exception.message`.
- **Regression risk:** Low — the new branch is strictly more specific than
  the generic `Error` branch it was added before, and only changes behavior
  for `ForbiddenError` instances specifically.
- **How to test the fix:** `apps/api/test/all-exceptions-filter.spec.ts`
  (new test: `filter.catch(new ForbiddenError(), host)` asserts `status`
  called with 403 and `body.code === "FORBIDDEN"`) — actually run, 6/6
  passing.

### BUG-016: `apps/web`'s middleware hardcoded the unprefixed session cookie name, breaking auth detection in any environment using `__Host-` prefixing

- **Label:** Confirmed bug
- **Severity:** HIGH — in any non-local environment (any deployment with
  HTTPS and no explicit cookie `Domain`, which is the expected production
  configuration per Phase 7's `cookieName` helper), the middleware would
  never recognize a signed-in user, redirecting every protected-page
  visit to `/login` regardless of actual auth state.
- **Status:** Fixed
- **Component/file:** `apps/web/src/middleware.ts`
- **Exact location:** The original cookie-presence check:
  `request.cookies.get("app_session")`.
- **Problem:** Phase 7 introduced `__Host-` cookie-prefixing (applied
  whenever a cookie is `Secure` with no `Domain` attribute — see
  `packages/security/src/index.ts`'s `cookieName` helper) — meaning the
  REAL session cookie name in production is `__Host-app_session`, not the
  literal string `"app_session"` this middleware checked for.
- **Root cause:** The middleware was written before (or without
  cross-referencing) Phase 7's cookie-prefixing logic, and hardcoded the
  base name as a literal string rather than deriving it the same way the
  API does.
- **Trigger:** Any production-shaped deployment (HTTPS, no cookie `Domain`
  attribute) — i.e. the expected normal production configuration, not an
  edge case.
- **Impact:** Every protected-page visit by a legitimately signed-in user
  would hit this middleware's outer cookie check, find no cookie named
  exactly `"app_session"`, and redirect to `/login` — effectively locking
  every user out of every protected `apps/web` page in production, despite
  a perfectly valid session existing. (Caught before this ever reached a
  real deployment — no production environment with real HTTPS has been
  stood up in this workstream yet.)
- **Reproduction steps:**
  1. Configure the API with `secure: true` and no cookie `Domain` (the
     production default), so the session cookie is actually set as
     `__Host-app_session`. 2. Sign in successfully (a valid `__Host-
app_session` cookie is set). 3. Visit any protected `apps/web` page
     (e.g. `/dashboard`). 4. The middleware's `request.cookies.get
("app_session")` returns `undefined` (wrong name), so it redirects to
     `/login` despite the valid session.
- **Expected behavior:** The middleware should recognize a session cookie
  under whichever name it actually has — prefixed or not.
- **Actual behavior (before fix):** Redirected to `/login` whenever the
  cookie was `__Host-`-prefixed.
- **Why it happens:** See root cause.
- **Related components:** `packages/security/src/index.ts`'s `cookieName`
  (Phase 7); `apps/admin/src/middleware.ts` (new this phase, written
  correctly from the start using the same dual-name check).
- **Recommended fix (applied):** Added
  `NEXT_PUBLIC_SESSION_COOKIE_NAME` to `packages/config`'s
  `publicEnvSchema` (defaulting to `"app_session"`), and rewrote the
  middleware's check as `hasSessionCookie(request)`, which checks both
  `request.cookies.has(SESSION_COOKIE_BASE_NAME)` and
  `request.cookies.has(\`__Host-${SESSION_COOKIE_BASE_NAME}\`)`.
- **Regression risk:** Low — strictly widens what the middleware accepts
  (checks two names instead of one); cannot newly reject a cookie it
  previously accepted.
- **How to test the fix:** No automated test exists for Next.js middleware
  directly in this monorepo (no apps/web test runner is configured at
  all) — Requires manual verification: set a `__Host-app_session` cookie
  in a browser, confirm a protected page is NOT redirected to `/login`.

### Caught pre-ship: `resolveAuthRedirect`'s first draft could redirect an authenticated visitor on `/login` back to `/login`

- **Label:** Confirmed bug (caught during this phase's own implementation,
  before any commit — same category as BUG-014 in Phase 9)
- **Severity:** MEDIUM as drafted (never shipped/committed) — a genuine
  redirect loop is a checklist-violating, user-facing defect (checklist
  task 6: "login never redirects to login"), though not a security
  vulnerability on its own.
- **Status:** Fixed (caught by this function's own exhaustive test suite
  before it was ever used in a real page)
- **Component/file:** `packages/security/src/index.ts`, `resolveAuthRedirect`
- **Exact location:** The `isLoginPage` branch's first draft:
  `return { redirectTo: safeReturnTo(input.next) }` with no exclusion for
  `/login` itself.
- **Problem:** `?next=/login` is a syntactically "safe" relative path per
  `isSafeRelativePath`'s own rules (single leading slash, no backslash, no
  control characters) — nothing about it looks malicious. But using it
  as-is would send an authenticated visitor who hit `/login?next=/login`
  straight back to `/login`, the exact 2-page loop checklist item 10 exists
  to prevent.
- **Root cause:** "Syntactically safe" and "semantically sensible at this
  specific call site" were conflated in the first draft — `safeReturnTo`
  correctly validates that a string is a safe-shaped relative path, but
  has no way to know that `/login` specifically is never a sensible
  redirect target FROM the login page itself; that exclusion has to be
  applied by the caller.
- **Trigger:** An authenticated visitor loading `/login?next=/login` (or
  any `?next=` value starting with `/login`).
- **Impact:** Would have created a redirect loop for that specific query
  string — never actually reachable by an ordinary user, but constructible
  by anyone who crafted the URL, and a real violation of the "cannot loop"
  invariant this function exists to guarantee.
- **Reproduction steps (of the vulnerable draft, not the shipped code):**
  1. Call `resolveAuthRedirect({ isLoginPage: true, requiresAuth: false,
isAuthenticated: true, currentPath: "/login", next: "/login" })`. 2.
     The draft returned `redirectTo: "/login"` — a loop.
- **Expected behavior:** Redirecting FROM the login page must never target
  the login page itself, for any input.
- **Actual behavior:** N/A — never shipped; caught by the function's own
  "never redirects FROM the login page back TO the login page, for any
  input combination" test (`packages/security/src/index.spec.ts`), which
  iterates every `(isAuthenticated, next)` combination including `"/login"`
  and `"/login?x=1"`, before this function was ever called from a real
  page.
- **Why it happens:** See root cause.
- **Related components:** Both real call sites (`requireUser()` in
  apps/web and apps/admin, and the login page's own "already signed in?"
  check) delegate to this one function specifically so this class of bug
  has one place to be exhaustively tested rather than two independently
  written implementations hoped to stay in sync.
- **Recommended fix (applied):** Added an explicit check:
  `target === "/login" || target.startsWith("/login?")` falls back to
  `/dashboard` instead of being returned as-is.
- **Regression risk:** None — never in a committed state; the fix only
  narrows what this one branch can return, and the exhaustive test suite
  covers the exclusion directly.
- **How to test the fix:** `packages/security/src/index.spec.ts` — actually
  run, including the specific `"/login"`/`"/login?x=1"` cases in the
  exhaustive test.

### BUG-017: Verification token lifetime was hardcoded to 24 hours, not configurable

- **Label:** Confirmed bug
- **Severity:** LOW — functionally correct at the default value; purely a
  configurability gap, not a security or correctness defect.
- **Status:** Fixed
- **Component/file:** `apps/api/src/auth/auth.service.ts`, `sendVerificationEmail()`
- **Exact location:** `issueOneTimeToken(userId, "verify_email", 60 * 60 * 24)`
- **Problem:** Stage 4 feature #57 requires the verification TTL be
  "24 hours (configurable)." The value was a literal expression, not read
  from environment configuration, so it could only be changed by editing
  source code.
- **Root cause:** No `AUTH_VERIFICATION_TOKEN_TTL_SECONDS` env var existed
  in `packages/config`'s private env schema at the time this code was
  written.
- **Trigger:** Any deployment wanting a non-24h verification window.
- **Impact:** Low — no incorrect behavior at the default; only blocks
  operators from tuning the window without a code change/redeploy.
- **Reproduction steps:** 1. Search `auth.service.ts` for the TTL value. 2. Observe it is a numeric literal, not `env.*`.
- **Expected behavior:** TTL configurable via environment variable.
- **Actual behavior (before fix):** Hardcoded, not configurable.
- **Why it happens:** See root cause.
- **Related components:** `packages/config/src/index.ts`, `.env`, `.env.example`.
- **Recommended fix (applied):** Added `AUTH_VERIFICATION_TOKEN_TTL_SECONDS`
  (default `86400`) to `packages/config`'s private env schema and to
  `.env`/`.env.example`; `sendVerificationEmail()` now reads
  `env.AUTH_VERIFICATION_TOKEN_TTL_SECONDS` instead of the literal.
- **Regression risk:** Low — default value unchanged (86400s = 24h);
  behavior is identical unless an operator explicitly overrides the env var.
- **How to test the fix:** `apps/api/test/phase4-signup-verification.integration.spec.ts`
  covers the expired-token path; `@saas/config`/`@saas/api` typecheck pass.
  Requires manual verification for a non-default TTL value (no
  Docker/Postgres available in this environment to run the integration
  suite against a real database).

### BUG-018: Password minimum length was 8, not 15, despite this app having no second authentication factor

- **Label:** Confirmed bug
- **Severity:** MEDIUM — weaker-than-intended password floor for an
  account protected by password alone; not an active exploit, but a
  policy gap against the explicit spec (stage 4 feature #61, NIST SP
  800-63B: "at least 8 characters (15 when the password is the only
  factor)").
- **Status:** Fixed
- **Component/file:** `packages/validation/src/index.ts`
- **Exact location:** `export const PASSWORD_MIN_LENGTH = 8;`
- **Problem:** This application has no MFA/TOTP implementation (confirmed
  in `docs/auth/ARCHITECTURE.md` §1.4: "TOTP MFA ... Not implemented") —
  password is the sole authentication factor for every account, which is
  exactly the condition NIST 800-63B ties to the stricter 15-character
  minimum, not the bare 8-character floor.
- **Root cause:** The schema used NIST's unconditional floor (8) without
  accounting for the "password is the only factor" condition that applies
  to every account in this app today.
- **Trigger:** Any signup/password-reset/password-change with a password
  between 8 and 14 characters.
- **Impact:** Accounts could be created with passwords weaker than the
  policy this stage's spec requires for a password-only app.
- **Reproduction steps:** 1. Call `passwordSchema.parse("12345678")` (8
  chars). 2. Before the fix, this passed.
- **Expected behavior:** Minimum 15 characters when password is the sole
  factor.
- **Actual behavior (before fix):** Minimum was 8.
- **Why it happens:** See root cause.
- **Related components:** `apps/web` signup/reset-password/change-password
  forms (no change needed — they render `PASSWORD_MIN_LENGTH` from the
  shared constant, not a separate hardcoded number);
  `packages/validation/src/index.spec.ts`.
- **Recommended fix (applied):** Raised `PASSWORD_MIN_LENGTH` to `15`.
  Updated the composition-rule test fixture
  (`packages/validation/src/index.spec.ts`) from a 12-char to a 20-char
  all-lowercase string, since it was coincidentally shorter than the new
  minimum and would otherwise fail for an unrelated reason (length, not
  composition).
- **Regression risk:** Low-medium — any existing test fixtures or seed
  data using an 8–14 character password for signup/reset/change-password
  will now fail validation; searched all `apps/api/test/*.spec.ts` files
  for `signUp()`/password fixtures under 15 characters — none found (only
  login tests use short passwords, which intentionally test wrong-password
  rejection and never pass through `passwordSchema`).
- **How to test the fix:** `packages/validation/src/index.spec.ts` — actually
  run, 8/8 pass, including the updated composition-rule and
  length-boundary tests.

### BUG-019: Account self-heal only repaired a missing profile, never a missing role; no scheduled job existed to catch an orphaned account that never logs in again

- **Label:** Confirmed bug
- **Severity:** MEDIUM — an account missing its role would resolve through
  `PrincipalService` with zero permissions (effectively unusable, not a
  security hole) rather than being repaired; an account that never logs
  in again after being left partial had no path back to a complete state.
- **Status:** Fixed
- **Component/file:** `apps/api/src/auth/principal.service.ts`; (new)
  `apps/worker/src/processors/account-repair.processor.ts`
- **Exact location:** `principal.service.ts`'s `resolve()` previously only
  checked/repaired `prisma.profile.findUnique`, never `userRole`.
- **Problem:** Stage 4 feature #63 requires "impossible for a user to
  exist without a profile, a role, or a way to verify," plus "a repair job
  catches older partial accounts." The transactional `signUp()` prevents
  new partial accounts; the per-login self-heal only covered a missing
  profile, not a missing role; and no job existed to repair an account
  that never logs in again.
- **Root cause:** The self-heal guard was written for the specific
  "profile lost to a bug predating the transactional signUp" scenario and
  was never extended to cover a missing role the same way; no repair job
  was ever added (only a `cleanup` queue/worker for expired tokens/old
  sessions existed).
- **Trigger:** Any user row left without a `UserRole` (e.g. by a bug
  predating Phase 4's atomic role assignment) or any partial account whose
  owner never signs in again.
- **Impact:** A role-less account would authenticate but hold zero
  permissions on every request; a partial account with no future login has
  no self-heal path at all.
- **Reproduction steps:** 1. Manually delete a test user's `UserRole` row. 2. Call `PrincipalService.resolve()` for that user. 3. Before the fix,
  `roles`/`permissions` stayed empty indefinitely.
- **Expected behavior:** A missing role is repaired the same way a missing
  profile is; a scheduled job repairs accounts that never log in.
- **Actual behavior (before fix):** Missing role was never repaired; no
  repair job existed.
- **Why it happens:** See root cause.
- **Related components:** `apps/api/src/auth/auth.service.ts` `signUp()`
  (prevention); `apps/worker/src/processors/cleanup.processor.ts` (sibling
  pattern this job's structure follows).
- **Recommended fix (applied):** `principal.service.ts` now also detects
  zero `userRoles` and assigns the default `user` role
  (`skipDuplicates: true`, idempotent under concurrent requests, same
  pattern as the existing profile self-heal). Added a new
  `account-repair` BullMQ queue/worker that scans for any user missing a
  profile and/or role and repairs both, for accounts that never log in
  again to trigger the lazy per-login path.
- **Regression risk:** Low — both changes only ever create a missing row;
  neither can modify or remove an existing profile/role/permission.
- **How to test the fix:** `@saas/worker` typecheck passes; full
  `apps/api` test suite actually run — 20 files, 44 passed, 91 skipped
  (DB-dependent), 0 failed. Requires manual verification for the repair
  job's actual output against a real database (no Docker/Postgres
  available in this environment), and for scheduling it to run
  periodically (no in-repo scheduler exists for this queue or the
  pre-existing `cleanup` queue — an external cron or BullMQ repeatable
  job must enqueue a job).

### BUG-020: Signup verification email sent synchronously in-request with no retry, not through the queue

- **Label:** Confirmed bug
- **Severity:** LOW — delivery failure was already caught, logged, and
  recoverable via resend; the gap was the absence of automatic retry
  before falling back to that manual path.
- **Status:** Fixed
- **Component/file:** `apps/api/src/auth/auth.service.ts` `sendVerificationEmail()`;
  `apps/api/src/common/email-queue.ts`
- **Exact location:** `sendEmail(...)` called with the default `queued =
false`, and the BullMQ `Queue` had no `defaultJobOptions`.
- **Problem:** Stage 4 feature #66 requires "Send email through a queue
  with retries." Verification emails were sent directly via
  `emailProvider.send()` in-request (no queue, no retry); separately, even
  the password-reset emails that already went through the queue had no
  `attempts`/`backoff` configured, so a BullMQ job that failed once was
  never retried by the worker.
- **Root cause:** Queuing was deliberately scoped to password-reset only
  in an earlier phase ("opted in per call site... broadening this to
  every email type is a larger change than this phase's explicit scope");
  this stage explicitly requires it for the signup/verification flow. The
  queue's retry options were simply never set when the queue was first
  created.
- **Trigger:** Any transient email-provider/network failure while sending
  a verification email.
- **Impact:** A transient failure immediately fell back to "user must
  manually click resend" instead of being retried automatically first.
- **Reproduction steps:** 1. Mock the email provider to reject once. 2. Before the fix, `sendVerificationEmail` called `emailProvider.send`
  directly — one failure, no retry, straight to the failure branch.
- **Expected behavior:** Delivery is attempted via a queue with automatic
  retries before the failure path is reached.
- **Actual behavior (before fix):** No queue, no retry, for verification
  email specifically; no retry configuration on the queue itself.
- **Why it happens:** See root cause.
- **Related components:** `apps/api/test/phase4-signup-verification.integration.spec.ts`
  (updated to spy on `enqueueEmail` instead of `StubEmailProvider.send`,
  matching the pattern `phase8-password-reset.integration.spec.ts` already
  used); `apps/worker/src/processors/email.processor.ts` (the consumer,
  unchanged — BullMQ's own retry/backoff mechanism handles re-delivery
  without any processor change).
- **Recommended fix (applied):** Added `defaultJobOptions: { attempts: 3,
backoff: { type: "exponential", delay: 5000 } }` to the BullMQ `Queue`
  in `email-queue.ts` (applies to every job on this queue, including the
  pre-existing password-reset emails). Changed `sendVerificationEmail`'s
  `sendEmail(...)` call to pass `queued = true`. Updated the affected test
  file's helper (`captureNextIssuedToken`) and the delivery-failure test to
  spy on `enqueueEmail` instead of the provider, since the provider is no
  longer called in-request for this email type.
- **Regression risk:** Medium-low — verification email delivery now
  depends on Redis/the worker process being reachable, same as password
  reset already did; if the queue's Redis connection itself is down,
  `enqueueEmail` throws synchronously and is still caught by the existing
  `sendEmail` try/catch (no new unhandled-failure path). Duplicate-signup
  notice emails were deliberately left unqueued (out of this stage's
  explicit scope) to keep the change minimal.
- **How to test the fix:** Full `apps/api` test suite actually run — 20
  files, 44 passed, 91 skipped (DB-dependent), 0 failed, including the
  updated `phase4-signup-verification.integration.spec.ts` (13 tests, all
  skip cleanly — no DB in this environment) and
  `phase8-password-reset.integration.spec.ts` (unaffected by the shared
  `defaultJobOptions` change). Requires manual verification against a
  real Redis/Postgres for the actual retry behavior.
