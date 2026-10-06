import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import express from "express";
import XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { parseRsvpWorkbook, RSVP_WORKBOOK, loadRsvpSeed, RSVP_EVENT_KEY } from "./rsvpRoster";

after(async () => {
  const { db } = await import("./db");
  await db.$client.end();
});

test("source roster preserves all 233 named entries and source metadata", () => {
  const rows = loadRsvpSeed();
  assert.equal(rows.length, 233);
  assert.equal(new Set(rows.map((r) => r.id)).size, 233);
  assert.equal(rows.filter((r) => !r.firstName).length, 2);
  assert.equal(rows.filter((r) => r.sourceCategory === "RSVP notes").length, 25);
  assert.equal(rows.filter((r) => r.sourceCategory === "Added per request").length, 1);
  assert.equal(rows.reduce((n, r) => n + r.plusOneCount, 0), 29);
  assert.ok(rows.every((r) => r.fullName && r.eventKey === RSVP_EVENT_KEY));
});

test("name identities are stable and summary rows are not attendees", () => {
  const buffer = fs.readFileSync(RSVP_WORKBOOK);
  const rows = parseRsvpWorkbook(buffer);
  assert.deepEqual(parseRsvpWorkbook(buffer), rows);
  assert.ok(!rows.some((r) => /current total|^24$/.test(r.fullName)));
});

test("malformed workbooks fail explicitly rather than seeding a partial roster", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["wrong columns"]]), "Accepted Attendees");
  assert.throws(() => parseRsvpWorkbook(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })), /name columns/);
});

test("authenticated API, persistent storage, concurrency and safe reimport", async () => {
  const { db } = await import("./db");
  const { rsvpAttendees } = await import("@shared/schema");
  const { initializeRsvpRoster, listRsvpAttendees } = await import("./rsvpStorage");
  const { registerRsvpRoutes } = await import("./rsvpRoutes");
  await initializeRsvpRoster();
  assert.equal((await listRsvpAttendees()).length, 233);
  const id = randomBytes(32).toString("hex");
  const fixture = {
    id, eventKey: RSVP_EVENT_KEY, firstName: "Test", lastName: "Fixture",
    fullName: "Test Fixture", sourceCategory: "automated test", plusOneCount: 0,
  };
  await db.insert(rsvpAttendees).values(fixture);
  const app = express();
  registerRsvpRoutes(app, (req, res, next) => {
    // Test-only middleware on a separate in-process server. Never used by the app.
    if (req.get("x-test-staff") === "yes") next();
    else res.status(401).json({ error: "Unauthorized" });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { "x-test-staff": "yes" };
  const checkInUrl = `${base}/api/rsvp/attendees/${id}/check-in`;
  try {
    assert.equal((await fetch(`${base}/api/rsvp/attendees`)).status, 401);
    assert.equal((await fetch(checkInUrl, { method: "POST" })).status, 401);
    const rosterResponse = await fetch(`${base}/api/rsvp/attendees`, { headers });
    assert.equal(rosterResponse.status, 200);
    assert.equal(rosterResponse.headers.get("cache-control"), "private, no-store");
    const roster = await rosterResponse.json() as { attendees: unknown[] };
    assert.equal(roster.attendees.length, 234);
    const originalUpdate = db.update;
    try {
      db.update = () => { throw new Error("Simulated database write failure"); };
      const failed = await fetch(checkInUrl, { method: "POST", headers });
      assert.equal(failed.status, 503);
      assert.deepEqual(await failed.json(), { error: "Unable to save check-in. Please try again." });
    } finally {
      db.update = originalUpdate;
    }
    const [beforeRetry] = await db.select().from(rsvpAttendees).where(eq(rsvpAttendees.id, id));
    assert.equal(beforeRetry.checkedInAt, null);
    const responses = await Promise.all(Array.from({ length: 8 }, () => fetch(checkInUrl, { method: "POST", headers })));
    assert.ok(responses.every((r) => r.status === 200));
    const attendees = await Promise.all(responses.map((r) => r.json())) as Array<{ checkedInAt: string }>;
    const timestamp = attendees[0].checkedInAt;
    assert.ok(timestamp);
    assert.ok(attendees.every((r) => r.checkedInAt === timestamp));
    await db.insert(rsvpAttendees).values([fixture, ...loadRsvpSeed()]).onConflictDoNothing();
    const [persisted] = await db.select().from(rsvpAttendees).where(eq(rsvpAttendees.id, id));
    assert.equal(persisted.checkedInAt?.toISOString(), timestamp);
    const repeated = await fetch(checkInUrl, { method: "POST", headers });
    assert.equal((await repeated.json() as { checkedInAt: string }).checkedInAt, timestamp);
    assert.equal((await fetch(`${base}/api/rsvp/attendees/${"f".repeat(64)}/check-in`, { method: "POST", headers })).status, 404);
    assert.equal((await fetch(`${base}/api/rsvp/attendees/invalid/check-in`, { method: "POST", headers })).status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await db.delete(rsvpAttendees).where(eq(rsvpAttendees.id, id));
  }
  assert.equal((await listRsvpAttendees()).length, 233);
});
