# Threat Model

## Assets

- User credentials and sessions.
- Personal data (email, profile data, uploaded files).
- Audit and security event logs.
- Infrastructure secrets (database, auth provider, storage, email).

## Trust boundaries

1. Browser ↔ `apps/web` / `apps/admin` (untrusted input, public internet).
2. `apps/web`/`apps/admin` ↔ `apps/api` (session cookie is the only credential crossing
   this boundary; CORS allowlist enforced).
3. `apps/api` ↔ PostgreSQL / Redis / auth provider / storage / email (private network,
   credentialed, never reachable from the browser).

## Key threats and mitigations

| Threat                            | Mitigation                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Credential stuffing / brute force | Rate limiting (`@nestjs/throttler`), neutral login/reset responses, account lockout via OTP attempt counter    |
| Session hijacking                 | `HttpOnly`/`Secure`/`SameSite=Lax` cookies, short-lived access tokens, refresh rotation, revocation list in DB |
| Open redirect                     | `isAllowedRedirect` allowlist enforced on every client-side redirect target                                    |
| CSRF                              | `SameSite=Lax` cookies + strict CORS origin allowlist on credentialed requests                                 |
| XSS                               | React escaping by default, restrictive CSP, no `dangerouslySetInnerHTML` in auth flows                         |
| Horizontal privilege escalation   | `canAccessOwnResource` ownership checks on every resource access                                               |
| Vertical privilege escalation     | Centralized `can`/`assertPermission` checks, never role-name branching                                         |
| Account enumeration               | Password reset and OTP request endpoints always return the same response                                       |
| Open redirect via OAuth callback  | Exact redirect URI allowlisting per provider, `state` + PKCE validation                                        |
| Secret leakage                    | No secrets in `apps/web`/`apps/admin`, secret scanning in CI, `.env` git-ignored                               |
| SQL injection                     | Prisma parameterized queries exclusively; no raw string interpolation into SQL                                 |
| Unsafe file upload                | MIME allowlist, unpredictable object keys, signed URLs, size limits (`@saas/storage`)                          |

## Out of scope for the base template

Payment processing, multi-tenant data isolation beyond basic ownership checks, and
device/browser fingerprinting are intentionally not implemented — add them in a product
module with their own threat model addendum.
