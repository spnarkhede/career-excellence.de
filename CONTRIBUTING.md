# Contributing

## Getting started

1. Install [pnpm](https://pnpm.io) `>=9` and Node.js `>=20`.
2. Copy `.env.example` to `.env` and fill in local values.
3. Start infrastructure: `docker compose up -d`.
4. Install dependencies: `pnpm install`.
5. Generate the Prisma client and run migrations: `pnpm db:generate && pnpm db:migrate`.
6. Start everything: `pnpm dev`.

## Workflow

- Create a branch from `main`.
- Keep pull requests focused on a single change.
- Every PR must pass CI: formatting, lint, typecheck, tests, build, and security scans.
- Do not commit `.env` files or secrets of any kind.
- Follow the commit style already used in the repository; write clear, imperative commit messages.

## Code style

- TypeScript strict mode is enforced everywhere.
- Shared logic belongs in `packages/*`, not duplicated across apps.
- UI primitives come from `@saas/ui`; don't hand-roll duplicate components.
- Validation schemas are defined once in `@saas/validation` and reused on client and server.

## Tests

- Unit/integration tests: `pnpm test`.
- End-to-end tests: `pnpm test:e2e`.
- New authentication or authorization logic must include tests covering both the success and the denied/failed path.

## Security

See [SECURITY.md](SECURITY.md) and [docs/security](docs/security) before changing anything related to authentication, sessions, or permissions.
