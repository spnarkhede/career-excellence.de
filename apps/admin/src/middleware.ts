import { NextResponse, type NextRequest } from "next/server";

// Must match AUTH_SESSION_COOKIE_NAME's base name (apps/api/src/auth/
// cookie-names.ts) — see the identical comment in apps/web/src/middleware.ts
// (BUG-016) for why both the bare and __Host--prefixed names are checked.
const SESSION_COOKIE_BASE_NAME = process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME || "app_session";
const PUBLIC_PATHS = new Set(["/login", "/forbidden"]);

function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has(SESSION_COOKIE_BASE_NAME) ||
    request.cookies.has(`__Host-${SESSION_COOKIE_BASE_NAME}`)
  );
}

/**
 * Checklist "Admin routes" / "guards in layers": the admin app previously had
 * NO middleware at all — its only gate was the manual check inside
 * `app/page.tsx`, meaning any FUTURE admin page added without copying that
 * exact pattern would be served with zero protection by default. This
 * middleware is still only the OUTER layer (same "NOT the security boundary"
 * caveat as apps/web's) — `requireUser()`/`requirePermission()`
 * (apps/admin/src/lib/require-user.ts) is the inner layer every page must
 * also call directly, precisely because framework middleware has had real
 * bypass bugs (checklist task 1, CVE-2025-29927).
 */
export function middleware(request: NextRequest) {
  if (PUBLIC_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  // Checklist task 7: no cached private admin content after logout.
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  // Every admin route except static assets/Next internals — unlike
  // apps/web, the ENTIRE admin app is sensitive by default, not just a
  // `/dashboard` subtree.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
