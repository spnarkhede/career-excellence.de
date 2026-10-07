// AuthService (and anything importing it) calls loadPrivateEnv() at module load time,
// which throws if required vars are missing — before any individual test's own
// DB-reachability skip logic gets a chance to run. CI already sets real values for
// these in .github/workflows/ci.yml's job-level `env:` block, so this only fills gaps
// for a local run with no .env configured; `??=`-style "set only if unset" below means
// a real CI/local value always wins over this placeholder.
const DEFAULTS: Record<string, string> = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/app_dev",
  REDIS_URL: "redis://localhost:6379",
  AUTH_JWT_SECRET: "local-test-only-placeholder-not-a-real-secret-32c", // secret-scan-ignore-line
  ENCRYPTION_KEY: "local-test-only-placeholder-key-32-bytes!!", // secret-scan-ignore-line
};

for (const [key, value] of Object.entries(DEFAULTS)) {
  if (!process.env[key]) process.env[key] = value;
}
