// Browser-safe utilities only. Password/token hashing (argon2, node:crypto) lives in ./server
// so client bundles (e.g. apps/web) never pull in native/server-only dependencies.

export interface SecurityHeadersOptions {
  /** Per-request nonce, required to allow any inline script without 'unsafe-inline'. */
  nonce: string;
  /** Additional script sources beyond 'self'/the nonce, e.g. an analytics CDN. */
  scriptSrc?: string[];
  connectSrc?: string[];
  frameAncestors?: string[];
  /** Enables HSTS and upgrade-insecure-requests. Only ever true in production. */
  isProduction?: boolean;
}

/**
 * Builds a restrictive Content-Security-Policy header value. Scripts are only allowed via
 * 'self' or the per-request nonce — 'unsafe-inline' is never used for script-src.
 */
export function buildContentSecurityPolicy(opts: SecurityHeadersOptions): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${opts.nonce}'`, ...(opts.scriptSrc ?? [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "https:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(opts.connectSrc ?? [])],
    "frame-ancestors": opts.frameAncestors ?? ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  const policy = Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
  return opts.isProduction ? `${policy}; upgrade-insecure-requests` : policy;
}

/** Generates a fresh, cryptographically random per-request CSP nonce (base64). */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function buildSecurityHeaders(opts: SecurityHeadersOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": buildContentSecurityPolicy(opts),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-Frame-Options": "DENY",
  };
  // HSTS only makes sense once HTTPS is actually enforced — never send it over plain HTTP in dev.
  if (opts.isProduction) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }
  return headers;
}

/** Pure allowlist check for CORS origin validation — never combine a wildcard with credentials. */
export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return true; // non-browser clients (no Origin header) are not subject to CORS
  return allowedOrigins.includes(origin);
}

/** Validates that a redirect target is a relative path or matches an allowlisted origin, preventing open redirects. */
export function isAllowedRedirect(target: string, allowedOrigins: string[]): boolean {
  if (target.startsWith("/") && !target.startsWith("//")) return true;
  try {
    const url = new URL(target);
    return allowedOrigins.includes(url.origin);
  } catch {
    return false;
  }
}

export interface CookieOptions {
  domain: string;
  secure: boolean;
  maxAgeSeconds: number;
}

export function sessionCookieOptions({ domain, secure, maxAgeSeconds }: CookieOptions) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    domain,
    path: "/",
    maxAge: maxAgeSeconds * 1000,
  };
}
