# docs/auth/FLOWS.md

Phase 1 deliverable. Sequence diagrams for every lifecycle in the "Lifecycle tracing"
checklist, each tracing User → Login UI → Validation → Authentication request →
Backend/Auth provider → Database → Session/token creation → Storage → Auth state →
Application state → Protected route → User dashboard, with every failure branch and the
HTTP status code it produces. These complement the flowcharts in
[ARCHITECTURE.md](ARCHITECTURE.md) §2 (decision-oriented) with the actor-level call
sequence (who calls whom, in what order). No application code was written to produce
this document — see [ARCHITECTURE.md](ARCHITECTURE.md) and `AUTH_RULES.md`.

## 1. Login lifecycle

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Login UI (apps/web)
    participant V as Client validation (Zod + RHF)
    participant API as AuthController (apps/api)
    participant PROV as Auth provider
    participant DB as Postgres (via Prisma)
    participant SESS as Session/token creation
    participant COOKIE as Cookie storage (HttpOnly)
    participant STATE as Client auth state (TanStack Query)
    participant GUARD as Protected route check

    U->>UI: Submit email + password
    UI->>V: Validate fields
    alt invalid input
        V-->>UI: Inline field errors (no request sent)
    else valid input
        V->>API: POST /auth/login
        API->>API: Rate limit check
        alt rate limited
            API-->>UI: 429 Too Many Requests
        else within limit
            API->>PROV: Verify credentials
            alt invalid credentials
                PROV-->>API: Auth failure
                API-->>UI: 401 Invalid email or password
            else valid credentials
                API->>DB: Look up User by external id
                alt user not found / suspended / deleted
                    DB-->>API: No active user
                    API-->>UI: 401 Invalid email or password
                else user active
                    API->>SESS: Create Session row, sign access JWT, issue refresh token
                    SESS->>COOKIE: Set-Cookie app_session, app_refresh (HttpOnly, Secure, SameSite=Lax)
                    COOKIE-->>UI: 200 OK
                    UI->>API: GET /auth/me
                    API-->>STATE: Principal (user, roles, permissions)
                    STATE->>GUARD: Protected route check (UX only)
                    GUARD-->>U: Redirect to dashboard
                end
            end
        end
    end
```

## 2. Logout lifecycle

```mermaid
sequenceDiagram
    actor U as User
    participant UI as apps/web
    participant API as AuthController
    participant GUARD as SessionGuard
    participant DB as Postgres
    participant COOKIE as Cookie storage
    participant STATE as Client auth state

    U->>UI: Click logout
    UI->>API: POST /auth/logout
    API->>GUARD: Validate session
    alt session invalid/expired
        GUARD-->>API: No valid session
        API-->>COOKIE: Clear cookies anyway
        COOKIE-->>UI: 200 OK (idempotent)
    else session valid
        GUARD-->>API: OK
        API->>DB: Session.revokedAt = now, revokedReason = "logout"
        API->>COOKIE: Clear app_session, app_refresh cookies
        COOKIE-->>STATE: Clear auth state, invalidate query cache
        STATE-->>U: Redirect to public home
    end
    Note over U,API: Browser back button to a protected page is still rejected:<br/>API independently re-checks the (now revoked) session → 401
```

## 3. Refresh lifecycle

```mermaid
sequenceDiagram
    actor Client as apps/web (api-client)
    participant API as AuthController
    participant DB as Postgres (Session table)
    participant SESS as Session/token rotation
    participant COOKIE as Cookie storage

    Client->>API: Request with expired/invalid access JWT
    API-->>Client: 401 Unauthorized
    Client->>API: POST /auth/refresh (refresh cookie)
    API->>DB: Look up refresh token hash in Session table
    alt not found
        DB-->>API: No match
        API-->>Client: 401 - clear cookies, require login
    else found
        DB-->>API: Session row
        alt session revoked or expired
            API-->>Client: 401 - clear cookies, require login
        else session valid
            API->>SESS: Revoke old session, create new Session + new JWT + new refresh token
            SESS->>COOKIE: Set-Cookie new app_session, app_refresh
            COOKIE-->>Client: 200 OK
            Client->>API: Retry original request
            API-->>Client: 200 OK (request proceeds)
        end
    end
```

## 4. Signup lifecycle

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Signup UI
    participant V as Client validation
    participant API as AuthController
    participant PROV as Auth provider
    participant DB as Postgres (transaction)
    participant MAIL as Email delivery

    U->>UI: Submit email + password
    UI->>V: Validate fields
    alt invalid
        V-->>UI: Inline field errors
    else valid
        V->>API: POST /auth/signup
        API->>API: Rate limit check
        alt rate limited
            API-->>UI: 429 Too Many Requests
        else within limit
            API->>DB: Check existing user by email
            alt already exists
                DB-->>API: Found
                API-->>UI: 409 Account exists
            else not found
                API->>PROV: Create identity
                alt provider error
                    PROV-->>API: Error
                    API-->>UI: 500 (mapped to generic error)
                else provider ok
                    API->>DB: Transaction - create User + Profile + default role
                    alt transaction fails
                        DB-->>API: Rolled back, no partial user
                        API-->>UI: 500 Signup failed, safe to retry
                    else transaction succeeds
                        API->>DB: Issue email verification token
                        API->>MAIL: Send verification email
                        alt send failure
                            MAIL-->>API: Delivery error (logged)
                            API-->>UI: 201 - user created, resend-verification flow covers delivery failure
                        else sent
                            MAIL-->>API: Sent
                            API-->>UI: 201 Check your email
                        end
                    end
                end
            end
        end
    end
```

## 5. Verification lifecycle

```mermaid
sequenceDiagram
    actor U as User
    participant UI as /verify-email page
    participant API as AuthController
    participant DB as Postgres (VerificationToken, User)

    U->>UI: Click verification link (token in URL)
    UI->>API: POST /auth/verify-email {token}
    API->>DB: Look up token - exists, not expired, not consumed?
    alt invalid
        DB-->>API: No match / expired / consumed
        API-->>UI: 400 Invalid or expired link
    else valid
        DB-->>API: Match
        API->>DB: Transaction - mark token consumed, User.emailVerifiedAt = now, status = active
        alt transaction fails
            DB-->>API: Error, token NOT marked consumed
            API-->>UI: 500 - safe to retry
        else success
            DB-->>API: OK
            API-->>UI: 200 Email verified, go to login
        end
    end
```

## 6. Password reset lifecycle

```mermaid
sequenceDiagram
    actor U as User
    participant UI1 as Forgot password form
    participant API as AuthController
    participant DB as Postgres
    participant MAIL as Email delivery
    participant UI2 as Reset password form
    participant PROV as Auth provider

    U->>UI1: Submit email
    UI1->>API: POST /auth/password-reset/request
    API->>API: Rate limit check
    alt rate limited
        API-->>UI1: 429 (still neutral message shown)
    else within limit
        API->>DB: Look up user by email
        alt user exists
            DB-->>API: Found
            API->>DB: Issue reset token
            API->>MAIL: Send reset email
        else user does not exist
            Note over API: Same neutral response either way - no enumeration
        end
        API-->>UI1: 200 Check your email if an account exists
    end
    U->>UI2: Follow reset link, submit new password
    UI2->>API: POST /auth/password-reset/confirm {token, newPassword}
    API->>DB: Token valid, not expired, not consumed?
    alt invalid
        DB-->>API: No match / expired / consumed
        API-->>UI2: 400 Invalid or expired link
    else valid
        DB-->>API: Match
        API->>PROV: Change password
        API->>DB: Mark token consumed
        API->>DB: Revoke ALL existing sessions for user
        API-->>UI2: 200 Password changed, please sign in
    end
```

## 7. OAuth lifecycle (e.g. Google)

```mermaid
sequenceDiagram
    actor U as User
    participant UI as apps/web
    participant API as AuthController
    participant PROV as OAuth provider (e.g. Google)
    participant DB as Postgres

    U->>UI: Click "Continue with Google"
    UI->>API: GET /auth/oauth/google/start
    API->>API: Generate state + PKCE verifier, store server-side
    API-->>UI: Redirect to provider authorization URL
    UI->>PROV: User authenticates with provider
    alt user denies
        PROV-->>UI: Callback with error param
        UI-->>U: Redirect to login, generic error shown
    else user approves
        PROV-->>API: GET /auth/oauth/google/callback?code&state
        API->>API: Verify state matches stored value
        alt state mismatch
            API-->>UI: 400 - reject, log security_event
        else state matches
            API->>PROV: Exchange code + verifier for identity
            alt exchange fails
                PROV-->>API: Error
                API-->>UI: 400/500 (mapped to generic error)
            else exchange succeeds
                API->>DB: Look up User linked to this provider identity
                alt existing link
                    DB-->>API: Found
                    API->>DB: Create Session, issue cookies
                    API-->>UI: 200 - redirect to dashboard
                else email matches an existing password account
                    DB-->>API: Found by email, no link yet
                    Note over API,UI: Explicit, user-confirmed safe-link flow required - never automatic
                    alt user confirms link
                        UI->>API: POST /auth/oauth/google/link-confirm
                        API->>DB: Link identity to existing User, create Session
                        API-->>UI: 200 - redirect to dashboard
                    else user does not confirm
                        API-->>UI: Reject - do not silently merge accounts
                    end
                else no existing user
                    DB-->>API: Not found
                    API->>DB: Create User + Profile + default role, create Session
                    API-->>UI: 200 - redirect to dashboard
                end
            end
        end
    end
```

## 8. Session expiration lifecycle

```mermaid
sequenceDiagram
    actor Client as apps/web (api-client)
    participant API as AuthController
    participant GUARD as SessionGuard
    participant DB as Postgres (Session table)

    Note over Client: Time passes, or session was revoked elsewhere
    Client->>API: Request to protected route
    API->>GUARD: Verify access JWT + Session row
    alt JWT valid and session active
        GUARD-->>API: OK
        API-->>Client: 200 OK
    else JWT expired or session revoked
        GUARD-->>API: Invalid
        API-->>Client: 401 Unauthorized
        Client->>API: Attempt refresh (see Flow 3)
        alt refresh succeeds
            Client->>API: Retry original request
            API-->>Client: 200 OK
        else refresh fails
            API-->>Client: 401 Session expired
            Client->>Client: Clear auth state + cookies
            Client-->>Client: Redirect to /login?reason=session_expired
        end
    end
```
