import { requirePermission } from "../lib/require-user";
import { AdminError } from "./admin-error";

/**
 * Administration entry point. Normal user authorization does not grant access here —
 * the administrator/super_administrator permission set is checked independently.
 */
export default async function AdminHomePage() {
  const result = await requirePermission("/", "users.read");
  if (result.kind === "error") {
    return <AdminError message={result.message} />;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Administration</h1>
      <p className="text-muted-foreground">Signed in as {result.principal.user.email}</p>
    </main>
  );
}
