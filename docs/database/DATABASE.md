# Database

## Schema

Defined in [packages/database/prisma/schema.prisma](../../packages/database/prisma/schema.prisma).
Base system tables: `users`, `profiles`, `auth_identities`, `sessions`, `roles`,
`permissions`, `role_permissions`, `user_roles`, `security_events`, `audit_logs`,
`consents`, `cookie_preferences`, `notification_preferences`, `files`, `feature_flags`,
`account_deletion_requests`, `data_export_requests`, `webhook_events`,
`system_settings`, `verification_tokens`.

Do not add product-specific tables to this base schema — extend it in a product module.

## Migrations

- Every schema change is a Prisma migration (`pnpm db:migrate` locally,
  `prisma migrate deploy` in CI/CD). Never hand-edit a production schema.
- Review destructive migrations (drops, non-nullable additions without defaults) before
  merging.
- Prefer expand-and-contract migrations when zero downtime matters: add the new
  column/table, backfill, switch reads/writes, then remove the old one in a later release.
- Back up before any high-risk migration in production.

## Constraints

- Unique constraints: `users.email`, `sessions.refreshTokenHash`,
  `auth_identities.[provider, providerId]`, `files.objectKey`,
  `verification_tokens.tokenHash`.
- Foreign keys use explicit `onDelete` behavior (`Cascade` for owned child records,
  `SetNull` for audit/event attribution that must survive user deletion).

## Backups

Use a managed PostgreSQL provider with automatic backups and point-in-time recovery
enabled in staging and production. A backup existing is not sufficient — schedule
periodic restore drills and record the results (see
[BACKUP_AND_RECOVERY.md](../architecture/BACKUP_AND_RECOVERY.md)).

## Seeding

`packages/database/prisma/seed.ts` seeds the baseline permissions and role→permission
mappings required by the authorization system.
