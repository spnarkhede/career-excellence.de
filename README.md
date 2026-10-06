# App Platform

A product-neutral, production-oriented SaaS starter. Authentication, authorization, security,
privacy, deployment, SEO, analytics, and infrastructure are already built so you can start
implementing product features immediately.

> Rename this repository and replace "App Platform" throughout once you've chosen a product name.

## Stack

- **Frontend:** Next.js (App Router), React, TypeScript strict, Tailwind CSS, shadcn/ui-style primitives, React Hook Form + Zod, TanStack Query, Zustand.
- **Backend:** NestJS, REST + OpenAPI/Swagger, Zod validation boundary.
- **Data:** PostgreSQL + Prisma, Redis.
- **Auth:** Pluggable authentication provider abstraction (email/password, OAuth, OTP, session management).
- **Infra:** pnpm + Turborepo monorepo, Docker, GitHub Actions, Vercel (web), container hosting (API/worker).
- **Ops:** Structured logging, Sentry-ready, OpenTelemetry-ready, health/readiness endpoints.

## Repository layout

```
apps/
  web/      Public site + authenticated user application (Next.js)
  api/      Trusted backend: auth, authorization, database, business APIs (NestJS)
  worker/   Asynchronous jobs: email, cleanup, webhook retries (BullMQ)
  admin/    Privileged administration interface (Next.js)
packages/   Shared libraries (ui, auth, authorization, database, contracts, validation, ...)
infrastructure/  Docker, database, monitoring, scripts
docs/       Architecture, security, authentication, deployment, and other reference docs
tests/      Cross-cutting e2e/integration/security/accessibility/performance tests
```

See [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) for the full breakdown.

## Getting started

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

- Web: http://localhost:3000
- Admin: http://localhost:3002
- API: http://localhost:4000 (Swagger docs at `/docs` outside production)

## Documentation

| Doc                                                         | Purpose                           |
| ----------------------------------------------------------- | --------------------------------- |
| [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)        | System design and app boundaries  |
| [AUTHENTICATION.md](docs/authentication/AUTHENTICATION.md)  | Full auth lifecycle               |
| [AUTHORIZATION.md](docs/authorization/AUTHORIZATION.md)     | Roles, permissions, policy checks |
| [DATABASE.md](docs/database/DATABASE.md)                    | Schema and migration rules        |
| [API.md](docs/api/API.md)                                   | REST conventions                  |
| [PRIVACY.md](docs/privacy/PRIVACY.md)                       | Privacy, consent, data lifecycle  |
| [ENVIRONMENTS.md](docs/deployment/ENVIRONMENTS.md)          | Environment matrix                |
| [DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md)              | CI/CD and release process         |
| [TESTING.md](docs/testing/TESTING.md)                       | Test strategy and matrix          |
| [OBSERVABILITY.md](docs/architecture/OBSERVABILITY.md)      | Logging, metrics, tracing         |
| [THREAT_MODEL.md](docs/security/THREAT_MODEL.md)            | Threat model                      |
| [RELEASE_CHECKLIST.md](docs/decisions/RELEASE_CHECKLIST.md) | Pre-production checklist          |

## License

Proprietary — update before open-sourcing.
