"use client";

import { useEffect, useState } from "react";
import { Button } from "@saas/ui";
import { apiClient } from "../lib/api-client";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
  github: "GitHub",
  facebook: "Facebook",
  apple: "Apple",
};

/**
 * Lists whichever providers are actually configured in this environment
 * (checklist task 9: an unregistered provider is a configuration gap, not a
 * missing button) and, for each, a button that does a full-page navigation
 * to `/auth/oauth/:provider/start` — never a popup, so there is no
 * popup-blocked/closed state to handle (checklist "Prefer full page
 * redirects").
 */
export function OAuthButtons({ mode = "login" }: { mode?: "login" | "link" }) {
  const [providers, setProviders] = useState<string[]>([]);

  useEffect(() => {
    apiClient
      .get<{ providers: string[] }>("/auth/oauth/providers")
      .then((res) => setProviders(res.providers))
      .catch(() => setProviders([]));
  }, []);

  if (providers.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {providers.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          onClick={() => {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
            window.location.href = `${apiUrl}/auth/oauth/${provider}/start?mode=${mode}`;
          }}
        >
          Continue with {PROVIDER_LABELS[provider] ?? provider}
        </Button>
      ))}
    </div>
  );
}
