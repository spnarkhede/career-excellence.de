import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthenticatedPrincipal, PermissionName } from "@saas/types";
import type { MeResponse } from "@saas/contracts";
import { resolveAuthRedirect } from "@saas/security";

export type RequireUserResult =
  { kind: "ok"; principal: AuthenticatedPrincipal } | { kind: "error"; message: string };

/**
 * Phase 10's `requireUser()` helper: the server-side gate every protected
 * page (not just `/dashboard` itself) must call directly — this is the
 * "check inside every ... page" half of "guards in layers" (checklist task
 * 1); the Next.js middleware's cookie-presence check is the OTHER, outer
 * layer, never the only one, precisely because framework middleware has had
 * real bypass bugs (CVE-2025-29927).
 *
 * Always re-fetches the principal fresh from the API using the forwarded
 * session cookie — never trusts anything client-supplied (checklist "Never
 * trust roles from the client"). Redirects to `/login` (carrying a safe,
 * allowlisted `next`) on a genuine 401; returns a retryable error state for
 * any OTHER failure (network error, 5xx, a malformed response) instead of
 * ever redirecting on those — a transient outage must never look like a
 * logout loop.
 */
export async function requireUser(currentPath: string): Promise<RequireUserResult> {
  let response: Response | null = null;
  try {
    const cookieStore = await cookies();
    response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { cookie: cookieStore.toString() },
      cache: "no-store",
    });
  } catch {
    response = null;
  }

  if (!response) {
    return {
      kind: "error",
      message: "We couldn't reach the server. Check your connection and try again.",
    };
  }

  if (response.status === 401) {
    // Delegates to the same decision function the login page's own
    // "already signed in?" check builds on (packages/security's
    // resolveAuthRedirect) — the structural property that makes a 2-page
    // loop impossible is tested once, there, rather than re-implemented
    // here and hoped to stay consistent.
    const { redirectTo } = resolveAuthRedirect({
      isLoginPage: false,
      requiresAuth: true,
      isAuthenticated: false,
      currentPath,
    });
    // requiresAuth: true + isAuthenticated: false always produces a
    // "/login?next=..." target — never null — per resolveAuthRedirect's own
    // (exhaustively tested) logic.
    redirect(`${redirectTo!}&reason=session_expired`);
  }

  if (!response.ok) {
    return { kind: "error", message: "We couldn't load this page right now. Please try again." };
  }

  const body = (await response.json().catch(() => null)) as MeResponse | null;
  if (!body?.principal) {
    // Checklist "missing profile shows a recovery page" — PrincipalService
    // self-heals a missing Profile row, so reaching this branch means /auth/me
    // itself returned a malformed body, not merely a missing profile; still
    // routed through the same recovery state rather than crashing.
    return {
      kind: "error",
      message: "We couldn't load your account. Please try again or contact support.",
    };
  }

  return { kind: "ok", principal: body.principal };
}

/**
 * `requirePermission(name)` — `requireUser()` plus a permission check against
 * the SAME server-resolved principal (never a client-supplied role/permission
 * list). Redirects to `/forbidden` when the permission is missing, distinct
 * from the `/login` redirect `requireUser()` uses for "not authenticated at
 * all" — checklist "401 when unauthenticated, 403 when forbidden" applied to
 * page-level routing (a page redirect obviously can't literally return an
 * HTTP 403 body, but it lands on a dedicated, distinctly-worded page rather
 * than reusing the login redirect for both cases).
 */
export async function requirePermission(
  currentPath: string,
  permission: PermissionName,
): Promise<RequireUserResult> {
  const result = await requireUser(currentPath);
  if (result.kind !== "ok") return result;
  if (!result.principal.permissions.includes(permission)) {
    redirect("/forbidden");
  }
  return result;
}
