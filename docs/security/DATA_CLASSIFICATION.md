# Data Classification

| Category    | Examples                                          | Storage                                                      | Sensitivity                             |
| ----------- | ------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------- |
| Credentials | Password hashes, refresh token hashes, OTP hashes | `auth_identities`, `sessions`, `verification_tokens`         | Critical — never logged, hashed at rest |
| Identity    | Email, display name, avatar                       | `users`, `profiles`                                          | High — PII                              |
| Behavioral  | Security events, audit logs                       | `security_events`, `audit_logs`                              | Medium — operational, retain per policy |
| Preferences | Cookie/notification preferences, consents         | `cookie_preferences`, `notification_preferences`, `consents` | Low–Medium                              |
| Files       | User-uploaded objects                             | S3-compatible private bucket                                 | Depends on content — default to High    |
| System      | Feature flags, system settings                    | `feature_flags`, `system_settings`                           | Low                                     |

## Handling rules

- Critical and High data must never appear in logs, analytics events, or error reports.
- Access to Critical data in the database requires least-privilege runtime credentials;
  migration credentials are separate from runtime credentials where the hosting platform
  supports it.
- Retention: verification tokens are deleted once expired; revoked sessions are purged
  after 30 days (see the worker's cleanup job). Define explicit retention periods for
  audit logs and security events per your compliance requirements.
