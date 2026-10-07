"use client";

import { Button } from "@saas/ui";

/**
 * Checklist "Login succeeding but dashboard/profile/permissions failing": never a
 * blank page or an uncaught crash when the post-login data fetch fails for a reason
 * other than "not authenticated" (that case redirects to /login instead, see
 * page.tsx) — always a visible error state with an explicit retry action.
 */
export function DashboardError({ message }: { message: string }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">{message}</p>
      <Button onClick={() => window.location.reload()}>Retry</Button>
    </main>
  );
}
