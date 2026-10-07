import { requireUser } from "../../../lib/require-user";
import { DashboardError } from "../dashboard-error";
import { ConnectedAccountsClient } from "./connected-accounts-client";

// Phase 10 (checklist "Nested routes", "Server-side protection"): same gap
// as dashboard/sessions — this page had no server-side gate of its own.
export default async function ConnectedAccountsPage() {
  const result = await requireUser("/dashboard/connected-accounts");
  if (result.kind === "error") {
    return <DashboardError message={result.message} />;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Connected accounts</h1>
      <p className="text-muted-foreground mb-6">
        Sign in with a linked provider, or link a new one below.
      </p>
      <ConnectedAccountsClient />
    </main>
  );
}
