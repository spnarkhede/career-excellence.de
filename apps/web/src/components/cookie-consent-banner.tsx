"use client";

import { useEffect, useState } from "react";
import { CONSENT_STORAGE_KEY, CONSENT_VERSION, consentUpdated } from "@saas/analytics";
import { Button } from "@saas/ui";

// Re-exported under the names this file already used, so the rest of the
// component below didn't need renaming — `@saas/analytics` is now the
// single source of truth for the key/version (see its own module-scope
// synchronous read, which this banner's writes must stay compatible with).
const STORAGE_KEY = CONSENT_STORAGE_KEY;
/** Dispatched by the "Cookie settings" footer link (checklist task 4: "a
 * link to reopen settings") to reopen this banner even after a choice was
 * already made — listened to below rather than lifted into shared state,
 * since this is the only consumer. */
export const REOPEN_COOKIE_SETTINGS_EVENT = "reopen-cookie-settings";

interface StoredConsent {
  analytics: boolean;
  marketing: boolean;
  consentVersion: string;
}

function readStoredConsent(): StoredConsent | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredConsent;
  } catch {
    return null;
  }
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  // Per-category toggles (checklist task 4: "per category choices") — never
  // pre-checked true, since the banner is only visible when consent hasn't
  // been recorded yet (or is being reopened to change a prior choice).
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const stored = readStoredConsent();
    if (!stored || stored.consentVersion !== CONSENT_VERSION) {
      setVisible(true);
    } else {
      consentUpdated({ analytics: stored.analytics, marketing: stored.marketing });
    }

    function reopen() {
      const current = readStoredConsent();
      setAnalytics(current?.analytics ?? false);
      setMarketing(current?.marketing ?? false);
      setCustomizing(true);
      setVisible(true);
    }
    window.addEventListener(REOPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  function save(consent: { analytics: boolean; marketing: boolean }) {
    const value: StoredConsent = { ...consent, consentVersion: CONSENT_VERSION };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    consentUpdated(consent);
    setVisible(false);
    setCustomizing(false);
  }

  if (!visible) return null;

  return (
    // role="region" + aria-label: axe's "region" rule (found and fixed in an
    // earlier phase) requires all page content to be inside a landmark.
    <div
      role="region"
      aria-label="Cookie consent"
      className="border-border bg-background fixed inset-x-0 bottom-0 z-50 border-t p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          We use cookies for essential functionality and, with your consent, analytics and
          marketing. Strictly necessary cookies (e.g. your signed-in session) are never optional and
          are not covered by this choice.
        </p>

        {customizing && (
          <div className="flex flex-col gap-2 border-t pt-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Strictly necessary</p>
                <p className="text-muted-foreground text-xs">
                  Required for login and security. Always on.
                </p>
              </div>
              <input type="checkbox" checked disabled aria-label="Strictly necessary (always on)" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Analytics</p>
                <p className="text-muted-foreground text-xs">
                  Helps us understand how the product is used.
                </p>
              </div>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                aria-label="Analytics cookies"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Marketing</p>
                <p className="text-muted-foreground text-xs">
                  Used to measure the effectiveness of campaigns.
                </p>
              </div>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                aria-label="Marketing cookies"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 sm:justify-end">
          {!customizing && (
            <Button variant="ghost" size="sm" onClick={() => setCustomizing(true)}>
              Customize
            </Button>
          )}
          {/* Checklist task 4: "Reject as easy as Accept" — both are the
              SAME variant/size, one click each, same row. Neither is
              visually de-emphasized relative to the other. */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => save({ analytics: false, marketing: false })}
          >
            Reject {customizing ? "all" : "optional"}
          </Button>
          {customizing ? (
            <Button variant="outline" size="sm" onClick={() => save({ analytics, marketing })}>
              Save preferences
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => save({ analytics: true, marketing: true })}
          >
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
