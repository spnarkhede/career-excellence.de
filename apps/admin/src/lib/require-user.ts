import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthenticatedPrincipal, PermissionName } from "@saas/types";
import type { MeResponse } from "@saas/contracts";
import { resolveAuthRedirect } from "@saas/security";

export type RequireUserResult =
  { kind: "ok"; principal: AuthenticatedPrincipal } | { kind: "error"; message: string };

/**
 * Admin app's `requireUser()`/`requirePermission()` — same shape and same
 * reasoning as apps/web's (apps/web/src/lib/require-user.ts), duplicated
 * here rather than shared via a package because it's ~60 lines of
 * Next.js-specific (`next/headers`/`next/navigation`) logic with nothing
 * else in this monorepo positioned to host a Next.js-coupled shared
 * package. Checklist "Admin routes" / "guards in layers": the admin app
 * previously had NO middleware and NO shared helper — every page
 * duplicated the fetch-and-check logic inline, with no try/catch around
 * the fetch and no handling of a non-401 failure (this fixes both).
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
    // Same shared decision function apps/web's requireUser() uses — see
    // packages/security's resolveAuthRedirect.
    const { redirectTo } = resolveAuthRedirect({
      isLoginPage: false,
      requiresAuth: true,
      isAuthenticated: false,
      currentPath,
    });
    redirect(redirectTo!);
  }

  if (!response.ok) {
    return { kind: "error", message: "We couldn't load this page right now. Please try again." };
  }

  const body = (await response.json().catch(() => null)) as MeResponse | null;
  if (!body?.principal) {
    return {
      kind: "error",
      message: "We couldn't load your account. Please try again or contact support.",
    };
  }

  return { kind: "ok", principal: body.principal };
}

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
