# Testing

## Layers

| Layer              | Tool                           | Location                                     |
| ------------------ | ------------------------------ | -------------------------------------------- |
| Unit / integration | Vitest                         | `apps/*/test`, `packages/*/src/**/*.spec.ts` |
| API integration    | Supertest + Vitest             | `apps/api/test`                              |
| End-to-end         | Playwright                     | `tests/e2e`                                  |
| Accessibility      | axe + Playwright               | `tests/accessibility`                        |
| Performance        | k6                             | `tests/performance`                          |
| Security           | Playwright/Supertest scenarios | `tests/security`                             |

## Authentication test matrix (see docs/security/THREAT_MODEL.md for full list)

Signup, duplicate signup, verification (valid/expired/reused), login (valid/invalid/
unknown account), OTP (valid/expired/rate-limited), password reset (valid/expired/reused
token), OAuth (valid/state-manipulated), refresh (valid/rotated-reuse), logout, revoked
session access, expired session access, protected route without session, cross-user
resource access (horizontal), normal user accessing admin routes (vertical).

## Running tests

```bash
pnpm test          # unit + integration, all packages/apps
pnpm test:e2e      # Playwright e2e
```

CI runs the full suite against a real Postgres + Redis service container — never against
mocks only, for anything touching authentication or authorization.
