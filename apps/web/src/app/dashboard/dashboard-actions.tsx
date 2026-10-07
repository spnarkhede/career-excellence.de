"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@saas/ui";
import { useAuth } from "../../components/auth-provider";

/**
 * Logout button plus session-list link. Cross-tab logout sync (checklist
 * "notify other tabs... log out of all devices") and client-cache clearing
 * are now centralized in `AuthProvider.logout()` (Phase 11) rather than
 * hand-rolled here — this component just calls it and navigates away.
 */
export function DashboardActions() {
  const router = useRouter();
  const auth = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  // If the AuthProvider's own cross-tab subscription (another tab logging
  // out) flips this tab to "unauthenticated" while sitting on the
  // dashboard, leave rather than show a now-stale authenticated page.
  useEffect(() => {
    if (auth.status === "unauthenticated") router.push("/login");
  }, [auth.status, router]);

  async function handleLogout() {
    setLoggingOut(true);
    await auth.logout();
    router.push("/login");
  }

  return (
    <div className="flex gap-3">
      <Button variant="outline" onClick={() => router.push("/dashboard/sessions")}>
        Manage sessions
      </Button>
      <Button variant="outline" onClick={() => router.push("/dashboard/connected-accounts")}>
        Connected accounts
      </Button>
      <Button variant="ghost" onClick={() => void handleLogout()} disabled={loggingOut}>
        {loggingOut ? "Logging out…" : "Log out"}
      </Button>
    </div>
  );
}
