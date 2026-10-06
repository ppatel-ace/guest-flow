const { test, expect } = require("@playwright/test");

// Isolated browser fixtures: these tests never write real attendance or audit records.
const baseURL = process.env.RSVP_TEST_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
test.use({
  baseURL,
  launchOptions: {
    executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
    args: ["--no-sandbox"],
  },
  viewport: { width: 1440, height: 900 },
});

async function setup(page, options = {}) {
  let polls = 0;
  let expired = false;
  let release;
  const attendees = Array.from({ length: 40 }, (_, i) => ({
    id: `fixture-${i}`, eventKey: "fixture", firstName: "Guest",
    lastName: String(i).padStart(2, "0"), fullName: `Guest ${String(i).padStart(2, "0")}`,
    sourceCategory: "RSVP", plusOneCount: 0, attendanceRevision: 0, checkedInAt: null,
  }));
  // Auth is intercepted only in this test browser; production protection stays untouched.
  await page.route("**/api/session", route => route.fulfill({
    json: { authenticated: true, user: { username: "fixture", name: "Test Staff" } },
  }));
  await page.route("**/api/rsvp/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (expired) return route.fulfill({ status: 401, json: { error: "Staff session expired" } });
    if (path.endsWith("attendance.csv")) return route.fulfill({
      contentType: "text/csv", body: "Full Name,Arrival\nGuest 00,\n",
    });
    if (request.method() === "GET") {
      polls++;
      return route.fulfill({ json: { eventName: "AUSA 2026", attendees } });
    }
    if (options.delayActions) await new Promise(resolve => { release = resolve; });
    const attendee = attendees.find(a => path.includes(`/${a.id}/`));
    if (path.endsWith("undo-check-in")) {
      expect(request.postDataJSON()).toEqual({ confirmed: true, expectedRevision: attendee.attendanceRevision });
      attendee.checkedInAt = null;
    } else attendee.checkedInAt = "2026-10-06T18:00:00.000Z";
    attendee.attendanceRevision++;
    return route.fulfill({ json: attendee });
  });
  await page.goto("/rsvp-check-in");
  await expect(page.getByTestId("attendee-fixture-0")).toBeVisible();
  return {
    polls: () => polls,
    expire: () => { expired = true; },
    release: () => release(),
  };
}

const enter = page => page.getByRole("button", { name: "Full screen", exact: true }).click();
const exit = page => page.getByRole("button", { name: "Exit full screen", exact: true }).click();
async function fallback(page, mode = "denied") {
  await page.evaluate(mode => {
    document.documentElement.requestFullscreen = mode === "unsupported" ? undefined :
      () => Promise.reject(new Error("Fullscreen denied for test"));
  }, mode);
}
async function assertExpanded(page) {
  await expect(page.getByRole("button", { name: "Exit full screen", exact: true })).toBeVisible();
  await expect(page.getByTestId("button-sidebar-toggle")).toBeHidden();
  await expect(page.getByTestId("app-version-footer")).toBeHidden();
  await expect(page.locator('[data-slot="sidebar"]')).toHaveCount(0);
  expect(await page.getByTestId("page-rsvp-check-in").evaluate(el => el.getBoundingClientRect().width))
    .toBeGreaterThan((await page.evaluate(() => innerWidth)) - 60);
}
async function assertNormal(page) {
  await expect(page.getByRole("button", { name: "Full screen", exact: true })).toBeVisible();
  await expect(page.getByTestId("button-sidebar-toggle")).toBeVisible();
  await expect(page.getByTestId("app-version-footer")).toBeVisible();
}

test("native browser fullscreen exits restore the mounted roster and search", async ({ page }) => {
  await setup(page);
  await page.getByRole("combobox", { name: "Find an attendee" }).fill("Guest 00");
  await page.getByRole("option", { name: "Guest 00" }).click();
  await enter(page);
  await assertExpanded(page);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
  // A browser exit (including Escape) emits this same fullscreenchange event.
  await page.evaluate(() => document.exitFullscreen());
  await assertNormal(page);
  await expect(page.getByRole("combobox", { name: "Find an attendee" })).toHaveValue("Guest 00");
  await expect(page.getByTestId("attendee-fixture-0")).toBeVisible();
  await expect(page.getByTestId("attendee-fixture-1")).toHaveCount(0);
  await enter(page);
  await exit(page);
  await assertNormal(page);
});

for (const mode of ["unsupported", "denied"]) {
  test(`${mode} fullscreen has working in-app exit and restores other pages`, async ({ page }) => {
    await setup(page);
    await fallback(page, mode);
    await page.getByRole("combobox", { name: "Find an attendee" }).fill("Guest");
    await enter(page);
    await assertExpanded(page);
    await page.getByRole("combobox", { name: "Find an attendee" }).focus();
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.getByRole("option", { name: "Guest 00", exact: true }).click();
    await exit(page);
    await expect(page.getByRole("combobox", { name: "Find an attendee" })).toHaveValue("Guest 00");
    await assertNormal(page);
    await enter(page);
    await page.evaluate(() => { history.pushState({}, "", "/import"); window.dispatchEvent(new PopStateEvent("popstate")); });
    await expect(page.getByTestId("button-sidebar-toggle")).toBeVisible();
    await expect(page.getByTestId("app-version-footer")).toBeVisible();
    await page.evaluate(() => { history.pushState({}, "", "/rsvp-check-in"); window.dispatchEvent(new PopStateEvent("popstate")); });
    await assertNormal(page);
  });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
  test(`touch-friendly scrolling and undo dialog at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await setup(page);
    await fallback(page);
    await enter(page);
    await assertExpanded(page);
    await page.getByTestId("button-check-in-fixture-0").click();
    await page.getByTestId("button-undo-check-in-fixture-0").click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    const accessible = await dialog.evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });
    expect(accessible).toBe(true);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByTestId("button-undo-check-in-fixture-0")).toBeVisible();
    await page.getByTestId("admin-main").evaluate(el => { el.scrollTop = el.scrollHeight; });
    const exitButton = page.getByRole("button", { name: "Exit full screen", exact: true });
    const box = await exitButton.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThan(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/rsvp-expanded-${viewport.width}.png` });
    await exit(page);
    await assertNormal(page);
  });
}

test("pending check-in, confirmed undo, polling, exports and session expiry work in both layouts", async ({ page }) => {
  const fixture = await setup(page, { delayActions: true });
  await fallback(page);
  await page.getByTestId("button-check-in-fixture-0").click();
  await expect(page.getByTestId("button-check-in-fixture-0")).toHaveText("Saving…");
  await enter(page);
  await expect(page.getByTestId("button-check-in-fixture-0")).toBeDisabled();
  fixture.release();
  await expect(page.getByTestId("button-undo-check-in-fixture-0")).toBeVisible();
  await page.getByTestId("button-undo-check-in-fixture-0").click();
  await page.getByRole("button", { name: "Confirm undo" }).click();
  await expect(page.getByRole("button", { name: "Undoing…" })).toBeVisible();
  // Modal is deliberately blocking, so dispatch the mode toggle without dismissing it.
  await page.getByRole("button", { name: "Exit full screen", exact: true, includeHidden: true }).dispatchEvent("click");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  fixture.release();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(page.getByTestId("button-check-in-fixture-0")).toBeVisible();
  const before = fixture.polls();
  await expect.poll(fixture.polls, { timeout: 8000 }).toBeGreaterThan(before);
  for (const scope of ["all", "arrivals"]) {
    if (scope === "arrivals") await enter(page);
    await page.getByLabel("Download attendance").selectOption(scope);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download CSV" }).click();
    expect((await download).suggestedFilename()).toBe(`ausa-2026-attendance-${scope}.csv`);
  }
  fixture.expire();
  await expect(page.getByText("Staff session expired", { exact: true })).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId("button-check-in-fixture-0")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Download CSV" })).toBeDisabled();
  await exit(page);
  await expect(page.getByTestId("button-check-in-fixture-0")).toBeDisabled();
});

test("late native requests cannot re-enter expanded mode after exit or navigation", async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    document.documentElement.requestFullscreen = () => new Promise(resolve => {
      window.finishFullscreen = () => {
        Object.defineProperty(document, "fullscreenElement", { configurable: true, value: document.documentElement });
        document.dispatchEvent(new Event("fullscreenchange"));
        resolve();
      };
    });
    document.exitFullscreen = async () => {
      Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
      document.dispatchEvent(new Event("fullscreenchange"));
    };
  });
  await enter(page);
  await exit(page);
  await page.evaluate(() => window.finishFullscreen());
  await assertNormal(page);
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  await enter(page);
  await page.evaluate(() => { history.pushState({}, "", "/import"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await expect(page.getByTestId("button-sidebar-toggle")).toBeVisible();
  await page.evaluate(() => window.finishFullscreen());
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
});
