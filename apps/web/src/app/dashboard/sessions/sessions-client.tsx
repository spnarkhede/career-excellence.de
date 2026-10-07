"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, FormError } from "@saas/ui";
import { ApiClientError } from "@saas/api-client";
import { apiClient } from "../../../lib/api-client";

interface SessionRow {
  id: string;
  current: boolean;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

/** Device/session list with per-row revoke buttons (checklist task 7) — backed by
 * the Phase 5 GET /auth/sessions endpoint, now returning only the fields a user
 * should see (never a refresh-token hash or internal rotation pointer). */
export function SessionsClient() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiClient.get<{ sessions: SessionRow[] }>("/auth/sessions");
      setSessions(res.sessions);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : "Couldn't load sessions.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(id: string) {
    setRevokingId(id);
    try {
      await apiClient.delete(`/auth/sessions/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : "Couldn't revoke that session.");
    } finally {
      setRevokingId(null);
    }
  }

  async function revokeOthers() {
    setRevokingOthers(true);
    try {
      await apiClient.post("/auth/sessions/revoke-others");
      await load();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.body.message : "Couldn't revoke other sessions.",
      );
    } finally {
      setRevokingOthers(false);
    }
  }

  if (!sessions && !error) {
    return <p className="text-muted-foreground">Loading sessions…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <FormError message={error ?? undefined} />
      <Button
        variant="outline"
        onClick={() => void revokeOthers()}
        disabled={revokingOthers || !sessions || sessions.length <= 1}
      >
        {revokingOthers ? "Revoking…" : "Log out other devices"}
      </Button>
      <ul className="flex flex-col gap-3">
        {sessions?.map((session) => (
          <li
            key={session.id}
            className="border-border flex items-center justify-between gap-4 rounded-md border p-3"
          >
            <div>
              <p className="text-sm font-medium">
                {session.userAgent ?? "Unknown device"}
                {session.current && <span className="text-muted-foreground"> (this device)</span>}
              </p>
              <p className="text-muted-foreground text-xs">
                Last active {new Date(session.lastUsedAt).toLocaleString()}
              </p>
            </div>
            {!session.current && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void revoke(session.id)}
                disabled={revokingId === session.id}
              >
                {revokingId === session.id ? "Revoking…" : "Revoke"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
