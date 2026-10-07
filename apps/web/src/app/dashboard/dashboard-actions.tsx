"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@saas/ui";
import { broadcastLogout, onLogoutBroadcast } from "@saas/api-client";
import { apiClient } from "../../lib/api-client";

/**
 * Logout button plus session-list link, and the receiving half of cross-tab
 * logout sync: if ANOTHER tab calls /auth/logout, this tab redirects to login
 * too, rather than silently continuing to show a now-stale authenticated page
 * (checklist "notify other tabs... log out of all devices").
 */
export function DashboardActions() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    return onLogoutBroadcast(() => {
      router.push("/login");
    });
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Even if the request fails (e.g. the session was already gone server-side),
      // still navigate away — there is nothing useful to retry here, and staying
      // on a dashboard the server no longer recognizes is the worse outcome.
    }
    broadcastLogout();
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
