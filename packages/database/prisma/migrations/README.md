# Migrations

Each migration folder contains:

- `migration.sql` — the forward migration, applied by `prisma migrate deploy`/`dev`.
- `down.sql` — the reverse migration, **not** run automatically (Prisma has no
  built-in down-migration runner). Apply manually if needed:
  `psql $DATABASE_URL -f packages/database/prisma/migrations/<folder>/down.sql`.

`down.sql` reverses the **schema shape**, not data: dropping a table in the forward
migration permanently deletes its rows, and the corresponding `down.sql` recreates that
table empty. Any lossy data backfill performed going forward (e.g. the `suspended` →
`disabled` status mapping in `00000000000001_phase3_auth_tables`) is noted in that
migration's `down.sql` header as a best-effort, non-perfect reversal.

Before writing a new migration, generate the SQL diff without needing a live database
connection:

```
DATABASE_URL="postgresql://user:pass@host/db" npx prisma migrate diff \
  --from-schema-datamodel <previous-schema-copy>.prisma \
  --to-schema-datamodel packages/database/prisma/schema.prisma \
  --script > packages/database/prisma/migrations/<timestamp>_<name>/migration.sql
```

(The `DATABASE_URL` value only needs to be syntactically valid for the provider — this
command never opens a network connection.) Then hand-write the matching `down.sql`.
