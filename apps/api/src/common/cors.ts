import { isOriginAllowed } from "@saas/security";

/**
 * Builds CORS options from an explicit allowlist. Never combines a wildcard origin with
 * credentials: true — a disallowed origin is rejected via `callback(null, false)` (no
 * CORS headers sent), never by throwing, so a probing request fails closed without a 500.
 *
 * Deliberately untyped against the `cors` package's own `CorsOptions` (which conflicts
 * with @nestjs/common's duplicate, slightly stricter interface) — this object is passed
 * to both `cors()` (Express) in tests and `app.enableCors()` (Nest) in main.ts, and it
 * matches both structurally.
 */
export function buildCorsOptions(allowedOrigins: string[]) {
  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, isOriginAllowed(origin, allowedOrigins));
    },
    credentials: true,
  };
}
