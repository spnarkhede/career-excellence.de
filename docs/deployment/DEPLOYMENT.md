# Deployment

## Pipeline

1. Developer opens a pull request.
2. CI (`.github/workflows/ci.yml`) runs format/lint/typecheck/tests/build + secret scan.
3. A preview deployment is created (web/admin on Vercel; API/worker to a preview
   container environment) against isolated infrastructure.
4. After review and merge to `main`, staging deploys automatically.
5. Database migrations run (`prisma migrate deploy`) before the new API version serves
   traffic.
6. E2E and smoke tests run against staging.
7. Production deployment requires manual approval.
8. Production migration → API deploy → worker deploy → web deploy, in that order.
9. Production smoke tests run; monitoring confirms health before the rollout is
   considered complete.

## Apps and hosting

- `apps/web`, `apps/admin` → Vercel.
- `apps/api`, `apps/worker` → container hosting (see `apps/api/Dockerfile`,
  build an equivalent for the worker).
- PostgreSQL and Redis → managed services, never self-hosted in production.

## Migration safety

- Never apply a destructive migration directly to production without a backup and a
  reviewed rollback plan.
- Prefer backward-compatible, expand/contract migrations when the API and old clients
  must coexist during rollout.

## Rollback

Keep the previous container image/deployment available for fast rollback. Database
migrations should be designed so a rollback of the API does not require a destructive
down-migration.
