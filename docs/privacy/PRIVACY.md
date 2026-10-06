# Privacy

## Documents (placeholders — have counsel review before production)

- `docs/privacy/PRIVACY.md` — privacy policy content lives in the web app's `/privacy` page.
- Cookie policy, terms, and subprocessor list should be added alongside this file with
  real legal-entity details before launch. Do not fabricate company information.

## Data subject rights

- **Export**: `data_export_requests` table + `POST` endpoint (implement in a product
  module) creates a request; the worker processes it asynchronously and writes a
  `downloadUrl` via `@saas/storage` signed URLs.
- **Deletion**: `account_deletion_requests` table records the request; processing should
  anonymize or delete personal data per your retention policy and mark `processedAt`.

## Consent

- `consents` table stores accepted policy versions per user (terms, privacy).
- `cookie_preferences` stores analytics/marketing consent + `consentVersion`.
- The web app's cookie banner (`CookieConsentBanner`) gates `@saas/analytics` — no
  analytics events fire until `consentUpdated({ analytics: true, ... })` is called.
- Bump `CONSENT_VERSION` in the banner whenever cookie purposes materially change to
  re-prompt users.

## Retention

Define retention periods per data category in `DATA_CLASSIFICATION.md` and enforce them
via the worker's cleanup job (`apps/worker/src/processors/cleanup.processor.ts`), which
already removes expired verification tokens and long-revoked sessions.
