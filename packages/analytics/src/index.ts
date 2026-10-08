/**
 * Single analytics abstraction used throughout the app. Components call these
 * functions, never a vendor SDK directly, so the backing provider can change later.
 * Never pass passwords, tokens, full form payloads, or other sensitive data here.
 */

export interface AnalyticsConsent {
  analytics: boolean;
  marketing: boolean;
}

export interface AnalyticsProvider {
  track(event: string, properties?: Record<string, unknown>): void;
  identify(userId: string, traits?: Record<string, unknown>): void;
  page(name?: string, properties?: Record<string, unknown>): void;
  reset(): void;
  consentUpdated(consent: AnalyticsConsent): void;
}

class NoopAnalyticsProvider implements AnalyticsProvider {
  track(): void {}
  identify(): void {}
  page(): void {}
  reset(): void {}
  consentUpdated(): void {}
}

/**
 * Phase 14 task 5: "load only after consent (or use a cookieless tool)."
 * No third-party analytics SDK (PostHog/Plausible/GA) is wired into this
 * codebase — see docs/auth/COMPONENTS.md — so this is a first-party,
 * cookieless-by-construction provider: it POSTs the event name and a small
 * properties object to this app's OWN API, which validates the event name
 * against a closed allowlist and strips anything email/token/UUID-shaped
 * (`apps/api/src/analytics/analytics.service.ts`). It never sets a cookie
 * of its own and never loads a third-party script, so there is nothing
 * for THIS provider to defer loading until consent — the `track`/`identify`/
 * `page` functions above already refuse to call it at all before consent
 * is granted, which is the actual enforcement point.
 */
export class HttpAnalyticsProvider implements AnalyticsProvider {
  constructor(private readonly apiBaseUrl: string) {}

  track(event: string, properties?: Record<string, unknown>): void {
    void fetch(`${this.apiBaseUrl}/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Never credentials: "include" — this event must never carry the
      // session cookie, since it's reachable before/without authentication
      // and must never double as an identity signal on its own.
      body: JSON.stringify({ event, properties: properties ?? {} }),
    }).catch(() => {
      // Analytics delivery is always best-effort — a failed beacon must
      // never surface as a user-visible error or block the calling action.
    });
  }

  identify(): void {
    // Deliberately a no-op: identify() would need a stable user identifier,
    // which the checklist's "never send... IDs in... events" rule and this
    // provider's cookieless design both argue against wiring up without a
    // real, reviewed analytics backend to receive it responsibly.
  }

  page(): void {
    // Deliberately a no-op: the server-side allowlist
    // (`@saas/validation`'s `ANALYTICS_EVENT_NAMES`) only accepts the 4
    // events this phase's task actually names (signup_started/completed,
    // login, verification_completed) — adding a generic "page_view" event
    // here without also widening that allowlist would just be silently
    // dropped server-side, which is worse than not sending it at all.
  }

  reset(): void {}
  consentUpdated(): void {}
}

// Exported so `CookieConsentBanner` (the only writer of this key) and this
// module (its synchronous reader, see below) can never silently drift out
// of sync on the key name or version string.
export const CONSENT_STORAGE_KEY = "cookie-consent";
export const CONSENT_VERSION = "1";

/**
 * BUG (found and fixed this phase, via a real Playwright test): consent was
 * previously only re-established by `CookieConsentBanner`'s OWN `useEffect`
 * reading localStorage — but on every fresh page load (a full navigation,
 * not a client-side transition), React runs a PAGE's effects (e.g. a page
 * that calls `track(...)` on mount) in JSX/tree order, and the banner is
 * mounted as a SIBLING declared AFTER `{children}` in the root layout. That
 * meant a page's own mount-time `track()` call could run before the
 * banner's effect had re-granted consent from a PRIOR choice, silently
 * dropping an event the user had every right to expect — caught by
 * `tests/e2e/phase14-legal-consent.spec.ts`'s "accepting cookies allows a
 * subsequent tracked event to be sent" test. Reading the stored choice
 * SYNCHRONOUSLY at module evaluation — before any component's effects run
 * at all — removes the race structurally, rather than trying to win a
 * timing race between sibling components' effect order.
 */
function readStoredConsentGranted(): boolean {
  if (typeof localStorage === "undefined") return false; // SSR/non-browser
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return false;
    const stored = JSON.parse(raw) as { analytics?: boolean; consentVersion?: string };
    return stored.consentVersion === CONSENT_VERSION && stored.analytics === true;
  } catch {
    return false;
  }
}

let activeProvider: AnalyticsProvider = new NoopAnalyticsProvider();
let consentGranted = readStoredConsentGranted();

export function configureAnalyticsProvider(provider: AnalyticsProvider): void {
  activeProvider = provider;
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (!consentGranted) return;
  activeProvider.track(event, properties);
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  if (!consentGranted) return;
  activeProvider.identify(userId, traits);
}

export function page(name?: string, properties?: Record<string, unknown>): void {
  if (!consentGranted) return;
  activeProvider.page(name, properties);
}

export function reset(): void {
  activeProvider.reset();
}

export function consentUpdated(consent: AnalyticsConsent): void {
  consentGranted = consent.analytics;
  activeProvider.consentUpdated(consent);
}
