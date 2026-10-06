# Phase 0 — Project Discovery and Baseline

Status: **Baseline established in this session.** This repository was empty prior to this
work; there was no pre-existing frontend, backend, or infrastructure to inspect. Everything
below reflects what now exists after the initial scaffold described in
[docs/decisions/0001-product-neutral-monorepo.md](decisions/0001-product-neutral-monorepo.md).
Items that have not been exercised end-to-end (because local infra/build tooling hasn't been
run against them yet) are explicitly marked **Unable to verify** rather than assumed working.

This document is the authoritative architecture map for Phase 0. Re-read it before starting
any later phase so changes build on what is actually here, not on assumptions.

---

## 1–5. Frontend / backend / package manager / runtime / monorepo

| Item               | Finding                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend framework | Next.js 15 (App Router), React 19, TypeScript strict — two apps: `apps/web` (public + authenticated user app) and `apps/admin` (privileged admin shell) |
| Backend framework  | NestJS 10 (`apps/api`), REST controllers, Swagger/OpenAPI via `@nestjs/swagger`                                                                         |
| Background jobs    | BullMQ + ioredis (`apps/worker`), queues: `email`, `cleanup`, `webhook-retry` (webhook-retry queue name reserved, no processor yet — **gap**)           |
| Package manager    | pnpm `9.12.0` (`packageManager` field pinned in root `package.json`)                                                                                    |
| Runtime            | Node.js `>=20` (`engines.node` in root `package.json`)                                                                                                  |
| Monorepo tool      | Turborepo (`turbo.json`), pipelines: `build`, `dev`, `lint`, `typecheck`, `test`, `test:e2e`, `clean`                                                   |
| Workspace layout   | `pnpm-workspace.yaml` → `apps/*`, `packages/*`. 4 apps, 18 shared packages                                                                              |

## 6–7. Database / ORM

- **Database:** PostgreSQL 16 (local via `docker-compose.yml`; managed Postgres assumed for staging/production, not yet provisioned).
- **ORM:** Prisma 6, schema at [packages/database/prisma/schema.prisma](../packages/database/prisma/schema.prisma).
- **Generated client:** NOT currently generated in this environment — `prisma generate` fails here because the sandbox's network proxy returns `407 Proxy authentication required` when fetching engine binaries from `binaries.prisma.sh`. This blocks `apps/api` and `apps/worker` builds (both depend on `@saas/database`). **Unable to verify** that the schema compiles into a working client until this is resolved on a network that can reach Prisma's binary host, or engines are vendored/cached.
- **Tables (system/base only, per the "no product-specific tables" rule):** `users`, `profiles`, `auth_identities`, `sessions`, `roles`, `permissions`, `role_permissions`, `user_roles`, `security_events`, `audit_logs`, `consents`, `cookie_preferences`, `notification_preferences`, `files`, `feature_flags`, `account_deletion_requests`, `data_export_requests`, `webhook_events`, `system_settings`, `verification_tokens`.
- **Seed script:** [packages/database/prisma/seed.ts](../packages/database/prisma/seed.ts) — creates permissions and role→permission mappings only (`user`, `support`, `moderator`, `administrator`, `super_administrator`). Does not seed any users.

## 8. Authentication provider

- No external managed provider wired yet. `@saas/auth` defines an `AuthProvider` interface and ships a `StubAuthProvider` (in-memory, dev/test only — **not durable**, state is lost on process restart and is not even the source of truth used by the API, which persists identities in Postgres via `AuthIdentity` while the stub independently tracks password hashes in memory). **This is an architectural gap to flag**: `apps/api/src/auth/auth.service.ts` creates a `User`/`AuthIdentity` row in Postgres _and_ calls the stub provider to create the "real" credential — on process restart the stub's in-memory password store is wiped while the Postgres `AuthIdentity` row survives, permanently locking out existing accounts. This must be fixed before Phase 1 by either (a) persisting credentials through the provider abstraction backed by Postgres, or (b) wiring a real managed provider.
- OAuth (Google/Microsoft/GitHub): interfaces defined (`OAuthProvider`, `OAuthStartResult`, `OAuthCallbackInput` in `@saas/auth`), **no concrete implementation exists yet**. Env vars for Google OAuth are scaffolded in `.env.example` but unused by any code path.
- TOTP MFA: not implemented. Mentioned only as a doc TODO in `docs/authorization/AUTHORIZATION.md`.

## 9. API architecture

- REST, NestJS controllers under `apps/api/src`. Modules: `auth`, `profile`, `health`.
- Global exception filter normalizes all errors to `{ requestId, code, message, details }` ([apps/api/src/common/all-exceptions.filter.ts](../apps/api/src/common/all-exceptions.filter.ts)).
- Request ID middleware assigns/propagates `x-request-id`.
- Validation boundary: Zod schemas from `@saas/validation`, applied via a custom `ZodValidationPipe` (not Nest's built-in `ValidationPipe`/class-validator — intentional, keeps one schema source for client+server).
- Swagger exposed at `/docs` when `APP_ENV !== production`.
- Global rate limiting via `@nestjs/throttler` (100 req/min default) plus per-route `@Throttle()` overrides on auth endpoints.

## 10–14. Session / cookie / token / JWT / refresh architecture

- **Session model:** hybrid — short-lived JWT access token + opaque refresh token, mirrored by a DB-backed `Session` row (id, userId, refreshTokenHash, userAgent, ipAddress, createdAt, lastActiveAt, expiresAt, revokedAt, revokedReason).
- **Access token:** JWT signed with `jsonwebtoken` using `AUTH_JWT_SECRET`, payload `{ sub: userId, sid: sessionId }`, TTL `AUTH_ACCESS_TOKEN_TTL` (default 900s). Verified per-request in `SessionGuard`, which **also** re-checks the DB session row (not revoked, not expired) — so revocation is effective immediately rather than waiting for JWT expiry. This is correct and worth preserving.
- **Refresh token:** opaque random (`generateSecureToken`, 32 bytes, base64url), stored **only as a SHA-256 hash** (`hashToken`, `@saas/security/server`) in `Session.refreshTokenHash`. Rotated on every `/auth/refresh` call (old session marked `revoked/rotated`, new session+tokens issued).
- **Cookies:** `app_session` (access) and `app_refresh` (refresh), both `HttpOnly`, `SameSite=Lax`, `Secure` outside `APP_ENV=local`, scoped to `API_COOKIE_DOMAIN`. Set via `@saas/security`'s `sessionCookieOptions`.
- **Gap:** cookies are set by the API on `API_COOKIE_DOMAIN`, but `apps/web`/`apps/admin` are separate origins calling the API via `fetch(..., { credentials: "include" })`. For this to work in any real deployment, the API's cookie domain must be a parent domain shared with web/admin (e.g. `api.example.com` cookie domain `.example.com`), **or** the architecture needs same-site reverse-proxying. This is not yet resolved/documented and should be a Phase 1 decision.

## 15–19. OAuth / email+password / OTP / verification / password recovery

- **Email + password:** implemented end-to-end (signup → pending_verification → emailed token → verify → active → login). See `docs/authentication/AUTHENTICATION.md`.
- **OTP:** implemented (`/auth/otp/request`, `/auth/otp/verify`), 6-digit code, hashed at rest, 5 min TTL, 5 attempt lockout, neutral response on request.
- **Email verification:** single-use hashed token, 24h TTL.
- **Password recovery:** single-use hashed token, 1h TTL, revokes all sessions on success, neutral response on request (no account enumeration).
- **OAuth:** interfaces only, no provider implementation (see §8).
- **Email delivery:** `@saas/email`'s `StubEmailProvider` only logs to console (`logger.warn`) — **no real provider wired**. Every "email sent" step in the lifecycle docs is currently a no-op from the recipient's perspective.

## 20. Session persistence

- Postgres-backed (`Session` table), not Redis — Redis is reserved for BullMQ queues only in the current design. This is a reasonable choice but means session reads are an extra DB round trip per authenticated request (`SessionGuard` → `prisma.session.findUnique`); no caching layer in front of it yet.

## 21–22. Middleware / protected routes

- API: `RequestIdMiddleware` (global), `SessionGuard` (per-route, Nest guard) resolves and attaches `request.principal`.
- `apps/web` has a `src/middleware.ts` that redirects unauthenticated requests away from `/dashboard` and `/settings` based on cookie _presence_ only (it does not validate the JWT or call the API) — correctly documented in its own comment as a UX nicety, not a security boundary.
- `apps/admin` has **no middleware.ts** — its one protected page (`app/page.tsx`) instead calls the API's `/auth/me` server-side on every render and redirects on `401`/missing permission. This is a per-page pattern, not centralized, and does not scale past one page without duplication. Gap: introduce `apps/admin/src/middleware.ts` (cookie-presence check, same pattern as web) once more admin pages exist, to avoid copy-pasting the fetch+redirect logic.
- In both apps, the **only real authorization boundary is the API** (`SessionGuard` + `assertPermission`), consistent with the documented trust model.

## 23–24. Roles / permissions

- Centralized permission model in `@saas/authorization` (`can`, `assertPermission`, `canAccessOwnResource`, `ForbiddenError`). Roles: `user`, `support`, `moderator`, `administrator`, `super_administrator`. Permissions are flat strings (`profile.read.own`, `users.suspend`, etc.), stored in Postgres (`roles`, `permissions`, `role_permissions`, `user_roles`) and resolved per-request by `PrincipalService`.
- No organization/tenant scoping exists yet (single-tenant assumption baked into the schema — no `organization_id` anywhere). Flag for Phase 1 if multi-tenancy is required.

## 25. User profile creation

- Transactional-ish: `AuthService.signUp` creates `User` with a nested `profile: { create: {} }` in one Prisma call, then a separate `prisma.userRole.create` call for the default role. The role assignment is **not** in the same transaction as user creation — a failure between the two calls would leave a user with no role. Minor but real gap; should be wrapped in `prisma.$transaction` in Phase 1.

## 26–27. Database triggers / functions

- None. All logic is in the application layer (Prisma + NestJS), consistent with the stated principle of not burying business logic in DB triggers. No stored procedures, no RLS (Postgres Row-Level Security is not used — authorization is enforced entirely in the API layer via `SessionGuard`/`assertPermission`).

## 28–32. Environment variables / dev / preview / staging / production configuration

- Typed, validated env schema in `@saas/config` (`loadPrivateEnv`, `loadPublicEnv`, Zod-based), fails fast on missing/invalid required vars.
- Single `.env.example` documents all variables with inline section comments; no per-environment files exist (`.env.staging`, etc.) — environment separation is described in `docs/deployment/ENVIRONMENTS.md` as a policy, but **no actual preview/staging/production config, secrets, or hosting has been provisioned**. This is all still a plan, not live infrastructure.

## 33. Deployment configuration

- `apps/api/Dockerfile` and `apps/web/Dockerfile` exist (multi-stage, pnpm-aware). **`apps/admin` and `apps/worker` have no Dockerfile yet** — gap.
- `.github/workflows/ci.yml` runs format/lint/typecheck/test/build/audit + a Postgres+Redis service container, plus a separate `gitleaks` secret-scan job. **Never actually executed against GitHub Actions** (no commits/pushes have been made) — status is "written, not run." **Unable to verify** it passes in GH Actions; only local equivalents (`pnpm lint`, partial `pnpm build`) have been run in this session.
- No CD/release automation exists (no Vercel project linked, no container registry push step, no environment promotion workflow) — `docs/deployment/DEPLOYMENT.md` describes the intended pipeline, none of it is wired to real infrastructure.

## 34–38. CORS / CSP / redirects / domains / HTTPS

- **CORS:** explicit allowlist from `API_CORS_ALLOWED_ORIGINS`, enforced in `apps/api/src/main.ts` via a custom origin callback (not a wildcard). Credentials enabled.
- **CSP:** `@saas/security`'s `buildContentSecurityPolicy`/`buildSecurityHeaders` exist but are **not wired into any app's actual response headers**. `apps/api/src/main.ts` explicitly disables Helmet's CSP (`contentSecurityPolicy: false`) with a comment deferring it to "the edge/CDN for the web/admin apps" — but nothing currently sets CSP on `apps/web`/`apps/admin` responses either (`next.config.mjs` only sets `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`). **CSP is effectively not enforced anywhere right now** — flag as a Phase 1 priority, not a nice-to-have.
- **Redirect handling:** `isAllowedRedirect` exists and is used in the web login page for the `?next=` param; not applied anywhere else a redirect target comes from user input.
- **Domains:** none configured; all URLs are `localhost` defaults in `.env.example`.
- **HTTPS:** not enforced anywhere (no HSTS header set in practice — `buildSecurityHeaders` includes HSTS but, as above, isn't wired in). Local dev is HTTP-only by design; this is fine for local but the "always HTTPS in production" rule is currently just documentation, not code.

## 39. Storage

- `@saas/storage`: S3-compatible abstraction (AWS SDK v3), MIME allowlist, unpredictable object keys, signed upload/download URLs. **Not connected to any app** — no controller/endpoint in `apps/api` calls it yet, and no bucket is provisioned. Interface-complete, integration-incomplete.

## 40–43. Third-party integrations / analytics / monitoring / error tracking

- **Analytics:** `@saas/analytics` single abstraction (`track/identify/page/reset/consentUpdated`), gated by a cookie-consent banner in `apps/web`. No concrete provider (Segment/PostHog/etc.) wired — it's a no-op `NoopAnalyticsProvider` until `configureAnalyticsProvider` is called, which nothing currently does.
- **Monitoring/observability:** `@saas/observability` gives a structured Pino logger with secret redaction. No metrics exporter, no dashboards.
- **Error tracking:** Sentry env var (`SENTRY_DSN`) reserved in config; **no `@sentry/*` package installed, no init code anywhere**. Currently 100% unimplemented beyond the placeholder env var.
- **Tracing:** `OTEL_EXPORTER_OTLP_ENDPOINT` reserved similarly; no OpenTelemetry SDK installed or initialized.

## 44. Testing

- Test tooling declared (Vitest in most packages' `package.json`, Supertest+Vitest devDeps in `apps/api`), but **actual test coverage is minimal**: one real spec exists (`apps/api/test/redirect-security.spec.ts`, 4 assertions on `isAllowedRedirect`). No auth lifecycle tests, no Playwright config/tests despite `test:e2e` script and `tests/e2e` being referenced in docs, no accessibility/performance/security test suites despite `tests/` being documented as a top-level convention. **The `tests/` directory referenced throughout docs does not exist on disk yet.**

## 45. CI and CD

- See §33. CI workflow is written but unexecuted; CD does not exist.

## 46. Existing security controls (what's actually enforced today vs. documented intent)

| Control                                              | Status                                                                                                                                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Password hashing (argon2id)                          | ✅ implemented, server-only module                                                                                                                                                     |
| Refresh/verification/OTP token hashing (SHA-256)     | ✅ implemented                                                                                                                                                                         |
| Rate limiting on auth endpoints                      | ✅ implemented (`@nestjs/throttler`)                                                                                                                                                   |
| Account enumeration resistance (reset/OTP)           | ✅ implemented (neutral responses)                                                                                                                                                     |
| Session revocation checked server-side per request   | ✅ implemented                                                                                                                                                                         |
| CORS allowlist                                       | ✅ implemented                                                                                                                                                                         |
| CSP / HSTS / security headers                        | ❌ written but not wired into any running app (see §34–38)                                                                                                                             |
| CSRF protection                                      | ❌ not implemented — relies on `SameSite=Lax` + CORS only; no CSRF token/double-submit pattern exists. For a cross-origin web→API architecture this is a real gap to close in Phase 1. |
| Centralized authorization (`can`/`assertPermission`) | ✅ implemented, used in `profile` module                                                                                                                                               |
| Audit logging of privileged actions                  | ⚠️ table exists (`audit_logs`), nothing writes to it yet — only `security_events` is actually populated                                                                                |
| Secret scanning in CI                                | ✅ configured (gitleaks job), unexecuted                                                                                                                                               |
| Dependency scanning in CI                            | ✅ `pnpm audit` step, non-blocking (`                                                                                                                                                  |     | true`), unexecuted |

## 47. Existing documentation

Present and reviewed: `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `docs/{architecture,authentication,authorization,database,api,privacy,deployment,testing,security,decisions}/*`. These describe **intended** behavior; this Phase 0 document is the first pass at reconciling docs against what is actually implemented, and several gaps above were found precisely because the docs described more than the code currently does (CSP, CSRF, audit logging, OAuth, MFA, Sentry/OTel, Playwright/e2e tests).

## 48. Existing technical debt / known gaps (consolidated)

1. **Auth provider durability bug**: `StubAuthProvider` is in-memory while `User`/`AuthIdentity` rows are persisted — restart loses all passwords without losing accounts. Must fix before any real usage.
2. **Prisma client cannot currently be generated in this sandboxed environment** (proxy blocks engine download) — blocks verifying `apps/api`/`apps/worker`/`@saas/database` builds end-to-end here.
3. **CSP/HSTS not actually applied** to any response despite the package existing.
4. **No CSRF protection** for the cross-origin cookie-auth flow.
5. **No OAuth provider implementation** (interfaces only).
6. **No MFA/TOTP** implementation.
7. **No real email provider** — all "sent" emails are console logs.
8. **No audit log writes** — table exists, nothing populates it.
9. **Signup is not fully transactional** (user creation and role assignment are separate calls).
10. **No centralized frontend route-protection in `apps/admin`** (only a per-page fetch+redirect pattern; `apps/web` already has a proper `middleware.ts`).
11. **No Dockerfiles** for `apps/admin`/`apps/worker`.
12. **No test suite** beyond one unit spec; `tests/e2e` etc. referenced in docs don't exist on disk.
13. **CI workflow unexecuted** — written but never run against GitHub Actions; cannot claim it passes.
14. **No multi-tenancy/organization scoping** in the schema — single-tenant assumption.
15. **Storage package unintegrated** — no endpoint uses it yet.
16. **Analytics/Sentry/OTel are interface-only** — no concrete provider wired for any of them.

---

## Trust boundary summary (for later phases)

```
Browser (untrusted)
  │  HTTPS (not yet enforced locally), cookies only, no tokens in JS-readable storage
  ▼
apps/web / apps/admin  (Next.js — public + session-cookie-aware, no DB/secret access)
  │  fetch(..., credentials: include) — CORS-restricted, cookie-domain assumption unresolved (see §10-14)
  ▼
apps/api  (NestJS — the only trust boundary that holds DB/auth-provider credentials)
  │  Prisma (parameterized queries only, no RLS)
  ▼
PostgreSQL / Redis (private network, no public ingress assumed)
```

`apps/worker` sits beside `apps/api` with its own direct DB/Redis access (no HTTP boundary
between them) — this is intentional for background jobs but means worker code must uphold the
same input-trust discipline as the API, since it reads data the API already validated but may
also read attacker-influenced data via future webhook ingestion (`webhook_events` table exists,
no ingestion endpoint implemented yet).

---

Phase 0 is complete for the purposes of establishing this baseline. Proceed to Phase 1 only
after you (the requester) confirm which of the 16 gaps in §48 are in scope before implementation
begins, since several of them (CSRF, auth provider durability, CSP enforcement) are security-load-bearing
and should be prioritized first regardless of what Phase 1's stated topic turns out to be.
