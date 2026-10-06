# Environments

| Environment | `APP_ENV`    | Purpose                   | Database             | Notes                                    |
| ----------- | ------------ | ------------------------- | -------------------- | ---------------------------------------- |
| Local       | `local`      | Developer machines        | Docker Postgres      | HTTPS not required                       |
| Preview     | `preview`    | Per-PR deploy previews    | Isolated/ephemeral   | Never points at production data          |
| Staging     | `staging`    | Pre-production validation | Dedicated staging DB | Mirrors production config                |
| Production  | `production` | Live traffic              | Managed Postgres     | HTTPS enforced, strict CSP, real secrets |

## Rules

- Each environment has independent database, Redis, storage, auth provider configuration,
  OAuth callback URLs, analytics write keys, and email provider credentials.
- Preview deployments must never connect to the production (or staging) database.
- `@saas/config` validates `process.env` at startup (`loadPrivateEnv`) and refuses to boot
  if required variables are missing or malformed — this is enforced identically in every
  environment.
- Public (`NEXT_PUBLIC_*`) and private variables are schema-separated
  (`publicEnvSchema` / `privateEnvSchema`) so a private secret can never accidentally be
  exposed with a public prefix.
