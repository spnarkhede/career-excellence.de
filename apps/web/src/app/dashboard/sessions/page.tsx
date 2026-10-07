import { SessionsClient } from "./sessions-client";

export default function SessionsPage() {
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
