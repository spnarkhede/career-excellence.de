import { ConnectedAccountsClient } from "./connected-accounts-client";

export default function ConnectedAccountsPage() {
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
