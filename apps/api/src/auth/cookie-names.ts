import { loadPrivateEnv } from "@saas/config";
import { cookieName } from "@saas/security";

const env = loadPrivateEnv();

// Computed once, here, so every call site that sets, clears, or reads one of
// these cookies (the controller, SessionGuard, CsrfGuard) agrees on the exact
// name — including whether the __Host- prefix applies. Each of these must use
// IDENTICAL secure/domain inputs to sessionCookieOptions() below, or a cookie set
// under one name would never be found when read under another.
export const isSecureCookies = env.APP_ENV !== "local";
const cookieDomain = env.API_COOKIE_DOMAIN || undefined;

export const sessionCookieName = cookieName(env.AUTH_SESSION_COOKIE_NAME, {
  secure: isSecureCookies,
  domain: cookieDomain,
});
export const refreshCookieName = cookieName(env.AUTH_REFRESH_COOKIE_NAME, {
  secure: isSecureCookies,
  domain: cookieDomain,
});
export const csrfCookieName = cookieName(env.AUTH_CSRF_COOKIE_NAME, {
  secure: isSecureCookies,
  domain: cookieDomain,
});
