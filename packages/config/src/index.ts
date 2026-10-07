import { fileURLToPath } from "node:url";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import { assertNoPublicSecretLeakage } from "./guard.js";

export { assertNoPublicSecretLeakage } from "./guard.js";

// Next.js auto-loads .env files; plain Node entrypoints (apps/api, apps/worker) need this.
const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../../..");
loadDotenv({ path: path.join(repoRoot, ".env") });

/**
 * Public variables are safe to expose to browser JavaScript (NEXT_PUBLIC_ prefix).
 * Everything else is private and must only be read on the server.
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_ADMIN_URL: z.string().url().optional(),
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_ANALYTICS_WRITE_KEY: z.string().optional().default(""),
  // The cookie's NAME is not a secret (its value is, and that's HttpOnly —
  // never readable by this public var or by JS either way); Next.js
  // middleware needs this to check for the session cookie's PRESENCE.
  // Must match AUTH_SESSION_COOKIE_NAME's base name (apps/api/src/auth/
  // cookie-names.ts) — the __Host- prefix, applied whenever the cookie is
  // Secure with no Domain attribute, is checked for separately by whatever
  // reads this, since a public env var can't know the server's runtime
  // secure/domain config.
  NEXT_PUBLIC_SESSION_COOKIE_NAME: z.string().default("app_session"),
});

export const privateEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "preview", "staging", "production"]).default("local"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  AUTH_PROVIDER: z.string().default("stub"),
  // Retained for backward compatibility with existing config/tests; no longer used
  // to sign access tokens (see AUTH_JWT_PRIVATE_KEY/PUBLIC_KEY below — Phase 7
  // switched signing from HS256/this shared secret to asymmetric EdDSA).
  AUTH_JWT_SECRET: z.string().min(32, "AUTH_JWT_SECRET must be at least 32 characters"),
  // Asymmetric (EdDSA/Ed25519) access-token signing keys, PEM-encoded. Optional: if
  // either is unset, AuthService generates an ephemeral Ed25519 keypair once at
  // process startup (same pattern as the dummy-hash timing protection) — fine for
  // local dev/tests, but means every restart invalidates outstanding access tokens
  // (refresh tokens are unaffected, since they're opaque and stored separately).
  // Production should set both so signing survives a restart/redeploy.
  AUTH_JWT_PRIVATE_KEY: z.string().optional().default(""),
  AUTH_JWT_PUBLIC_KEY: z.string().optional().default(""),
  // Key ID carried in the JWT header, letting `verifyAccessToken` pick the right
  // public key — required for key rotation (checklist item 2's "key IDs for
  // rotation"): roll by setting AUTH_JWT_PREVIOUS_* to the outgoing key/kid and
  // AUTH_JWT_PRIVATE_KEY/PUBLIC_KEY/KID to the incoming one; tokens signed under the
  // previous key remain verifiable until they naturally expire.
  AUTH_JWT_KID: z.string().default("default"),
  AUTH_JWT_PREVIOUS_PUBLIC_KEY: z.string().optional().default(""),
  AUTH_JWT_PREVIOUS_KID: z.string().optional().default(""),
  AUTH_JWT_ISSUER: z.string().default("career-excellence-api"),
  AUTH_JWT_AUDIENCE: z.string().default("career-excellence-web"),
  AUTH_ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  AUTH_REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(2_592_000),
  // Verification token lifetime (checklist "Verification expiration... 24 hours
  // (configurable)"); applies to email verification tokens issued in auth.service.ts.
  AUTH_VERIFICATION_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  // Idle timeout (checklist "idle timeout... enforced on the server"): a session
  // not used for this long is treated as expired even though its refresh token
  // hasn't reached its own rolling/absolute expiry.
  AUTH_IDLE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(1800),
  // Grace window after a refresh token is rotated during which presenting the
  // now-superseded token is treated as a benign race (e.g. two tabs refreshing at
  // once) and resolved to the live session, rather than as a stolen-token replay
  // that revokes the whole family.
  AUTH_REFRESH_REUSE_GRACE_MS: z.coerce.number().int().nonnegative().default(10_000),
  AUTH_SESSION_COOKIE_NAME: z.string().default("app_session"),
  AUTH_REFRESH_COOKIE_NAME: z.string().default("app_refresh"),
  AUTH_CSRF_COOKIE_NAME: z.string().default("csrf_token"),
  // Checks new/changed passwords against the HIBP k-anonymity range API (never sends
  // the plaintext password or full hash — see @saas/security/server isPasswordBreached).
  // Off by default: an external dependency on the signup/reset path should be an
  // explicit opt-in, not a surprise outage risk.
  FEATURE_BREACHED_PASSWORD_CHECK: z.coerce.boolean().default(false),

  API_PORT: z.coerce.number().int().positive().default(4000),
  // Empty (the default) means "don't set a Domain attribute at all" — a host-only
  // cookie, which only this exact host ever receives (checklist "Domain unset
  // unless subdomains need it"). Set only when the API and its clients genuinely
  // span subdomains of one parent domain.
  API_COOKIE_DOMAIN: z.string().default(""),
  API_CORS_ALLOWED_ORIGINS: z.string().default(""),
  // Phase 9: apps/api needs the web app's own absolute URL server-side, to
  // build OAuth redirect targets (success/error/pending-email pages all live
  // in apps/web) — NEXT_PUBLIC_APP_URL is client-only and not loaded here.
  WEB_APP_URL: z.string().url().default("http://localhost:3000"),

  // Phase 9: one client-id/secret/redirect-uri triple per provider, all
  // optional (unconfigured = that provider's adapter simply isn't registered
  // — see @saas/auth's buildOAuthProviderRegistry). Redirect URIs are read
  // literally, never pattern-matched/wildcarded (checklist "exact redirect
  // URIs per environment from config, no wildcards").
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional().default(""),

  MICROSOFT_OAUTH_CLIENT_ID: z.string().optional().default(""),
  MICROSOFT_OAUTH_CLIENT_SECRET: z.string().optional().default(""),
  MICROSOFT_OAUTH_REDIRECT_URI: z.string().optional().default(""),
  // "common" (any work/school or personal account), "organizations", or a
  // specific tenant GUID — controls which /{tenant}/v2.0 authorize/token
  // endpoint is used. The ID token's own `tid` claim is validated against
  // the tenant actually returned, never just trusted at face value (checklist
  // "validate the issuer against the tenant ID").
  MICROSOFT_OAUTH_TENANT: z.string().default("common"),

  GITHUB_OAUTH_CLIENT_ID: z.string().optional().default(""),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().optional().default(""),
  GITHUB_OAUTH_REDIRECT_URI: z.string().optional().default(""),

  FACEBOOK_OAUTH_CLIENT_ID: z.string().optional().default(""),
  FACEBOOK_OAUTH_CLIENT_SECRET: z.string().optional().default(""),
  FACEBOOK_OAUTH_REDIRECT_URI: z.string().optional().default(""),

  // Apple's "client secret" is a short-lived JWT this app signs itself with
  // its own private key (ES256), not a static shared secret — see
  // @saas/auth's apple adapter. APPLE_OAUTH_CLIENT_ID is the Services ID
  // (the audience/client_id for web auth), distinct from the app's Bundle ID.
  APPLE_OAUTH_CLIENT_ID: z.string().optional().default(""),
  APPLE_OAUTH_TEAM_ID: z.string().optional().default(""),
  APPLE_OAUTH_KEY_ID: z.string().optional().default(""),
  APPLE_OAUTH_PRIVATE_KEY: z.string().optional().default(""),
  APPLE_OAUTH_REDIRECT_URI: z.string().optional().default(""),

  // "Any other provider" (checklist item 6): a single configurable generic
  // OIDC adapter, proving the shared interface genuinely generalizes beyond
  // the five named providers — driven entirely by OIDC discovery
  // (`${issuer}/.well-known/openid-configuration`), not a provider-specific
  // adapter class.
  OAUTH_GENERIC_PROVIDER_NAME: z.string().optional().default(""),
  OAUTH_GENERIC_ISSUER: z.string().optional().default(""),
  OAUTH_GENERIC_CLIENT_ID: z.string().optional().default(""),
  OAUTH_GENERIC_CLIENT_SECRET: z.string().optional().default(""),
  OAUTH_GENERIC_REDIRECT_URI: z.string().optional().default(""),

  EMAIL_PROVIDER: z.string().default("stub"),
  EMAIL_API_KEY: z.string().optional().default(""),
  EMAIL_FROM_ADDRESS: z.string().email().default("no-reply@example.com"),

  STORAGE_ENDPOINT: z.string().optional().default(""),
  STORAGE_REGION: z.string().default("auto"),
  STORAGE_BUCKET: z.string().default("app-private"),
  STORAGE_ACCESS_KEY_ID: z.string().optional().default(""),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional().default(""),

  SENTRY_DSN: z.string().optional().default(""),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional().default(""),

  ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY must be at least 32 characters"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type PrivateEnv = z.infer<typeof privateEnvSchema>;

/**
 * Validates process.env against the private schema. Throws and prevents startup
 * when required secrets or configuration are missing or malformed.
 */
export function loadPrivateEnv(source: NodeJS.ProcessEnv = process.env): PrivateEnv {
  const result = privateEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

export function loadPublicEnv(source: NodeJS.ProcessEnv = process.env): PublicEnv {
  assertNoPublicSecretLeakage(
    Object.keys(publicEnvSchema.shape),
    Object.keys(privateEnvSchema.shape),
  );

  const result = publicEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid public environment configuration:\n${issues}`);
  }
  return result.data;
}
