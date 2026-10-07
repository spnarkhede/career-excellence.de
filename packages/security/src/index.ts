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

const DEFAULT_SAFE_RETURN_TO = "/dashboard";

/**
 * Phase 10 ("Safe return URL helper"): true only for a strictly same-origin,
 * single-segment-rooted relative path — decoded EXACTLY ONCE (never zero
 * times, which would let a %2F-encoded "//evil.example" slip past the
 * literal prefix checks below; never more than once, which opens its own
 * double-encoding bypass class) before every check:
 *
 * - must start with exactly one `/` — `//host` (protocol-relative) is
 *   rejected, and so is a bare scheme like `javascript:...` (which never
 *   starts with `/` at all).
 * - no backslash anywhere — browsers following the WHATWG URL spec treat
 *   `\` as equivalent to `/` for "special" schemes, so `/\evil.example`
 *   would be re-parsed by the BROWSER as `//evil.example` (protocol-
 *   relative) even though the literal string here starts with a single
 *   forward slash.
 * - no control characters (including tab/newline) — browsers strip these
 *   during URL normalization, which can turn an innocuous-looking string
 *   like `/\n/evil.example` into `//evil.example` after the browser's own
 *   whitespace stripping, the same class of bypass as the backslash case.
 */
export function isSafeRelativePath(raw: string): boolean {
  if (typeof raw !== "string" || raw.length === 0) return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return false; // malformed percent-encoding — fail closed, never guess
  }
  // eslint-disable-next-line no-control-regex -- deliberately matching control chars, including tab/newline/DEL
  if (/[\x00-\x1f\x7f]/.test(decoded)) return false;
  if (decoded.includes("\\")) return false;
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return false;
  return true;
}

/**
 * The canonical `?next=`/`?returnTo=` validator: returns `raw` unchanged only
 * if it's a safe relative path (see `isSafeRelativePath`) AND, when
 * `allowedPrefixes` is given, starts with one of those prefixes — otherwise
 * falls back to `/dashboard` (or `opts.fallback`). Checklist task 5's "paths
 * outside an allowlist" requirement: a safe-shaped path is still rejected if
 * it points somewhere this particular call site never intends to send
 * anyone (e.g. a login page's `next` should only ever point back into the
 * app's own protected areas, not to an arbitrary same-origin static asset).
 */
export function safeReturnTo(
  raw: string | null | undefined,
  opts: { allowedPrefixes?: string[]; fallback?: string } = {},
): string {
  const fallback = opts.fallback ?? DEFAULT_SAFE_RETURN_TO;
  if (!raw || !isSafeRelativePath(raw)) return fallback;
  if (
    opts.allowedPrefixes &&
    !opts.allowedPrefixes.some(
      (prefix) => raw === prefix || raw.startsWith(`${prefix}/`) || raw.startsWith(`${prefix}?`),
    )
  ) {
    return fallback;
  }
  return raw;
}

/** Validates that a redirect target is a relative path or matches an allowlisted origin, preventing open redirects. */
export function isAllowedRedirect(target: string, allowedOrigins: string[]): boolean {
  if (isSafeRelativePath(target)) return true;
  try {
    const url = new URL(target);
    return allowedOrigins.includes(url.origin);
  } catch {
    return false;
  }
}

/**
 * Phase 10 checklist task 6 ("Redirect rules that cannot loop") formalized
 * as a pure decision function: given a page's own identity (is it the login
 * page?), whether the path requires auth, and whether the caller is
 * authenticated, decide where (if anywhere) to redirect. The two real
 * call sites (a login page checking "am I already signed in?" and a
 * protected page's `requireUser()`/`requirePermission()` checking "is there
 * a valid session?") each independently implement one branch of this same
 * decision table — this function exists so the INVARIANT that makes them
 * loop-free (mutual exclusion: login only ever redirects AWAY, a protected
 * page only ever redirects TO login, and login can never be both at once)
 * has one place to be exhaustively tested, rather than only being provable
 * by reading two separate page implementations side by side.
 */
export interface AuthRedirectInput {
  /** True if the CURRENT page being rendered is the login page itself. */
  isLoginPage: boolean;
  /** True if the current page requires authentication at all (irrelevant when `isLoginPage`). */
  requiresAuth: boolean;
  isAuthenticated: boolean;
  /** The current page's own path — used to build `?next=` when redirecting
   * an unauthenticated visitor to login. */
  currentPath: string;
  /** Where to send an authenticated user away from login (read from THAT
   * page's own `?next=`, if any) — validated with `safeReturnTo`, never
   * trusted as-is. */
  next?: string | null;
}

/**
 * The two REAL call sites (`requireUser()` in apps/web and apps/admin, and
 * the login page's own "already signed in?" check) should call this instead
 * of hand-rolling the decision — doing so makes the "cannot loop" invariant
 * structural, not just independently re-implemented in two places and
 * HOPED to stay in sync.
 */
export function resolveAuthRedirect(input: AuthRedirectInput): { redirectTo: string | null } {
  // Checklist: "login never redirects to login" — this branch can only ever
  // produce a redirect AWAY from login, never back to it, by construction
  // (safeReturnTo's own fallback is /dashboard, never /login).
  if (input.isLoginPage) {
    if (!input.isAuthenticated) return { redirectTo: null };
    // `?next=/login` is itself a syntactically "safe" relative path per
    // safeReturnTo's own rules — nothing about it looks malicious — but
    // using it here would bounce an authenticated visitor straight back to
    // login, the exact loop checklist item 10 exists to prevent. Caught by
    // this function's own exhaustive test (every (isAuthenticated, next)
    // combination), not by inspection — reject it explicitly rather than
    // trusting "syntactically safe" to also mean "semantically sensible
    // here."
    const target = safeReturnTo(input.next);
    return {
      redirectTo: target === "/login" || target.startsWith("/login?") ? "/dashboard" : target,
    };
  }

  // Checklist: "signed out user on a protected page goes to login with
  // returnTo" — this is the ONLY branch that ever points at /login, and it
  // can never fire for the login page itself (handled above), so the two
  // branches can never point at each other — the structural property that
  // makes a 2-page cycle impossible regardless of session/profile state.
  if (input.requiresAuth && !input.isAuthenticated) {
    return { redirectTo: `/login?next=${encodeURIComponent(safeReturnTo(input.currentPath))}` };
  }

  return { redirectTo: null };
}

export interface CookieOptions {
  /** Empty/omitted means "no Domain attribute" — a host-only cookie. */
  domain?: string;
  secure: boolean;
  /**
   * Omit entirely (stage 5 #74 "Session persistence setting") for a browser
   * session cookie — no Max-Age/Expires, so the browser discards it on restart.
   * Set equal to the token/session's own absolute lifetime for a "remember me"
   * persistent cookie that survives a restart.
   */
  maxAgeSeconds?: number;
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
    // Omitting `maxAge` makes this a browser-session cookie (no Max-Age/Expires
    // attribute at all) — distinct from passing `maxAge: 0`, which would delete it.
    ...(maxAgeSeconds !== undefined ? { maxAge: maxAgeSeconds * 1000 } : {}),
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
