import type { OAuthProviderAdapter } from "../types.js";
import { createAppleAdapter } from "./apple.js";
import { createFacebookAdapter } from "./facebook.js";
import { createGenericOidcAdapter, discoverOidcConfiguration } from "./generic-oidc.js";
import { createGitHubAdapter } from "./github.js";
import { createGoogleAdapter } from "./google.js";
import { createMicrosoftAdapter } from "./microsoft.js";

export interface OAuthRegistryConfig {
  google?: { clientId: string; clientSecret: string };
  microsoft?: { clientId: string; clientSecret: string; tenant: string };
  github?: { clientId: string; clientSecret: string };
  facebook?: { clientId: string; clientSecret: string };
  apple?: { clientId: string; teamId: string; keyId: string; privateKey: string };
  /** The "any other provider" slot (checklist item 6) — any OIDC-compliant
   * issuer, driven entirely by discovery. */
  generic?: { name: string; issuer: string; clientId: string; clientSecret: string };
}

/** Builds the provider -> adapter map actually available in this
 * environment — a provider whose config is absent/incomplete simply isn't
 * registered (checklist task 9: unconfigured providers are a configuration
 * gap, not a code gap; the `/auth/oauth/:provider/start` route 404s for an
 * unregistered name rather than crashing). Async because the generic OIDC
 * provider needs its discovery document fetched once, up front — not lazily
 * inside a synchronous `buildAuthorizationUrl` call. */
export async function buildOAuthProviderRegistry(
  config: OAuthRegistryConfig,
): Promise<Record<string, OAuthProviderAdapter>> {
  const registry: Record<string, OAuthProviderAdapter> = {};

  if (config.google?.clientId && config.google.clientSecret) {
    registry.google = createGoogleAdapter(config.google);
  }
  if (config.microsoft?.clientId && config.microsoft.clientSecret) {
    registry.microsoft = createMicrosoftAdapter(config.microsoft);
  }
  if (config.github?.clientId && config.github.clientSecret) {
    registry.github = createGitHubAdapter(config.github);
  }
  if (config.facebook?.clientId && config.facebook.clientSecret) {
    registry.facebook = createFacebookAdapter(config.facebook);
  }
  if (
    config.apple?.clientId &&
    config.apple.teamId &&
    config.apple.keyId &&
    config.apple.privateKey
  ) {
    registry.apple = createAppleAdapter(config.apple);
  }
  if (config.generic?.name && config.generic.issuer && config.generic.clientId) {
    const discovery = await discoverOidcConfiguration(config.generic.issuer);
    registry[config.generic.name] = createGenericOidcAdapter({ ...config.generic, discovery });
  }

  return registry;
}

/** Providers whose callback arrives as a cross-site POST (Apple today) need
 * their state cookie set with SameSite=None+Secure — otherwise the browser
 * never sends the cookie back on the provider's cross-site POST, and the
 * callback would always see a missing-state error. Every other provider's
 * GET redirect is same-site-from-a-top-level-navigation's perspective and
 * works fine with the stricter SameSite=Lax. */
export function oauthStateCookieSameSite(adapter: OAuthProviderAdapter): "lax" | "none" {
  return adapter.callbackMethod === "POST" ? "none" : "lax";
}

// Known in-app/embedded-webview User-Agent signatures. Google specifically
// blocks sign-in from these (checklist 4.1: "detect in app browsers and show
// 'Open in your browser'") — the same detection is useful generically for any
// provider that restricts embedded webviews, so it isn't Google-specific here.
const IN_APP_BROWSER_PATTERNS = [
  /FBAN|FBAV/i, // Facebook app
  /Instagram/i,
  /Line\//i,
  /MicroMessenger/i, // WeChat
  /TikTok/i,
  /; wv\)/i, // generic Android WebView marker
  /GSA\//i, // Google Search app's embedded browser
];

export function isInAppBrowser(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return IN_APP_BROWSER_PATTERNS.some((pattern) => pattern.test(userAgent));
}
