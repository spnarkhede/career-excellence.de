"use client";

import { useEffect, useState } from "react";
import { consentUpdated } from "@saas/analytics";
import { Button } from "@saas/ui";

const CONSENT_VERSION = "1";
const STORAGE_KEY = "cookie-consent";

interface StoredConsent {
  analytics: boolean;
  marketing: boolean;
  consentVersion: string;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setVisible(true);
      return;
    }
    const stored = JSON.parse(raw) as StoredConsent;
    if (stored.consentVersion !== CONSENT_VERSION) {
      setVisible(true);
      return;
    }
    consentUpdated({ analytics: stored.analytics, marketing: stored.marketing });
  }, []);

  function save(consent: { analytics: boolean; marketing: boolean }) {
    const value: StoredConsent = { ...consent, consentVersion: CONSENT_VERSION };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    consentUpdated(consent);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    // BUG (found and fixed this phase, via axe): this banner rendered as a
    // bare <div>, outside any landmark region — axe's "region" rule flags
    // any page content not contained by one. A <dialog>/<section> with a
    // role wouldn't help here (this isn't modal and doesn't own a heading),
    // so a plain `role="region"` + `aria-label` is the minimal fix.
    <div
      role="region"
      aria-label="Cookie consent"
      className="border-border bg-background fixed inset-x-0 bottom-0 z-50 border-t p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-muted-foreground text-sm">
          We use cookies for essential functionality and, with your consent, analytics.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => save({ analytics: false, marketing: false })}
          >
            Reject optional
          </Button>
          <Button size="sm" onClick={() => save({ analytics: true, marketing: true })}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
