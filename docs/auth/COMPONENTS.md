# Components

One entry per item in the "Authentication map" checklist, per
[AUTH_RULES.md](../../AUTH_RULES.md). Every entry answers all 8 questions. Phase 1
entries are marked **Planned** — they describe intent and, where code already exists
from prior work, the current real file. Later phases change each entry's status to the
real, verified file paths once implemented/audited and update the 8 answers to match
actual behavior, not the plan.

## Template

Copy this block for new components discovered in later phases.

```
### <Component name> (<file path>) — <Planned | Implemented>

1. **What it does:**
2. **What calls it:**
3. **What it calls:**
4. **What data it receives:**
5. **What data it returns:**
6. **What happens when it fails:**
7. **Whether it is secure:**
8. **Whether it can create inconsistent state:**
```

## Component inventory (Authentication map checklist)

### 1. Every login page — Planned

`apps/web/src/app/(auth)/login/page.tsx` _(existing, pre-dates this phase)_

1. Renders the email/password login form and OAuth entry points.
2. Routed to by unauthenticated visitors to `/login`, and by middleware/guard redirects.
3. Calls `apps/web` login form component → `@saas/api-client` → `POST /auth/login`.
4. Receives `?next=` query param (redirect target) and user input (email, password).
5. Returns rendered HTML; on success, browser navigation to dashboard.
6. On failure, renders the error returned by the API inline; never throws unhandled.
7. **Planned to be secure**: no credentials persisted client-side, `next` passed through `isAllowedRedirect`. To be confirmed in Phase 3/9.
8. **Planned**: none — page itself is stateless; risk lives in the API, not here.

### 2. Every login component — Planned

`apps/web/src/components/auth/login-form.tsx` _(existing, pre-dates this phase)_

1. Collects and client-validates email/password via React Hook Form + Zod, submits to the API.
2. Called by the login page.
3. Calls `@saas/api-client`'s auth client.
4. Receives form field values.
5. Returns a submit result (success/redirect or typed error) to the page.
6. On failure, surfaces the API's error message without echoing raw request/response bodies.
7. **Planned to be secure**: no logging of password value; disabled-while-submitting to reduce double-submit (Phase 11 hardens this explicitly).
8. **Planned**: double-click/double-submit race is a known edge case, owned by Phase 11/17.

### 3. Every authentication function — Planned

`apps/api/src/auth/auth.service.ts` (`AuthService`) _(existing, pre-dates this phase)_

1. Implements signup, login, refresh, logout, verify-email, password-reset, OTP, OAuth, session revocation business logic.
2. Called only by `AuthController`.
3. Calls the `AuthProvider` adapter (Phase 2+ concrete implementation), Prisma (`packages/database`), `@saas/email`.
4. Receives validated DTOs plus request context (IP, user agent).
5. Returns domain results (tokens, session metadata) or throws typed Nest exceptions.
6. On failure, throws a structured exception mapped to a stable HTTP status by `AllExceptionsFilter`; never leaks internals.
7. **Planned to be secure**: never logs raw secrets (rule 3); hashes all stored tokens.
8. **Known risk carried from prior discovery**: signup's user-create and role-assign are not yet in one atomic transaction — flagged for Phase 2/3 to fix, to be recorded as a finding once confirmed against current code.

### 4. Every API endpoint — Planned

`apps/api/src/auth/auth.controller.ts` (`AuthController`) _(existing, pre-dates this phase)_

1. Exposes REST endpoints: `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/refresh`, `/auth/me`, `/auth/verify-email`, `/auth/password-reset/request`, `/auth/password-reset/confirm`, OTP endpoints, OAuth start/callback endpoints (Phase 6+), `/auth/sessions/revoke-others`.
2. Called by `apps/web`/`apps/admin` via `@saas/api-client`.
3. Calls `AuthService`, `PrincipalService`.
4. Receives Zod-validated DTOs (`ZodValidationPipe`).
5. Returns JSON + `Set-Cookie` headers where applicable.
6. On failure, returns a normalized `ApiError` shape via `AllExceptionsFilter`.
7. **Planned to be secure**: per-route `@Throttle()` rate limits; no endpoint trusts client-asserted identity.
8. **Planned**: none at the controller layer — it is intentionally thin.

### 5. Every server action — Planned

Not applicable in the current architecture: `apps/web`/`apps/admin` use client/server
components calling REST endpoints via `@saas/api-client`, not Next.js Server Actions, for
auth flows. **Status: Planned — no change proposed.** If a future phase introduces a
Server Action for any auth-adjacent mutation, it must be added here with all 8 answers
before merging, per `AUTH_RULES.md` rule 1.

### 6. Every auth hook — Planned

`apps/web/src/lib/` _(not yet implemented — TanStack Query wiring is an open gap, see ARCHITECTURE.md §1.1)_

1. **Planned**: a `useSession`/`useAuth` hook wrapping `GET /auth/me` via TanStack Query, exposing principal + loading/error state.
2. Called by any component needing current-user/auth state (nav, protected layouts).
3. Calls `@saas/api-client`.
4. Receives nothing (reads cookies implicitly via `credentials: "include"`).
5. Returns `{ principal, isLoading, error }` shape.
6. On failure (401), triggers the refresh flow before surfacing a logged-out state.
7. **Planned to be secure**: never stores the principal/tokens outside the TanStack Query cache (in-memory only).
8. **Planned risk to track**: stale cache after logout in another tab — owned by Phase 11/17 (cross-tab synchronization).

### 7. Every auth context/provider — Planned

`apps/web/src/app/providers.tsx` (or equivalent root providers file) _(not yet implemented for auth; QueryClientProvider wiring is an open gap)_

1. **Planned**: wraps the app in `QueryClientProvider` so the auth hook (#6) has a cache.
2. Called by the root layout.
3. Calls nothing directly; configures TanStack Query client.
4. Receives children.
5. Returns the wrapped React tree.
6. On failure, a query error renders the hook's error state, not a provider-level crash.
7. **Planned to be secure**: holds no secrets; query cache lives client-side (acceptable since it only ever holds the already-public-to-the-user principal shape, never raw tokens).
8. **Planned**: none beyond the cache staleness risk tracked under #6.

### 8. Every middleware — Planned

`apps/web/src/middleware.ts` _(existing, pre-dates this phase)_ and
`apps/api` `SessionGuard` (`apps/api/src/auth/session.guard.ts`) _(existing)_

1. `apps/web` middleware: UX-only redirect for cookie-less requests to known protected paths. `SessionGuard`: verifies the access JWT and re-checks the DB `Session` row on every guarded request — this is the real security boundary.
2. Middleware is invoked by Next.js routing; `SessionGuard` is invoked via `@UseGuards(SessionGuard)` on protected controllers.
3. Middleware checks cookie presence only (no DB call). `SessionGuard` calls `AuthService.verifyAccessToken` and Prisma.
4. Middleware receives the request path + cookies. `SessionGuard` receives the `app_session` cookie.
5. Middleware returns a redirect or pass-through. `SessionGuard` attaches `request.principal` or throws 401.
6. Middleware fails open to pass-through on a matcher miss (documented, non-authoritative). `SessionGuard` fails closed — throws 401 on any failure.
7. **Explicitly documented**: `apps/web` middleware is never the security boundary (`AUTH_RULES.md` rule 6); `SessionGuard` is.
8. **Planned**: none — this split is already the correct pattern per the stack's requirements; Phase 1 confirms it, future phases re-verify it hasn't regressed.

### 9. Every protected route — Planned

`apps/web/src/app/(dashboard)/**`, `apps/admin/src/app/**` _(existing shells, pre-date this phase)_

1. Renders authenticated-only UI (dashboard, settings, admin screens).
2. Reached via navigation after login, or direct URL entry.
3. Calls the API (`/auth/me`, resource endpoints) server-side (admin) or client-side (web) to confirm/fetch data.
4. Receives forwarded cookies.
5. Returns rendered page, or a redirect to `/login` / `/forbidden` on 401/403 from the API.
6. On API failure, redirects rather than rendering a partial authenticated page.
7. **Planned to be secure**: every protected route's real authorization is the API's response, not the route's own client-side check.
8. **Planned**: flash-of-protected-content before redirect is a known edge case, owned by Phase 11.

### 10. Every redirect — Planned

`apps/web/src/lib/redirect-allowlist.ts` (or equivalent `isAllowedRedirect` helper) _(existing, pre-dates this phase)_

1. Validates any `?next=`/callback redirect target against an allowlist of same-origin, known-safe paths.
2. Called by login/signup/OAuth-callback pages before navigating.
3. Calls nothing (pure function).
4. Receives a candidate redirect string.
5. Returns a safe path or a default fallback.
6. On an invalid target, silently falls back to the default dashboard — never follows an attacker-supplied external URL.
7. **Planned to be secure**: this is the open-redirect control named in the threat model (ARCHITECTURE.md §4).
8. **Planned**: none.

### 11. Every token/session handler — Planned

`apps/api/src/auth/auth.service.ts` (token issuance/rotation), `Session`/`VerificationToken` Prisma models

1. Issues/verifies/rotates access JWTs, refresh tokens, and purpose-scoped verification tokens (email verification, password reset, OTP).
2. Called by `AuthService`'s login/refresh/signup/verify/reset/OTP methods.
3. Calls Prisma (`Session`, `VerificationToken` tables) and a signing library (`jsonwebtoken` or equivalent).
4. Receives a user id, purpose, and TTL.
5. Returns a signed/opaque token plus its hashed, stored counterpart.
6. On failure (DB write error), the action that requested the token fails closed — no token is returned to the client without a persisted record.
7. **Planned to be secure**: tokens are hashed before storage; raw tokens never logged (rule 3); JWT `issuer`/`audience`/algorithm-allowlist hardening is a named gap for Phase 3 (see threat model).
8. **Planned risk**: no transactional guarantee today between a token-consuming auth action and its `security_events` write — flagged in ARCHITECTURE.md §3, owned by Phase 2/3.

### 12. Every database table related to users/auth — Planned

`packages/database/prisma/schema.prisma`: `users`, `profiles`, `auth_identities`,
`sessions`, `roles`, `permissions`, `role_permissions`, `user_roles`, `security_events`,
`audit_logs`, `verification_tokens` _(existing, pre-date this phase — see ARCHITECTURE.md §5 for the full data connection diagram)_

1. Store user identity, credentials-linkage, session, role/permission, and audit state.
2. Read/written exclusively through Prisma from `apps/api`/`apps/worker`.
3. N/A (leaf data layer).
4. Receives typed rows via Prisma Client.
5. Returns typed rows via Prisma Client.
6. On a constraint violation (e.g. duplicate email), Prisma throws a typed error `AuthService` maps to `409`.
7. **Planned to be secure**: no RLS policies exist (see D10, open question); access control is Prisma/API-layer only today.
8. **Known gap**: `audit_logs` is not yet written to by any code — recorded in ARCHITECTURE.md §5 as a confirmed gap, not a live risk since nothing uses it yet.

### 13. Every database policy — Planned

**Status: Planned — none exist today.** No Postgres RLS policies are defined in the
current schema (see D10 in ARCHITECTURE.md §7). If the human confirms RLS is required
(open question #9), this entry becomes real policies with full answers to all 8
questions in a later phase.

### 14. Every trigger — Planned

**Status: Planned — none exist today.** No Postgres triggers/functions are defined in
the current schema. User/profile creation and role assignment happen in Prisma
application code (`AuthService`), not database triggers. No change proposed unless a
later phase identifies a race condition (see TRACEABILITY.md Phase 3, item 24) that a
trigger would close more reliably than application-level transaction handling.

### 15. Every edge/server function — Planned

**Status: Planned — not applicable in the current architecture.** There are no
Vercel Edge Functions or Next.js Route Handlers used for auth; all server-side auth
logic lives in `apps/api` (NestJS). If a future phase introduces one (e.g. an OAuth
callback handled at the edge), it must be added here with all 8 answers first.

### 16. Every environment variable — Planned

See [ARCHITECTURE.md](ARCHITECTURE.md) §6 for the full inventory (name, purpose,
server-only/public, required environment, build-time/runtime). Not duplicated here to
avoid drift between two sources of truth; ARCHITECTURE.md §6 is authoritative.

### 17. Every external authentication dependency — Planned

1. Managed auth provider (Supabase Auth — proposed, pending human confirmation per D2),
   email delivery provider (`EMAIL_PROVIDER`), and OAuth providers (Google required;
   Microsoft/GitHub optional, pending D5).
2. Called by the `AuthProvider`/`OAuthProvider` adapter implementations (concrete
   adapters are Phase 2+ work; only interfaces exist today in `@saas/auth`).
3. Each dependency calls back into our `/auth/*` endpoints (OAuth redirect) or is called
   directly by `AuthService` (password/OTP/email verification via the provider SDK).
4. Receives credentials/authorization codes/tokens scoped to the minimum needed per
   provider.
5. Returns identity confirmation, tokens, or delivery confirmation.
6. On failure, `AuthService` maps provider errors to a generic `ApiError` — provider
   error details are never surfaced raw to the client (rule 3/8 — avoid leaking
   provider internals as a side channel).
7. **Planned to be secure**: all provider secrets are server-only env vars (ARCHITECTURE.md §6); no provider SDK call is ever made from `apps/web`/`apps/admin`.
8. **Planned risk**: a provider outage must degrade to a clear, safe error (not a silent
   hang or an exposed stack trace) — to be verified against real adapter code once
   implemented in Phase 2+.
