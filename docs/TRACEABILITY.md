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

| Item                                                                                | Phase | Implementing files | Tests | Status      | Notes |
| ----------------------------------------------------------------------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. User table                                                                       | 3     |                    |       | Not started |       |
| 2. Profile table                                                                    | 3     |                    |       | Not started |       |
| 3. Auth table                                                                       | 3     |                    |       | Not started |       |
| 4. Roles                                                                            | 3     |                    |       | Not started |       |
| 5. Permissions                                                                      | 3     |                    |       | Not started |       |
| 6. Foreign keys                                                                     | 3     |                    |       | Not started |       |
| 7. Unique constraints                                                               | 3     |                    |       | Not started |       |
| 8. Nullability                                                                      | 3     |                    |       | Not started |       |
| 9. Default values                                                                   | 3     |                    |       | Not started |       |
| 10. Database triggers                                                               | 3     |                    |       | Not started |       |
| 11. Functions                                                                       | 3     |                    |       | Not started |       |
| 12. Row-level security                                                              | 3     |                    |       | Not started |       |
| 13. RLS policies                                                                    | 3     |                    |       | Not started |       |
| 14. Insert policies                                                                 | 3     |                    |       | Not started |       |
| 15. Select policies                                                                 | 3     |                    |       | Not started |       |
| 16. Update policies                                                                 | 3     |                    |       | Not started |       |
| 17. Delete policies                                                                 | 3     |                    |       | Not started |       |
| 18. Service-role usage                                                              | 3     |                    |       | Not started |       |
| 19. Anonymous access                                                                | 3     |                    |       | Not started |       |
| 20. Privileged queries                                                              | 3     |                    |       | Not started |       |
| 21. User/profile synchronization                                                    | 3     |                    |       | Not started |       |
| 22. Orphaned users                                                                  | 3     |                    |       | Not started |       |
| 23. Duplicate profiles                                                              | 3     |                    |       | Not started |       |
| 24. Race conditions during profile creation                                         | 3     |                    |       | Not started |       |
| 25. Missing records                                                                 | 3     |                    |       | Not started |       |
| 26. Deleted records                                                                 | 3     |                    |       | Not started |       |
| 27. Soft-deleted accounts                                                           | 3     |                    |       | Not started |       |
| 28. Data consistency                                                                | 3     |                    |       | Not started |       |
| 29. A newly authenticated user reliably obtains the correct profile and permissions | 3     |                    |       | Not started |       |

## SIGNUP AND VERIFICATION (Phase 4)

| Item                          | Phase | Implementing files | Tests | Status      | Notes |
| ----------------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Signup                     | 4     |                    |       | Not started |       |
| 2. Duplicate account          | 4     |                    |       | Not started |       |
| 3. Email verification         | 4     |                    |       | Not started |       |
| 4. Verification expiration    | 4     |                    |       | Not started |       |
| 5. Verification resend        | 4     |                    |       | Not started |       |
| 6. Unverified login           | 4     |                    |       | Not started |       |
| 7. Password creation          | 4     |                    |       | Not started |       |
| 8. Weak password handling     | 4     |                    |       | Not started |       |
| 9. Account creation failure   | 4     |                    |       | Not started |       |
| 10. Partial account creation  | 4     |                    |       | Not started |       |
| 11. Profile creation failure  | 4     |                    |       | Not started |       |
| 12. Database trigger failure  | 4     |                    |       | Not started |       |
| 13. Email delivery failure    | 4     |                    |       | Not started |       |
| 14. Verification redirect     | 4     |                    |       | Not started |       |
| 15. Already verified account  | 4     |                    |       | Not started |       |
| 16. Expired verification link | 4     |                    |       | Not started |       |

## LOGIN PROCESS (Phase 5)

| Item                                                   | Phase | Implementing files | Tests | Status      | Notes |
| ------------------------------------------------------ | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Empty email                                         | 5     |                    |       | Not started |       |
| 2. Invalid email                                       | 5     |                    |       | Not started |       |
| 3. Leading/trailing spaces                             | 5     |                    |       | Not started |       |
| 4. Upper/lowercase email handling                      | 5     |                    |       | Not started |       |
| 5. Empty password                                      | 5     |                    |       | Not started |       |
| 6. Incorrect password                                  | 5     |                    |       | Not started |       |
| 7. Correct credentials                                 | 5     |                    |       | Not started |       |
| 8. Unverified account                                  | 5     |                    |       | Not started |       |
| 9. Disabled account                                    | 5     |                    |       | Not started |       |
| 10. Deleted account                                    | 5     |                    |       | Not started |       |
| 11. Locked account                                     | 5     |                    |       | Not started |       |
| 12. Rate-limited account                               | 5     |                    |       | Not started |       |
| 13. Network failure                                    | 5     |                    |       | Not started |       |
| 14. Timeout                                            | 5     |                    |       | Not started |       |
| 15. Server error                                       | 5     |                    |       | Not started |       |
| 16. Auth-provider error                                | 5     |                    |       | Not started |       |
| 17. Database error                                     | 5     |                    |       | Not started |       |
| 18. Invalid response                                   | 5     |                    |       | Not started |       |
| 19. Expired session                                    | 5     |                    |       | Not started |       |
| 20. Existing session                                   | 5     |                    |       | Not started |       |
| 21. Multiple login attempts                            | 5     |                    |       | Not started |       |
| 22. Double-click login                                 | 5     |                    |       | Not started |       |
| 23. Multiple simultaneous requests                     | 5     |                    |       | Not started |       |
| 24. Slow network                                       | 5     |                    |       | Not started |       |
| 25. Offline mode                                       | 5     |                    |       | Not started |       |
| 26. Browser refresh during login                       | 5     |                    |       | Not started |       |
| 27. Login from multiple tabs                           | 5     |                    |       | Not started |       |
| 28. Login from multiple devices                        | 5     |                    |       | Not started |       |
| 29. Redirect after login                               | 5     |                    |       | Not started |       |
| 30. Redirect loops                                     | 5     |                    |       | Not started |       |
| 31. Incorrect redirect destination                     | 5     |                    |       | Not started |       |
| 32. Authentication state not updating                  | 5     |                    |       | Not started |       |
| 33. UI showing logged in while backend says logged out | 5     |                    |       | Not started |       |
| 34. Backend saying logged in while UI says logged out  | 5     |                    |       | Not started |       |
| 35. Session not persisting                             | 5     |                    |       | Not started |       |
| 36. Session disappearing after refresh                 | 5     |                    |       | Not started |       |
| 37. Login succeeding but dashboard failing             | 5     |                    |       | Not started |       |
| 38. Login succeeding but profile loading failing       | 5     |                    |       | Not started |       |
| 39. Login succeeding but permissions failing           | 5     |                    |       | Not started |       |

## OTP AUTHENTICATION (Phase 6)

| Item                          | Phase | Implementing files | Tests | Status      | Notes |
| ----------------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. OTP authentication         | 6     |                    |       | Not started |       |
| 2. OTP generation and hashing | 6     |                    |       | Not started |       |
| 3. OTP expiration             | 6     |                    |       | Not started |       |
| 4. OTP attempt limits         | 6     |                    |       | Not started |       |
| 5. OTP resend                 | 6     |                    |       | Not started |       |
| 6. OTP enumeration protection | 6     |                    |       | Not started |       |
| 7. OTP replay prevention      | 6     |                    |       | Not started |       |

## SESSION LIFECYCLE (Phase 7)

| Item                                              | Phase | Implementing files | Tests | Status      | Notes |
| ------------------------------------------------- | ----- | ------------------ | ----- | ----------- | ----- |
| 1. Access token creation                          | 7     |                    |       | Not started |       |
| 2. Access token expiration                        | 7     |                    |       | Not started |       |
| 3. Refresh token creation                         | 7     |                    |       | Not started |       |
| 4. Refresh token rotation                         | 7     |                    |       | Not started |       |
| 5. Refresh token expiration                       | 7     |                    |       | Not started |       |
| 6. Token storage                                  | 7     |                    |       | Not started |       |
| 7. Cookie configuration                           | 7     |                    |       | Not started |       |
| 8. HttpOnly                                       | 7     |                    |       | Not started |       |
| 9. Secure                                         | 7     |                    |       | Not started |       |
| 10. SameSite                                      | 7     |                    |       | Not started |       |
| 11. Domain                                        | 7     |                    |       | Not started |       |
| 12. Path                                          | 7     |                    |       | Not started |       |
| 13. Token leakage                                 | 7     |                    |       | Not started |       |
| 14. Token exposure in URLs                        | 7     |                    |       | Not started |       |
| 15. Token exposure in localStorage/sessionStorage | 7     |                    |       | Not started |       |
| 16. Token exposure in logs                        | 7     |                    |       | Not started |       |
| 17. Token exposure in errors                      | 7     |                    |       | Not started |       |
| 18. Token exposure in frontend state              | 7     |                    |       | Not started |       |
| 19. Refresh race conditions                       | 7     |                    |       | Not started |       |
| 20. Concurrent refresh requests                   | 7     |                    |       | Not started |       |
| 21. Expired token handling                        | 7     |                    |       | Not started |       |
| 22. Invalid token handling                        | 7     |                    |       | Not started |       |
| 23. Revoked token handling                        | 7     |                    |       | Not started |       |
| 24. Logout invalidation                           | 7     |                    |       | Not started |       |
| 25. Session invalidation                          | 7     |                    |       | Not started |       |
| 26. Multi-device sessions                         | 7     |                    |       | Not started |       |
| 27. Session persistence                           | 7     |                    |       | Not started |       |
| 28. Browser restart                               | 7     |                    |       | Not started |       |
| 29. Private/incognito mode                        | 7     |                    |       | Not started |       |
| 30. Cross-tab synchronization                     | 7     |                    |       | Not started |       |
| 31. Stale sessions cannot remain valid            | 7     |                    |       | Not started |       |

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
