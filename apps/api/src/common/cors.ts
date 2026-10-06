import type { CorsOptions } from "cors";
import { isOriginAllowed } from "@saas/security";

/**
 * Builds CORS options from an explicit allowlist. Never combines a wildcard origin with
 * credentials: true — a disallowed origin is rejected via `callback(null, false)` (no
 * CORS headers sent), never by throwing, so a probing request fails closed without a 500.
 */
export function buildCorsOptions(allowedOrigins: string[]): CorsOptions {
  return {
    origin: (origin, callback) => {
      callback(null, isOriginAllowed(origin, allowedOrigins));
    },
    credentials: true,
  };
}
