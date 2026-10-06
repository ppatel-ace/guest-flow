import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import express from "express";
import XLSX from "xlsx";
import Papa from "papaparse";
import { eq } from "drizzle-orm";
import { parseRsvpWorkbook, RSVP_WORKBOOK, loadRsvpSeed, RSVP_EVENT_KEY } from "./rsvpRoster";
import type { AceAuthRequest } from "./aceSso";

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
  const { rsvpAttendees, rsvpCheckInCorrections } = await import("@shared/schema");
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
  app.use(express.json());
  registerRsvpRoutes(app, (req, res, next) => {
    // Test-only middleware on a separate in-process server. Never used by the app.
    if (req.get("x-test-staff") === "yes") {
      if (!req.get("x-test-no-identity")) {
        (req as AceAuthRequest).user = { id: "test-staff", email: "test@example.invalid", name: "Test Staff" };
      }
      next();
    }
    else res.status(401).json({ error: "Unauthorized" });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { "x-test-staff": "yes" };
  const checkInUrl = `${base}/api/rsvp/attendees/${id}/check-in`;
  const undoUrl = `${base}/api/rsvp/attendees/${id}/undo-check-in`;
  const exportUrl = `${base}/api/rsvp/attendance.csv`;
  const parseExport = async (response: Response) =>
    Papa.parse<Record<string, string>>(await response.text(), { header: true, skipEmptyLines: true }).data;
  try {
    const deniedExport = await fetch(exportUrl);
    assert.equal(deniedExport.status, 401);
    assert.equal(deniedExport.headers.get("cache-control"), "private, no-store");
    assert.equal(deniedExport.headers.get("content-disposition"), null);
    for (const query of ["scope=invalid", "scope=all&scope=arrivals", "scope[x]=all"]) {
      assert.equal((await fetch(`${exportUrl}?${query}`, { headers })).status, 400);
    }
    const beforeExport = await fetch(exportUrl, { headers });
    assert.equal(beforeExport.status, 200);
    assert.equal(beforeExport.headers.get("cache-control"), "private, no-store");
    assert.equal(beforeExport.headers.get("content-type"), "text/csv; charset=utf-8");
    assert.equal(beforeExport.headers.get("x-content-type-options"), "nosniff");
    assert.equal(beforeExport.headers.get("content-disposition"), 'attachment; filename="ausa-2026-attendance-all.csv"');
    const allBefore = await parseExport(beforeExport);
    assert.equal(allBefore.length, 234);
    assert.equal(allBefore.find((row) => row["Full name"] === fixture.fullName)?.["Checked-in status"], "Not checked in");
    assert.ok(!(await parseExport(await fetch(`${exportUrl}?scope=arrivals`, { headers })))
      .some((row) => row["Full name"] === fixture.fullName));
    const originalSelect = db.select;
    try {
      db.select = () => { throw new Error("Simulated export database failure"); };
      const failedExport = await fetch(exportUrl, { headers });
      assert.equal(failedExport.status, 503);
      assert.equal(failedExport.headers.get("content-disposition"), null);
      assert.deepEqual(await failedExport.json(), { error: "Unable to download RSVP attendance. Please try again." });
    } finally {
      db.select = originalSelect;
    }
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
    // Exercise simultaneous arrivals without exhausting the shared session pool.
    const responses = await Promise.all(Array.from({ length: 3 }, () => fetch(checkInUrl, { method: "POST", headers })));
    assert.ok(responses.every((r) => r.status === 200));
    const attendees = await Promise.all(responses.map((r) => r.json())) as Array<{ checkedInAt: string }>;
    const timestamp = attendees[0].checkedInAt;
    assert.ok(timestamp);
    assert.ok(attendees.every((r) => r.checkedInAt === timestamp));
    await db.insert(rsvpAttendees).values([fixture, ...loadRsvpSeed()]).onConflictDoNothing();
    const [persisted] = await db.select().from(rsvpAttendees).where(eq(rsvpAttendees.id, id));
    assert.equal(persisted.checkedInAt?.toISOString(), timestamp);
    for (const scope of ["all", "arrivals"]) {
      const response = await fetch(`${exportUrl}?scope=${scope}`, { headers });
      assert.equal(response.status, 200);
      const exported = await parseExport(response);
      const row = exported.find((item) => item["Full name"] === fixture.fullName);
      assert.equal(row?.["Checked-in status"], "Checked in");
      assert.equal(row?.["First arrival timestamp (UTC)"], timestamp);
      assert.equal(row?.["Source plus-one count (metadata only; not checked-in guests)"], "0");
      if (scope === "arrivals") assert.ok(exported.every((item) => item["First arrival timestamp (UTC)"]));
    }
    const repeated = await fetch(checkInUrl, { method: "POST", headers });
    assert.equal((await repeated.json() as { checkedInAt: string }).checkedInAt, timestamp);
    assert.equal((await fetch(`${base}/api/rsvp/attendees/${"f".repeat(64)}/check-in`, { method: "POST", headers })).status, 404);
    assert.equal((await fetch(`${base}/api/rsvp/attendees/invalid/check-in`, { method: "POST", headers })).status, 400);
    const undo = (body: unknown, extraHeaders = {}) => fetch(undoUrl, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify(body),
    });
    const revision = persisted.attendanceRevision;
    const undoBody = { confirmed: true, expectedRevision: revision, correctedBy: "spoofed-staff" };
    assert.equal((await fetch(undoUrl, { method: "POST" })).status, 401);
    assert.equal((await undo(undoBody, { "x-test-no-identity": "yes" })).status, 403);
    for (const body of [
      {}, { expectedRevision: revision }, { confirmed: false, expectedRevision: revision },
      { confirmed: true, expectedRevision: -1 }, { confirmed: true, expectedRevision: "1" },
      { confirmed: true, expectedRevision: 1.5 },
    ]) assert.equal((await undo(body)).status, 400);
    assert.equal((await undo({ confirmed: true, expectedRevision: revision + 1 })).status, 409);
    // Fail after the audit insert but before the attendance update; both must roll back.
    const originalTransaction = db.transaction;
    try {
      db.transaction = ((callback: any) => originalTransaction.call(db, async (tx) => {
        tx.update = () => { throw new Error("Simulated correction update failure"); };
        return callback(tx);
      })) as typeof db.transaction;
      assert.equal((await undo(undoBody)).status, 503);
    } finally {
      db.transaction = originalTransaction;
    }
    assert.equal((await db.select().from(rsvpCheckInCorrections)
      .where(eq(rsvpCheckInCorrections.attendeeId, id))).length, 0);
    const [unchanged] = await db.select().from(rsvpAttendees).where(eq(rsvpAttendees.id, id));
    assert.equal(unchanged.checkedInAt?.toISOString(), timestamp);
    assert.equal(unchanged.attendanceRevision, revision);
    const otherAttendance = (await listRsvpAttendees()).filter((item) => item.id !== id);
    const corrections = await Promise.all([undo(undoBody), undo(undoBody)]);
    assert.deepEqual(corrections.map((response) => response.status).sort(), [200, 409]);
    const corrected = await corrections.find((response) => response.status === 200)!.json();
    assert.equal(corrected.checkedInAt, null);
    assert.equal(corrected.attendanceRevision, revision + 1);
    const audits = await db.select().from(rsvpCheckInCorrections)
      .where(eq(rsvpCheckInCorrections.attendeeId, id));
    assert.equal(audits.length, 1);
    assert.equal(audits[0].priorArrivalAt.toISOString(), timestamp);
    assert.equal(audits[0].priorRevision, revision);
    assert.equal(audits[0].correctedBy, "test-staff");
    assert.ok(audits[0].correctedAt.getTime() >= persisted.checkedInAt!.getTime());
    assert.deepEqual((await listRsvpAttendees()).filter((item) => item.id !== id), otherAttendance);
    assert.equal((await undo(undoBody)).status, 409);
    const refreshedRoster = await (await fetch(`${base}/api/rsvp/attendees`, { headers })).json();
    assert.equal(refreshedRoster.attendees.find((item: { id: string }) => item.id === id).checkedInAt, null);
    assert.ok(!(await parseExport(await fetch(`${exportUrl}?scope=arrivals`, { headers })))
      .some((row) => row["Full name"] === fixture.fullName));
    // A stale undo must not erase a new arrival after an undo/re-check-in cycle.
    const newArrival = await (await fetch(checkInUrl, { method: "POST", headers })).json();
    assert.equal(newArrival.attendanceRevision, revision + 2);
    assert.equal((await undo(undoBody)).status, 409);
    assert.equal((await undo({ confirmed: true, expectedRevision: newArrival.attendanceRevision })).status, 200);
    assert.equal((await db.select().from(rsvpCheckInCorrections)
      .where(eq(rsvpCheckInCorrections.attendeeId, id))).length, 2);
    for (const [attendeeId, status] of [["f".repeat(64), 404], ["invalid", 400]] as const) {
      assert.equal((await fetch(`${base}/api/rsvp/attendees/${attendeeId}/undo-check-in`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(undoBody),
      })).status, status);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await db.delete(rsvpCheckInCorrections).where(eq(rsvpCheckInCorrections.attendeeId, id));
    await db.delete(rsvpAttendees).where(eq(rsvpAttendees.id, id));
  }
  assert.equal((await listRsvpAttendees()).length, 233);
});
