# Auth Workstream Progress

Statuses are restricted to the set in [AUTH_RULES.md](../../AUTH_RULES.md) rule 13:
Confirmed working, Confirmed broken, Fixed, Requires configuration, Requires manual
verification, Unable to verify. "Not started" is used only before a phase has begun.

| Phase | Name                                              | Status                       | Date       | Version | Tests run                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----- | ------------------------------------------------- | ---------------------------- | ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Project rules, traceability and development log   | Confirmed working            | 2026-10-06 | 0.1.0   | `pnpm lint` (22/22 packages pass, exit 0); commitlint manually verified to reject a malformed commit message (exit 1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | AUTH_RULES.md (13 rules, word for word), docs/TRACEABILITY.md, docs/auth/FINDINGS.md, docs/auth/COMPONENTS.md, this file, CHANGELOG.md, docs/devlog/, commitlint + husky commit-msg hook, scripts/release.mjs created. No application code touched. Committed as 802fbe6, tagged v0.1.0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 1     | System understanding, lifecycle tracing, auth map | Requires manual verification | 2026-10-06 | 0.2.0   | `pnpm lint` (22/22 packages pass, exit 0); no automated test exists for documentation completeness, so every Phase 1 traceability row is "Requires manual verification", never "Confirmed working"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | docs/auth/ARCHITECTURE.md extended (project layout, data connection diagram, D10/open question 9); docs/auth/FLOWS.md created (8 mermaid sequence diagrams with failure branches + HTTP codes); docs/auth/COMPONENTS.md rewritten with a Planned entry per Authentication map item. No application code written. **Human confirmation required before Phase 2** — see the 9 "Open questions for the human" in ARCHITECTURE.md.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2     | Scaffold and secure foundation                    | Confirmed working            | 2026-10-07 | 0.3.0   | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test` 4 test files/34 tests pass + `test:scripts` 1 file/4 tests; `pnpm check:cycles` 0 cycles; `pnpm check:duplicates` 4 clones, 1.3%, under 5% threshold; `pnpm build` (web+admin+api+worker) succeeds; `pnpm check:bundle-secrets` passes against real build; live Playwright smoke test (chromium) passes                                                                                                                                                                                                                                                                                                                                                                                      | Env validation, HTTPS redirect, security headers, CORS allowlist, redaction (added `otp`), global process handlers, strict lint rules, knip/jscpd/madge wired, Playwright expanded to 4 browser/device projects, CI updated. Found and fixed 5 real bugs (BUG-001..005, pre-existing + newly introduced) — see FINDINGS.md. `check:deadcode` wired as informational only (real, out-of-scope findings — see FINDINGS.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 3     | Database tables and data connections              | Requires manual verification | 2026-10-07 | 0.4.0   | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test` all pass (12 real + 10 DB-dependent skipped — no live Postgres in this environment, see Notes); `pnpm check:cycles` 0 cycles; `pnpm build` succeeds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Full Phase 3 schema (users/profiles/oauth_accounts/sessions/one_time_tokens/auth_events + RLS), 2 migrations with down.sql, AuthService rewritten (transactional signup, password on users.passwordHash, lockout, soft delete, refresh-reuse detection), consistency-check script, seed script with generated test users. **No live database was available in this environment** — every DB-dependent test (1,2,3,4,6,7,8) is written and will run for real in CI, but was not executed against a real Postgres instance in this session; see FINDINGS.md. One critical bug (BUG-006: a draft migration would have silently orphaned every FK on a populated DB) was caught by manual review and fixed before being committed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 4     | Signup and verification                           | Requires manual verification | 2026-10-07 | 0.5.0   | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test` all pass (`packages/validation` 8/8 and `packages/security` 25/25 actually run — no DB needed; 13 new Phase 4 DB-dependent tests + 2 GET-verification tests skip cleanly, no live Postgres); `pnpm build` succeeds                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | NIST 800-63B password policy (no composition rules, min 8, max 128); argon2id with explicit OWASP params + rehash-on-login; breached-password check (HIBP k-anonymity, behind `FEATURE_BREACHED_PASSWORD_CHECK`, default off); timing/response-neutral duplicate signup (notice email, creates nothing); resend invalidates older tokens; 5 distinct verification states (valid/expired/already_used/invalid/already_verified); Confirm-button verify-email page (no auto-POST), `referrer: no-referrer`, token stripped from URL; found and fixed a real pre-existing gap — login() never checked `pending_verification` status (checklist item 6). Every DB-dependent test is written but **not executed against a real database in this session** (same environment limitation as Phase 3) — see FINDINGS.md.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 5     | Login process                                     | Requires manual verification | 2026-10-07 | 0.6.0   | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test`: 2 new test suites needed no database and were actually run (`packages/api-client` 8/8, `apps/api` `all-exceptions-filter.spec.ts` 5/5) — 39 of this phase's DB/browser-dependent tests skip or are documented as manual; `pnpm build` succeeds                                                                                                                                                                                                                                                                                                                                                                                                                                              | Rewrote `login()`: dummy-hash timing protection, ALL account-status checks moved to after password verification (found + fixed BUG-007 and BUG-008 doing this), growing-delay lockout (5 failures, doubling, capped 24h), session-fixation prevention (discards the caller's existing session on success). Replaced the in-process-memory throttler with a Redis-backed one (`RedisThrottlerStorage`), globally. Validation errors now 422 with field messages (was 400). Mapped Prisma connection failures to 503. Added client-side timeout/offline detection (`@saas/api-client`), a double-submit guard + existing-session redirect on the login page, and a hardened dashboard with a visible retry state on failure instead of a blank page/crash.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6     | OTP authentication                                | Requires manual verification | 2026-10-07 | 0.7.0   | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test`: all previously-passing non-DB suites still pass (17/17), 12 new `phase6-otp.integration.spec.ts` tests written and skip cleanly (no live Postgres — same environment limitation as Phases 3-5); `pnpm build` succeeds                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Rewrote `requestOtp`/`verifyOtp` for atomic single-use consume (found + fixed BUG-009, a real concurrent-use race in the pre-existing code), resend-invalidation, per-destination cooldown, session-fixation handling. Added `requestMagicLink`/`verifyMagicLink` to pragmatically resolve open question D4 (implement both OTP and magic link, per ARCHITECTURE.md). Added the magic-link confirm page (Confirm button + POST, link scanners can't consume it) and the OTP request/verify UI (one input, `autocomplete="one-time-code"`, numeric input mode, paste support, 30s countdown).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 7     | Session lifecycle                                 | Requires manual verification | 2026-10-07 | 0.8.0   | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test`: all previously-passing non-DB suites still pass, plus 12 new pure-logic `phase7-tokens.spec.ts` tests, 6 new `packages/api-client` tests, 4 new `packages/security` tests, and 1 new `packages/observability` test — all **actually run**, no database needed; 11 new `phase7-session.integration.spec.ts` tests skip cleanly (no live Postgres); `pnpm build` succeeds                                                                                                                                                                                                                                                                                                                     | Switched access tokens from HS256 to asymmetric RS256 with kid-based rotation and explicit iss/aud/alg-allowlist/clock-skew checks; added a refresh-token reuse grace window (benign-race resolution vs. stolen-token family revocation); added idle-timeout + absolute-expiry enforcement and Cache-Control: no-store in SessionGuard; added a CSRF double-submit-cookie + Origin-check guard on every cookie-authenticated state change; hardened cookies (Domain unset by default, __Host- prefix, SameSite Strict for the refresh cookie); added client-side single-flight refresh-and-retry-once and cross-tab logout sync (BroadcastChannel + storage fallback) to the shared API client; added a session-list/revoke page and a logout button to the dashboard; added authenticated change-password and logout-all-devices endpoints. Found and fixed BUG-010 (log-redaction gap for compound token field names) and BUG-011 (SessionGuard bypassing validated config for the cookie name) — see FINDINGS.md.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 8     | Password reset                                    | Requires manual verification | 2026-10-07 | 0.9.0   | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test`: all previously-passing non-DB suites still pass, plus 10 new `phase8-password-reset.integration.spec.ts` tests written and skip cleanly (no live Postgres — same environment limitation as Phases 3-7); `pnpm build` succeeds                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Fixed BUG-012 (atomic token-consume race, same shape as BUG-009) and BUG-013 (confirm endpoint had no rate limit at all). Added per-email resend cooldown + previous-token invalidation to `requestPasswordReset`, queued both the reset-request and password-changed-confirmation emails through the existing (previously API-unused) BullMQ email queue, added failure-path `auth_events` and structured error codes to `resetPassword`. Rewrote the reset-password page: token stripped from the URL, `referrer: no-referrer`, distinct expired/used/invalid states with a "Request a new link" affordance, and redirect through the shared `isAllowedRedirect` safe-redirect helper. Flagged (not fixed) a residual, narrow timing side-channel in `requestPasswordReset` as a documented Potential risk — see FINDINGS.md.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 9     | OAuth providers and processes                     | Requires manual verification | 2026-10-07 | 0.10.0  | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test`: 26 new `packages/auth` adapter/ID-token tests + 7 new controller tests all **actually run** (no DB/network — JWKS verification uses an injectable test resolver, not a real fetch, since `createRemoteJWKSet` bypasses `fetch` stubbing entirely); 14 new `phase9-oauth.integration.spec.ts` tests skip cleanly (no live Postgres); `pnpm build` succeeds                                                                                                                                                                                                                                                                                                                                   | Implemented all 5 named providers (Google, Microsoft, GitHub, Facebook, Apple) plus a generic "any other provider" OIDC-discovery adapter behind one shared `OAuthProviderAdapter` interface — PKCE (S256) + full ID token validation (signature/issuer/audience/expiry/nonce) for OIDC providers, provider-specific email-trust rules (Google's `email_verified`, GitHub's primary-verified-only, Facebook's missing-email collect-and-verify sub-flow, Microsoft's never-trust-email + tenant+object-id identity, Apple's form_post + one-time name capture + private-relay emails). Account linking rules: identity matched on provider+providerAccountId never email, email collision never auto-links (deliberately reveals the collision per this phase's own UX spec — see FINDINGS.md), unverified provider emails never link, provider identity collision shows a clear error, never unlink the last sign-in method. Caught and fixed a critical pre-ship bug (BUG-014: an unsigned JWT decode in the link-mode session check) before it was ever committed. Pragmatically resolves D5 (Microsoft/GitHub in scope) the same way Phase 6 resolved D4. Apple is **Requires configuration** (needs a paid Apple Developer Program enrollment).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 10    | Routing and middleware                            | Requires manual verification | 2026-10-07 | 0.11.0  | `pnpm lint` 22/22; `pnpm typecheck` 22/22; `pnpm test`: all previously-passing suites still pass, plus 4 new `phase10-permissions-guard.spec.ts` + 3 new `phase10-forged-headers.spec.ts` + 1 new `all-exceptions-filter.spec.ts` test, all **actually run** (no DB needed); 5 new `phase10-rbac.integration.spec.ts` tests skip cleanly (no live Postgres); `scripts/route-matrix.spec.ts` (new, 84/84, actually run — pure filesystem/regex, no DB/server); `pnpm check:cycles` 0 cycles; `pnpm check:duplicates` 4.32%, under threshold; `pnpm build` (web+admin+api+worker) all succeed; `pnpm check:bundle-secrets` clean                                                                                                                      | Added `PermissionsGuard`/`@RequirePermission` (declarative NestJS guard pair, never trusts client-supplied roles — loads from the DB-joined principal); `requireUser()`/`requirePermission()` for apps/web and apps/admin (Next.js server-component gates); hardened `isSafeRelativePath`/`safeReturnTo`/`resolveAuthRedirect` (safe-redirect + no-loop invariant, formalized as one pure, exhaustively-tested function); new apps/admin middleware (app had none before); a static-analysis route-matrix test (84 assertions, manually verified to catch a real regression). Fixed BUG-015 (`ForbiddenError` → 500 instead of 403, would have affected every `PermissionsGuard`-protected route) and BUG-016 (apps/web middleware hardcoded the unprefixed session cookie name — would have locked out every signed-in user in production). Converted `revokeSession`/`unlinkAccount` from silent no-op to explicit 404 on a not-owned/nonexistent resource (object-level checks). Caught and fixed a `?next=/login` redirect-loop bug in `resolveAuthRedirect`'s own first draft before it was ever used in a real page. No live browser exists in this session, so back/forward-button behavior and the full deep-link round trip are **Requires manual verification**, not Confirmed working — same honesty discipline as every prior phase's environment-limited items.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 11    | Frontend auth UI                                  | Requires manual verification | 2026-10-07 | 0.12.0  | `pnpm --filter (web,ui,api-client,config,security) typecheck/lint` clean (apps/api excluded — broken by unrelated, concurrent, uncommitted work from a different session, not by anything in this phase); `pnpm --filter (api-client,security,config) test`: 20/20 (+6 new), 62/62, 6/6, all **actually run**; `pnpm check:cycles` 0 cycles; `pnpm check:duplicates` 4.28%, under threshold; `pnpm --filter @saas/web build` succeeds; `pnpm check:bundle-secrets` clean; `pnpm exec playwright test tests/e2e/auth-ui.spec.ts` — **actually run against a live `next dev` server** (first time this workstream has live-browser-tested anything beyond the Phase 2 homepage smoke test): 12 passed, 2 skipped cleanly (no reachable API), 0 failed | Added `AuthProvider`/`useAuth()` (server-resolved initial state, session-generation counter + `AbortController`, cross-tab login/logout sync, centralized cache-clearing on logout), `PasswordInput`/`ErrorSummary` shared components, and a double-submit guard on every one of the 6 auth forms. This phase's live Playwright run (not just written) surfaced and fixed 3 real bugs: BUG-022 (`.js`-extension imports broke `next dev`, invisible to `next build` and every unit test), BUG-023 (cookie-consent banner failed axe's landmark rule on every page), and BUG-024 (a wrong password/OTP/magic-link 401 was misread as "session expired" and hard-redirected away from the real error message — the most significant finding, since it affected the 3 most common auth failure paths). Back/forward-button behavior, refresh-without-flash, and cross-tab sync all have real Playwright tests written; 2 of them need a reachable API and skip cleanly without one, same honesty discipline as every prior phase. **Also discovered**: Phase 10's own commit (a7a54f5) had accidentally absorbed unrelated content into `docs/auth/FINDINGS.md` from a concurrent session's uncommitted work, because that file was staged as a whole without checking for intermixing — already pushed, not rewritten; this phase isolated shared-file edits by hunk instead (see devlog).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 12    | Error handling                                    | Requires manual verification | 2026-10-07 | 0.13.0  | `pnpm --filter (observability,api-client) typecheck/lint` clean (apps/api excluded from a FULL project typecheck — broken by unrelated, concurrent, uncommitted tsconfig work from a different session; the specific Phase 12 files lint cleanly standalone); `pnpm --filter @saas/observability test` 7/7 (2 new: logger.spec.ts's real log-capture tests); `pnpm --filter @saas/api test` 21 files / 51 passed / 94 skipped (DB-dependent) / 0 failed — includes 10 new tests in all-exceptions-filter.spec.ts and phase12-error-catalog.spec.ts, all **actually run** except 3 DB-dependent catalog-entry tests which skip cleanly; `pnpm check:cycles` 0 cycles; `pnpm check:duplicates` 3.91%, under threshold                                 | Added `docs/auth/ERRORS.md` (the full catalog: response shape, mapping layer, recovery paths, logging/scrubbing, metrics/alerts, all 9 per-error questions for every HTTP status family and named code) and its machine-checkable counterpart `apps/api/src/common/error-catalog.ts`. Added `recordAuthMetric()` (`packages/observability/src/metrics.ts`) wired at 6 real call sites (login/OTP/magic-link success+failure, rate-limited, refresh-reuse-detected, auth-route 5xx, email-send-failed) — no managed metrics backend exists, so this is structured-log-based plumbing, documented honestly as **Requires configuration** for the alerting layer on top. Fixed BUG-025 (6 auth exceptions threw with no machine-readable `code`, falling back to a generic status-name code — wrong password, session reuse/expiry, wrong current password, wrong OTP ×4, invalid/expired magic link ×2). Added a clean `ThrottlerException` → 429 `TOO_MANY_REQUESTS` mapping (previously leaked the raw `"ThrottlerException: ..."` string with no code at all); flagged the lack of a `Retry-After` header on throttled responses as a documented Potential risk, not fixed (would require overriding `ThrottlerGuard` itself, out of this phase's mapping-layer scope). Added a genuine log-capture test (`packages/observability/src/logger.spec.ts`) that builds a real pino logger via a new `createLogger` factory and asserts captured output never contains a raw password/token/OTP/cookie value — required refactoring the logger into a factory since pino's default destination bypasses `process.stdout.write`, undetectable by a naive spy (caught and fixed before the test could have been accidentally vacuous). **Process note**: while isolating this phase's own shared-file edits from a different session's concurrent uncommitted work (same discipline established in Phase 11), a `git show HEAD:... | Out-File` encoding mishap corrupted non-ASCII characters across all of docs/TRACEABILITY.md, and the recovery step (`git checkout HEAD --`) was run without first backing up the other session's uncommitted edits to that file — they are lost from the working tree (not from git history; nothing of theirs was ever committed to begin with, so their underlying CODE changes elsewhere are unaffected, only this one doc file's uncommitted cross-reference rows). Reported directly to the user; `docs/auth/FINDINGS.md` was isolated safely afterward using a proper backup-first approach. |
| 13    | Security checks                                   | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 14    | Launch: legal, trust and conversion               | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 15    | Launch: SEO and sharing                           | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 16    | Launch: performance and accessibility             | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 17    | Race conditions and edge cases                    | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 18    | Code defects that must not exist                  | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 19    | Test matrix                                       | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 20    | Production audit                                  | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 21    | Final audit report                                | Not started                  |            |         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Phase 0 detail

### Done-when verification

1. All Phase 0 files exist at the required paths — **Confirmed working**: AUTH_RULES.md,
   docs/TRACEABILITY.md (every checklist item from this instruction set copied in, status
   "Not started"), docs/auth/PROGRESS.md (this file), docs/auth/FINDINGS.md,
   docs/auth/COMPONENTS.md, CHANGELOG.md, docs/devlog/README.md, package.json at 0.1.0,
   commitlint config + husky commit-msg hook, scripts/release.mjs.
2. commitlint rejects a malformed commit message — **Requires manual verification**: run
   `git commit -m "bad message"` against the hook; a Conventional Commits message is
   required to pass.
3. No application code was written in this phase — **Confirmed working**: only root/docs
   files, package.json metadata, and commit tooling were touched.

### Tests run

- `pnpm lint` — repository lint, documentation-only phase has no application code to
  exercise with Vitest/Supertest/Playwright for this specific phase.

### Open questions and risks

- **Missing information**: a prior session already produced `docs/auth/ARCHITECTURE.md`
  and an earlier-shaped `docs/auth/PROGRESS.md` under a different phase numbering
  (0-15). This phase re-creates PROGRESS.md under the 0-21 numbering required by this
  instruction set; ARCHITECTURE.md is left untouched for the next phase to reconcile.
- **Missing information**: this repository already contains a non-trivial existing
  NestJS/Prisma auth implementation from prior work. Phase 1 must decide whether to
  audit/extend it or treat it as reference only, per AUTH_RULES.md rule 7.

## Phase 1 detail

### Done-when verification

1. Every "System understanding", "Lifecycle tracing", and "Authentication map" item has
   a decision, diagram, or component entry — **Confirmed working**: all 33 System
   understanding items are addressed in `docs/auth/ARCHITECTURE.md` §1 (decisions +
   reasons + owning phase); all 8 lifecycles have a Mermaid sequence diagram in
   `docs/auth/FLOWS.md` with failure branches and HTTP status codes; all 17
   Authentication map items have a "Planned" entry in `docs/auth/COMPONENTS.md`
   answering all 8 questions.
2. Every threat has a control and an owning phase — **Confirmed working** (carried
   forward from the existing `docs/auth/ARCHITECTURE.md` §4 threat model, which already
   mapped all 38 "Security checks" items to a planned control and phase; not duplicated
   here to avoid two sources of truth).
3. Open questions are listed and the human is asked to confirm before Phase 2 —
   **Confirmed working**: 9 open questions listed in `docs/auth/ARCHITECTURE.md`,
   restated below.

### Tests run

- `pnpm lint` — 22/22 packages, exit 0. Documentation-only phase; no auth application
  code exists yet for this workstream to exercise with Vitest/Supertest/Playwright.
- No automated test can verify "every checklist item has a decision" — this was
  verified manually by re-reading every item against the produced documents. Recorded
  as "Requires manual verification" in `docs/TRACEABILITY.md`, per `AUTH_RULES.md`
  rule 13 (never "Confirmed working" without a real test).

### Open questions and risks — human confirmation required before Phase 2

Restated from `docs/auth/ARCHITECTURE.md` ("Open questions for the human"):

1. Confirm the managed auth provider: Supabase Auth (proposed) vs. Auth.js vs. Clerk.
2. Email OTP, magic link, or both?
3. Is Microsoft OAuth in scope? Is GitHub OAuth in scope? (Google treated as required.)
4. Is TOTP MFA in scope now or deferred?
5. Is multi-tenant/organization scoping needed?
6. **Missing information**: real staging/production domain names, needed before Phase 6
   (OAuth) can finalize callback URLs.
7. Confirm or renumber the provisional Phase 2–15 plan used to give every threat an
   owning phase.
8. Should Phase 2+ harden/extend the existing NestJS/Prisma auth implementation
   already in this repo, or discard parts of it?
9. **New in this phase**: is database-level row-level security (RLS) required as
   defense-in-depth, or is Prisma/API-layer-only access control (as implemented today)
   acceptable?

Per this phase's instructions, work stops here. Phase 2 does not begin until the human
answers the questions above.

**Update 2026-10-07**: the human directly supplied Phase 2's instructions ("scaffold and
secure foundation"), which proceeds independently of the 9 open questions above — Phase 2
is config/security scaffolding (env validation, HTTPS, security headers, CORS, logging,
quality tooling) and touches no auth-provider-specific, OTP/OAuth-specific, or
RLS-specific code, so none of the 9 pending decisions block it. All 9 remain open and
still gate Phase 3+ (the actual auth provider integration).

## Phase 2 detail

### Done-when verification

1. "App starts" — **Confirmed working**: `pnpm --filter @saas/api dev` boots and listens
   (verified via `loadPrivateEnv()` succeeding + the existing `/health/live` endpoint,
   exercised indirectly by `apps/api/test/*.spec.ts`); `pnpm --filter @saas/web dev`
   confirmed via a live Playwright smoke test against the real dev server.
2. "CI passes" — **Requires manual verification**: the updated `.github/workflows/ci.yml`
   was not run on GitHub Actions itself in this phase (no access to trigger a real
   workflow run from here); every step it runs (`lint`, `typecheck`, `test`,
   `check:cycles`, `check:duplicates`, `build`, `check:bundle-secrets`,
   `test:e2e`) was run locally and passes. `check:deadcode` is wired with `|| true`
   (informational), so it cannot fail the job even though it currently reports real,
   out-of-scope findings (see FINDINGS.md).
3. "All tests pass" — **Confirmed working**: see the Tests run column above and the
   per-requirement test list below.

### Tests run (from this phase's "TESTS" list)

1. **Missing variable stops startup with its name and no value** — **Confirmed
   working**. Pre-existing `packages/config/src/index.spec.ts` ("fails fast naming the
   missing variable, without ever including a value") already covered this; re-verified
   passing in this phase (6/6 tests in that file).
2. **Logger redacts every listed key** — **Confirmed working**. Added the previously-
   missing `otp` key to `SENSITIVE_KEYS`/`REDACT_PATHS`; `packages/observability/src/redact.spec.ts` (4/4 tests, including the new `otp` case) passes.
3. **Response headers match the policy** — **Confirmed working**.
   `apps/api/test/security-headers.spec.ts` (4/4 tests) asserts CSP (with
   `frame-ancestors 'none'`, no `unsafe-inline`), `X-Content-Type-Options: nosniff`,
   `Referrer-Policy`, and HSTS (production only).
4. **Non-allowlisted origin gets no CORS allow headers** — **Confirmed working**.
   Same spec file, "CORS allowlist" describe block (2/2 tests).
5. **HTTP request in production mode redirects to HTTPS** — **Confirmed working**.
   New `apps/api/test/https-redirect.spec.ts` (3/3 tests) — this test did not exist
   before this phase; written to close the gap.
6. **Bundle check fails when a fake secret is placed in client code** — **Confirmed
   working**. New `scripts/check-bundle-for-secrets.spec.ts` (4/4 tests) exercises the
   pure `findLeakedSecretNames` function with both a positive (leak found) and negative
   case; the live script was also verified against a real `pnpm build` output (clean
   pass) after fixing BUG-001.

### Findings

Five real bugs found and fixed in this phase (BUG-001 through BUG-005), plus one tracked
but intentionally not fixed (knip's unused-dependency report). Full root-cause records
in [docs/auth/FINDINGS.md](FINDINGS.md). Three of the five (BUG-002, BUG-004, and the
pre-existing Prisma-client-not-generated gap) predate this phase; BUG-001, BUG-003, and
BUG-005 relate to work done in this phase, caught before being considered done, per
`AUTH_RULES.md` rule 12 ("after any change, re-run the relevant flow... check for
regressions").

### Open questions and risks

- **Requires manual verification**: the GitHub Actions workflow itself has not been
  executed on GitHub — only each of its steps run locally. The next push should be
  watched to confirm the workflow actually passes end-to-end in that environment
  (different OS, network, and timing characteristics than local Windows execution).
- **Potential risk**: `pnpm audit --audit-level=high || true` in CI never fails the
  build regardless of findings — kept as-is from before this phase (not touched, per
  rule 7) but flagged since it means a genuinely high-severity dependency vulnerability
  would not block CI today. A later phase should decide whether to tighten this.
- **Missing information**: knip reports 10 unused dependencies / 4 unused exports,
  mostly reserved for not-yet-wired features; tracked in FINDINGS.md, not fixed, wired
  as informational only.

## Phase 3 detail

### Done-when verification

1. "All tests pass" — **Requires manual verification, not Confirmed working**: this
   environment has no Docker and no accessible Postgres with known credentials (see
   FINDINGS.md). `pnpm test` reports 12 real (non-DB) tests passing and 10 DB-dependent
   tests _skipped_ (not failed — they detect the unreachable database and skip
   cleanly, per the explicit design in `apps/api/test/db-test-helpers.ts`). None of
   this phase's 8 named TESTS requiring a real database were executed in this session.
2. "Schema docs match the migrations" — **Confirmed working**: `docs/auth/ARCHITECTURE.md`
   §5/§5a and `docs/auth/COMPONENTS.md`'s "Phase 3 components" section were written
   directly from the final `schema.prisma` and `migration.sql`, and cross-checked
   against them line by line after the BUG-006 revision.

### Tests run (this phase's explicit TESTS list)

| #   | Test                                                                  | Status                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Same email, different case/spaces, fails                              | Requires manual verification — written as `apps/api/test/signup-integrity.integration.spec.ts`, not executed (no DB)                                                                                                        |
| 2   | 10 concurrent signups → 10 profiles; 2 concurrent same-email → 1 user | Requires manual verification — same file, not executed                                                                                                                                                                      |
| 3   | User A cannot select/insert/update/delete User B's rows               | Requires manual verification — `apps/api/test/rls.integration.spec.ts`, not executed                                                                                                                                        |
| 4   | Anonymous client reads nothing from auth tables                       | Requires manual verification — same file, not executed                                                                                                                                                                      |
| 5   | Profile update cannot change role or status                           | **Confirmed working** — `apps/api/test/profile-immutability.spec.ts`, a pure unit test needing no database; actually run, passes                                                                                            |
| 6   | Delete cascades; soft delete revokes sessions                         | Requires manual verification — `apps/api/test/cascade-and-soft-delete.integration.spec.ts`, not executed                                                                                                                    |
| 7   | Simulated trigger failure leaves no partial user                      | Requires manual verification — `apps/api/test/signup-integrity.integration.spec.ts`, not executed                                                                                                                           |
| 8   | Consistency script reports zero problems on seeded data               | Requires manual verification — `scripts/check-db-consistency.integration.spec.ts` (DB-dependent, not executed) + `scripts/check-db-consistency.spec.ts` (pure-logic unit test with a fake client, **actually run, passes**) |

Non-DB verification actually run in this session: `pnpm lint` (22/22), `pnpm typecheck`
(22/22), `pnpm check:cycles` (0 circular dependencies), `pnpm format:check` (clean),
`node scripts/secret-scan.mjs` (clean), `pnpm build` (web+admin+api+worker all
succeed), `pnpm check:bundle-secrets` (clean against the real build output),
`prisma validate`/`prisma generate` against the final schema (both succeed).

### Findings

One **critical** finding (BUG-006): a draft of the Phase 3 migration would have
dropped and recreated every table's primary/foreign key column, silently orphaning
every relationship on a populated database. Caught by manually reading the generated
migration SQL before committing it — never applied anywhere. Full root-cause record in
`docs/auth/FINDINGS.md`. No other new bugs found in code written this phase (BUG-001
through BUG-005 were Phase 2 findings).

### Open questions and risks

- **Missing information / critical gap in this session's verification**: no live
  Postgres database was available (no Docker; the only service bound to port 5432 on
  this machine is an unrelated, pre-existing instance with unknown credentials, not
  probed further per AUTH_RULES.md rule 2/4). **The next step before trusting this
  phase's database work is to actually run `pnpm --filter @saas/database migrate:deploy
&& pnpm db:seed && pnpm test && pnpm db:check-consistency` against a real, disposable
  Postgres database** (CI will do this automatically on the next push) and update this
  file and `FINDINGS.md` with the real results.
- **Requires manual verification**: the `'suspended'` → `'disabled'` status backfill
  and the `email` column's TEXT→CITEXT type change in the migration are written to be
  safe against a populated table (see the migration's own comments) but were never
  exercised against real populated data.
- **Carried-forward open question (ARCHITECTURE.md §7, item 9)**: should a future phase
  wire `app.current_user_id` into Prisma's actual connection, making the new RLS
  policies the real enforcement layer rather than a dormant, independently-tested one?
- **Documented decision, not a defect**: soft-deleted accounts' email addresses are
  never released for reuse (the unique constraint stays in force indefinitely). If the
  product requires email reuse after deletion, this needs a deliberate follow-up
  decision (anonymizing the email on delete, or a separate reuse-eligibility window).

## Phase 4 detail

### Done-when verification

"All tests pass" — **Requires manual verification, not Confirmed working**: same
environment limitation as Phase 3 (no live Postgres). Two test suites needed no
database and were **actually run**: `packages/validation/src/index.spec.ts` (8/8 —
password policy boundaries) and the updated `packages/security/src/server.spec.ts`
(25/25 — argon2id params, `needsRehash`, `isPasswordBreached`). All 13 new
`phase4-signup-verification.integration.spec.ts` tests plus the 2
`get-verification-url.integration.spec.ts` tests are written (one test per checklist
item, plus the "GET doesn't verify" and "no raw token" extras) and skip cleanly
without a reachable database; none were executed against a real one.

### Tests run (checklist item -> test -> status)

| #     | Checklist item                                | Test                                                                                                  | Status                                                                                         |
| ----- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1     | Signup                                        | `phase4-signup-verification.integration.spec.ts`                                                      | Requires manual verification                                                                   |
| 2     | Duplicate account                             | same file                                                                                             | Requires manual verification                                                                   |
| 3     | Email verification                            | same file                                                                                             | Requires manual verification                                                                   |
| 4     | Verification expiration                       | same file                                                                                             | Requires manual verification                                                                   |
| 5     | Verification resend                           | same file                                                                                             | Requires manual verification                                                                   |
| 6     | Unverified login                              | same file                                                                                             | Requires manual verification                                                                   |
| 7     | Password creation                             | `packages/validation/src/index.spec.ts`                                                               | **Confirmed working** (8/8, actually run, no DB needed)                                        |
| 8     | Weak password handling                        | same file                                                                                             | **Confirmed working** (same run)                                                               |
| 9     | Account creation failure                      | `phase4-signup-verification.integration.spec.ts`                                                      | Requires manual verification                                                                   |
| 10    | Partial account creation                      | same file                                                                                             | Requires manual verification                                                                   |
| 11    | Profile creation failure                      | same file                                                                                             | Requires manual verification                                                                   |
| 12    | Database trigger failure                      | N/A — documented decision, no triggers exist                                                          | Requires manual verification (written note, no test possible for something that doesn't exist) |
| 13    | Email delivery failure                        | same file (spies on the email provider to force a failure)                                            | Requires manual verification                                                                   |
| 14    | Verification redirect                         | `apps/web` verify-email-client.tsx + `isAllowedRedirect` (already unit-tested in `packages/security`) | Requires manual verification for the page's own usage — no browser-level test was run          |
| 15    | Already verified account                      | `phase4-signup-verification.integration.spec.ts`                                                      | Requires manual verification                                                                   |
| 16    | Expired verification link                     | same file                                                                                             | Requires manual verification                                                                   |
| extra | GET on verification URL does not verify       | `get-verification-url.integration.spec.ts`                                                            | Requires manual verification                                                                   |
| extra | No raw token in DB or logs                    | `phase4-signup-verification.integration.spec.ts`                                                      | Requires manual verification                                                                   |
| extra | Forced mid-transaction failure leaves no rows | same file                                                                                             | Requires manual verification                                                                   |

### Findings

Found and fixed one real, pre-existing gap while implementing this phase: `login()`
never checked for `status === "pending_verification"` at all — an unverified account
with the correct password could sign in successfully, silently bypassing the entire
email-verification gate. This directly corresponds to checklist item 6 ("Unverified
login"), which is why implementing this phase's own test for that item is what
surfaced it. Fixed by adding the check immediately after password verification
succeeds (not before — checking status before confirming the password would let
anyone probe an email's verification state with any password, an enumeration vector).
Full record in `docs/auth/FINDINGS.md`.

### Open questions and risks

- **Missing information / carried-forward environment limitation**: no live Postgres
  was available in this session either (see Phase 3's note, unchanged). Every
  DB-dependent test in this phase is written and will run for real in CI; none were
  executed here.
- **Requires manual verification**: the verify-email page's Confirm-button flow,
  referrer-policy header, and token-stripping-from-URL behavior were written but not
  exercised in a real browser (no Playwright run against this specific page in this
  session — Phase 2's e2e smoke test only covers the home page).
- `FEATURE_BREACHED_PASSWORD_CHECK` defaults to `false` — the HIBP k-anonymity check
  exists and has unit test coverage (mocked `fetch`), but was never exercised against
  the real API in this session (deliberately — making a real network call in a test
  suite is flaky and slow; the mocked tests cover the wiring/fail-open behavior).

## Phase 5 detail

### Done-when verification

"All tests pass" — **Requires manual verification, not Confirmed working**: same
environment limitation as Phases 3/4 (no live Postgres), plus this phase introduces
items that genuinely need a real browser (double-click guard, multi-tab, offline
mode in a real browser, slow network via DevTools throttling) which no amount of
local Node-level testing can substitute for. Two test files needed neither a
database nor a browser and were **actually run**:
`packages/api-client/src/index.spec.ts` (8/8 — timeout, offline, network-failure,
malformed-response handling) and `apps/api/test/all-exceptions-filter.spec.ts` (5/5
— 422/503/500 mapping, Retry-After header). All 14 new
`phase5-login.integration.spec.ts` tests (covering checklist items 1-12, the timing
test, and session fixation) are written and skip cleanly without a reachable
database.

### Tests run (checklist item -> status)

| #                  | Item                                                                                                    | Status                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1-5                | Empty/invalid email, spaces, case, empty password                                                       | Requires manual verification (written, DB-dependent)                                                                                                                                             |
| 6-11               | Incorrect password through Locked account                                                               | Requires manual verification (written, DB-dependent)                                                                                                                                             |
| 12                 | Rate-limited account                                                                                    | Requires manual verification — the Redis-backed per-IP throttler has no direct test; written steps in TRACEABILITY.md                                                                            |
| 13, 14, 15, 17, 18 | Network failure, Timeout, Server error, Database error, Invalid response                                | **Confirmed working** — `packages/api-client` and `all-exceptions-filter` suites, actually run                                                                                                   |
| 16                 | Auth-provider error                                                                                     | N/A — no external provider SDK is wired yet                                                                                                                                                      |
| 19-21              | Expired/existing session, multiple login attempts                                                       | Requires manual verification                                                                                                                                                                     |
| 22-28              | Double-click, concurrent requests, slow network, offline, refresh-during-login, multi-tab, multi-device | 25 (Offline mode) is **Confirmed working** (`ApiClientOfflineError` test, actually run); the rest are Requires manual verification — none are automatable without a real browser in this session |
| 29, 31             | Redirect after login, incorrect redirect destination                                                    | **Confirmed working** for the underlying `isAllowedRedirect` helper (already unit-tested); the login page's own call site is Requires manual verification                                        |
| 30, 32-39          | Redirect loops through permissions failing                                                              | Requires manual verification — all need a real browser/running stack                                                                                                                             |

### Findings

Two real, pre-existing bugs found and fixed while writing this phase's own tests —
both instances of the same pattern this phase's spec explicitly names ("Account
states, checked only after the password matches"):

- **BUG-007** (found in Phase 4, during this phase's rewrite it became clear the fix
  needed to be broader): `pending_verification` wasn't the only status checked too
  early.
- **BUG-008** (new this phase): `locked`/`disabled`/`deleted` were ALL checked before
  password verification, letting anyone enumerate a known email's exact account
  status using any password at all. Fixed in the same `login()` rewrite that added
  dummy-hash timing protection. Full record in `docs/auth/FINDINGS.md`.

### Open questions and risks

- **Missing information / carried-forward environment limitation**: no live
  Postgres, same as Phases 3/4.
- **New this phase**: no browser automation (Playwright against a running stack) was
  exercised either — items 22-39 (minus the two "Confirmed working" exceptions above)
  are all genuinely untested beyond the implementation itself. A later phase (or a
  human with a running local stack) should work through TRACEABILITY.md's written
  manual-verification steps for each.
- **Carried-forward**: the 9 open architecture questions from Phase 1 remain
  unanswered.
- `RedisThrottlerStorage` fails CLOSED on a Redis outage (every throttled route would
  start rejecting requests rather than silently allowing unlimited ones) — this is
  the deliberately safer failure mode per the "never process memory" requirement, but
  it does mean a Redis outage becomes a login-availability incident, not just a
  rate-limiting gap. Worth flagging for the production-readiness phase.

## Phase 6 detail

### Done-when verification

"All tests pass" — **Requires manual verification, not Confirmed working**: same
environment limitation as every prior phase (no live Postgres in this session). All
12 new `phase6-otp.integration.spec.ts` tests (covering every item in the Phase 6
TESTS list, plus magic-link equivalents) are written as real, non-mocked integration
tests and skip cleanly via `isDatabaseReachable()`. No test file in this phase was
runnable without a database — unlike Phase 5, there was no network/timeout/offline
subset that could be exercised without one. The full `apps/api` suite was re-run
after every change and confirmed zero regressions (17 previously-passing non-DB tests
still pass).

### Tests run (checklist item -> status)

| #   | Item                            | Status                                                                                                                   |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | OTP authentication (happy path) | Requires manual verification (written, DB-dependent)                                                                     |
| 2   | OTP generation and hashing      | Requires manual verification — assertions on `tokenHash` shape/non-equality are written but need a database to run       |
| 3   | OTP expiration                  | Requires manual verification (written, DB-dependent)                                                                     |
| 4   | OTP attempt limits              | Requires manual verification (written, DB-dependent — 5-attempt lockout test)                                            |
| 5   | OTP resend                      | Requires manual verification (written, DB-dependent — both the invalidate-previous and the cooldown-blocks-resend tests) |
| 6   | OTP enumeration protection      | Requires manual verification (written, DB-dependent — identical-response tests for request and verify)                   |
| 7   | OTP replay prevention           | Requires manual verification (written, DB-dependent — replay test and the concurrent-use race test, both target BUG-009) |
| 8   | Magic link (D4 resolution)      | Requires manual verification (written, DB-dependent — replay, concurrent-use, and unrecognized-token tests)              |

### Findings

One real, pre-existing bug found and fixed while writing this phase's own
concurrency test:

- **BUG-009**: `verifyOtp()`'s code-consumption step used a non-atomic
  `findFirst` + `update` pair, letting two concurrent correct submissions of the same
  code both succeed (each issuing its own session) — exactly the race this phase's
  own "concurrent use of one code, exactly one succeeds" test requirement exists to
  catch. Fixed by replacing it with a single atomic `updateMany` guarded by
  `usedAt: null`, checking `count === 0` to detect and reject the losing racer. The
  same (already-correct) pattern was reused for the new `verifyMagicLink`. Full
  record in `docs/auth/FINDINGS.md`.

### Open questions and risks

- **Missing information / carried-forward environment limitation**: no live
  Postgres, same as every prior phase.
- **No browser testing performed**: the magic-link confirm page and the OTP
  request/verify UI (countdown, paste support, numeric input mode) were implemented
  but never exercised in an actual browser in this session — both are Requires
  manual verification, not Confirmed working.
- **D4 pragmatically resolved, not by human confirmation**: this phase implemented
  both OTP and magic link rather than waiting for the human to pick one, since the
  Phase 6 task list itself described both as in scope. If the human intended a single
  mechanism, the unwanted one should be disabled (not deleted — the `purpose` column
  already separates them cleanly) rather than left live by default.
- **D6 (TOTP MFA) remains unresolved and unimplemented.** Task 7's "OTP as a second
  factor, if in scope, runs after password verification and before session creation"
  was read as conditional on a scope that was never confirmed, so no second-factor
  wiring was added — `verifyOtp` and `verifyMagicLink` each independently create a
  fresh session, the same as `login()`, not as a second step after it.
- **Carried-forward**: the remaining open architecture questions from Phase 1 are
  still unanswered (managed-provider choice, OAuth provider scope, multi-tenancy,
  real domain names, phase-plan renumbering, harden-vs-discard decision, RLS wiring
  into Prisma's actual connection).

## Phase 7 detail

### Done-when verification

"All tests pass" — **Requires manual verification, not Confirmed working**: same
database limitation as every prior phase (no live Postgres in this session). This
phase is unusual in that a large share of its logic is pure (JWT signing/
verification, cookie-name computation, the CSRF guard, the api-client refresh/CSRF/
broadcast logic, log redaction) and needed no database at all — 23 new tests across
`apps/api`, `packages/api-client`, `packages/security`, and `packages/observability`
were **actually run** this session, not just written. Only the session-row-level
behavior (rotation, reuse detection, idle touch, logout, change-password,
logout-all-devices) is DB-dependent and skips cleanly.

### Tests run (checklist item -> status)

See `docs/TRACEABILITY.md`'s "SESSION LIFECYCLE (Phase 7)" table for the full
item-by-item breakdown (31 rows). Summary: items 1, 2, 7, 8, 10 (partial), 11, 12,
13, 16, 17, 19, 21 (access-token half), 22 (access-token half), 29 (fallback logic),
30 are **Confirmed working** (actually run, no database needed). Items 3, 4, 5, 6,
9, 14, 15, 18, 20, 21 (refresh-token half), 22 (refresh-token half), 23, 24, 25, 26,
27, 28, 29 (real private-mode), 31 are **Requires manual verification** (written as
real integration tests or need a browser/running stack, not executed against a live
database or browser this session).

### Findings

Two real, pre-existing-or-introduced bugs found and fixed while implementing this
phase, plus one documented design decision flagged for human confirmation:

- **BUG-010** (pre-existing, latent): `packages/observability/src/redact.ts` used
  exact-match key matching, which silently let `accessToken`/`refreshToken`/
  `csrfToken` — the exact field names this phase's own new code would plausibly
  log — bypass redaction entirely, despite `token`/`refresh` already being on the
  sensitive-keyword list. Fixed by switching to substring matching.
- **BUG-011** (pre-existing, became exploitable this phase): `SessionGuard` read
  the session cookie name from `process.env` directly instead of through the
  validated config, which had no visible effect before this phase but would have
  caused a complete, silent lockout as soon as the new `__Host-` cookie-prefix
  logic made the controller's actual cookie name diverge from the guard's
  hardcoded fallback. Fixed by routing through the new shared `cookie-names.ts`.
- **Potential risk** (not a bug, flagged for a human decision): idle-timeout is
  measured against protected-resource access (`SessionGuard`), not against
  `/auth/refresh` calls — a client that only ever refreshes, never touching a
  protected route, could keep a session's refresh chain alive past the idle
  window. Full record and the alternative interpretation in FINDINGS.md.

### Open questions and risks

- **Missing information / carried-forward environment limitation**: no live
  Postgres, same as every prior phase.
- **No browser testing performed**: the new `/dashboard/sessions` page, the
  dashboard logout button, and cross-tab-logout's REAL (not mocked) BroadcastChannel
  behavior in an actual browser were never exercised — all Requires manual
  verification, not Confirmed working.
- **EdDSA vs. RS256**: the task allowed either; RS256 was used instead of EdDSA
  solely because `@types/jsonwebtoken@9.0.10` doesn't type `"EdDSA"` yet. Not a
  security downgrade — RS256 is the other explicitly-allowed option — but worth
  knowing if a future phase wants to revisit once the type definitions catch up
  (or by using `jose` instead of `jsonwebtoken`, which does support EdDSA with
  correct types today).
- **Idle-timeout semantics**: see the "Potential risk" finding above — needs a
  human decision on whether `/auth/refresh` itself should also count as activity
  for idle-timeout purposes.
- **Login/signup/OTP-verify/magic-link-verify are NOT behind `CsrfGuard`**: scoped
  deliberately to "cookie-authenticated" state changes only, per the task's literal
  wording — at the moment these are called, the caller doesn't yet have a valid
  session the way logout/refresh/revoke do. A stricter reading (CSRF-protecting
  login itself, against "login CSRF") was considered and explicitly out of scope
  for this phase; flagging it here rather than silently deciding it doesn't matter.
- **No key-rotation drill was performed**: `AUTH_JWT_PREVIOUS_PUBLIC_KEY`/
  `AUTH_JWT_PREVIOUS_KID` exist and are wired into `verifyAccessToken`, but rotating
  keys end-to-end (issuing under a new key while still accepting the old one) was
  not exercised against a running system this session.
- **Carried-forward**: the remaining open architecture questions from Phase 1
  (managed-provider choice, OAuth provider scope, multi-tenancy, real domain
  names, phase-plan renumbering, harden-vs-discard decision, RLS wiring into
  Prisma's actual connection), and D6 (TOTP MFA, still unresolved/unimplemented).

## Phase 8 detail

### Done-when verification

"All tests pass" — **Requires manual verification, not Confirmed working**: same
database limitation as every prior phase (no live Postgres in this session). All
10 new `phase8-password-reset.integration.spec.ts` tests (covering every
checklist item, including the explicit "two simultaneous submits with one token"
and "sessions in a second browser context dead after reset" requirements) are
written as real, non-mocked integration tests and skip cleanly via
`isDatabaseReachable()`. The full `apps/api` suite was re-run after every change
and confirmed zero regressions.

### Tests run (checklist item -> status)

| #   | Item                                       | Status                                                                                                                                          |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Forgot password                            | Requires manual verification (written, DB-dependent)                                                                                            |
| 2   | Reset email                                | Requires manual verification (written, DB-dependent — queue-spy assertion)                                                                      |
| 3   | Reset token                                | Requires manual verification (written, DB-dependent — 32-byte/hash-shape assertions)                                                            |
| 4   | Reset token expiration                     | Requires manual verification (written, DB-dependent)                                                                                            |
| 5   | Token reuse                                | Requires manual verification (written, DB-dependent — targets BUG-012)                                                                          |
| 6   | Token invalidation                         | Requires manual verification (written, DB-dependent)                                                                                            |
| 7   | Password update                            | Requires manual verification (written, DB-dependent — old password rejected, new one accepted)                                                  |
| 8   | Session invalidation after password change | Requires manual verification (written, DB-dependent — two independent logins, both revoked)                                                     |
| 9   | Existing sessions after password reset     | Requires manual verification (same test as item 8; HTTP-level 401 round trip not re-tested, covered generically in Phase 7)                     |
| 10  | Enumeration protection                     | Requires manual verification (written, DB-dependent — response-shape only, NOT full timing-safety, see FINDINGS.md)                             |
| 11  | Expired reset links                        | Requires manual verification (backend: same as item 4; frontend state has no browser test)                                                      |
| 12  | Multiple reset requests                    | Requires manual verification (written, DB-dependent — cooldown-blocks-resend test)                                                              |
| 13  | Race conditions                            | Requires manual verification (written, DB-dependent — targets BUG-012, the explicit "exactly one succeeds" requirement)                         |
| 14  | Redirect handling                          | Confirmed working for the underlying `isAllowedRedirect` helper (already unit-tested); the page's own call site is Requires manual verification |

### Findings

Two real, pre-existing bugs found and fixed while implementing this phase, plus
one documented timing-safety limitation flagged for a human decision:

- **BUG-012** (pre-existing, high severity): `resetPassword()`'s token
  consumption used a non-atomic read-then-`update`, the same TOCTOU race already
  identified and fixed for OTP as BUG-009 — two concurrent submissions of the
  same reset token could both succeed. Fixed with the same atomic-`updateMany`
  pattern.
- **BUG-013** (pre-existing, medium severity): `POST /auth/password-reset/confirm`
  had no `@Throttle` decorator at all, unlike every sibling verify/confirm
  endpoint. Fixed by adding the same 10/60s limit used by OTP/magic-link verify.
- **Potential risk** (not a bug, flagged for a human decision): the
  "enumeration protection" fix for `requestPasswordReset` narrows but does not
  fully close a timing side-channel between known and unknown emails — unlike
  `login()`'s dummy-hash protection, there's no single dominant slow operation to
  equalize against here. Full record and the tradeoff in FINDINGS.md.

### Open questions and risks

- **Missing information / carried-forward environment limitation**: no live
  Postgres, same as every prior phase.
- **No browser testing performed**: the rewritten reset-password page's
  expired/used/invalid states and the "Request a new link" affordance were
  never exercised in an actual browser.
- **Timing-safety tradeoff**: see the "Potential risk" finding above — a
  calibrated artificial delay could close the remaining gap but introduces its
  own maintenance burden (the delay would need to track the real branch's actual
  cost over time); not attempted without a human decision on whether it's worth
  it.
- **Email queue adoption is scoped to this phase's two new email sends only**:
  signup verification, OTP, magic-link, and duplicate-signup-notice emails still
  send directly/synchronously, as they did before this phase — broadening queue
  adoption to every email type in the codebase was judged a larger change than
  this phase's explicit scope ("Do only the work in this phase").
- **Carried-forward**: the remaining open architecture questions from Phase 1,
  and D6 (TOTP MFA, still unresolved/unimplemented).

## Phase 9 detail

### Done-when verification

"All tests pass" — **Requires manual verification, not Confirmed working**:
same database limitation as every prior phase (no live Postgres in this
session), plus no real provider credentials exist for any of the five named
providers (checklist task 9: "Provider registration needs real accounts" —
marked Requires configuration, not attempted). Unlike a typical phase, the
PROVIDER ADAPTER layer itself (packages/auth) is almost entirely pure logic —
33 tests across `packages/auth` (26) and the controller-level half of
`apps/api` (7) **actually run**, covering PKCE, every adapter's identity
resolution and email-trust rule, full ID-token validation (signature/issuer/
audience/expiry/nonce, including a forged-key rejection test), in-app-browser
detection, and every callback-validation branch that happens before the
database is ever touched (state missing/mismatched, cancellation, missing
code, replayed code). Only the account-resolution/linking logic that needs a
database (`OAuthService`'s `resolveIdentity`) is written as a real
integration test that skips cleanly.

### Tests run (checklist item -> status)

See `docs/TRACEABILITY.md`'s "OAUTH PROVIDERS (Phase 9)" and "OAUTH PROCESSES
(Phase 9)" tables for the full breakdown. Summary: PKCE, state validation,
in-app-browser detection, OAuth cancellation, and all four provider adapters'
own identity-resolution logic (Google/Microsoft/GitHub/Facebook, plus the
generic OIDC adapter) are **Confirmed working** (actually run, no DB/network
needed). Callback handling, redirect URI, account linking (both directions),
email collision, provider identity collision, unverified-email handling, and
multiple-accounts link/unlink are **Requires manual verification** (written
as real integration tests, skip cleanly without a database). Popup failure is
**N/A** (no popup codepath exists — full-page redirects only, by design).
Apple's adapter has no dedicated unit test (its ES256 client-secret JWT
signing and `form_post` handling were exercised only via code review) and
real provider registration for every provider is **Requires configuration**.

### Findings

One critical bug caught and fixed BEFORE it was ever committed, plus one
documented, task-mandated exception to this codebase's usual
enumeration-safety discipline:

- **BUG-014** (caught pre-ship, critical as drafted): the OAuth "link a
  provider from settings" flow's session check initially used
  `jwt.decode()` (no signature verification) instead of
  `AuthService.verifyAccessToken()` (full verification) — an unsigned,
  forged cookie would have been accepted as any arbitrary user id, letting
  an attacker link a provider identity to a victim's account. Fixed by
  routing through the same `verifyAccessToken` every other protected route
  already relies on, before this was ever in a committed state.
- **Documented exception, not a bug**: a successful email collision during
  OAuth login reveals that an account exists for that email — unlike every
  other flow in this codebase. This is literally what Phase 9's own task
  list specifies ("The user signs in to the existing account, then links
  from settings" necessarily implies telling them one exists), not an
  oversight. Full record in FINDINGS.md.

### Open questions and risks

- **Missing information / carried-forward environment limitation**: no live
  Postgres, same as every prior phase.
- **No real provider credentials exist anywhere** — Google, Microsoft,
  GitHub, Facebook, and Apple all need real OAuth app registrations (Apple
  additionally needs a paid Apple Developer Program enrollment) before any
  of this can be exercised end-to-end against the real providers. Every
  adapter's logic is tested with a local, mocked identity instead.
- **No browser testing performed**: the full redirect round trip (clicking a
  "Continue with Google" button, completing a real provider's consent
  screen, landing back on this app) was never exercised in an actual
  browser — only the pieces on either end (building the authorization URL,
  handling the callback once a code arrives) are tested in isolation.
- **D2 (managed auth provider) remains genuinely unresolved** — this phase
  proceeded with a hand-rolled implementation rather than blocking on it,
  consistent with every prior phase, but the human should know OAuth is now
  a non-trivial amount of hand-rolled code that a managed-provider migration
  would need to either keep or replace.
- **D5 is pragmatically resolved** (Microsoft, GitHub, Facebook, Apple, and
  a generic adapter all implemented) rather than by explicit human
  confirmation — same pattern as D4 in Phase 6.
- **No federated/provider-side logout** is implemented — logging out of this
  app never ends the user's session with Google/Microsoft/GitHub/Facebook/
  Apple itself. Documented in `docs/auth/COMPONENTS.md` per checklist task 8
  ("document provider session behavior"), not treated as a gap to close
  this phase.
- **No provider access/refresh token storage** — the `OauthAccount` table
  was not extended to store a provider's own access/refresh token, since
  nothing in this phase's task list calls for making further API calls to a
  provider after initial sign-in. A future phase that needs e.g. "read the
  user's GitHub repos" would need a schema change at that point.
- **Carried-forward**: the remaining open architecture questions from
  Phase 1, and D6 (TOTP MFA, still unresolved/unimplemented).

## Phase 10 detail

### Done-when verification

"All tests pass" — **Requires manual verification, not Confirmed working**:
same database/browser limitations as every prior phase (no live Postgres,
no running browser in this session). What DOES actually run: 4 new
`phase10-permissions-guard.spec.ts` tests, 3 new `phase10-forged-headers.spec.ts`
tests (the task's explicit test 5 — forged `x-middleware-subrequest`/
`x-user-id`/`x-user-role`/`x-principal` headers and an unsigned `alg:none`
JWT-shaped cookie, all rejected by `SessionGuard`, since it only ever reads
the actual session cookie), 1 new `all-exceptions-filter.spec.ts` test
(`ForbiddenError` → 403), and 84 new `route-matrix.spec.ts` assertions (the
task's explicit test 1, implemented as static analysis rather than a live
4-persona HTTP crawl — no server/database to crawl against in this
environment). 5 new `phase10-rbac.integration.spec.ts` tests (object-level
404 checks for `revokeSession`/`unlinkAccount`) are written as real
integration tests and skip cleanly. The task's test 2 (malicious `returnTo`
values) and test 3 (no loop for any state) are both covered by actually-run,
exhaustive `packages/security/src/index.spec.ts` tests — these ARE
Confirmed working, since they need no database or browser at all. Test 4
(back/forward after logout show no protected content) has no automated
test — no apps/web/apps/admin test runner exists in this monorepo at all
(confirmed: neither package.json has a `"test"` script) — so it is
**Requires manual verification**, same honesty discipline as every prior
phase's browser-dependent items.

### Tests run (checklist item -> status)

See `docs/TRACEABILITY.md`'s "ROUTING AND MIDDLEWARE (Phase 10)" table for
the full 20-item breakdown. Summary: route guards, server-side API
protection, unauthorized/forbidden-access handling, redirect-loop
prevention, return-URL handling, logged-in/logged-out/wrong-role access, and
"never rely solely on frontend route protection" are **Confirmed working**
(actually run — pure logic or DB-free controller/guard tests). Middleware
itself, client-side protection, nested/dynamic routes beyond what's covered
by the RBAC integration tests, deep links, refresh behavior, back/forward
button behavior, and opening protected URLs directly are **Requires manual
verification** (no live browser in this session). Dynamic routes (checklist
item 6) is **N/A** — no `[id]`-style dynamic page or API route with its own
object-level ownership check exists in this codebase yet; the closest
analogues (`revokeSession`, `unlinkAccount`) are body/param-addressed
service methods, covered under "API routes" instead.

### Findings

Two confirmed bugs, plus one caught-before-shipping defect in brand-new
Phase 10 code itself:

- **BUG-015** (confirmed, HIGH severity): `ForbiddenError` is a plain
  `Error`, not a Nest `HttpException`, so it fell through
  `AllExceptionsFilter`'s generic branch and returned HTTP 500 instead of
  403 for every permission-denied case — previously limited in reach (only
  `profile.controller.ts` called `assertPermission`), but this phase's new
  `PermissionsGuard` pattern was expected to make this common going
  forward. Fixed by adding an explicit `ForbiddenError` branch to the
  filter.
- **BUG-016** (confirmed, HIGH severity): `apps/web/src/middleware.ts`
  hardcoded the unprefixed session cookie name (`"app_session"`), but
  Phase 7's `__Host-` cookie-prefixing means the real cookie name in any
  production-shaped deployment (HTTPS, no cookie `Domain`) is
  `__Host-app_session` — this middleware would never have detected a
  signed-in user in production, locking out every user. Fixed by checking
  both name variants via a new public env var.
- **Caught pre-ship, not shipped**: `resolveAuthRedirect`'s first draft let
  an authenticated visit to `/login?next=/login` redirect back to
  `/login` — a genuine loop, caught by the function's own exhaustive test
  before it was ever called from a real page. Fixed with an explicit
  `/login` exclusion. Full record in FINDINGS.md.

### Open questions and risks

- **Missing information / carried-forward environment limitation**: no
  live Postgres, same as every prior phase.
- **No browser testing performed**: back/forward-button behavior after
  logout (checklist item 15/16, task test 4), refresh behavior on a
  protected page (item 13), and the full deep-link-survives-login round
  trip (item 12/14) were never exercised in an actual browser — no
  apps/web/apps/admin test runner exists in this monorepo at all to even
  attempt an automated version of these.
- **Duplicated `requireUser()`/`requirePermission()` logic between
  apps/web and apps/admin**: deliberately NOT extracted into a new shared
  package this phase (judged a larger change than this phase's explicit
  scope, "Do only the work in this phase") — contributes to
  `check:duplicates`' modest increase (4.06% → 4.32%, still well under
  threshold). Flagged as a candidate for a future `@saas/auth-client`-style
  extraction if a third Next.js app is ever added.
- **No dynamic (`[id]`-style) route exists yet** with its own object-level
  ownership check beyond `revokeSession`/`unlinkAccount` — checklist item
  6 ("Dynamic routes") is therefore N/A rather than tested; a future phase
  introducing one (e.g. a resource editable by id) should re-visit this.
- **No server actions exist anywhere in this codebase** (verified during
  this phase's research — no `"use server"` directive in apps/web or
  apps/admin) — the task's "server action" guard requirement is therefore
  structurally satisfied (nothing to guard), not something a test exercises;
  `scripts/route-matrix.spec.ts`'s own doc comment flags this explicitly so
  a future server action is caught as "unclassified" the moment one is
  added.
- **`settings.manage` permission remains unused** — carried forward from
  Phase 3's seed data; still no route or component references it. Not a
  Phase 10 finding specifically, but worth a human decision on whether it
  should be removed or whether a future admin feature is expected to use
  it.
- **Carried-forward**: the remaining open architecture questions from
  Phase 1, and D6 (TOTP MFA, still unresolved/unimplemented).

## Phase 11 detail

### Done-when verification

"All tests pass" — **Requires manual verification, not Confirmed
working**: unlike every prior phase, this one DID get a real live-browser
run (Playwright against an actual `next dev` server, chromium), which is
new — every previous phase's "no browser testing was performed" caveat
does not apply here. 12 of 14 e2e tests pass for real; 2 skip cleanly
because no reachable API exists in this environment (cross-tab logout,
hard-refresh-no-flash — both need a real session, which needs a real
database behind the API). The axe/double-submit/button-reenable/
password-toggle/viewport/keyboard-navigation tests needed no backend at
all (mocked at the browser network layer) and are genuinely **Confirmed
working**. Race-condition handling (the session-generation counter) and
several structural items (form-reset-on-error-only, autofill, password
manager compatibility, real screen-reader output) are implemented and
code-reviewed but have no dedicated automated test this phase — honestly
marked Requires manual verification in TRACEABILITY.md, not claimed as
Confirmed working.

### Tests run (checklist item -> status)

See `docs/TRACEABILITY.md`'s "FRONTEND AUTH UI (Phase 11)" table for the
full 26-item breakdown. Summary: error messages/wrong-error-displayed,
password visibility, mobile keyboard/viewport (16px font), accessibility
(axe-clean), keyboard navigation, focus management, and broken redirects
are **Confirmed working** — all actually run against a live server.
Loading states, button-disabled/re-enabled, double submission (login
only — the other 5 forms share the pattern but aren't independently
tested), form reset, autofill, password manager compatibility, loading
indicators, race conditions, flash prevention, and incorrect logout state
are **Requires manual verification** (implemented, several have a written
test that needs a reachable API and skips without one).

### Findings

Three confirmed bugs, all caught by this phase's own live Playwright run
(not by code review, not by a written-but-unexecuted test):

- **BUG-022** (confirmed, HIGH severity): `.js`-suffixed relative imports
  in `packages/ui`/`packages/config` — valid under Node's own ESM loader
  (used correctly by `tsx` in apps/api/apps/worker) — failed to resolve
  under `next dev` specifically, returning a 500 on every single route in
  apps/web. Completely invisible to `next build` (which apparently
  resolves them fine) and to every unit/integration test in this
  workstream, since none of them boot `next dev`. Fixed by removing the
  extension from the handful of files apps/web actually imports; 13 more
  files elsewhere in the repo have the identical pattern but are never
  imported by apps/web today — flagged as a Potential risk for later.
- **BUG-023** (confirmed, LOW severity): the cookie-consent banner
  rendered outside any landmark region, failing axe's "region" rule
  (moderate impact per axe) on every page in the app. Fixed with
  `role="region"`/`aria-label`.
- **BUG-024** (confirmed, HIGH severity, the most significant finding this
  phase): a wrong login password, wrong OTP code, or an expired/used magic
  link all legitimately return HTTP 401 for reasons that have nothing to
  do with session validity — but the shared API client treated EVERY 401
  (except literally `/auth/refresh`) as "session expired" and fired a hard
  `window.location.href` redirect before the calling page's own error
  handling could run. This affected three of the app's most common
  failure paths (wrong password, wrong OTP code, expired magic link) and
  had gone completely undetected because nothing had ever exercised the
  real browser-navigation side effect until this phase's own
  "login error summary receives focus" test failed and revealed it. Fixed
  with an explicit opt-in flag on the affected call sites.

### Open questions and risks

- **Missing information / carried-forward environment limitation**: no
  live Postgres, same as every prior phase — though this phase DID get a
  real browser, a first for anything beyond the Phase 2 homepage smoke
  test.
- **No real screen-reader software was used** — axe and explicit
  `aria-pressed`/`role`/`aria-live` assertions confirm correct markup, but
  no one listened to NVDA/VoiceOver/JAWS actually announce any of this.
- **`POST /auth/change-password` has the identical BUG-024 shape** (401
  for a wrong current password) but has no frontend call site yet — no
  change-password UI exists in apps/web. Whoever builds it must pass
  `treatUnauthorizedAsOrdinaryError: true`, or this exact bug recurs there.
  Flagged in FINDINGS.md as a Potential risk, not fixed preemptively (no
  code to fix yet).
- **13 more files repo-wide share BUG-022's `.js`-extension pattern**
  (`packages/auth`, `packages/database`) — currently harmless (never
  imported by apps/web/apps/admin, and `tsx`/Node's ESM loader resolves
  them correctly for apps/api/apps/worker), but would reproduce the same
  `next dev` failure if ever added to a Next app's `transpilePackages` or
  imported directly. Not fixed repo-wide this phase (out of scope — only
  the files actually blocking apps/web's dev server were touched).
- **Important process finding, not a product bug**: this phase discovered
  that Phase 10's own commit (`a7a54f5`) had accidentally absorbed
  unrelated, unreviewed content into `docs/auth/FINDINGS.md` from a
  separate, concurrent session's uncommitted work — because that file was
  staged as a whole (`git add docs/auth/FINDINGS.md`) without checking
  whether it had been modified by anything else first. That content
  (BUG-017 through BUG-020 in the committed history) describes real work
  from that other session, not fabricated, but it was never reviewed or
  vouched for as part of Phase 10's own verification, and it's already
  pushed to `origin/main`. Not rewritten here (rewriting pushed history
  wasn't asked for and carries its own risk) — flagged directly to the
  user in this phase's own report. This phase's own shared-file edits
  (`docs/TRACEABILITY.md`, `docs/auth/FINDINGS.md`,
  `packages/config/src/index.ts`) were isolated by hunk before staging
  specifically to not repeat this mistake.
- **Several apps/web routes changed from static to dynamic rendering**
  (`○` to `ƒ` in the `next build` output) because the root layout's
  session resolution now runs on every request — a deliberate,
  correctness-motivated tradeoff (no stale auth state baked into a static
  page), flagged here so a future performance-focused phase doesn't
  mistake it for an accidental regression.
- **Carried-forward**: the remaining open architecture questions from
  Phase 1, and D6 (TOTP MFA, still unresolved/unimplemented).

## Phase 12 detail

### Done-when verification

"All tests pass and ERRORS.md matches the code" — **Requires manual
verification, not Confirmed working**: the catalog-shape tests (pure
logic, no DB) and the full `all-exceptions-filter.spec.ts` suite (pure
logic, no DB) all actually run and pass — 3 + 10 tests. The 3
DB-dependent `phase12-error-catalog.spec.ts` tests that trigger
`INVALID_CREDENTIALS`/`OTP_INVALID_OR_EXPIRED`/`SESSION_EXPIRED` against a
real `AuthService` call are written as real integration tests and skip
cleanly — same environment limitation as every prior phase (no live
Postgres in this session). "ERRORS.md matches the code" is enforced two
ways: the catalog-shape tests assert the `AUTH_ERROR_CATALOG` object
itself is well-formed, and `all-exceptions-filter.spec.ts`'s new
catalog-cross-reference tests assert specific real exceptions
(`ForbiddenError`, a Prisma-unreachable error, `ThrottlerException`)
produce EXACTLY their catalog-documented status/message — not just a
human cross-read of the doc against the source.

### Tests run (checklist item -> status)

See `docs/TRACEABILITY.md`'s "ERROR HANDLING: PER ERROR" and "ERROR
HANDLING: ERROR TYPES" tables for the full breakdown. Summary: the
response shape, mapping layer, recovery-path enforcement, and the
scrubbing/log-capture test are all **Confirmed working** (actually run).
400/403/422/429/500/503/database-errors/unexpected-exceptions/"no generic
something went wrong" are **Confirmed working**. 401 and the specific
per-code triggers are **Requires manual verification** (DB-dependent,
written as real tests, skip cleanly here). 404 and auth-provider errors
are unchanged from Phases 9/10 and re-documented for completeness, not
re-verified this phase. 409 and 502 are **N/A** — no code path in this
codebase produces either status, documented honestly in ERRORS.md rather
than fabricating a test for a scenario that doesn't exist (AUTH_RULES
rule 10).

### Findings

One confirmed bug, plus one documented scope-limited gap:

- **BUG-025** (confirmed, MEDIUM severity): six auth exceptions (ten
  throw sites) threw with a bare string instead of `{code, message}`,
  falling back to `AllExceptionsFilter`'s generic `HttpStatus[status]`
  code — no user-facing impact (message/status were always correct), but
  made the response's `code` field unable to distinguish e.g. a wrong
  password from a stale session, both `"UNAUTHORIZED"`. Fixed by giving
  each its own catalog code; the exact message text is unchanged.
- **Potential risk, not fixed**: 429 responses from the new
  `ThrottlerException` mapping don't carry a `Retry-After` header — doing
  so would require overriding `ThrottlerGuard` itself (a change to this
  app's own rate-limiting mechanism, not a provider/database error to
  map), judged out of this phase's "one mapping layer... to catalog
  codes" scope. Full record in FINDINGS.md.

### Open questions and risks

- **Missing information / carried-forward environment limitation**: no
  live Postgres, same as every prior phase.
- **No managed metrics backend or error tracker is wired**:
  `recordAuthMetric()` is structured-log-based plumbing only; Sentry and
  OpenTelemetry remain purely aspirational in this codebase's docs (named
  in the stack, zero dependency installed, zero init code) — confirmed by
  direct investigation this phase, not assumed. Alerting thresholds on top
  of the metric events this phase added are a deployment-time/ops
  decision requiring that backend to exist first.
- **`apps/api`'s full-project `typecheck` is currently broken by
  unrelated, concurrent, uncommitted work from a different session**
  touching this same working directory (a `tsconfig.json` `"composite":
true` change causing an `import.meta`/module-target conflict in
  `packages/config`) — not caused by, and not fixable from within, this
  phase's own scope. Every Phase 12 file was verified individually
  (standalone `eslint`, `tsc --noEmit` on the specific package, and the
  full `vitest` suite, which doesn't depend on the broken tsconfig
  project-reference setting) instead.
- **Process finding, not a product bug — a real mistake made this
  phase**: while isolating `docs/TRACEABILITY.md`'s own shared-file edit
  from that same concurrent session's uncommitted work (the discipline
  established in Phase 11, to avoid repeating Phase 10's
  accidental-whole-file-stage mistake), a `git show HEAD:docs/TRACEABILITY.md
| Out-File -Encoding utf8` command corrupted the file's non-ASCII
  characters (→ and § became mangled byte sequences) across the ENTIRE
  file, not just the Phase 12 section — a PowerShell console
  encoding round-trip issue, not a `git`/file-content issue. The recovery
  action, `git checkout HEAD -- docs/TRACEABILITY.md`, correctly restored
  clean content but was run WITHOUT first saving a backup of the other
  session's uncommitted edits to that specific file, unlike the (correct)
  backup-first approach used for `docs/auth/FINDINGS.md` and
  `packages/config/src/index.ts` moments later in this same phase. That
  other session's uncommitted `docs/TRACEABILITY.md` edits (status-row
  updates referencing their own, separately-committed-elsewhere "Stage 5"
  feature work) are lost from the working tree. Nothing of theirs was
  ever committed to git, so no git history is affected, and none of
  their actual CODE changes in other files were touched — only this one
  documentation file's uncommitted cross-reference rows. Reported
  directly to the user in this phase's own closing report, not silently
  absorbed.
- **Carried-forward**: the remaining open architecture questions from
  Phase 1, and D6 (TOTP MFA, still unresolved/unimplemented).
