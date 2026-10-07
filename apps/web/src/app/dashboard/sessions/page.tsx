import { requireUser } from "../../../lib/require-user";
import { DashboardError } from "../dashboard-error";
import { SessionsClient } from "./sessions-client";

// Phase 10 (checklist "Nested routes", "Server-side protection"): this nested
// dashboard page previously had NO server-side gate of its own — it relied
// only on the Next.js middleware's blunt cookie-presence check plus
// SessionsClient's own API calls failing with 401 (which showed an inline
// error, never a redirect). `requireUser()` closes that gap the same way
// `/dashboard` itself is already gated.
export default async function SessionsPage() {
  const result = await requireUser("/dashboard/sessions");
  if (result.kind === "error") {
    return <DashboardError message={result.message} />;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Active sessions</h1>
      <p className="text-muted-foreground mb-6">
        Devices currently signed in to your account. Revoke any you don't recognize.
      </p>
      <SessionsClient />
    </main>
  );
}
