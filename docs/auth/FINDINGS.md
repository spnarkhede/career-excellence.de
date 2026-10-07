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
