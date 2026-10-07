"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, FormError } from "@saas/ui";
import { ApiClientError } from "@saas/api-client";
import { apiClient } from "../../../lib/api-client";
import { OAuthButtons } from "../../../components/oauth-buttons";

interface LinkedAccount {
  id: string;
  provider: string;
  emailAtLinkTime: string;
  createdAt: string;
}

/** Checklist 7 ("Multiple accounts: link and unlink from settings, never
 * unlink the last sign in method") — lists every linked provider with a
 * per-row unlink button; "Continue with X" buttons below (mode="link") start
 * the linking flow for providers not yet connected. */
export function ConnectedAccountsClient() {
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiClient.get<{ accounts: LinkedAccount[] }>("/auth/oauth/accounts");
      setAccounts(res.accounts);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.body.message : "Couldn't load connected accounts.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function unlink(provider: string) {
    setUnlinkingProvider(provider);
    setError(null);
    try {
      await apiClient.delete(`/auth/oauth/accounts/${provider}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : "Couldn't unlink that provider.");
    } finally {
      setUnlinkingProvider(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <FormError message={error ?? undefined} />

      {accounts === null ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="text-muted-foreground">No providers linked yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="border-border flex items-center justify-between gap-4 rounded-md border p-3"
            >
              <div>
                <p className="text-sm font-medium capitalize">{account.provider}</p>
                <p className="text-muted-foreground text-xs">{account.emailAtLinkTime}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void unlink(account.provider)}
                disabled={unlinkingProvider === account.provider}
              >
                {unlinkingProvider === account.provider ? "Unlinking…" : "Unlink"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium">Link another provider</h2>
        <OAuthButtons mode="link" />
      </div>
    </div>
  );
}
