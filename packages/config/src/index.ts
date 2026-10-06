import { z } from "zod";
import { assertNoPublicSecretLeakage } from "./guard";

export { assertNoPublicSecretLeakage } from "./guard";

/**
 * Public variables are safe to expose to browser JavaScript (NEXT_PUBLIC_ prefix).
 * Everything else is private and must only be read on the server.
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_ADMIN_URL: z.string().url().optional(),
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_ANALYTICS_WRITE_KEY: z.string().optional().default(""),
});

export const privateEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "preview", "staging", "production"]).default("local"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  AUTH_PROVIDER: z.string().default("stub"),
  AUTH_JWT_SECRET: z.string().min(32, "AUTH_JWT_SECRET must be at least 32 characters"),
  AUTH_ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  AUTH_REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(2_592_000),
  AUTH_SESSION_COOKIE_NAME: z.string().default("app_session"),
  AUTH_REFRESH_COOKIE_NAME: z.string().default("app_refresh"),

  API_PORT: z.coerce.number().int().positive().default(4000),
  API_COOKIE_DOMAIN: z.string().default("localhost"),
  API_CORS_ALLOWED_ORIGINS: z.string().default(""),

  GOOGLE_OAUTH_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional().default(""),

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
