import { loadPrivateEnv } from "@saas/config";
import { logger } from "@saas/observability";

const env = loadPrivateEnv();
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Phase 14 task 9: "a privacy-friendly challenge (for example Cloudflare
 * Turnstile) verified on the server." Verifies a client-submitted Turnstile
 * token against Cloudflare's own siteverify endpoint — never trusts the
 * token's mere presence, since a bot can send an arbitrary string too.
 *
 * Returns `true` when `TURNSTILE_SECRET_KEY` is unset — this is a
 * deliberate, documented "Requires configuration" fallback (see
 * docs/auth/ERRORS.md-style honesty: no secret configured means
 * verification is SKIPPED, not silently treated as having passed a real
 * check that never ran). The honeypot and minimum-fill-time checks in
 * `ContactService` still apply regardless, so this is never the ONLY
 * anti-spam control.
 */
export async function verifyTurnstileToken(token: string | undefined): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) {
    logger.warn(
      { event: "turnstile_not_configured" },
      "TURNSTILE_SECRET_KEY is unset — skipping challenge verification (Requires configuration).",
    );
    return true;
  }
  if (!token) return false;

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
    });
    const body = (await response.json()) as { success?: boolean };
    return body.success === true;
  } catch (err) {
    logger.error({ err }, "Turnstile verification request failed");
    return false;
  }
}
