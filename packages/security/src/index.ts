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
  /** Empty/omitted means "no Domain attribute" — a host-only cookie. */
  domain?: string;
  secure: boolean;
  maxAgeSeconds: number;
  /**
   * "strict" for cookies that should never be sent on an incoming cross-site
   * navigation (e.g. a refresh token, which is only ever read by same-site
   * fetches); "lax" (the default) for ones that must still work after following a
   * same-site-but-top-level-navigation link from elsewhere (e.g. an email
   * magic-link landing page's own subsequent fetches); "none" (always paired
   * with Secure) only for a cookie that must survive a genuine cross-site
   * request — Apple's Sign in with Apple web callback arrives as a cross-site
   * POST, which Lax would not carry the cookie on.
   */
  sameSite?: "strict" | "lax" | "none";
}

export function sessionCookieOptions({
  domain,
  secure,
  maxAgeSeconds,
  sameSite = "lax",
}: CookieOptions) {
  return {
    httpOnly: true,
    secure,
    sameSite,
    // Omit the Domain attribute entirely when unset, rather than passing an empty
    // string — Express's res.cookie would otherwise serialize `Domain=`, which is
    // not the same as omitting the attribute.
    ...(domain ? { domain } : {}),
    path: "/",
    maxAge: maxAgeSeconds * 1000,
  };
}

/**
 * The `__Host-` prefix is a browser-enforced guarantee (RFC 6265bis) that a cookie
 * can only be set when `Secure` is true, `Path=/`, and no `Domain` attribute is
 * present — exactly the "most locked down" cookie shape. Applying it is only valid
 * when all three hold; this computes the eligible name so the caller can't apply
 * the prefix to a cookie that doesn't actually meet the requirement (the browser
 * would silently reject the Set-Cookie header instead of erroring visibly).
 */
export function cookieName(baseName: string, opts: { secure: boolean; domain?: string }): string {
  return opts.secure && !opts.domain ? `__Host-${baseName}` : baseName;
}
