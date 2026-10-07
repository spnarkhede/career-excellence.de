import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/settings"];

// Must match AUTH_SESSION_COOKIE_NAME's base name (apps/api/src/auth/
// cookie-names.ts). BUG-016 (Phase 10): this previously hardcoded the
// literal "app_session" — but Phase 7 applies a __Host- prefix to that
// cookie whenever it's Secure with no Domain attribute (i.e. in any
// non-local environment), so this check would never have found the cookie
// in production at all, redirecting every signed-in user to /login on
// every protected-page visit. Checking both the bare and __Host--prefixed
// names (middleware can't know the server's runtime secure/domain config)
// fixes it without needing this file to duplicate that logic.
const SESSION_COOKIE_BASE_NAME = process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME || "app_session";

function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has(SESSION_COOKIE_BASE_NAME) ||
    request.cookies.has(`__Host-${SESSION_COOKIE_BASE_NAME}`)
  );
}

/**
 * Improves navigation UX by redirecting obviously-unauthenticated requests to
 * login, and strips any (impossible-to-forge-usefully-here, but defense in
 * depth costs nothing) sensitive response caching on protected paths.
 *
 * This is NOT the security boundary — checklist task 1: "Framework
 * middleware has had bypass bugs (for example CVE-2025-29927 in Next.js), so
 * handlers check again." Every protected page ALSO calls `requireUser()`/
 * `requirePermission()` server-side (apps/web/src/lib/require-user.ts),
 * independently of whatever this middleware decided — a middleware bypass
 * (forged `x-middleware-subrequest` header or any future equivalent) still
 * hits a page that re-verifies the session against the database via the API,
 * the same way SessionGuard re-verifies every API request regardless of any
 * upstream header.
 */
export function middleware(request: NextRequest) {
  const isProtected = PROTECTED_PREFIXES.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  if (!hasSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Checklist task 7: "Cache-Control no store so back and forward after
  // logout show no private data" — applied here so it covers every
  // protected page uniformly, rather than each page setting it individually.
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*"],
};
