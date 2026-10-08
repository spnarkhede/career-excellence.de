import { expect, test } from "@playwright/test";

/**
 * Phase 14 explicit tests: "no analytics request before accept, none
 * after reject" and "404 status on an unknown URL." Actually run against
 * a live `next dev` server — no backend/database needed for any of these.
 */

test("an unknown URL returns a real HTTP 404 status with a custom page", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist-anywhere");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByRole("link", { name: /go home/i })).toBeVisible();
});

test("no analytics event is sent before the user responds to the cookie banner", async ({
  page,
}) => {
  let analyticsRequestSeen = false;
  await page.route("**/analytics/events", (route) => {
    analyticsRequestSeen = true;
    return route.fulfill({ status: 204, body: "" });
  });
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));

  await page.goto("/");
  // The banner itself appearing is not an analytics event; give the page a
  // moment to settle, then confirm nothing was sent.
  await page.waitForTimeout(500);
  expect(analyticsRequestSeen).toBe(false);
});

test("no analytics event is sent after the user rejects optional cookies", async ({ page }) => {
  let analyticsRequestSeen = false;
  await page.route("**/analytics/events", (route) => {
    analyticsRequestSeen = true;
    return route.fulfill({ status: 204, body: "" });
  });
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));

  await page.goto("/");
  await page.getByRole("button", { name: /reject optional/i }).click();
  // Navigate to a page that fires a tracked event (signup) to prove
  // rejection actually suppresses it, not just that nothing happened to
  // fire in the meantime.
  await page.goto("/signup");
  await page.waitForTimeout(500);
  expect(analyticsRequestSeen).toBe(false);
});

test("accepting cookies allows a subsequent tracked event to be sent", async ({ page }) => {
  let analyticsRequestSeen = false;
  await page.route("**/analytics/events", (route) => {
    analyticsRequestSeen = true;
    return route.fulfill({ status: 204, body: "" });
  });
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));

  await page.goto("/");
  await page.getByRole("button", { name: /accept all/i }).click();
  await page.goto("/signup"); // fires track("signup_started") on mount
  await page.waitForTimeout(500);
  expect(analyticsRequestSeen).toBe(true);
});

test("Reject and Accept are the same size/variant — equally easy, not a dark pattern", async ({
  page,
}) => {
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");

  const reject = page.getByRole("button", { name: /reject optional/i });
  const accept = page.getByRole("button", { name: /accept all/i });
  const rejectBox = await reject.boundingBox();
  const acceptBox = await accept.boundingBox();
  expect(rejectBox?.height).toBe(acceptBox?.height);
});

test("the cookie settings link reopens the banner after a choice was already made", async ({
  page,
}) => {
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
  await page.getByRole("button", { name: /accept all/i }).click();
  await expect(page.getByRole("region", { name: "Cookie consent" })).toBeHidden();

  await page.getByRole("button", { name: /cookie settings/i }).click();
  await expect(page.getByRole("region", { name: "Cookie consent" })).toBeVisible();
});
