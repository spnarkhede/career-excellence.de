# Traceability Matrix

This file tracks every checklist item from the authentication workstream phases (0-21)
against its implementing files, tests, and status, per [AUTH_RULES.md](../AUTH_RULES.md).
Every item is copied exactly as specified. Status values are restricted to the set defined
in AUTH_RULES.md rule 13. All items start as "Not started" until implemented and verified.

## LAUNCH: DEVELOPMENT LOGS (Phase 0)

| Item                                | Phase | Implementing files                                                                                      | Tests                        | Status      | Notes |
| ----------------------------------- | ----- | ------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------- | ----- |
| 1. Development logs with versioning | 0     | package.json, CHANGELOG.md, docs/devlog/, commitlint.config.cjs, .husky/commit-msg, scripts/release.mjs | Requires manual verification | Not started |       |

## SYSTEM UNDERSTANDING (Phase 1)

| Item                                        | Phase | Implementing files        | Tests                        | Status                       | Notes |
| ------------------------------------------- | ----- | ------------------------- | ---------------------------- | ---------------------------- | ----- |
| 1. Frontend framework                       | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 2. Backend architecture                     | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 3. Database                                 | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 4. Authentication provider                  | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 5. API architecture                         | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 6. Session architecture                     | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 7. Cookies                                  | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 8. Tokens                                   | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 9. JWT handling                             | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 10. Refresh tokens                          | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 11. OAuth/social login                      | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 12. Email/password authentication           | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 13. OTP authentication                      | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 14. Email verification                      | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 15. Password reset                          | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 16. Session persistence                     | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 17. Middleware                              | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 18. Protected routes                        | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 19. Role-based access                       | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 20. Permission system                       | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 21. User profile creation                   | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 22. Database triggers/functions             | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 23. Environment variables                   | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 24. Production configuration                | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 25. Development configuration               | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 26. Deployment configuration                | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 27. CORS                                    | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 28. CSP                                     | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 29. Redirect URLs                           | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 30. Domain configuration                    | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 31. HTTPS configuration                     | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 32. Storage/auth dependencies               | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |
| 33. Third-party authentication integrations | 1     | docs/auth/ARCHITECTURE.md | Requires manual verification | Requires manual verification |       |

## LIFECYCLE TRACING (Phase 1)

| Item                                                                                                                                                                                                                | Phase | Implementing files                               | Tests                        | Status                       | Notes |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------ | ---------------------------- | ---------------------------- | ----- |
| 1. Login lifecycle: User → Login UI → Validation → Authentication request → Backend/Auth provider → Database → Session/token creation → Storage → Auth state → Application state → Protected route → User dashboard | 1     | docs/auth/FLOWS.md, docs/auth/ARCHITECTURE.md §2 | Requires manual verification | Requires manual verification |       |
| 2. Logout lifecycle                                                                                                                                                                                                 | 1     | docs/auth/FLOWS.md, docs/auth/ARCHITECTURE.md §2 | Requires manual verification | Requires manual verification |       |
| 3. Refresh lifecycle                                                                                                                                                                                                | 1     | docs/auth/FLOWS.md, docs/auth/ARCHITECTURE.md §2 | Requires manual verification | Requires manual verification |       |
| 4. Signup lifecycle                                                                                                                                                                                                 | 1     | docs/auth/FLOWS.md, docs/auth/ARCHITECTURE.md §2 | Requires manual verification | Requires manual verification |       |
| 5. Verification lifecycle                                                                                                                                                                                           | 1     | docs/auth/FLOWS.md, docs/auth/ARCHITECTURE.md §2 | Requires manual verification | Requires manual verification |       |
| 6. Password reset lifecycle                                                                                                                                                                                         | 1     | docs/auth/FLOWS.md, docs/auth/ARCHITECTURE.md §2 | Requires manual verification | Requires manual verification |       |
| 7. OAuth lifecycle                                                                                                                                                                                                  | 1     | docs/auth/FLOWS.md, docs/auth/ARCHITECTURE.md §2 | Requires manual verification | Requires manual verification |       |
| 8. Session expiration lifecycle                                                                                                                                                                                     | 1     | docs/auth/FLOWS.md, docs/auth/ARCHITECTURE.md §2 | Requires manual verification | Requires manual verification |       |

## AUTHENTICATION MAP COMPONENTS (Phase 1)

| Item                                           | Phase | Implementing files      | Tests                        | Status                       | Notes |
| ---------------------------------------------- | ----- | ----------------------- | ---------------------------- | ---------------------------- | ----- |
| 1. Every login page                            | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |
| 2. Every login component                       | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |
| 3. Every authentication function               | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |
| 4. Every API endpoint                          | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |
| 5. Every server action                         | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |
| 6. Every auth hook                             | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |
| 7. Every auth context/provider                 | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |
| 8. Every middleware                            | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |
| 9. Every protected route                       | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |
| 10. Every redirect                             | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |
| 11. Every token/session handler                | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |
| 12. Every database table related to users/auth | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |
| 13. Every database policy                      | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |
| 14. Every trigger                              | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |
| 15. Every edge/server function                 | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |
| 16. Every environment variable                 | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |
| 17. Every external authentication dependency   | 1     | docs/auth/COMPONENTS.md | Requires manual verification | Requires manual verification |       |

## LAUNCH: SECURITY BASICS (Phase 2)

| Item                       | Phase | Implementing files                                                                                                    | Tests                                                                                                  | Status            | Notes                                                                                                                                                                                                                                             |
| -------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Remove frontend secrets | 2     | packages/config/src/guard.ts, scripts/check-bundle-for-secrets.ts, apps/web/src/lib/env.ts, apps/admin/src/lib/env.ts | scripts/check-bundle-for-secrets.spec.ts; `pnpm check:bundle-secrets` against real `pnpm build` output | Confirmed working | Fixed a real bug: the script scanned all of `.next/` (including server-only SSR chunks, which legitimately bundle private var _names_), producing false positives. Narrowed to `.next/static` only, the directory actually served to the browser. |
| 2. Enforce HTTPS           | 2     | apps/api/src/common/https-redirect.middleware.ts                                                                      | apps/api/test/https-redirect.spec.ts (3 tests)                                                         | Confirmed working | Redirects to HTTPS (308) only when `APP_ENV=production`; trusts `X-Forwarded-Proto` behind the load balancer.                                                                                                                                     |

## DATABASE TABLES AND DATA CONNECTIONS (Phase 3)

| Item | Phase | Implementing files | Tests | Status | Notes |
| ----------------------------------------------------------------------------------- | ----- | users table: id/email(citext,unique)/emailVerifiedAt/passwordHash/status/failedLoginCount/lockedUntil/timestamps/deletedAt — packages/database/prisma/schema.prisma, packages/database/prisma/migrations/00000000000001_phase3_auth_tables/migration.sql | apps/api/test/signup-integrity.integration.spec.ts; apps/api/test/cascade-and-soft-delete.integration.spec.ts | Requires manual verification | ----- |
| 1. User table | 3 | profiles table: userId PK+FK cascade, display fields, createdAt+updatedAt — packages/database/prisma/schema.prisma, packages/database/prisma/migrations/00000000000001_phase3_auth_tables/migration.sql | apps/api/test/cascade-and-soft-delete.integration.spec.ts | Requires manual verification | |
| 2. Profile table | 3 | auth_events, one_time_tokens, oauth_accounts, sessions tables — packages/database/prisma/schema.prisma, packages/database/prisma/migrations/00000000000001_phase3_auth_tables/migration.sql | apps/api/test/rls.integration.spec.ts (sessions); scripts/check-db-consistency.integration.spec.ts | Requires manual verification | |
| 3. Auth table | 3 | roles table (unchanged from Phase 2) — packages/database/prisma/schema.prisma, packages/database/prisma/migrations/00000000000001_phase3_auth_tables/migration.sql | apps/api/test/rls.integration.spec.ts (roles SELECT policy) | Requires manual verification | |
| 4. Roles | 3 | permissions table (unchanged from Phase 2) — packages/database/prisma/schema.prisma, packages/database/prisma/migrations/00000000000001_phase3_auth_tables/migration.sql | N/A — unchanged schema, no new test needed this phase | Requires manual verification | |
| 5. Permissions | 3 | Every relation declared with @relation + onDelete — packages/database/prisma/schema.prisma, packages/database/prisma/migrations/00000000000001_phase3_auth_tables/migration.sql | apps/api/test/cascade-and-soft-delete.integration.spec.ts | Requires manual verification | |
| 6. Foreign keys | 3 | users.email (citext unique), sessions.refreshTokenHash (unique), one_time_tokens.tokenHash (unique), oauth_accounts (provider,providerAccountId unique), role_permissions/user_roles composite PKs — packages/database/prisma/schema.prisma, packages/database/prisma/migrations/00000000000001_phase3_auth_tables/migration.sql | apps/api/test/signup-integrity.integration.spec.ts (email); scripts/check-db-consistency.spec.ts (duplicate-profile check, always 0 by PK) | Requires manual verification | |
| 7. Unique constraints | 3 | NOT NULL on every required column; passwordHash nullable only for OAuth/OTP-only accounts — packages/database/prisma/schema.prisma, packages/database/prisma/migrations/00000000000001_phase3_auth_tables/migration.sql | Requires manual verification — written review of schema.prisma against the Phase 3 column spec | Requires manual verification | |
| 8. Nullability | 3 | Defaults: status=pending_verification, failedLoginCount=0, timestamps=now(), familyId=uuid() — packages/database/prisma/schema.prisma, packages/database/prisma/migrations/00000000000001_phase3_auth_tables/migration.sql | Requires manual verification — written review of schema.prisma defaults | Requires manual verification | |
| 9. Default values | 3 | Decision: no database triggers — see docs/auth/ARCHITECTURE.md / FINDINGS.md | N/A — deliberately not implemented, documented decision | Requires manual verification | |
| 10. Database triggers | 3 | Decision: no stored functions beyond app_current_user_id() (RLS helper) — migration.sql | apps/api/test/rls.integration.spec.ts | Requires manual verification | |
| 11. Functions | 3 | RLS enabled on users/profiles/sessions/one_time_tokens/oauth_accounts/auth_events/roles/permissions/role_permissions/user_roles — migration.sql | apps/api/test/rls.integration.spec.ts | Requires manual verification | |
| 12. Row-level security | 3 | app_anon / app_authenticated roles + policies — migration.sql | apps/api/test/rls.integration.spec.ts | Requires manual verification | |
| 13. RLS policies | 3 | No INSERT policy for app_authenticated on any table (server-mediated only) — migration.sql | apps/api/test/rls.integration.spec.ts (INSERT rejected) | Requires manual verification | |
| 14. Insert policies | 3 | SELECT-own policies on users/profiles/sessions/one_time_tokens/oauth_accounts/auth_events/user_roles; SELECT-all on roles/permissions/role_permissions — migration.sql | apps/api/test/rls.integration.spec.ts | Requires manual verification | |
| 15. Select policies | 3 | UPDATE-own (WITH CHECK) policies on profiles/sessions/one_time_tokens — migration.sql | apps/api/test/rls.integration.spec.ts | Requires manual verification | |
| 16. Update policies | 3 | No DELETE policy for app_authenticated on any table — migration.sql | apps/api/test/rls.integration.spec.ts (DELETE rejected) | Requires manual verification | |
| 17. Delete policies | 3 | Decision: apps/api's existing DATABASE_URL role is the schema owner and bypasses RLS (FORCE ROW LEVEL SECURITY deliberately not set) — see docs/auth/ARCHITECTURE.md / FINDINGS.md | Requires manual verification — architectural decision, not independently testable | Requires manual verification | |
| 18. Service-role usage | 3 | app_anon has zero grants on every auth table — migration.sql | apps/api/test/rls.integration.spec.ts | Requires manual verification | |
| 19. Anonymous access | 3 | Role/permission assignment, account status changes — service-role (owner) connection only, never app_authenticated | apps/api/test/rls.integration.spec.ts (no write grant for app_authenticated) | Requires manual verification | |
| 20. Privileged queries | 3 | AuthService.signUp: single $transaction (user+profile+role) — apps/api/src/auth/auth.service.ts; self-healing upsert in PrincipalService.resolve | apps/api/test/signup-integrity.integration.spec.ts; apps/api/test/signup-integrity.integration.spec.ts (transaction atomicity) | Requires manual verification | |
| 21. User/profile synchronization | 3 | Self-healing profile creation in PrincipalService.resolve — apps/api/src/auth/principal.service.ts | scripts/check-db-consistency.integration.spec.ts | Requires manual verification | |
| 22. Orphaned users | 3 | profiles.userId is the primary key — structurally impossible; defensive check anyway — scripts/check-db-consistency.ts | scripts/check-db-consistency.spec.ts; scripts/check-db-consistency.integration.spec.ts | Requires manual verification | |
| 23. Duplicate profiles | 3 | Single $transaction in AuthService.signUp closes the race between user-create and role-assign | apps/api/test/signup-integrity.integration.spec.ts (10 concurrent signups; 2 concurrent same-email signups) | Requires manual verification | |
| 24. Race conditions during profile creation | 3 | scripts/check-db-consistency.ts: orphanedUsers, usersWithoutRoles, duplicateProfileUserIds, danglingSessions | scripts/check-db-consistency.spec.ts; scripts/check-db-consistency.integration.spec.ts | Requires manual verification | |
| 25. Missing records | 3 | ON DELETE CASCADE from users to profiles/sessions/oneTimeTokens/oauthAccounts/userRoles/etc — schema.prisma | apps/api/test/cascade-and-soft-delete.integration.spec.ts | Requires manual verification | |
| 26. Deleted records | 3 | users.deletedAt + status=deleted; AuthService.softDeleteAccount revokes all sessions, blocks login — apps/api/src/auth/auth.service.ts | apps/api/test/cascade-and-soft-delete.integration.spec.ts | Requires manual verification | |
| 27. Soft-deleted accounts | 3 | scripts/check-db-consistency.ts as the single source of truth for consistency | scripts/check-db-consistency.spec.ts; scripts/check-db-consistency.integration.spec.ts | Requires manual verification | |
| 28. Data consistency | 3 | PrincipalService.resolve: active-status gate + self-healing profile + role/permission resolution — apps/api/src/auth/principal.service.ts | apps/api/test/signup-integrity.integration.spec.ts; apps/api/test/rls.integration.spec.ts | Requires manual verification | |
| 29. A newly authenticated user reliably obtains the correct profile and permissions | 3 | | | Not started | |

## SIGNUP AND VERIFICATION (Phase 4)

| Item                          | Phase | Implementing files                                                                                         | Tests                                                                                                               | Status                                                                                                                                   | Notes |
| ----------------------------- | ----- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1. Signup                     | 4     | apps/api/src/auth/auth.service.ts signUp()                                                                 | apps/api/test/phase4-signup-verification.integration.spec.ts                                                        | Requires manual verification                                                                                                             |       |
| 2. Duplicate account          | 4     | apps/api/src/auth/auth.service.ts signUp() duplicate branch (no create, notice email)                      | apps/api/test/phase4-signup-verification.integration.spec.ts; apps/api/test/signup-integrity.integration.spec.ts    | Requires manual verification                                                                                                             |       |
| 3. Email verification         | 4     | apps/api/src/auth/auth.service.ts verifyEmail()                                                            | apps/api/test/phase4-signup-verification.integration.spec.ts                                                        | Requires manual verification                                                                                                             |       |
| 4. Verification expiration    | 4     | apps/api/src/auth/auth.service.ts verifyEmail() expired branch                                             | apps/api/test/phase4-signup-verification.integration.spec.ts                                                        | Requires manual verification                                                                                                             |       |
| 5. Verification resend        | 4     | apps/api/src/auth/auth.service.ts sendVerificationEmail()/resendVerification() (invalidate-old-token)      | apps/api/test/phase4-signup-verification.integration.spec.ts                                                        | Requires manual verification                                                                                                             |       |
| 6. Unverified login           | 4     | apps/api/src/auth/auth.service.ts login() pending_verification check                                       | apps/api/test/phase4-signup-verification.integration.spec.ts                                                        | Requires manual verification                                                                                                             |       |
| 7. Password creation          | 4     | packages/validation/src/index.ts passwordSchema (NIST 800-63B)                                             | packages/validation/src/index.spec.ts; apps/api/test/phase4-signup-verification.integration.spec.ts                 | Confirmed working — the pure schema test (packages/validation/src/index.spec.ts) does not need a database and was actually run: 8/8 pass |       |
| 8. Weak password handling     | 4     | packages/validation/src/index.ts passwordSchema min/max boundaries                                         | packages/validation/src/index.spec.ts                                                                               | Confirmed working — actually run, 8/8 pass                                                                                               |       |
| 9. Account creation failure   | 4     | apps/api/src/auth/auth.service.ts signUp() $transaction                                                    | apps/api/test/phase4-signup-verification.integration.spec.ts                                                        | Requires manual verification                                                                                                             |       |
| 10. Partial account creation  | 4     | apps/api/src/auth/auth.service.ts signUp() $transaction (same guarantee as item 9)                         | apps/api/test/phase4-signup-verification.integration.spec.ts                                                        | Requires manual verification                                                                                                             |       |
| 11. Profile creation failure  | 4     | apps/api/src/auth/auth.service.ts signUp() nested profile create inside the same transaction               | apps/api/test/phase4-signup-verification.integration.spec.ts                                                        | Requires manual verification                                                                                                             |       |
| 12. Database trigger failure  | 4     | Decision: no database triggers exist — see docs/auth/ARCHITECTURE.md                                       | N/A — deliberately not implemented, documented decision                                                             | Requires manual verification                                                                                                             |       |
| 13. Email delivery failure    | 4     | apps/api/src/auth/auth.service.ts sendEmail() (try/catch + logger.error + requestId + distinct auth_event) | apps/api/test/phase4-signup-verification.integration.spec.ts                                                        | Requires manual verification                                                                                                             |       |
| 14. Verification redirect     | 4     | apps/web verify-email-client.tsx resolveRedirectTarget() via isAllowedRedirect                             | packages/security/src/index.spec.ts (isAllowedRedirect itself); manual verification needed for the page's own usage | Requires manual verification                                                                                                             |       |
| 15. Already verified account  | 4     | apps/api/src/auth/auth.service.ts verifyEmail() already_verified branch                                    | apps/api/test/phase4-signup-verification.integration.spec.ts                                                        | Requires manual verification                                                                                                             |       |
| 16. Expired verification link | 4     | apps/api/src/auth/auth.service.ts verifyEmail() expired branch (same as item 4)                            | apps/api/test/phase4-signup-verification.integration.spec.ts                                                        | Requires manual verification                                                                                                             |       |

## LOGIN PROCESS (Phase 5)

| Item                                                   | Phase | Implementing files                                                                                                              | Tests                                                                                  | Status                                                                                                                                                                     | Notes |
| ------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1. Empty email                                         | 5     | ZodValidationPipe + loginSchema (422)                                                                                           | apps/api/test/phase5-login.integration.spec.ts                                         | Requires manual verification                                                                                                                                               |       |
| 2. Invalid email                                       | 5     | ZodValidationPipe + loginSchema (422)                                                                                           | apps/api/test/phase5-login.integration.spec.ts                                         | Requires manual verification                                                                                                                                               |       |
| 3. Leading/trailing spaces                             | 5     | packages/validation emailSchema .trim()                                                                                         | apps/api/test/phase5-login.integration.spec.ts                                         | Requires manual verification                                                                                                                                               |       |
| 4. Upper/lowercase email handling                      | 5     | packages/validation emailSchema .toLowerCase()                                                                                  | apps/api/test/phase5-login.integration.spec.ts                                         | Requires manual verification                                                                                                                                               |       |
| 5. Empty password                                      | 5     | ZodValidationPipe + loginSchema (422)                                                                                           | apps/api/test/phase5-login.integration.spec.ts                                         | Requires manual verification                                                                                                                                               |       |
| 6. Incorrect password                                  | 5     | apps/api/src/auth/auth.service.ts login() dummy-hash timing protection                                                          | apps/api/test/phase5-login.integration.spec.ts                                         | Requires manual verification                                                                                                                                               |       |
| 7. Correct credentials                                 | 5     | apps/api/src/auth/auth.service.ts login() success path                                                                          | apps/api/test/phase5-login.integration.spec.ts                                         | Requires manual verification                                                                                                                                               |       |
| 8. Unverified account                                  | 5     | apps/api/src/auth/auth.service.ts login() pending_verification check (post-password)                                            | apps/api/test/phase5-login.integration.spec.ts                                         | Requires manual verification                                                                                                                                               |       |
| 9. Disabled account                                    | 5     | apps/api/src/auth/auth.service.ts login() disabled/deleted check (post-password)                                                | apps/api/test/phase5-login.integration.spec.ts                                         | Requires manual verification                                                                                                                                               |       |
| 10. Deleted account                                    | 5     | apps/api/src/auth/auth.service.ts login() disabled/deleted check (post-password)                                                | apps/api/test/phase5-login.integration.spec.ts                                         | Requires manual verification                                                                                                                                               |       |
| 11. Locked account                                     | 5     | apps/api/src/auth/auth.service.ts login() locked check + computeLockoutDuration (growing delay)                                 | apps/api/test/phase5-login.integration.spec.ts                                         | Requires manual verification                                                                                                                                               |       |
| 12. Rate-limited account                               | 5     | apps/api/src/common/redis-throttler-storage.ts (per-IP, Redis-backed); AuthService account-level lockout                        | No test exercises the Redis-backed per-IP throttler directly                           | Requires manual verification — written steps: run 21+ requests/min against /auth/login from one IP and confirm 429 with Retry-After                                        |       |
| 13. Network failure                                    | 5     | packages/api-client/src/index.ts (propagates fetch rejection)                                                                   | packages/api-client/src/index.spec.ts                                                  | Confirmed working — actually run, no DB needed                                                                                                                             |       |
| 14. Timeout                                            | 5     | packages/api-client/src/index.ts (AbortController + ApiClientTimeoutError)                                                      | packages/api-client/src/index.spec.ts                                                  | Confirmed working — actually run, no DB needed                                                                                                                             |       |
| 15. Server error                                       | 5     | apps/api/src/common/all-exceptions.filter.ts; packages/api-client non-2xx handling                                              | apps/api/test/all-exceptions-filter.spec.ts; packages/api-client/src/index.spec.ts     | Confirmed working — both actually run, no DB needed                                                                                                                        |       |
| 16. Auth-provider error                                | 5     | N/A — no external auth provider SDK is wired yet (StubAuthProvider/password hashing is in-process); deferred to the OAuth phase | N/A                                                                                    | Requires manual verification — no provider integration exists yet to test                                                                                                  |       |
| 17. Database error                                     | 5     | apps/api/src/common/all-exceptions.filter.ts (Prisma connection-error -> 503)                                                   | apps/api/test/all-exceptions-filter.spec.ts                                            | Confirmed working — actually run, no DB needed                                                                                                                             |       |
| 18. Invalid response                                   | 5     | packages/api-client/src/index.ts (malformed JSON error body fallback)                                                           | packages/api-client/src/index.spec.ts                                                  | Confirmed working — actually run, no DB needed                                                                                                                             |       |
| 19. Expired session                                    | 5     | apps/api/src/auth/auth.service.ts refresh()/session.guard.ts (Phase 3)                                                          | apps/api/test/rls.integration.spec.ts (session rows); no new Phase 5 test              | Requires manual verification                                                                                                                                               |       |
| 20. Existing session                                   | 5     | apps/web login/page.tsx (GET /auth/me redirect-if-authenticated)                                                                | No automated test (needs a browser)                                                    | Requires manual verification — written steps: log in, visit /login again, confirm immediate redirect to the dashboard without the form flashing                            |       |
| 21. Multiple login attempts                            | 5     | apps/api/src/auth/auth.service.ts login() computeLockoutDuration                                                                | apps/api/test/phase5-login.integration.spec.ts                                         | Requires manual verification                                                                                                                                               |       |
| 22. Double-click login                                 | 5     | apps/web login/page.tsx submitLock ref + isSubmitting                                                                           | No automated test (needs a browser)                                                    | Requires manual verification — written steps: rapid-double-click Log in, confirm only one request fires (Network tab) and no duplicate session is created                  |       |
| 23. Multiple simultaneous requests                     | 5     | apps/web login/page.tsx submitLock ref                                                                                          | No automated test (needs a browser)                                                    | Requires manual verification — same as item 22                                                                                                                             |       |
| 24. Slow network                                       | 5     | packages/api-client timeout (10s default)                                                                                       | No automated test under real network throttling                                        | Requires manual verification — written steps: Chrome DevTools Slow 3G, confirm the form times out cleanly rather than hanging forever                                      |       |
| 25. Offline mode                                       | 5     | packages/api-client/src/index.ts ApiClientOfflineError                                                                          | packages/api-client/src/index.spec.ts                                                  | Confirmed working — actually run, no DB needed                                                                                                                             |       |
| 26. Browser refresh during login                       | 5     | apps/web login/page.tsx (router.push after await, not before)                                                                   | No automated test (needs a browser)                                                    | Requires manual verification — written steps: submit, refresh mid-request, confirm no half-authenticated state                                                             |       |
| 27. Login from multiple tabs                           | 5     | Session rows are per-login, not per-tab — no special multi-tab handling exists or is needed server-side                         | No automated test                                                                      | Requires manual verification — written steps: log in in tab A, open tab B, confirm both show the same authenticated state after a /auth/me re-fetch                        |       |
| 28. Login from multiple devices                        | 5     | Sessions table supports unlimited concurrent sessions per user (Phase 3 schema)                                                 | No automated test                                                                      | Requires manual verification — written steps: log in from two different browsers, confirm both sessions are listed independently and revoking one doesn't affect the other |       |
| 29. Redirect after login                               | 5     | apps/web login/page.tsx resolveRedirectTarget() via isAllowedRedirect                                                           | packages/security/src/index.spec.ts (isAllowedRedirect itself, actually run)           | Confirmed working for the underlying helper; the page's own call site is Requires manual verification                                                                      |       |
| 30. Redirect loops                                     | 5     | apps/web login/page.tsx (redirect only fires once, on a resolved GET /auth/me)                                                  | No automated test                                                                      | Requires manual verification — written steps: confirm visiting /login while authenticated redirects exactly once, never bouncing back                                      |       |
| 31. Incorrect redirect destination                     | 5     | apps/web login/page.tsx resolveRedirectTarget()                                                                                 | packages/security/src/index.spec.ts                                                    | Confirmed working for the underlying helper (rejects non-allowlisted targets)                                                                                              |       |
| 32. Authentication state not updating                  | 5     | apps/web login/page.tsx + dashboard/page.tsx (both re-derive from the server, never assume)                                     | No automated test (needs a browser)                                                    | Requires manual verification                                                                                                                                               |       |
| 33. UI showing logged in while backend says logged out | 5     | apps/web dashboard/page.tsx (server-fetched /auth/me on every render, cache: no-store)                                          | No automated test                                                                      | Requires manual verification                                                                                                                                               |       |
| 34. Backend saying logged in while UI says logged out  | 5     | apps/web login/page.tsx (never sets local auth state from the login response itself)                                            | No automated test                                                                      | Requires manual verification                                                                                                                                               |       |
| 35. Session not persisting                             | 5     | apps/api session cookie TTL + Session.absoluteExpiresAt (Phase 3)                                                               | No new Phase 5 test                                                                    | Requires manual verification                                                                                                                                               |       |
| 36. Session disappearing after refresh                 | 5     | apps/api session cookie maxAge persists across refresh (HttpOnly cookie, not JS state)                                          | No automated test                                                                      | Requires manual verification                                                                                                                                               |       |
| 37. Login succeeding but dashboard failing             | 5     | apps/web dashboard/page.tsx + dashboard-error.tsx (DashboardError component, retry action)                                      | No automated test (needs a browser)                                                    | Requires manual verification                                                                                                                                               |       |
| 38. Login succeeding but profile loading failing       | 5     | apps/api PrincipalService.resolve self-healing profile create (Phase 3/4)                                                       | scripts/check-db-consistency tests cover the DB invariant; no new Phase 5 browser test | Requires manual verification                                                                                                                                               |       |
| 39. Login succeeding but permissions failing           | 5     | apps/web dashboard/page.tsx (any /auth/me failure renders DashboardError, never a blank page)                                   | No automated test (needs a browser)                                                    | Requires manual verification                                                                                                                                               |       |

## OTP AUTHENTICATION (Phase 6)

| Item                          | Phase | Implementing files                                                                                                                                                                                | Tests                                                                                                                                                    | Status                       | Notes                                                                                                                                                                                                                 |
| ----------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. OTP authentication         | 6     | apps/api/src/auth/auth.service.ts requestOtp()/verifyOtp(); auth.controller.ts /auth/otp/request, /auth/otp/verify; apps/web otp/page.tsx, otp/otp-client.tsx                                     | apps/api/test/phase6-otp.integration.spec.ts (happy-path test)                                                                                           | Requires manual verification | No live DB in this session; test is real (not mocked), skips cleanly via isDatabaseReachable() per AUTH_RULES.md rule 13. Frontend has no automated browser test.                                                     |
| 2. OTP generation and hashing | 6     | apps/api/src/auth/auth.service.ts requestOtp() (CSPRNG 6-digit code via @saas/security); packages/security/src/server.ts hashToken() (SHA-256)                                                    | apps/api/test/phase6-otp.integration.spec.ts ("stores only its hash" assertions: tokenHash !== code, does not contain code, matches 64-hex)              | Requires manual verification | Same DB-reachability caveat as item 1.                                                                                                                                                                                |
| 3. OTP expiration             | 6     | apps/api/src/auth/auth.service.ts OTP_TTL_MS = 5 minutes; verifyOtp() expiresAt check                                                                                                             | apps/api/test/phase6-otp.integration.spec.ts ("rejects an expired code without consuming it")                                                            | Requires manual verification | Same DB-reachability caveat as item 1.                                                                                                                                                                                |
| 4. OTP attempt limits         | 6     | apps/api/src/auth/auth.service.ts MAX_OTP_ATTEMPTS = 5; verifyOtp() attempts increment + lockout check                                                                                            | apps/api/test/phase6-otp.integration.spec.ts ("locks out after the attempt limit, then rejects even the correct code")                                   | Requires manual verification | Same DB-reachability caveat as item 1.                                                                                                                                                                                |
| 5. OTP resend                 | 6     | apps/api/src/auth/auth.service.ts requestOtp() (OTP_RESEND_COOLDOWN_MS = 30s cooldown check; invalidate-previous-token updateMany); apps/web otp-client.tsx (countdown)                           | apps/api/test/phase6-otp.integration.spec.ts ("resend invalidates the previous code...", "respects the resend cooldown...")                              | Requires manual verification | Backend logic is covered by a real test (DB-gated); the UI countdown itself has no automated test (needs a browser).                                                                                                  |
| 6. OTP enumeration protection | 6     | apps/api/src/auth/auth.service.ts requestOtp()/verifyOtp() (identical response/error for known vs. unknown destination)                                                                           | apps/api/test/phase6-otp.integration.spec.ts ("gives the same response... for a known and an unknown email", "gives the identical error message...")     | Requires manual verification | Same DB-reachability caveat as item 1.                                                                                                                                                                                |
| 7. OTP replay prevention      | 6     | apps/api/src/auth/auth.service.ts verifyOtp() atomic consume (prisma.oneTimeToken.updateMany where usedAt: null)                                                                                  | apps/api/test/phase6-otp.integration.spec.ts ("rejects reusing an already-consumed code", "lets exactly one of two concurrent verifications... succeed") | Requires manual verification | Fixes BUG-009 (see FINDINGS.md) — the pre-existing code used a non-atomic findFirst + update, which two concurrent correct submissions could both pass.                                                               |
| 8. Magic link (D4 resolution) | 6     | apps/api/src/auth/auth.service.ts requestMagicLink()/verifyMagicLink(); auth.controller.ts /auth/magic-link/request, /auth/magic-link/verify; apps/web magic-link/page.tsx, magic-link-client.tsx | apps/api/test/phase6-otp.integration.spec.ts (describe("magic link") block: replay, concurrent-use, unrecognized-token)                                  | Requires manual verification | Added to pragmatically resolve open question D4 (see ARCHITECTURE.md); same atomic-consume and cooldown/invalidate-on-resend guarantees as OTP, confirm-page POST pattern (task 6) prevents link-scanner consumption. |

## SESSION LIFECYCLE (Phase 7)

| Item                                              | Phase | Implementing files                                                                                                                                      | Tests                                                                                                                                                                             | Status                                                                                  | Notes                                                                                                                                                                                                 |
| ------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Access token creation                          | 7     | apps/api/src/auth/auth.service.ts signAccessToken() — RS256, asymmetric, kid header                                                                     | apps/api/test/phase7-tokens.spec.ts ("round-trips a freshly signed token")                                                                                                        | Confirmed working                                                                       | Actually run, no DB needed. Chose RS256 over EdDSA (both allowed by spec) because @types/jsonwebtoken@9.0.10 doesn't type "EdDSA" yet — see FINDINGS.md note.                                         |
| 2. Access token expiration                        | 7     | apps/api/src/auth/auth.service.ts signAccessToken() AUTH_ACCESS_TOKEN_TTL=900s; verifyAccessToken() exp check via jwt.verify                            | apps/api/test/phase7-tokens.spec.ts ("rejects an expired token")                                                                                                                  | Confirmed working                                                                       | Actually run, no DB needed.                                                                                                                                                                           |
| 3. Refresh token creation                         | 7     | apps/api/src/auth/auth.service.ts createSession()/rotateSession() — 32-byte CSPRNG, hash-only storage (Session.refreshTokenHash)                        | apps/api/test/phase7-session.integration.spec.ts ("rotates the refresh token on use...")                                                                                          | Requires manual verification                                                            | No live DB in this session; written as a real integration test, skips cleanly.                                                                                                                        |
| 4. Refresh token rotation                         | 7     | apps/api/src/auth/auth.service.ts refresh()/rotateAndRecord() — old token revoked, new one issued in the same family                                    | apps/api/test/phase7-session.integration.spec.ts ("rotates the refresh token on use, within the same family")                                                                     | Requires manual verification                                                            | Same DB-reachability caveat as item 3.                                                                                                                                                                |
| 5. Refresh token expiration                       | 7     | apps/api/src/auth/auth.service.ts refresh() — rolling expiresAt + absoluteExpiresAt checks                                                              | apps/api/test/phase7-session.integration.spec.ts ("rejects a refresh token whose session has passed its absolute expiry")                                                         | Requires manual verification                                                            | Same DB-reachability caveat as item 3.                                                                                                                                                                |
| 6. Token storage                                  | 7     | packages/database/prisma/schema.prisma Session.refreshTokenHash (hashed, never raw); access token lives only in an HttpOnly cookie                      | apps/api/test/phase7-session.integration.spec.ts ("listSessions returns rows that never include refreshTokenHash" — asserts the stored value is a 64-hex hash, not the raw token) | Requires manual verification                                                            | Same DB-reachability caveat as item 3.                                                                                                                                                                |
| 7. Cookie configuration                           | 7     | apps/api/src/auth/cookie-names.ts; packages/security/src/index.ts sessionCookieOptions()/cookieName()                                                   | packages/security/src/index.spec.ts (sessionCookieOptions/cookieName suite)                                                                                                       | Confirmed working                                                                       | Actually run, no DB needed.                                                                                                                                                                           |
| 8. HttpOnly                                       | 7     | packages/security/src/index.ts sessionCookieOptions() — httpOnly: true, unconditionally                                                                 | packages/security/src/index.spec.ts ("always sets httpOnly, Path=/, and defaults to SameSite=Lax")                                                                                | Confirmed working                                                                       | Actually run, no DB needed.                                                                                                                                                                           |
| 9. Secure                                         | 7     | apps/api/src/auth/cookie-names.ts isSecureCookies = env.APP_ENV !== "local"                                                                             | No dedicated unit test (APP_ENV-dependent); covered indirectly by cookieName() tests, which take `secure` as input                                                                | Requires manual verification                                                            | The `secure` input itself is exercised; the env-driven wiring (APP_ENV !== "local") has no automated test.                                                                                            |
| 10. SameSite                                      | 7     | apps/api/src/auth/auth.controller.ts setSessionCookies() — Lax for the session cookie, Strict for the refresh cookie                                    | packages/security/src/index.spec.ts ("supports SameSite=Strict for cookies that never need a cross-site send")                                                                    | Confirmed working                                                                       | The underlying helper is actually run; the controller's specific per-cookie choice (Lax vs. Strict) has no dedicated test.                                                                            |
| 11. Domain                                        | 7     | packages/config/src/index.ts API_COOKIE_DOMAIN default "" (unset); packages/security/src/index.ts sessionCookieOptions() omits the attribute when unset | packages/security/src/index.spec.ts ("omits the Domain attribute entirely when unset...", "includes the Domain attribute when one is explicitly given")                           | Confirmed working                                                                       | Actually run, no DB needed.                                                                                                                                                                           |
| 12. Path                                          | 7     | packages/security/src/index.ts sessionCookieOptions() — path: "/", unconditionally                                                                      | packages/security/src/index.spec.ts ("always sets httpOnly, Path=/, and defaults to SameSite=Lax")                                                                                | Confirmed working                                                                       | Actually run, no DB needed.                                                                                                                                                                           |
| 13. Token leakage                                 | 7     | packages/observability/src/redact.ts isSensitiveKey() — substring match, not exact match (BUG-010 fix)                                                  | packages/observability/src/redact.spec.ts ("redacts compound key names built around a sensitive word (BUG-010)")                                                                  | Confirmed working                                                                       | Actually run, no DB needed.                                                                                                                                                                           |
| 14. Token exposure in URLs                        | 7     | apps/api/src/auth/auth.controller.ts — access/refresh tokens are cookie-only, never query params; CSRF token is a header, not a URL param               | No dedicated test beyond code review; the api-client CSRF tests confirm the token travels as a header                                                                             | Requires manual verification                                                            | OTP/magic-link/reset tokens DO appear in emailed URLs by design (Phase 4/6) — a distinct, already-documented exposure surface, not this checklist item.                                               |
| 15. Token exposure in localStorage/sessionStorage | 7     | packages/api-client/src/index.ts — never reads/writes any token to Web Storage; relies entirely on HttpOnly cookies + credentials: "include"            | No dedicated automated test (absence-of-a-call isn't directly testable); confirmed via code review                                                                                | Requires manual verification                                                            | Grepped the whole repo for localStorage/sessionStorage near tokens during research — none found in app code.                                                                                          |
| 16. Token exposure in logs                        | 7     | packages/observability/src/redact.ts deepRedact()/isSensitiveKey()                                                                                      | packages/observability/src/redact.spec.ts (full suite)                                                                                                                            | Confirmed working                                                                       | Actually run, no DB needed.                                                                                                                                                                           |
| 17. Token exposure in errors                      | 7     | apps/api/src/auth/auth.service.ts verifyAccessToken()/refresh() — every failure throws a generic message, never the token/payload                       | apps/api/test/phase7-tokens.spec.ts (every rejection asserts the generic "Invalid or expired session." message)                                                                   | Confirmed working                                                                       | Actually run, no DB needed.                                                                                                                                                                           |
| 18. Token exposure in frontend state              | 7     | apps/web session/otp/magic-link pages — tokens never stored in React state beyond the single request that consumes them                                 | No dedicated automated test; confirmed via code review                                                                                                                            | Requires manual verification                                                            | No browser automation was run this phase.                                                                                                                                                             |
| 19. Refresh race conditions                       | 7     | packages/api-client/src/index.ts refreshOnce() — single shared in-flight promise                                                                        | packages/api-client/src/index.spec.ts ("triggers exactly one /auth/refresh call for 5 parallel 401s...")                                                                          | Confirmed working                                                                       | Actually run, no DB needed. This is the explicit "5 parallel requests... exactly one refresh" test.                                                                                                   |
| 20. Concurrent refresh requests                   | 7     | apps/api/src/auth/auth.service.ts refresh()/followRotationChain() — grace-window benign-race resolution                                                 | apps/api/test/phase7-session.integration.spec.ts ("resolves a rotated-token replay within the grace window...")                                                                   | Requires manual verification                                                            | Same DB-reachability caveat as item 3.                                                                                                                                                                |
| 21. Expired token handling                        | 7     | apps/api/src/auth/auth.service.ts verifyAccessToken() (exp)/refresh() (expiresAt/absoluteExpiresAt)                                                     | apps/api/test/phase7-tokens.spec.ts ("rejects an expired token"); phase7-session.integration.spec.ts (absolute-expiry test)                                                       | Confirmed working (access token) / Requires manual verification (refresh token)         | Access-token expiry test runs for real; refresh-token expiry test needs a database.                                                                                                                   |
| 22. Invalid token handling                        | 7     | apps/api/src/auth/auth.service.ts verifyAccessToken() (malformed/wrong-key)/refresh() (never-issued token)                                              | apps/api/test/phase7-tokens.spec.ts (alg:none, wrong key, malformed); phase7-session.integration.spec.ts (never-issued refresh token)                                             | Confirmed working (access token) / Requires manual verification (refresh token)         | Access-token test runs for real; refresh-token test needs a database.                                                                                                                                 |
| 23. Revoked token handling                        | 7     | apps/api/src/auth/auth.service.ts refresh() — reuse-detected family revocation outside the grace window                                                 | apps/api/test/phase7-session.integration.spec.ts ("revokes the entire session family when a rotated token is replayed outside the grace window")                                  | Requires manual verification                                                            | Same DB-reachability caveat as item 3. This is the explicit "reuse of a rotated token revokes the family" test.                                                                                       |
| 24. Logout invalidation                           | 7     | apps/api/src/auth/auth.service.ts logout(); apps/api/src/auth/session.guard.ts (revoked sessions rejected)                                              | apps/api/test/phase7-session.integration.spec.ts ("revokes exactly the targeted session on logout...")                                                                            | Requires manual verification                                                            | The explicit "replaying a cookie after logout returns 401" test is covered at the session-row level here; the HTTP-cookie round trip itself needs a browser/supertest run not performed this session. |
| 25. Session invalidation                          | 7     | apps/api/src/auth/auth.service.ts revokeSession()/revokeOtherSessions()/logoutAllDevices()/changePassword()                                             | apps/api/test/phase7-session.integration.spec.ts (logoutAllDevices and changePassword tests)                                                                                      | Requires manual verification                                                            | Same DB-reachability caveat as item 3.                                                                                                                                                                |
| 26. Multi-device sessions                         | 7     | packages/database/prisma/schema.prisma Session (unlimited concurrent sessions per user); apps/web/.../dashboard/sessions (list/revoke UI)               | apps/api/test/phase7-session.integration.spec.ts (logout/logoutAllDevices/changePassword tests all create a second independent login)                                             | Requires manual verification                                                            | Same DB-reachability caveat as item 3; no browser test of the new sessions page was run.                                                                                                              |
| 27. Session persistence                           | 7     | packages/database/prisma/schema.prisma Session rows persist independently of any one process; apps/api/src/auth/auth.service.ts touchSessionActivity()  | apps/api/test/phase7-session.integration.spec.ts ("touchSessionActivity updates lastUsedAt...")                                                                                   | Requires manual verification                                                            | Same DB-reachability caveat as item 3.                                                                                                                                                                |
| 28. Browser restart                               | 7     | HttpOnly cookies with a multi-day maxAge (AUTH_REFRESH_TOKEN_TTL) persist across a browser restart by construction (standard cookie semantics)          | No automated test (needs a real browser)                                                                                                                                          | Requires manual verification                                                            | Written steps: log in, fully quit and reopen the browser, confirm /auth/me still succeeds without re-entering credentials.                                                                            |
| 29. Private/incognito mode                        | 7     | Same HttpOnly-cookie mechanism; `onLogoutBroadcast`'s localStorage fallback is wrapped in try/catch for private-mode storage restrictions               | packages/api-client/src/index.spec.ts ("falls back to a storage-event ping when BroadcastChannel is unavailable")                                                                 | Confirmed working (fallback logic) / Requires manual verification (real private window) | The fallback's try/catch behavior is actually tested; real private-mode browser behavior was not exercised.                                                                                           |
| 30. Cross-tab synchronization                     | 7     | packages/api-client/src/index.ts broadcastLogout()/onLogoutBroadcast(); apps/web/.../dashboard/dashboard-actions.tsx                                    | packages/api-client/src/index.spec.ts (BroadcastChannel delivery test + storage-event fallback test)                                                                              | Confirmed working                                                                       | Actually run, no DB needed (BroadcastChannel/storage mocked).                                                                                                                                         |
| 31. Stale sessions cannot remain valid            | 7     | apps/api/src/auth/session.guard.ts — revoked/expired/absolute-expired/idle-timed-out sessions all rejected before touching lastUsedAt                   | apps/api/test/phase7-session.integration.spec.ts (absolute-expiry, logout, logoutAllDevices tests all assert the session row itself is unusable afterward)                        | Requires manual verification                                                            | Idle-timeout enforcement itself (AUTH_IDLE_TIMEOUT_SECONDS) has no dedicated test — see FINDINGS.md's design note on where idleness is measured.                                                      |

## PASSWORD RESET (Phase 8)

| Item                                          | Phase | Implementing files | Tests | Status      | Notes |
| --------------------------------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Forgot password                            | 8     |                    |       | Not started |       |
| 2. Reset email                                | 8     |                    |       | Not started |       |
| 3. Reset token                                | 8     |                    |       | Not started |       |
| 4. Reset token expiration                     | 8     |                    |       | Not started |       |
| 5. Token reuse                                | 8     |                    |       | Not started |       |
| 6. Token invalidation                         | 8     |                    |       | Not started |       |
| 7. Password update                            | 8     |                    |       | Not started |       |
| 8. Session invalidation after password change | 8     |                    |       | Not started |       |
| 9. Existing sessions after password reset     | 8     |                    |       | Not started |       |
| 10. Enumeration protection                    | 8     |                    |       | Not started |       |
| 11. Expired reset links                       | 8     |                    |       | Not started |       |
| 12. Multiple reset requests                   | 8     |                    |       | Not started |       |
| 13. Race conditions                           | 8     |                    |       | Not started |       |
| 14. Redirect handling                         | 8     |                    |       | Not started |       |

## OAUTH PROVIDERS (Phase 9)

| Item                  | Phase | Implementing files | Tests | Status      | Notes |
| --------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Google             | 9     |                    |       | Not started |       |
| 2. Apple              | 9     |                    |       | Not started |       |
| 3. GitHub             | 9     |                    |       | Not started |       |
| 4. Facebook           | 9     |                    |       | Not started |       |
| 5. Microsoft          | 9     |                    |       | Not started |       |
| 6. Any other provider | 9     |                    |       | Not started |       |

## OAUTH PROCESSES (Phase 9)

| Item                           | Phase | Implementing files | Tests | Status      | Notes |
| ------------------------------ | ----- | ------------------ | ----- | ----------- | ----- |
| 1. OAuth initialization        | 9     |                    |       | Not started |       |
| 2. State validation            | 9     |                    |       | Not started |       |
| 3. PKCE                        | 9     |                    |       | Not started |       |
| 4. Callback handling           | 9     |                    |       | Not started |       |
| 5. Redirect URI                | 9     |                    |       | Not started |       |
| 6. Account linking             | 9     |                    |       | Not started |       |
| 7. Existing account linking    | 9     |                    |       | Not started |       |
| 8. Email collision             | 9     |                    |       | Not started |       |
| 9. Provider identity collision | 9     |                    |       | Not started |       |
| 10. Unverified provider email  | 9     |                    |       | Not started |       |
| 11. Callback failure           | 9     |                    |       | Not started |       |
| 12. Popup failure              | 9     |                    |       | Not started |       |
| 13. Mobile browser behavior    | 9     |                    |       | Not started |       |
| 14. In-app browser behavior    | 9     |                    |       | Not started |       |
| 15. OAuth cancellation         | 9     |                    |       | Not started |       |
| 16. OAuth retry                | 9     |                    |       | Not started |       |
| 17. Multiple accounts          | 9     |                    |       | Not started |       |
| 18. Logout behavior            | 9     |                    |       | Not started |       |

## ROUTING AND MIDDLEWARE (Phase 10)

| Item                                                            | Phase | Implementing files | Tests | Status      | Notes |
| --------------------------------------------------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Middleware                                                   | 10    |                    |       | Not started |       |
| 2. Route guards                                                 | 10    |                    |       | Not started |       |
| 3. Server-side protection                                       | 10    |                    |       | Not started |       |
| 4. Client-side protection                                       | 10    |                    |       | Not started |       |
| 5. Nested routes                                                | 10    |                    |       | Not started |       |
| 6. Dynamic routes                                               | 10    |                    |       | Not started |       |
| 7. API routes                                                   | 10    |                    |       | Not started |       |
| 8. Admin routes                                                 | 10    |                    |       | Not started |       |
| 9. Unauthorized access                                          | 10    |                    |       | Not started |       |
| 10. Redirect loops                                              | 10    |                    |       | Not started |       |
| 11. Return URL handling                                         | 10    |                    |       | Not started |       |
| 12. Deep links                                                  | 10    |                    |       | Not started |       |
| 13. Refreshing protected pages                                  | 10    |                    |       | Not started |       |
| 14. Opening protected URLs directly                             | 10    |                    |       | Not started |       |
| 15. Back button behavior                                        | 10    |                    |       | Not started |       |
| 16. Forward button behavior                                     | 10    |                    |       | Not started |       |
| 17. Logged-out access                                           | 10    |                    |       | Not started |       |
| 18. Logged-in access                                            | 10    |                    |       | Not started |       |
| 19. Wrong-role access                                           | 10    |                    |       | Not started |       |
| 20. Never rely solely on frontend route protection for security | 10    |                    |       | Not started |       |

## FRONTEND AUTH UI (Phase 11)

| Item                                            | Phase | Implementing files | Tests | Status      | Notes |
| ----------------------------------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Incorrect loading state                      | 11    |                    |       | Not started |       |
| 2. Button remaining disabled                    | 11    |                    |       | Not started |       |
| 3. Button becoming enabled incorrectly          | 11    |                    |       | Not started |       |
| 4. Double submission                            | 11    |                    |       | Not started |       |
| 5. Missing validation                           | 11    |                    |       | Not started |       |
| 6. Incorrect error messages                     | 11    |                    |       | Not started |       |
| 7. Errors disappearing too quickly              | 11    |                    |       | Not started |       |
| 8. Errors not appearing                         | 11    |                    |       | Not started |       |
| 9. Wrong error displayed                        | 11    |                    |       | Not started |       |
| 10. Password visibility bugs                    | 11    |                    |       | Not started |       |
| 11. Form reset problems                         | 11    |                    |       | Not started |       |
| 12. Autofill problems                           | 11    |                    |       | Not started |       |
| 13. Browser password manager compatibility      | 11    |                    |       | Not started |       |
| 14. Mobile keyboard issues                      | 11    |                    |       | Not started |       |
| 15. Mobile viewport problems                    | 11    |                    |       | Not started |       |
| 16. Accessibility                               | 11    |                    |       | Not started |       |
| 17. Keyboard navigation                         | 11    |                    |       | Not started |       |
| 18. Screen readers                              | 11    |                    |       | Not started |       |
| 19. Focus management                            | 11    |                    |       | Not started |       |
| 20. Loading indicators                          | 11    |                    |       | Not started |       |
| 21. Race conditions                             | 11    |                    |       | Not started |       |
| 22. Stale auth state                            | 11    |                    |       | Not started |       |
| 23. Broken redirects                            | 11    |                    |       | Not started |       |
| 24. Flash of protected content                  | 11    |                    |       | Not started |       |
| 25. Flash of login page for authenticated users | 11    |                    |       | Not started |       |
| 26. Incorrect logout state                      | 11    |                    |       | Not started |       |

## ERROR HANDLING: PER ERROR (Phase 12)

| Item                                      | Phase | Implementing files | Tests | Status      | Notes |
| ----------------------------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Exact source                           | 12    |                    |       | Not started |       |
| 2. Trigger                                | 12    |                    |       | Not started |       |
| 3. User-visible behavior                  | 12    |                    |       | Not started |       |
| 4. Internal behavior                      | 12    |                    |       | Not started |       |
| 5. Whether it is handled                  | 12    |                    |       | Not started |       |
| 6. Whether it is logged                   | 12    |                    |       | Not started |       |
| 7. Whether the message is correct         | 12    |                    |       | Not started |       |
| 8. Whether it leaks sensitive information | 12    |                    |       | Not started |       |
| 9. Whether recovery is possible           | 12    |                    |       | Not started |       |

## ERROR HANDLING: ERROR TYPES (Phase 12)

| Item                                                                    | Phase | Implementing files | Tests | Status      | Notes |
| ----------------------------------------------------------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. 400                                                                  | 12    |                    |       | Not started |       |
| 2. 401                                                                  | 12    |                    |       | Not started |       |
| 3. 403                                                                  | 12    |                    |       | Not started |       |
| 4. 404                                                                  | 12    |                    |       | Not started |       |
| 5. 409                                                                  | 12    |                    |       | Not started |       |
| 6. 422                                                                  | 12    |                    |       | Not started |       |
| 7. 429                                                                  | 12    |                    |       | Not started |       |
| 8. 500                                                                  | 12    |                    |       | Not started |       |
| 9. 502                                                                  | 12    |                    |       | Not started |       |
| 10. 503                                                                 | 12    |                    |       | Not started |       |
| 11. Network errors                                                      | 12    |                    |       | Not started |       |
| 12. Timeout errors                                                      | 12    |                    |       | Not started |       |
| 13. Auth-provider errors                                                | 12    |                    |       | Not started |       |
| 14. Database errors                                                     | 12    |                    |       | Not started |       |
| 15. Unexpected exceptions                                               | 12    |                    |       | Not started |       |
| 16. No generic "Something went wrong" where a safe recovery path exists | 12    |                    |       | Not started |       |

## SECURITY CHECKS (Phase 13)

| Item                                                                                          | Phase | Implementing files | Tests | Status      | Notes |
| --------------------------------------------------------------------------------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Authentication bypass                                                                      | 13    |                    |       | Not started |       |
| 2. Authorization bypass                                                                       | 13    |                    |       | Not started |       |
| 3. Broken access control                                                                      | 13    |                    |       | Not started |       |
| 4. IDOR                                                                                       | 13    |                    |       | Not started |       |
| 5. Privilege escalation                                                                       | 13    |                    |       | Not started |       |
| 6. Session fixation                                                                           | 13    |                    |       | Not started |       |
| 7. Session hijacking                                                                          | 13    |                    |       | Not started |       |
| 8. CSRF                                                                                       | 13    |                    |       | Not started |       |
| 9. XSS affecting authentication                                                               | 13    |                    |       | Not started |       |
| 10. Open redirects                                                                            | 13    |                    |       | Not started |       |
| 11. Token theft                                                                               | 13    |                    |       | Not started |       |
| 12. Credential leakage                                                                        | 13    |                    |       | Not started |       |
| 13. Password leakage                                                                          | 13    |                    |       | Not started |       |
| 14. Sensitive data leakage                                                                    | 13    |                    |       | Not started |       |
| 15. User enumeration                                                                          | 13    |                    |       | Not started |       |
| 16. Excessive authentication attempts                                                         | 13    |                    |       | Not started |       |
| 17. Brute-force vulnerabilities                                                               | 13    |                    |       | Not started |       |
| 18. Missing rate limiting                                                                     | 13    |                    |       | Not started |       |
| 19. Weak password handling                                                                    | 13    |                    |       | Not started |       |
| 20. Insecure password reset                                                                   | 13    |                    |       | Not started |       |
| 21. Insecure email verification                                                               | 13    |                    |       | Not started |       |
| 22. OAuth account takeover                                                                    | 13    |                    |       | Not started |       |
| 23. Incorrect OAuth callback validation                                                       | 13    |                    |       | Not started |       |
| 24. Redirect URI vulnerabilities                                                              | 13    |                    |       | Not started |       |
| 25. CORS misconfiguration                                                                     | 13    |                    |       | Not started |       |
| 26. Cookie misconfiguration                                                                   | 13    |                    |       | Not started |       |
| 27. JWT validation problems                                                                   | 13    |                    |       | Not started |       |
| 28. JWT algorithm problems                                                                    | 13    |                    |       | Not started |       |
| 29. Incorrect issuer validation                                                               | 13    |                    |       | Not started |       |
| 30. Incorrect audience validation                                                             | 13    |                    |       | Not started |       |
| 31. Expiration validation problems                                                            | 13    |                    |       | Not started |       |
| 32. Server/client trust boundary violations                                                   | 13    |                    |       | Not started |       |
| 33. Client-side-only authorization                                                            | 13    |                    |       | Not started |       |
| 34. Secrets exposed to frontend                                                               | 13    |                    |       | Not started |       |
| 35. Environment variable exposure                                                             | 13    |                    |       | Not started |       |
| 36. Debug information exposed in production                                                   | 13    |                    |       | Not started |       |
| 37. Authentication information appearing in logs                                              | 13    |                    |       | Not started |       |
| 38. Never expose secrets, tokens, passwords, API keys, private keys, or credentials in output | 13    |                    |       | Not started |       |

## LAUNCH: LEGAL, TRUST AND CONVERSION (Phase 14)

| Item                     | Phase | Implementing files | Tests | Status      | Notes |
| ------------------------ | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Privacy policy        | 14    |                    |       | Not started |       |
| 2. Terms & conditions    | 14    |                    |       | Not started |       |
| 3. Cookie consent banner | 14    |                    |       | Not started |       |
| 4. Analytics setup       | 14    |                    |       | Not started |       |
| 5. Single clear CTA      | 14    |                    |       | Not started |       |
| 6. Custom 404 page       | 14    |                    |       | Not started |       |
| 7. Form validation       | 14    |                    |       | Not started |       |
| 8. Spam protection       | 14    |                    |       | Not started |       |

## LAUNCH: SEO AND SHARING (Phase 15)

| Item                        | Phase | Implementing files | Tests | Status      | Notes |
| --------------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Meta titles/descriptions | 15    |                    |       | Not started |       |
| 2. Social preview image     | 15    |                    |       | Not started |       |
| 3. Favicon                  | 15    |                    |       | Not started |       |
| 4. Sitemap and robots.txt   | 15    |                    |       | Not started |       |

## LAUNCH: PERFORMANCE AND ACCESSIBILITY (Phase 16)

| Item                     | Phase | Implementing files | Tests | Status      | Notes |
| ------------------------ | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Image alt text        | 16    |                    |       | Not started |       |
| 2. Image compression     | 16    |                    |       | Not started |       |
| 3. Page load speed check | 16    |                    |       | Not started |       |
| 4. Color contrast fixes  | 16    |                    |       | Not started |       |
| 5. Mobile responsiveness | 16    |                    |       | Not started |       |
| 6. Broken link fixes     | 16    |                    |       | Not started |       |

## RACE CONDITIONS AND EDGE CASES (Phase 17)

| Item                                                  | Phase | Implementing files | Tests | Status      | Notes |
| ----------------------------------------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Two login requests simultaneously                  | 17    |                    |       | Not started |       |
| 2. Login + logout simultaneously                      | 17    |                    |       | Not started |       |
| 3. Login + refresh simultaneously                     | 17    |                    |       | Not started |       |
| 4. Token refresh + API request simultaneously         | 17    |                    |       | Not started |       |
| 5. Multiple browser tabs                              | 17    |                    |       | Not started |       |
| 6. Multiple devices                                   | 17    |                    |       | Not started |       |
| 7. Expired token during API request                   | 17    |                    |       | Not started |       |
| 8. User refreshes during authentication               | 17    |                    |       | Not started |       |
| 9. User closes browser during authentication          | 17    |                    |       | Not started |       |
| 10. Network disconnects during authentication         | 17    |                    |       | Not started |       |
| 11. Network reconnects                                | 17    |                    |       | Not started |       |
| 12. Slow authentication provider                      | 17    |                    |       | Not started |       |
| 13. Duplicate clicks                                  | 17    |                    |       | Not started |       |
| 14. Rapid navigation                                  | 17    |                    |       | Not started |       |
| 15. Session expires while user is active              | 17    |                    |       | Not started |       |
| 16. Session expires while page is open                | 17    |                    |       | Not started |       |
| 17. Profile request before session request completes  | 17    |                    |       | Not started |       |
| 18. Profile request after logout                      | 17    |                    |       | Not started |       |
| 19. Refresh token rotation during concurrent requests | 17    |                    |       | Not started |       |

## CODE DEFECTS THAT MUST NOT EXIST (Phase 18)

| Item                                    | Phase | Implementing files | Tests | Status      | Notes |
| --------------------------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Dead code                            | 18    |                    |       | Not started |       |
| 2. Duplicate logic                      | 18    |                    |       | Not started |       |
| 3. Incorrect async/await                | 18    |                    |       | Not started |       |
| 4. Missing await                        | 18    |                    |       | Not started |       |
| 5. Unhandled promises                   | 18    |                    |       | Not started |       |
| 6. Incorrect try/catch                  | 18    |                    |       | Not started |       |
| 7. Incorrect error propagation          | 18    |                    |       | Not started |       |
| 8. Null/undefined handling              | 18    |                    |       | Not started |       |
| 9. Type mismatches                      | 18    |                    |       | Not started |       |
| 10. Incorrect state updates             | 18    |                    |       | Not started |       |
| 11. Stale closures                      | 18    |                    |       | Not started |       |
| 12. Incorrect dependencies              | 18    |                    |       | Not started |       |
| 13. Memory leaks                        | 18    |                    |       | Not started |       |
| 14. Infinite loops                      | 18    |                    |       | Not started |       |
| 15. Incorrect redirects                 | 18    |                    |       | Not started |       |
| 16. Incorrect environment variables     | 18    |                    |       | Not started |       |
| 17. Incorrect imports                   | 18    |                    |       | Not started |       |
| 18. Dependency issues                   | 18    |                    |       | Not started |       |
| 19. Deprecated APIs                     | 18    |                    |       | Not started |       |
| 20. Incorrect SDK usage                 | 18    |                    |       | Not started |       |
| 21. Incorrect auth-provider integration | 18    |                    |       | Not started |       |
| 22. Server/client boundary mistakes     | 18    |                    |       | Not started |       |

## TEST MATRIX: VALID CASES (Phase 19)

| Item                    | Phase | Implementing files | Tests | Status      | Notes |
| ----------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Valid login          | 19    |                    |       | Not started |       |
| 2. Valid signup         | 19    |                    |       | Not started |       |
| 3. Valid verification   | 19    |                    |       | Not started |       |
| 4. Valid password reset | 19    |                    |       | Not started |       |
| 5. Valid logout         | 19    |                    |       | Not started |       |

## TEST MATRIX: INVALID CASES (Phase 19)

| Item                    | Phase | Implementing files | Tests | Status      | Notes |
| ----------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Invalid email        | 19    |                    |       | Not started |       |
| 2. Invalid password     | 19    |                    |       | Not started |       |
| 3. Missing fields       | 19    |                    |       | Not started |       |
| 4. Expired token        | 19    |                    |       | Not started |       |
| 5. Invalid token        | 19    |                    |       | Not started |       |
| 6. Invalid verification | 19    |                    |       | Not started |       |
| 7. Invalid reset token  | 19    |                    |       | Not started |       |
| 8. Unauthorized user    | 19    |                    |       | Not started |       |
| 9. Forbidden user       | 19    |                    |       | Not started |       |

## TEST MATRIX: ENVIRONMENT CASES (Phase 19)

| Item             | Phase | Implementing files | Tests | Status      | Notes |
| ---------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Development   | 19    |                    |       | Not started |       |
| 2. Staging       | 19    |                    |       | Not started |       |
| 3. Production    | 19    |                    |       | Not started |       |
| 4. Mobile        | 19    |                    |       | Not started |       |
| 5. Desktop       | 19    |                    |       | Not started |       |
| 6. Slow network  | 19    |                    |       | Not started |       |
| 7. Offline       | 19    |                    |       | Not started |       |
| 8. Multiple tabs | 19    |                    |       | Not started |       |

## TEST MATRIX: SECURITY CASES (Phase 19)

| Item                    | Phase | Implementing files | Tests | Status      | Notes |
| ----------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Brute force          | 19    |                    |       | Not started |       |
| 2. Rate limit           | 19    |                    |       | Not started |       |
| 3. Session theft        | 19    |                    |       | Not started |       |
| 4. CSRF                 | 19    |                    |       | Not started |       |
| 5. XSS                  | 19    |                    |       | Not started |       |
| 6. IDOR                 | 19    |                    |       | Not started |       |
| 7. Privilege escalation | 19    |                    |       | Not started |       |
| 8. Open redirect        | 19    |                    |       | Not started |       |
| 9. Token leakage        | 19    |                    |       | Not started |       |

## PRODUCTION AUDIT (Phase 20)

| Item                                            | Phase | Implementing files | Tests | Status      | Notes |
| ----------------------------------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Production environment variables             | 20    |                    |       | Not started |       |
| 2. Missing environment variables                | 20    |                    |       | Not started |       |
| 3. Wrong environment variables                  | 20    |                    |       | Not started |       |
| 4. Development URLs                             | 20    |                    |       | Not started |       |
| 5. Localhost references                         | 20    |                    |       | Not started |       |
| 6. Production callback URLs                     | 20    |                    |       | Not started |       |
| 7. Production domains                           | 20    |                    |       | Not started |       |
| 8. HTTPS                                        | 20    |                    |       | Not started |       |
| 9. CORS                                         | 20    |                    |       | Not started |       |
| 10. Cookies                                     | 20    |                    |       | Not started |       |
| 11. CDN/proxy behavior                          | 20    |                    |       | Not started |       |
| 12. Reverse proxy behavior                      | 20    |                    |       | Not started |       |
| 13. Serverless cold starts                      | 20    |                    |       | Not started |       |
| 14. Timeout handling                            | 20    |                    |       | Not started |       |
| 15. Rate limits                                 | 20    |                    |       | Not started |       |
| 16. Authentication provider limits              | 20    |                    |       | Not started |       |
| 17. Database connection limits                  | 20    |                    |       | Not started |       |
| 18. Logging                                     | 20    |                    |       | Not started |       |
| 19. Monitoring                                  | 20    |                    |       | Not started |       |
| 20. Error tracking                              | 20    |                    |       | Not started |       |
| 21. Observability                               | 20    |                    |       | Not started |       |
| 22. Deployment configuration                    | 20    |                    |       | Not started |       |
| 23. Build-time vs runtime environment variables | 20    |                    |       | Not started |       |
| 24. Secret management                           | 20    |                    |       | Not started |       |
| 25. Production-only failures                    | 20    |                    |       | Not started |       |
| 26. Browser compatibility                       | 20    |                    |       | Not started |       |
| 27. Mobile compatibility                        | 20    |                    |       | Not started |       |

## FINAL AUDIT REPORT (Phase 21)

| Item                           | Phase | Implementing files | Tests | Status      | Notes |
| ------------------------------ | ----- | ------------------ | ----- | ----------- | ----- |
| A. Executive Summary           | 21    |                    |       | Not started |       |
| B. Authentication Architecture | 21    |                    |       | Not started |       |
| C. Findings                    | 21    |                    |       | Not started |       |
| D. Security Findings           | 21    |                    |       | Not started |       |
| E. Production Findings         | 21    |                    |       | Not started |       |
| F. Edge Cases                  | 21    |                    |       | Not started |       |
| G. Test Matrix                 | 21    |                    |       | Not started |       |
| H. Fix Plan                    | 21    |                    |       | Not started |       |
| I. Regression Checklist        | 21    |                    |       | Not started |       |
| J. Final Status                | 21    |                    |       | Not started |       |
