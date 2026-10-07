import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { MeResponse } from "@saas/contracts";
import { DashboardError } from "./dashboard-error";

/**
 * Fetches the authenticated principal (session -> profile -> permissions, all
 * resolved together server-side by PrincipalService.resolve, including its
 * self-healing idempotent profile creation if one is missing) using the forwarded
 * session cookie.
 *
 * Checklist "Login succeeding but dashboard/profile/permissions failing": a 401
 * means "not authenticated" and redirects to /login — never a loop, since /login
 * itself only redirects AWAY when /auth/me succeeds, so an unauthenticated user
 * reaches the form. Every OTHER failure (network error, 5xx, a malformed response)
 * renders a visible retry state instead of crashing or showing a blank page.
 */
export default async function DashboardPage() {
  // `redirect()` (below) works by throwing a special Next.js-internal error that
  // must propagate all the way up — it must never be caught by the try/catch here,
  // so the fetch itself is isolated in its own try/catch and only produces plain
  // data (a response, or null on network failure); every status-based branch,
  // redirect included, happens outside that block.
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
    return (
      <DashboardError message="We couldn't reach the server. Check your connection and try again." />
    );
  }

  if (response.status === 401) {
    redirect("/login?reason=session_expired");
  }

  if (!response.ok) {
    return (
      <DashboardError message="We couldn't load your dashboard right now. Please try again." />
    );
  }

  const body = (await response.json().catch(() => null)) as MeResponse | null;
  if (!body?.principal) {
    return (
      <DashboardError message="We couldn't load your dashboard right now. Please try again." />
    );
  }
  const principal = body.principal;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Welcome, {principal.user.email}</h1>
      <p className="text-muted-foreground">Roles: {principal.roles.join(", ") || "none"}</p>
    </main>
  );
}
