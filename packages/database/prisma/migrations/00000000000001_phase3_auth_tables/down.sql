-- Down-migration for 00000000000001_phase3_auth_tables.
-- Not run automatically by `prisma migrate` — apply manually with
-- `psql $DATABASE_URL -f down.sql` if you need to roll this migration back.
--
-- This reverses the SCHEMA shape only, not data: any row written into
-- oauth_accounts/one_time_tokens/auth_events is lost, and auth_identities/
-- security_events/verification_tokens are recreated EMPTY (their data was
-- dropped by the up-migration and cannot be recovered by this script). The
-- 'suspended' -> 'disabled' status backfill performed going up is also not
-- reversible (which rows were originally 'suspended' is no longer known).

-- --- Row-level security -----------------------------------------------------
DROP POLICY IF EXISTS user_roles_select_own ON "user_roles";
DROP POLICY IF EXISTS role_permissions_select_all ON "role_permissions";
DROP POLICY IF EXISTS permissions_select_all ON "permissions";
DROP POLICY IF EXISTS roles_select_all ON "roles";
DROP POLICY IF EXISTS auth_events_select_own ON "auth_events";
DROP POLICY IF EXISTS oauth_accounts_select_own ON "oauth_accounts";
DROP POLICY IF EXISTS one_time_tokens_update_own ON "one_time_tokens";
DROP POLICY IF EXISTS one_time_tokens_select_own ON "one_time_tokens";
DROP POLICY IF EXISTS sessions_update_own ON "sessions";
DROP POLICY IF EXISTS sessions_select_own ON "sessions";
DROP POLICY IF EXISTS profiles_update_own ON "profiles";
DROP POLICY IF EXISTS profiles_select_own ON "profiles";
DROP POLICY IF EXISTS users_select_own ON "users";

ALTER TABLE "user_roles" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "permissions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_events" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_accounts" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "one_time_tokens" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS app_current_user_id();
DROP ROLE IF EXISTS app_authenticated;
DROP ROLE IF EXISTS app_anon;

-- --- New tables --------------------------------------------------------------
DROP TABLE IF EXISTS "auth_events";
DROP TABLE IF EXISTS "one_time_tokens";
DROP TABLE IF EXISTS "oauth_accounts";

-- --- Restore dropped tables (empty — data is not recoverable) ----------------
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "verification_tokens_tokenHash_key" ON "verification_tokens"("tokenHash");
CREATE INDEX "verification_tokens_userId_purpose_idx" ON "verification_tokens"("userId", "purpose");
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "security_events_userId_idx" ON "security_events"("userId");
CREATE INDEX "security_events_type_idx" ON "security_events"("type");
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "auth_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "auth_identities_provider_providerId_key" ON "auth_identities"("provider", "providerId");
CREATE INDEX "auth_identities_userId_idx" ON "auth_identities"("userId");
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --- sessions ------------------------------------------------------------------
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_familyId_fkey";
DROP INDEX IF EXISTS "sessions_familyId_idx";
ALTER TABLE "sessions"
  DROP COLUMN "absoluteExpiresAt",
  DROP COLUMN "familyId",
  DROP COLUMN "ipHash",
  DROP COLUMN "lastUsedAt",
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- --- profiles --------------------------------------------------------------
ALTER TABLE "profiles" DROP COLUMN "createdAt";

-- --- users -------------------------------------------------------------------
DROP INDEX IF EXISTS "users_status_idx";
DROP INDEX IF EXISTS "users_deletedAt_idx";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_trimmed_check";
ALTER TABLE "users"
  DROP COLUMN "deletedAt",
  DROP COLUMN "failedLoginCount",
  DROP COLUMN "lockedUntil",
  DROP COLUMN "passwordHash",
  ALTER COLUMN "email" SET DATA TYPE TEXT;

BEGIN;
CREATE TYPE "AccountStatus_old" AS ENUM ('pending_verification', 'active', 'suspended', 'deleted');
ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;
-- 'disabled'/'locked' both map back to 'suspended' — the original distinction
-- these replaced; this is a best-effort, lossy reversal (see header note).
UPDATE "users" SET "status" = 'suspended' WHERE "status" IN ('disabled', 'locked');
ALTER TABLE "users" ALTER COLUMN "status" TYPE "AccountStatus_old" USING ("status"::text::"AccountStatus_old");
ALTER TYPE "AccountStatus" RENAME TO "AccountStatus_new";
ALTER TYPE "AccountStatus_old" RENAME TO "AccountStatus";
DROP TYPE "AccountStatus_new";
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'pending_verification';
COMMIT;

DROP TYPE IF EXISTS "OneTimeTokenPurpose";
DROP EXTENSION IF EXISTS "citext";
