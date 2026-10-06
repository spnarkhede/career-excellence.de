# API

## Conventions

- REST, JSON bodies, `application/json`.
- Base path per environment via `NEXT_PUBLIC_API_URL`.
- Swagger/OpenAPI docs served at `/docs` outside production (`APP_ENV != production`).
- Every response error uses the shape:

```json
{ "requestId": "...", "code": "...", "message": "...", "details": {} }
```

- Validation happens at the boundary with Zod schemas shared from `@saas/validation`
  (see `ZodValidationPipe`); never trust client-side validation alone.
- Authenticated routes require the `SessionGuard` and read the principal via
  `@CurrentPrincipal()`.
- Rate limits are applied per-route with `@Throttle()` on top of a global default
  (100 req/min) from `ThrottlerGuard`.

## Route reference

See [packages/contracts/src/index.ts](../../packages/contracts/src/index.ts) for the
canonical, typed list of routes shared between the API and clients (`API_ROUTES`).

| Method    | Path                            | Auth           | Notes                            |
| --------- | ------------------------------- | -------------- | -------------------------------- |
| POST      | `/auth/signup`                  | public         | rate limited                     |
| POST      | `/auth/login`                   | public         | rate limited                     |
| POST      | `/auth/logout`                  | session        |                                  |
| POST      | `/auth/refresh`                 | refresh cookie | rotates refresh token            |
| GET       | `/auth/me`                      | session        | returns `AuthenticatedPrincipal` |
| POST      | `/auth/verify-email`            | public (token) | single-use                       |
| POST      | `/auth/password-reset/request`  | public         | neutral response                 |
| POST      | `/auth/password-reset/confirm`  | public (token) | revokes all sessions             |
| POST      | `/auth/otp/request`             | public         | neutral response                 |
| POST      | `/auth/otp/verify`              | public         | issues session                   |
| GET       | `/auth/sessions`                | session        |                                  |
| DELETE    | `/auth/sessions/:id`            | session        |                                  |
| POST      | `/auth/sessions/revoke-others`  | session        |                                  |
| GET/PATCH | `/profile/me`                   | session        | permission-checked               |
| GET       | `/health/live`, `/health/ready` | public         |                                  |

## Error codes

HTTP status is mirrored into `code` via Nest's `HttpStatus` enum names (e.g.
`UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST`). Unhandled exceptions become
`INTERNAL_ERROR` with a generic message — stack traces are never sent to clients
(`AllExceptionsFilter`).
