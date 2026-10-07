const { test, expect } = require("@playwright/test");
test.use({
  baseURL: process.env.RSVP_TEST_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`,
  launchOptions: { executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium", args: ["--no-sandbox"] },
  viewport: { width: 390, height: 844 },
});
const eventToken = "a".repeat(64);
const attendeeId = "b".repeat(64);
const ticketId = "c".repeat(64);
const responseData = { eventName: "AUSA 2026", location: "Test event venue" };
const arrival = { status: "checked-in", fullName: "Test Guest", checkedInAt: "2026-10-06T18:00:00.000Z" };

async function guestFixtures(page, options = {}) {
  const writes = [];
  await page.route("**/api/captcha-mode", (route) => route.fulfill({ json: { mode: "invisible", token: "fixture-token" } }));
  await page.route("**/api/rsvp-guest/context", (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${eventToken}`);
    return route.fulfill(options.invalid ? { status: 403, json: { error: "This event QR is not active." } } : { json: responseData });
  });
  await page.route("**/api/rsvp-guest/search?*", (route) => route.fulfill({
    json: { attendees: options.empty ? [] : [{ id: attendeeId, fullName: "Test Guest" }], truncated: false },
  }));
  await page.route("**/api/rsvp-guest/select", (route) => {
    writes.push(route.request().postDataJSON());
    if (options.failFirst && writes.length === 1) return route.fulfill({ status: 503, json: { error: "Temporary issue. Try again." } });
    return route.fulfill({ json: options.form ? { status: "form-required", formUrl: `/guest-check-in?rsvp=${ticketId}#event=${eventToken}` } : arrival });
  });
  await page.route("**/api/page-settings/*", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/ace-pocs*", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/rsvp-guest/form-context", (route) => route.fulfill({ json: {
    ...responseData, ticketId, fullName: "Test Guest", firstName: "Test", lastName: "Guest", completed: false,
  } }));
  await page.goto(options.entryUrl || `/rsvp-arrival#event=${eventToken}`);
  return writes;
}

test("phone search renders real branding; searching and page loads do not check in", async ({ page }) => {
  const writes = await guestFixtures(page);
  await expect(page.getByRole("heading", { name: "Search your name" })).toBeVisible();
  await expect(page.getByAltText("Ace Electronics Defense Systems")).toBeVisible();
  await page.getByLabel("First or last name").fill("Test");
  await expect(page.getByText("Test Guest", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("matched name confirms one explicit arrival, and failed retry preserves request ID", async ({ page }) => {
  const writes = await guestFixtures(page, { failFirst: true });
  await page.getByLabel("First or last name").fill("Test");
  await page.getByRole("button", { name: /Confirm arrival/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Temporary issue" })).toBeVisible();
  await page.getByRole("button", { name: /Confirm arrival/ }).click();
  await expect(page.getByText("Arrival confirmed", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[0].requestId).toBe(writes[1].requestId);
  expect(writes[1]._ft).toBe("fixture-token");
});
test("unmatched guest must complete the existing prefilled form; failed form does not claim success", async ({ page }) => {
  const writes = await guestFixtures(page, { form: true });
  let submits = 0;
  await page.route("**/api/guest-checkin", (route) => {
    const body = route.request().postDataJSON();
    expect(body.rsvpTicket).toBe(ticketId);
    expect(body.location).toBe(responseData.location);
    expect(body.eventName).toBe("AUSA 2026");
    submits++;
    return route.fulfill(submits === 1 ? { status: 503, json: { error: "Retry your arrival" } } : { status: 201, json: { ...arrival, name: arrival.fullName } });
  });
  let historySearches = 0;
  await page.route("**/api/kiosk/visitor-search?*", (route) => { historySearches++; return route.fulfill({ json: [] }); });
  await page.getByLabel("First or last name").fill("Test");
  await page.getByRole("button", { name: /Confirm arrival/ }).click();
  await expect(page.getByRole("heading", { name: "Complete your RSVP check-in" })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(submits).toBe(0);
  await expect(page.getByTestId("input-first-name")).toHaveValue("Test");
  await expect(page.getByTestId("input-last-name")).toHaveValue("Guest");
  await expect(page.getByTestId("select-location")).toBeDisabled();
  await page.getByTestId("input-guest-email").fill("test@example.invalid");
  await page.getByTestId("input-phone-number").fill("5550000000");
  await page.getByTestId("button-submit-lead").click();
  await expect(page.getByText("Retry your arrival", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "You're checked in." })).toHaveCount(0);
  await page.getByTestId("button-submit-lead").click();
  await expect(page.getByRole("heading", { name: "You're checked in." })).toBeVisible();
  expect(historySearches).toBe(0);
});
test("no matches and inactive QR give actionable states without guest writes", async ({ page }) => {
  const writes = await guestFixtures(page, { empty: true });
  await page.getByLabel("First or last name").fill("Unknown");
  await expect(page.getByText("No names found", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
});
test("QR-less route and invalid form cannot fall through to an unlinked arrival", async ({ page }) => {
  await page.goto("/rsvp-arrival");
  await expect(page.getByRole("heading", { name: /Open the event QR/i })).toBeVisible();
  await page.route("**/api/rsvp-guest/form-context", (route) => route.fulfill({ status: 410, json: { error: "This form link expired." } }));
  await page.goto(`/guest-check-in?rsvp=${ticketId}`);
  await expect(page.getByRole("alert")).toHaveText("This form link expired.");
  await expect(page.getByTestId("input-guest-email")).toHaveCount(0);
});
test("inactive QR blocks name search", async ({ page }) => {
  await guestFixtures(page, { invalid: true });
  await expect(page.getByRole("alert")).toHaveText("This event QR is not active.");
  await expect(page.getByLabel("First or last name")).toHaveCount(0);
});

test("staff can save venue, download and print the reusable QR without any arrival write", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  let configs = 0;
  let arrived = 0;
  const QRCode = require("qrcode");
  const config = { ...responseData, guestBaseUrl: "https://example.invalid", enabled: true,
    guestUrl: `https://example.invalid/rsvp-arrival#event=${eventToken}`,
    qrCode: await QRCode.toDataURL(`https://example.invalid/rsvp-arrival#event=${eventToken}`),
    referenceSummary: { visits: 283, names: 139, automaticMatches: 3, formRequired: 230 } };
  await page.route("**/api/session", (route) => route.fulfill({ json: { authenticated: true, user: { name: "Test Staff", username: "fixture" } } }));
  await page.route("**/api/rsvp/attendees", (route) => route.fulfill({ json: { eventName: "AUSA 2026", attendees: [] } }));
  await page.route("**/api/rsvp/qr-config", (route) => {
    if (route.request().method() === "POST") configs++;
    return route.fulfill({ json: config });
  });
  await page.route("**/api/rsvp-guest/select", (route) => { arrived++; return route.fulfill({ json: arrival }); });
  await page.goto("/rsvp-check-in");
  await expect(page.getByRole("heading", { name: "RSVP event QR", exact: true })).toBeVisible();
  await expect(page.getByText("QR enabled", { exact: true })).toBeVisible();
  await expect(page.getByText("Live QR", { exact: true })).toHaveCount(0);
  await expect(page.getByAltText("Guest RSVP arrival QR code")).toBeVisible();
  await page.getByRole("button", { name: /Save.*QR|Save settings/i }).click();
  expect(configs).toBe(1);
  await expect(page.getByText(/This does not publish the app; test the guest page/)).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.png$/);
  await page.evaluate(() => {
    const open = window.open.bind(window);
    window.open = (...args) => {
      const popup = open(...args);
      if (popup) popup.print = () => { popup.__printCalled = true; };
      return popup;
    };
  });
  const opened = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Print", exact: true }).click();
  const printPage = await opened;
  await printPage.waitForLoadState("domcontentloaded");
  await expect(printPage.getByAltText("Ace Electronics Defense Systems")).toBeVisible();
  await expect(printPage.getByAltText("Guest RSVP arrival QR code")).toBeVisible();
  await expect(printPage.getByText("Test event venue", { exact: true })).toBeVisible();
  await expect.poll(() => printPage.evaluate(() => !!window.__printCalled)).toBe(true);
  expect(arrived).toBe(0);
});

async function previewAssetsOnGuestHosts(page) {
  // Exercise actual client hostname routing with preview assets, not the stale published bundle.
  const preview = process.env.RSVP_TEST_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
  await page.route(/^https:\/\/(?:aceregistration\.replit\.app|guestflow\.aceelectronics\.com)\//, async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `${preview}${url.pathname}${url.search}`,
      headers: { ...route.request().headers(), host: new URL(preview).host, "x-forwarded-host": new URL(preview).host },
    });
    await route.fulfill({ response });
  });
}

test("public guest hostname shows RSVP selection before any form and preserves the event fragment", async ({ page }) => {
  await previewAssetsOnGuestHosts(page);
  const entryUrl = `https://aceregistration.replit.app/rsvp-arrival#event=${eventToken}`;
  const writes = await guestFixtures(page, { entryUrl });
  await expect(page.getByRole("heading", { name: "Search your name" })).toBeVisible();
  await expect(page.getByTestId("input-guest-email")).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe(`#event=${eventToken}`);
  await page.getByLabel("First or last name").fill("Test");
  await page.getByRole("button", { name: /Confirm arrival/ }).click();
  await expect(page.getByText("Arrival confirmed", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  await page.goto("https://aceregistration.replit.app/rsvp-arrival");
  await expect(page.getByRole("heading", { name: /Open the event QR/i })).toBeVisible();
  await expect(page.getByTestId("input-guest-email")).toHaveCount(0);
  await page.route("**/api/rsvp-guest/context", (route) =>
    route.fulfill({ status: 403, json: { error: "This event QR is not active." } }));
  await page.evaluate((url) => { window.location.href = url; }, entryUrl);
  await expect(page.getByRole("alert")).toHaveText("This event QR is not active.");
  await expect(page.getByTestId("input-guest-email")).toHaveCount(0);
  expect(writes).toHaveLength(1);
});

test("HTTP hostname redirect preserves the QR grant and opens RSVP name selection", async ({ page }) => {
  // The exact canonical Location is checked by the server test. Use a reachable
  // destination here: redirected top-level navigation does not use our asset proxy.
  const preview = process.env.RSVP_TEST_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
  await page.route("https://arrival.aceelectronics.com/**", (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({ status: 301, headers: { location: `${preview}${url.pathname}${url.search}` } });
  });
  const writes = await guestFixtures(page, { entryUrl: `https://arrival.aceelectronics.com/rsvp-arrival?entry=desk#event=${eventToken}` });
  await expect(page.getByRole("heading", { name: "Search your name" })).toBeVisible();
  expect(new URL(page.url()).hostname).toBe(new URL(preview).hostname);
  expect(new URL(page.url()).hash).toBe(`#event=${eventToken}`);
  expect(new URL(page.url()).search).toBe("?entry=desk");
  expect(writes).toHaveLength(0);
});
