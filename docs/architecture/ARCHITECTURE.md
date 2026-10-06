# Architecture

## Trust chain

```
Browser → Web (Next.js) → API (NestJS) → Auth provider / Database / Redis
```

- **apps/web** owns the public site and the authenticated user experience. It holds no
  database, auth provider, payment, storage, or email secrets — only `NEXT_PUBLIC_*` values.
- **apps/api** is the only app with access to the database, auth provider, and other
  private credentials. It owns authentication integration, authorization, profiles,
  uploads, audit logging, and business APIs.
- **apps/worker** processes asynchronous jobs (email delivery, cleanup, webhook retries,
  exports/imports) via BullMQ/Redis queues.
- **apps/admin** is a separate privileged application with its own authorization checks;
  normal user permissions never grant admin access.

## Why separate apps instead of one Next.js app with API routes?

- Secrets never need to reach the web runtime.
- The API can be scaled, rate-limited, and audited independently.
- Authorization is centralized in one place instead of duplicated across route handlers.

## Shared packages

Cross-cutting concerns live in `packages/*` and are imported by multiple apps:

| Package                            | Responsibility                                                        |
| ---------------------------------- | --------------------------------------------------------------------- |
| `@saas/types`                      | Shared domain types                                                   |
| `@saas/contracts`                  | REST contract types + route constants shared by client and server     |
| `@saas/validation`                 | Zod schemas used on both client and server                            |
| `@saas/config`                     | Typed, validated environment configuration                            |
| `@saas/auth`                       | Authentication provider abstraction, token helpers                    |
| `@saas/authorization`              | Permission checks (`can`, `assertPermission`)                         |
| `@saas/database`                   | Prisma schema + client                                                |
| `@saas/security`                   | Password hashing, CSP/headers, redirect allowlisting                  |
| `@saas/storage`                    | S3-compatible object storage abstraction                              |
| `@saas/email`                      | Email provider abstraction + templates                                |
| `@saas/analytics`                  | Single analytics interface (track/identify/page/reset/consentUpdated) |
| `@saas/observability`              | Structured logging                                                    |
| `@saas/feature-flags`              | Feature flag abstraction                                              |
| `@saas/ui` / `@saas/design-tokens` | Shared UI primitives and design tokens                                |
| `@saas/api-client`                 | Typed fetch client used by web/admin                                  |
| `@saas/testing`                    | Shared test factories                                                 |

## Request lifecycle (protected API route)

1. Validate session cookie and resolve session from the database.
2. Resolve user, verify account status.
3. Resolve role(s) and permissions.
4. Check resource ownership / organization scope where relevant.
5. Execute the operation.
6. Audit privileged operations.

Frontend route protection (Next.js middleware) only improves navigation. The API is the
only real authorization boundary.
