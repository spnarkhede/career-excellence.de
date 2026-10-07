import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { loadPrivateEnv } from "@saas/config";
import { csrfCookieName } from "../auth/cookie-names.js";

const env = loadPrivateEnv();
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Buffers of different lengths would make timingSafeEqual throw rather than
  // return false — comparing against a fixed-length buffer first keeps this a
  // constant-time check regardless of the (attacker-controlled) header's length.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Double-submit-cookie CSRF check plus an explicit Origin re-check, applied to
 * cookie-authenticated state-changing routes (logout, session revocation, refresh,
 * password change). CORS already blocks a disallowed origin's browser-made
 * request, but that enforcement lives in the browser — this repeats the check
 * server-side so a client that doesn't go through CORS (e.g. a non-browser HTTP
 * client replaying a stolen cookie) can't bypass it just by omitting an Origin
 * header's enforcement path. The CSRF token itself is the primary defense: an
 * attacker's cross-site page can get the browser to SEND the cookie automatically,
 * but can't READ its value to also set the matching header (same-origin policy).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!STATE_CHANGING_METHODS.has(request.method)) return true;

    const allowedOrigins = env.API_CORS_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    const origin = request.get("origin");
    if (origin && !allowedOrigins.includes(origin)) {
      throw new ForbiddenException("Request origin not allowed.");
    }

    const cookieToken = request.cookies?.[csrfCookieName];
    const headerToken = request.get("x-csrf-token");
    if (!cookieToken || !headerToken || !timingSafeStringEqual(cookieToken, headerToken)) {
      throw new ForbiddenException("Missing or invalid CSRF token.");
    }

    return true;
  }
}
