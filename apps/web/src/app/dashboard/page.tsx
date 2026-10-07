import { requireUser } from "../../lib/require-user";
import { DashboardActions } from "./dashboard-actions";
import { DashboardError } from "./dashboard-error";

/**
 * Checklist "Login succeeding but dashboard/profile/permissions failing": a 401
 * means "not authenticated" and redirects to /login — never a loop, since /login
 * itself only redirects AWAY when /auth/me succeeds, so an unauthenticated user
 * reaches the form. Every OTHER failure (network error, 5xx, a malformed response)
 * renders a visible retry state instead of crashing or showing a blank page.
 */
export default async function DashboardPage() {
  const result = await requireUser("/dashboard");
  if (result.kind === "error") {
    return <DashboardError message={result.message} />;
  }
  const principal = result.principal;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Welcome, {principal.user.email}</h1>
      <p className="text-muted-foreground">Roles: {principal.roles.join(", ") || "none"}</p>
      <div className="mt-6">
        <DashboardActions />
      </div>
    </main>
  );
}
