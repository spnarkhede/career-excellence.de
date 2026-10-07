-- Down-migration for 00000000000000_init.
-- Not run automatically by `prisma migrate` (Prisma has no built-in down-migration
-- runner) — apply manually with `psql $DATABASE_URL -f down.sql` if you need to roll
-- this migration back. Drops every object this migration created; tables are dropped
-- with CASCADE, so all data in them is lost — this reverses the SCHEMA, not the data.
DROP SCHEMA IF EXISTS "public" CASCADE;
CREATE SCHEMA "public";
