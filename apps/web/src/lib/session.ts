import { cookies } from "next/headers";
import type { AuthenticatedPrincipal } from "@saas/types";
import type { MeResponse } from "@saas/contracts";

/**
 * Phase 11 task 1: "resolve the session on the server where possible to
 * prevent a flash of protected content and a flash of the login page."
 *
 * Unlike `requireUser()` (Phase 10), this NEVER redirects and never throws —
 * it just reports what the server currently knows, or `null` if it couldn't
 * find out (no session, or the API was unreachable). It's meant to seed the
 * client-side `AuthProvider`'s initial state in the root layout, which every
 * page renders through (including public pages), so a redirect here would be
 * wrong — route-level auth enforcement stays with `requireUser()` /
 * `requirePermission()` on the specific pages that need it (checklist "never
 * rely solely on frontend route protection for security" — this function
 * produces UI state only, not an authorization decision).
 */
export async function getServerSession(): Promise<AuthenticatedPrincipal | null> {
  try {
    const cookieStore = await cookies();
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { cookie: cookieStore.toString() },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json().catch(() => null)) as MeResponse | null;
    return body?.principal ?? null;
  } catch {
    return null;
  }
}
