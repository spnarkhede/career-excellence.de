-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "OneTimeTokenPurpose" AS ENUM ('verify_email', 'reset_password', 'otp', 'magic_link');

-- AlterEnum
-- Backfill the retired 'suspended' value to its replacement BEFORE the type swap below —
-- the USING cast would otherwise fail outright if any row still holds the old value. This
-- app has never been deployed with real data yet, but a migration must still be safe to run
-- against a populated table (AUTH_RULES.md rule 1: do not assume the current state is empty).
UPDATE "users" SET "status" = 'disabled' WHERE "status" = 'suspended';

BEGIN;
CREATE TYPE "AccountStatus_new" AS ENUM ('pending_verification', 'active', 'disabled', 'locked', 'deleted');
ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "status" TYPE "AccountStatus_new" USING ("status"::text::"AccountStatus_new");
ALTER TYPE "AccountStatus" RENAME TO "AccountStatus_old";
ALTER TYPE "AccountStatus_new" RENAME TO "AccountStatus";
DROP TYPE "AccountStatus_old";
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'pending_verification';
COMMIT;

-- DropForeignKey
ALTER TABLE "auth_identities" DROP CONSTRAINT "auth_identities_userId_fkey";

-- DropForeignKey
ALTER TABLE "security_events" DROP CONSTRAINT "security_events_userId_fkey";

-- DropForeignKey
ALTER TABLE "verification_tokens" DROP CONSTRAINT "verification_tokens_userId_fkey";

-- AlterTable
-- NOTE for real deployments with existing data: switching `email` to CITEXT applies
-- case-insensitive comparison retroactively. If two existing rows differ only by case
-- (e.g. "a@x.com" and "A@x.com"), the later CreateIndex (citext-backed unique on email)
-- below will fail — such duplicates must be resolved manually before this migration runs.
-- This app has no production data yet, so no such duplicates can exist today.
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT,
ALTER COLUMN "email" SET DATA TYPE CITEXT;

-- Enforce "trimmed" (no leading/trailing whitespace) at the database level — CITEXT only
-- normalizes case, not whitespace. `emailSchema` (`z.string().trim()`) already does this at
-- the app boundary; this CHECK is the defense-in-depth backstop for any other write path.
ALTER TABLE "users" ADD CONSTRAINT "users_email_trimmed_check" CHECK ("email" = btrim("email"::text)::citext);

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
-- familyId/absoluteExpiresAt are added nullable, backfilled for any pre-existing row, then
-- tightened to NOT NULL — adding a NOT NULL column with no default directly would fail
-- outright against a populated table. Prisma's `@default(uuid())` for familyId is applied
-- client-side (by the query engine on INSERT), not as a DB-level DEFAULT, so it does not
-- help here; gen_random_uuid() (built into Postgres core since v13) backfills existing rows.
ALTER TABLE "sessions" DROP COLUMN "ipAddress",
DROP COLUMN "lastActiveAt",
ADD COLUMN     "absoluteExpiresAt" TIMESTAMP(3),
ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "ipHash" TEXT,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "sessions" SET "familyId" = gen_random_uuid()::text WHERE "familyId" IS NULL;
-- No prior absolute ceiling existed; treat each pre-existing session's current rolling
-- expiry as its absolute ceiling too (the safest fallback — never extends a session beyond
-- what it already had).
UPDATE "sessions" SET "absoluteExpiresAt" = "expiresAt" WHERE "absoluteExpiresAt" IS NULL;

ALTER TABLE "sessions" ALTER COLUMN "familyId" SET NOT NULL,
ALTER COLUMN "absoluteExpiresAt" SET NOT NULL;

-- DropTable
DROP TABLE "auth_identities";

-- DropTable
DROP TABLE "security_events";

-- DropTable
DROP TABLE "verification_tokens";

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailAtLinkTime" TEXT NOT NULL,
    "emailVerifiedByProvider" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_time_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "OneTimeTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oauth_accounts_userId_idx" ON "oauth_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_providerAccountId_key" ON "oauth_accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "one_time_tokens_tokenHash_key" ON "one_time_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "one_time_tokens_userId_purpose_idx" ON "one_time_tokens"("userId", "purpose");

-- CreateIndex
CREATE INDEX "auth_events_userId_idx" ON "auth_events"("userId");

-- CreateIndex
CREATE INDEX "auth_events_type_idx" ON "auth_events"("type");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "sessions_familyId_idx" ON "sessions"("familyId");

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Row-level security (defense-in-depth)
-- ============================================================================
-- Decision (see docs/auth/ARCHITECTURE.md D10 / FINDINGS.md): Postgres is not
-- reachable from any client today — only apps/api and apps/worker hold
-- DATABASE_URL, and the NestJS API is the real, already-enforced authorization
-- boundary (AUTH_RULES.md rule 6). RLS is enabled here anyway, as defense-in-
-- depth and because the Phase 3 checklist/tests require it to be testable
-- directly at the database level. The role apps/api currently connects as is
-- this schema's OWNER (whatever DATABASE_URL names), and table owners bypass
-- RLS by default in Postgres (FORCE ROW LEVEL SECURITY is deliberately NOT
-- set) — so the existing application continues to work completely unchanged;
-- this migration does not touch which role Prisma connects as.
--
-- Two additional roles are created purely so the policies below are directly
-- testable (per this phase's TESTS 3 and 4), without requiring any app code
-- to set a session variable per request:
--   - app_anon:          no grants on any table below (anonymous = zero access).
--   - app_authenticated: RLS-scoped access, keyed off current_setting
--                         ('app.current_user_id', true) — a session variable a
--                         future phase would SET LOCAL per request if Postgres
--                         were ever made directly reachable from a client.
--                         Not wired into Prisma's connection in this phase.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_anon') THEN
    CREATE ROLE app_anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_authenticated') THEN
    CREATE ROLE app_authenticated NOLOGIN;
  END IF;
END
$$;

-- Returns the current request's authenticated user id, or NULL if unset
-- (e.g. for app_anon, or any role that never sets the session variable).
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS TEXT AS $$
  SELECT current_setting('app.current_user_id', true);
$$ LANGUAGE sql STABLE;

-- Explicit default-deny: revoke whatever PUBLIC/default grants exist, then
-- grant back only what each role is meant to have.
REVOKE ALL ON "users", "profiles", "sessions", "one_time_tokens", "oauth_accounts",
  "auth_events", "roles", "permissions", "role_permissions", "user_roles"
  FROM PUBLIC, app_anon, app_authenticated;

GRANT SELECT ON "users" TO app_authenticated;
GRANT SELECT, UPDATE ON "profiles" TO app_authenticated;
GRANT SELECT, UPDATE ON "sessions" TO app_authenticated;
GRANT SELECT, UPDATE ON "one_time_tokens" TO app_authenticated;
GRANT SELECT ON "oauth_accounts" TO app_authenticated;
GRANT SELECT ON "auth_events" TO app_authenticated;
GRANT SELECT ON "roles", "permissions", "role_permissions" TO app_authenticated;
GRANT SELECT ON "user_roles" TO app_authenticated;

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "one_time_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;

-- users: read own row only. No INSERT/UPDATE/DELETE policy for
-- app_authenticated at all (signup/status/password changes are
-- server-mediated business logic, not direct client writes).
CREATE POLICY users_select_own ON "users"
  FOR SELECT TO app_authenticated
  USING ("id" = app_current_user_id());

-- profiles: read/update own row only. The WITH CHECK clause on UPDATE pins
-- "userId" to the caller's own id, so a row's ownership itself can never be
-- changed by an UPDATE (the DB-level equivalent of "cannot write user_id").
-- There is no "role" or "status" column on this table to protect — those
-- live on `users`, which app_authenticated cannot UPDATE at all (above).
CREATE POLICY profiles_select_own ON "profiles"
  FOR SELECT TO app_authenticated
  USING ("userId" = app_current_user_id());
CREATE POLICY profiles_update_own ON "profiles"
  FOR UPDATE TO app_authenticated
  USING ("userId" = app_current_user_id())
  WITH CHECK ("userId" = app_current_user_id());

-- sessions: read/revoke (UPDATE) own rows only; a session row is never
-- client-inserted (issued only by the server on login/refresh) and never
-- client-deleted (revocation is an UPDATE setting revokedAt, preserving the
-- audit trail) — so there is deliberately no INSERT or DELETE policy here.
CREATE POLICY sessions_select_own ON "sessions"
  FOR SELECT TO app_authenticated
  USING ("userId" = app_current_user_id());
CREATE POLICY sessions_update_own ON "sessions"
  FOR UPDATE TO app_authenticated
  USING ("userId" = app_current_user_id())
  WITH CHECK ("userId" = app_current_user_id());

-- one_time_tokens: same shape as sessions — the server issues and consumes
-- these; a client is only ever shown its own row, never allowed to forge one.
CREATE POLICY one_time_tokens_select_own ON "one_time_tokens"
  FOR SELECT TO app_authenticated
  USING ("userId" = app_current_user_id());
CREATE POLICY one_time_tokens_update_own ON "one_time_tokens"
  FOR UPDATE TO app_authenticated
  USING ("userId" = app_current_user_id())
  WITH CHECK ("userId" = app_current_user_id());

-- oauth_accounts: read own links only; linking/unlinking is server-mediated
-- (see docs/auth/ARCHITECTURE.md §2.8 — no silent account auto-linking), so
-- no INSERT/UPDATE/DELETE policy exists for app_authenticated.
CREATE POLICY oauth_accounts_select_own ON "oauth_accounts"
  FOR SELECT TO app_authenticated
  USING ("userId" = app_current_user_id());

-- auth_events: read own event history only; this is an append-only audit
-- trail the server writes to — no client write policy of any kind.
CREATE POLICY auth_events_select_own ON "auth_events"
  FOR SELECT TO app_authenticated
  USING ("userId" = app_current_user_id());

-- roles/permissions/role_permissions: shared reference/junction data every
-- authenticated user may read (needed to resolve "what can I do"), never
-- written by a client — role/permission assignment is a privileged,
-- service-role-only operation (checklist item 20).
CREATE POLICY roles_select_all ON "roles"
  FOR SELECT TO app_authenticated USING (true);
CREATE POLICY permissions_select_all ON "permissions"
  FOR SELECT TO app_authenticated USING (true);
CREATE POLICY role_permissions_select_all ON "role_permissions"
  FOR SELECT TO app_authenticated USING (true);

-- user_roles: read own role assignments only; assignment itself is
-- privileged (service-role-only), matching role_permissions above.
CREATE POLICY user_roles_select_own ON "user_roles"
  FOR SELECT TO app_authenticated
  USING ("userId" = app_current_user_id());

