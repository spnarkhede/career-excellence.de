import type { NextFunction, Request, Response } from "express";
import { buildSecurityHeaders, generateNonce } from "@saas/security";

// Swagger UI (dev-only, disabled in production) ships its own inline bootstrap scripts that
// cannot be nonce'd without forking the bundled HTML — excluded from strict CSP enforcement.
const CSP_EXEMPT_PREFIXES = ["/docs"];

export interface SecurityHeadersConfig {
  isProduction: boolean;
}

/** Sets CSP (with a fresh per-request nonce), HSTS (prod only), and the other baseline security headers. */
export function createSecurityHeadersMiddleware({ isProduction }: SecurityHeadersConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const nonce = generateNonce();
    res.locals.nonce = nonce;

    if (CSP_EXEMPT_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
      next();
      return;
    }

    const headers = buildSecurityHeaders({ nonce, isProduction });
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
    next();
  };
}
