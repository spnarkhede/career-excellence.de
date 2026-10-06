# ADR 0001: Product-neutral monorepo foundation

## Status

Accepted

## Context

We need a reusable foundation for future SaaS products that doesn't require rebuilding
authentication, authorization, security, privacy, deployment, or infrastructure for every
new idea.

## Decision

Adopt a TypeScript monorepo (pnpm + Turborepo) with a strict trust boundary: only
`apps/api` holds private credentials, `apps/web`/`apps/admin` are public-facing clients,
and `apps/worker` handles asynchronous jobs. Shared logic lives in `packages/*` and is
consumed by all apps.

## Consequences

- New products are built by adding product-specific modules/tables on top of this
  foundation, not by modifying the auth/authorization/security core.
- Any change to the authentication or authorization packages affects every app and must
  be reviewed with that blast radius in mind.
