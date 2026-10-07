-- Reverses 00000000000003_phase9_oauth. Dropping this table loses any
-- in-flight "verify your email to finish linking this provider" attempts
-- (Facebook's missing-email flow) — acceptable, since these are always
-- short-lived, resumable-by-retrying-the-OAuth-flow records, never the
-- user's only record of anything.
DROP TABLE "oauth_pending_identities";
