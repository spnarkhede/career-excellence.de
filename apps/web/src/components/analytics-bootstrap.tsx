"use client";

import { configureAnalyticsProvider, HttpAnalyticsProvider } from "@saas/analytics";

/** Mounted once, globally, in the root layout. Configuring the provider
 * does NOT itself send anything — `track()`/`identify()`/`page()` in
 * `@saas/analytics` still refuse to call it until `consentUpdated()` has
 * granted consent (set by the cookie banner from stored or fresh choice).
 *
 * BUG (found and fixed this phase): this used to configure the provider
 * inside a `useEffect`. Root layout siblings run their mount effects in JSX
 * order, and a freshly-navigated PAGE's own mount effect (e.g. a page that
 * calls `track(...)` immediately) is declared earlier (`{children}`) than
 * this component — so the page's `track()` call could fire while
 * `activeProvider` was still the module's default `NoopAnalyticsProvider`,
 * silently dropping the event even once consent was already granted. Module
 * scope in a client component evaluates at import time, before any
 * component's effects run, so configuring here removes the race the same
 * way `@saas/analytics`'s own synchronous consent read does. */
configureAnalyticsProvider(new HttpAnalyticsProvider(process.env.NEXT_PUBLIC_API_URL ?? ""));

export function AnalyticsBootstrap() {
  return null;
}
