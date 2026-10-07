import type { Request, Response } from "express";
import { loadPrivateEnv } from "@saas/config";
import { cookieName, sessionCookieOptions } from "@saas/security";
import { isSecureCookies } from "../cookie-names.js";

const env = loadPrivateEnv();
const cookieDomain = env.API_COOKIE_DOMAIN || undefined;

const OAUTH_STATE_TTL_SECONDS = 10 * 60;

export interface OAuthStateCookiePayload {
  provider: string;
  state: string;
  codeVerifier: string;
  /** Present only for OIDC providers; absent for pure-OAuth2 ones (GitHub, Facebook). */
  nonce?: string;
  mode: "login" | "link";
  /** Present only when mode === "link" — the already-authenticated user this
   * new provider identity will be linked to once the callback succeeds. */
  linkUserId?: string;
  /** Where to send the browser after a successful login (allowlist-checked
   * again at the point of redirecting — this is just carried through). */
  next?: string;
}

function stateCookieName(sameSite: "lax" | "none"): string {
  // __Host- requires SameSite is irrelevant to the prefix's own rules (Secure
  // + Path=/ + no Domain), but a SameSite=None cookie always requires Secure
  // anyway, so in practice this only ever differs by the literal base name
  // when APP_ENV is local (non-secure, no prefix applies either way).
  return cookieName(`oauth_state_${sameSite}`, { secure: isSecureCookies, domain: cookieDomain });
}

export function setOAuthStateCookie(
  res: Response,
  payload: OAuthStateCookiePayload,
  sameSite: "lax" | "none",
): void {
  res.cookie(stateCookieName(sameSite), JSON.stringify(payload), {
    ...sessionCookieOptions({
      domain: cookieDomain,
      secure: isSecureCookies || sameSite === "none", // SameSite=None requires Secure
      maxAgeSeconds: OAUTH_STATE_TTL_SECONDS,
      sameSite,
    }),
    httpOnly: true,
  });
}

/** Reads AND clears the state cookie in one step — it's single-use by
 * design, same as a one-time token, so a replayed callback (the code already
 * consumed, or an attacker replaying an old callback URL) never finds a
 * matching cookie the second time. Tries both SameSite variants since the
 * caller doesn't know which one was set until it reads whichever is present. */
export function consumeOAuthStateCookie(
  req: Request,
  res: Response,
): OAuthStateCookiePayload | null {
  for (const sameSite of ["lax", "none"] as const) {
    const name = stateCookieName(sameSite);
    const raw = req.cookies?.[name];
    if (raw) {
      res.clearCookie(name, { domain: cookieDomain, path: "/" });
      try {
        return JSON.parse(raw) as OAuthStateCookiePayload;
      } catch {
        return null;
      }
    }
  }
  return null;
}
