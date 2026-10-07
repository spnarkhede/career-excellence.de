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
