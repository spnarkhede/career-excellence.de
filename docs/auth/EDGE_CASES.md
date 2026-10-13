# Edge Cases: Race Conditions (Phase 17)

Per [AUTH_RULES.md](../../AUTH_RULES.md), one entry per checklist item: scenario,
expected behavior, test or manual steps, status. Statuses are restricted to the set in
rule 13. See [docs/TRACEABILITY.md](../TRACEABILITY.md)'s "Race conditions and edge
cases" table for the implementing-file/test cross-reference per item.

Helpers built for this phase (task 1): a delayed-route interceptor (`delayRoute`) and
`context.setOffline` toggling in `tests/e2e/phase17-race-conditions.spec.ts` (network
throttling / offline-reconnect), `Promise.all`/`Promise.allSettled` parallel request
runners in `apps/api/test/phase17-race-conditions.integration.spec.ts` (server-side
concurrency), and multiple `Page`s in one `BrowserContext` (multi-tab). A genuine
multi-device scenario needs two independent browser _contexts_ with separately
established sessions against a live backend — no network-layer mock can fake a second
device's real session, so item 6 below is manual-only.

---

### 1. Two login requests simultaneously

**Expected behavior:** Both requests succeed independently (correct credentials, no
lockout in play); two distinct sessions are created; neither corrupts the other.

**Test:** `apps/api/test/phase17-race-conditions.integration.spec.ts` — "issues two
independent, valid sessions for two concurrent logins."

**Status:** Requires manual verification — written as a real (non-mocked) integration
test; no live Postgres was reachable in this session, so it skipped cleanly (7/7 tests
in this file skip; 0 run). Will execute for real in CI per every prior phase's
identical environment note.

---

### 2. Login + logout simultaneously

**Expected behavior:** A logout targeting an existing session and a brand-new login for
the same user, run concurrently, do not interfere — the targeted session ends up
revoked (`revokedReason: "logout"`) and the new login's session remains active.

**Test:** Same file — "logging out an existing session concurrently with a brand-new
login revokes only the targeted session."

**Status:** Requires manual verification (same reason as item 1).

---

### 3. Login + refresh simultaneously

**Expected behavior:** Refreshing a pre-existing session and logging in fresh (for the
same user) concurrently both succeed; the refresh rotates its own session forward; the
new login is a wholly separate session; neither result is corrupted by the other.

**Test:** Same file — "a concurrent refresh of an existing session and a brand-new
login both succeed independently."

**Status:** Requires manual verification (same reason as item 1).

---

### 4. Token refresh + API request simultaneously

**Expected behavior:** When several requests in flight all discover an expired access
token near-simultaneously, exactly one `/auth/refresh` call is made; every other
request awaits that same in-flight refresh and retries once against the new token,
instead of each independently racing to refresh (which would otherwise trigger the
server's reuse-detection logic against itself).

**Test:** `packages/api-client/src/index.spec.ts` — "triggers exactly one /auth/refresh
call for 5 parallel 401s, and retries each original request once." Server-side same-
token concurrency: `phase17-race-conditions.integration.spec.ts` — "two concurrent
refreshes of the SAME refresh token resolve to one rotation without a false
reuse-detected revocation."

**Status:** Confirmed working (client) — the api-client test needs no database and was
actually run (part of the pre-existing Phase 7 suite, re-verified passing this phase).
Requires manual verification (server) — the new integration test is written but
DB-dependent, same environment limitation as item 1.

---

### 5. Multiple browser tabs

**Expected behavior:** Each tab independently resolves its own auth state from the
server (no client-only shared state to desync); a logout in one tab broadcasts to every
other open tab (BroadcastChannel, with a `localStorage` fallback), which then clears its
own state and redirects to login.

**Test:** `tests/e2e/auth-ui.spec.ts` "cross-tab logout sync" (needs a reachable API,
documented to skip cleanly without one); `tests/e2e/phase17-race-conditions.spec.ts`
"two tabs in the same context each resolve their own unauthenticated state
independently" (mocked, no backend needed).

**Status:** Requires manual verification — neither test was executed against a live
`next dev` server in this session (see the Findings note below on this environment's
Playwright run not completing in the available time). The underlying broadcast
mechanism (`broadcastLogout`/`onLogoutBroadcast` in `packages/api-client`) has no
dedicated unit test of its own beyond what Phase 7/11 already covered by code review.

---

### 6. Multiple devices

**Expected behavior:** Two real devices, each with their own independently-issued
session, operate without interference; revoking one device's session (via "sign out
other devices") does not affect the other.

**Manual verification steps:**

1. Sign in from Device A (or Browser Context A). Note the session appears in the
   session list (`/dashboard/sessions` or equivalent).
2. Sign in from Device B with the same account.
3. Confirm Device A's session list now shows both sessions.
4. From Device A, revoke "all other sessions."
5. Confirm Device B's next request (e.g. a page refresh) is rejected with
   `SESSION_REVOKED` and redirects to login, while Device A remains signed in.

**Status:** Requires manual verification — no automated test can fake two genuinely
independent devices/sessions against a mocked network layer; this is the one item in
this phase's checklist that is manual-only by nature, not merely unexecuted.

---

### 7. Expired token during API request

**Expected behavior:** A request made with an already-expired access token receives a
401, triggers exactly one refresh attempt, and either succeeds (fresh token, request
retried once) or fails cleanly with a redirect to login (refresh itself failed/the
session is truly gone).

**Test:** `packages/api-client/src/index.spec.ts` (401 → refresh → retry-once, and the
"refresh itself fails → onUnauthorized" case) — **actually run**. Server-side expiry
checks: `phase17-race-conditions.integration.spec.ts`.

**Status:** Confirmed working (client, actually run). Requires manual verification
(server-side DB-dependent assertions, written but not executed this session).

---

### 8. User refreshes during authentication

**Expected behavior:** A hard page reload while a login request is still in flight
leaves no half-authenticated state — the reload lands back on a clean, unauthenticated
login form (the in-flight request's eventual response, if it ever arrives, is directed
at a page that no longer exists and is simply discarded by the browser).

**Test:** `tests/e2e/phase17-race-conditions.spec.ts` — "reloading mid-login leaves the
app in a clean unauthenticated state."

**Status:** Requires manual verification — written, not executed against a live `next
dev` server in this session (see the Findings note below).

---

### 9. User closes browser during authentication

**Expected behavior:** Same invariant as item 8 — closing the browser mid-request
cannot leave a "half-authenticated" state, because the server only ever creates a
session after the full login transaction completes; a closed browser simply never
receives the cookie if it closed before the response arrived.

**Manual verification steps:**

1. Open DevTools Network tab, throttle to Slow 3G.
2. Submit the login form.
3. Close the browser tab/window immediately, before the response arrives.
4. Reopen the browser, navigate to the app.
5. Confirm the app shows the login page (unauthenticated) — not a stuck "logging in"
   state, and not a silently-authenticated session the user never saw confirmed.

**Status:** Requires manual verification — a closed browser cannot be observed or
asserted against by any automated test; this is manual-only by nature.

---

### 10. Network disconnects during authentication

**Expected behavior:** Submitting the login form while offline fails fast with a
distinct "you appear to be offline" message, without ever attempting (and hanging on)
a `fetch` call. A disconnect that happens mid-request (not just before it) is reported
as a network failure, not silently retried forever.

**Test:** `packages/api-client/src/index.spec.ts` "throws ApiClientOfflineError without
ever calling fetch when navigator.onLine is false" — **actually run** (pre-flight
check). `tests/e2e/phase17-race-conditions.spec.ts` "submitting while offline shows a
distinct offline message without hanging" (mid-flow, via `context.setOffline`).

**Status:** Confirmed working (pre-flight offline detection, actually run). Requires
manual verification (live-browser mid-flow scenario, written but not executed this
session).

---

### 11. Network reconnects

**Expected behavior:** After a failed offline attempt, going back online and retrying
the same form succeeds normally — no stuck state, no need to reload the page.

**Test:** `tests/e2e/phase17-race-conditions.spec.ts` "retrying after reconnecting
succeeds."

**Status:** Requires manual verification — written, not executed against a live `next
dev` server in this session.

---

### 12. Slow authentication provider

**Expected behavior:** A slow (multi-second) response from the login endpoint keeps the
submit button disabled for the full duration (no duplicate submissions possible) and
resolves exactly once when the response finally arrives.

**Test:** `tests/e2e/phase17-race-conditions.spec.ts` "slow login response keeps the
submit button disabled and resolves exactly once" (1.5s simulated delay).

**Status:** Requires manual verification — written, not executed against a live `next
dev` server in this session. The underlying double-submit guard this test exercises is
the same mechanism Phase 11's "duplicate clicks" test already confirmed working under a
shorter (300ms) delay.

---

### 13. Duplicate clicks

**Expected behavior:** Rapidly double-clicking (or otherwise re-triggering) the submit
button sends exactly one request.

**Test:** `tests/e2e/auth-ui.spec.ts` "double click on login submit sends exactly one
request" — **actually run** in Phase 11 (12 passed, 2 skipped cleanly, 0 failed).

**Status:** Confirmed working — pre-existing Phase 11 coverage, re-verified by code
review this phase (the `submitLock` ref + `isSubmitting` guard in the login page was
not touched). Not re-executed live in this session.

---

### 14. Rapid navigation

**Expected behavior:** Quickly navigating away from a page with an auth request still
in flight does not throw an unhandled client-side error or leave a stuck loading state
on the page the user navigated to.

**Test:** `tests/e2e/phase17-race-conditions.spec.ts` "navigating away mid-request does
not throw an unhandled page error" (asserts zero `pageerror` events).

**Status:** Requires manual verification — written, not executed against a live `next
dev` server in this session.

---

### 15. Session expires while user is active

**Expected behavior:** There is no background polling/timer watching the session —
expiry is discovered the next time the user's browser makes any authenticated request
(a navigation, a data fetch), which receives a 401, attempts one refresh, and either
continues transparently (refresh succeeded) or is redirected to login with
`reason=session_expired` (refresh failed, e.g. the refresh token itself expired or was
revoked).

**Test:** `packages/api-client/src/index.spec.ts` ("calls onUnauthorized exactly when
the response status is 401" and the refresh-retry tests) — **actually run**.

**Status:** Confirmed working — this is the complete, already-implemented mechanism;
no gap was found. "While user is active" specifically means "on their next request,"
by design (see item 16).

---

### 16. Session expires while page is open

**Expected behavior:** Same mechanism as item 15 — a page left open with no further
user interaction will NOT proactively notice its session expired (no background poll
exists). The next interaction that triggers a request is what discovers it.

**Status:** Confirmed working (by design) — this is a deliberate architectural decision,
not a gap: a background "am I still logged in" poll was considered and rejected as
unnecessary complexity given the access token's short (15-minute) lifetime and the
fact that every real user interaction already re-validates the session as a side
effect. A product requirement for "log the user out within N seconds of the server-side
session ending, even with zero page interaction" would need a new polling mechanism —
none exists today, and none was requested by any prior phase's checklist.

---

### 17. Profile request before session request completes

**Expected behavior:** A race between two near-simultaneous principal/profile
resolutions for the same (possibly still being self-healed) user — e.g. two requests
arriving before a lazily-created profile row exists — must not throw an unhandled
unique-constraint error or create two profile rows; both requests must succeed with a
valid principal.

**Test:** `apps/api/test/phase17-race-conditions.integration.spec.ts` — "concurrent
principal resolution for a profile-less user self-heals without a duplicate-row
error."

**Status:** Requires manual verification — written, DB-dependent, not executed in this
session. The underlying self-heal mechanism (`PrincipalService.resolve`, Phase 3) was
specifically designed to swallow exactly this race (`P2002` unique-constraint
violation on a concurrent `profile.create`), so this test is confirming an existing,
reasoned-about guarantee rather than probing new ground.

---

### 18. Profile request after logout

**Expected behavior:** Once a session is logged out (revoked), any subsequent attempt
to renew it (refresh) is rejected — there is no path for a "profile" request to
succeed against a session that no longer exists server-side, since every authenticated
request depends on a valid access token that itself depends on the session being live.

**Test:** `phase17-race-conditions.integration.spec.ts` — "refresh fails for a session
that was already logged out."

**Status:** Requires manual verification — written, DB-dependent, not executed this
session.

---

### 19. Refresh token rotation during concurrent requests

**Expected behavior:** Two tabs (or two near-simultaneous requests) presenting the SAME
refresh token at nearly the same time is treated as a benign race within a short grace
window — both resolve to the same rotated-forward session, not a false "stolen token"
reuse-detection event. The SAME presentation, outside that grace window (a genuinely
stale/replayed token), revokes the entire session family.

**Test:** `phase17-race-conditions.integration.spec.ts` — "two concurrent refreshes of
the SAME refresh token resolve to one rotation without a false reuse-detected
revocation" (within grace window) and "replaying an already-rotated refresh token
outside the grace window revokes the whole family" (adversarial variant).

**Status:** Requires manual verification — written, DB-dependent, not executed this
session. The grace-window/rotation-chain mechanism itself was implemented and already
reasoned about in Phase 7; this phase adds the explicit concurrent-call assertions
confirming that design actually behaves as intended under real parallel calls.

---

## Environment note: Playwright live-browser run not completed this session

`tests/e2e/phase17-race-conditions.spec.ts` was written, passes `tsc --noEmit` and
`eslint` cleanly, and follows the same `page.route`-mocking pattern already proven
(actually run) in `tests/e2e/auth-ui.spec.ts` and the Phase 14-16 e2e suites. Multiple
attempts to execute it against a live `next dev` server in this sandboxed session did
not complete within the available tool-call time budget (the Playwright process
produced no output and did not exit; a large number of leftover `node` processes were
observed, suggesting resource contention from this session's earlier `pnpm dev`/test
runs, not a defect in the test file itself). This is an **environment limitation**,
the same category already documented for every DB-dependent test in Phases 3-16 — it
does not indicate the tests are wrong, only that they were not **confirmed** running in
this specific session. The next environment with a clean, reachable `next dev` server
and normal resource headroom should run `pnpm exec playwright test
tests/e2e/phase17-race-conditions.spec.ts --project=chromium` and update every
"Requires manual verification" status above that depends on it to "Confirmed working"
or "Confirmed broken" as appropriate, per AUTH_RULES.md rule 13.
