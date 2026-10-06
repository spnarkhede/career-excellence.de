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

let activeProvider: AnalyticsProvider = new NoopAnalyticsProvider();
let consentGranted = false;

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
