import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import express from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { parseVisitorReference, summarizeReference, normalizeRsvpName } from "./rsvpReference";
import type { RsvpGuestResult } from "@shared/rsvpGuest";

after(async () => { const { db } = await import("./db"); await db.$client.end(); });

test("synthetic reference matching retains repeated visits as one identity and excludes unmatched names", () => {
  const parsed = parseVisitorReference(`Full Name,Email,Company\nTest Person,test@example.invalid,A\nTEST  PERSON,test@example.invalid,A\nOther Person,,B`);
  assert.deepEqual(summarizeReference(parsed, [
    { fullName: "Test Person" }, { fullName: "Other Person" }, { fullName: "Unmatched Person" },
  ]), { visits: 3, names: 2, automaticMatches: 1, formRequired: 2 });
  assert.equal(normalizeRsvpName("  TEST    Person "), "test person");
});
test("ambiguous names, missing email, and malformed reference files never become eligible", () => {
  const parsed = parseVisitorReference(`Full Name,Email,Company,Signed In\n Test Person ,TEST@example.invalid,Old,2026-01-01\nTest   Person,test@example.invalid,Current,2026-10-01\nAmbiguous Person,one@example.invalid,A,2026-01-01\nAmbiguous Person,two@example.invalid,B,2026-01-01\nMissing Person,,C,2026-01-01\nMissing Person,known@example.invalid,C,2026-01-01`);
  assert.equal(parsed.visits, 6);
  assert.equal(parsed.names, 3);
  assert.equal(parsed.identities.size, 1);
  assert.deepEqual(parsed.identities.get("test person"), { email: "test@example.invalid", company: "Current" });
  assert.throws(() => parseVisitorReference("Wrong,Header\nx,y"), /Invalid/);
});

test("isolated guest arrivals are atomic, idempotent, revision-safe and scoped without touching real event attendance", async () => {
  const { db } = await import("./db");
  const {
    rsvpAttendees, rsvpGuestEvents, rsvpGuestRequests, rsvpGuestTickets, rsvpCheckInCorrections,
    visitors, leads, customers,
  } = await import("@shared/schema");
  const {
    initializeGuestRsvp, selectQrAttendee, getRsvpFormContext, completeRsvpForm, GuestFlowError,
  } = await import("./rsvpGuestStorage");
  const { registerRsvpGuestRoutes } = await import("./rsvpGuestRoutes");
  const { RSVP_EVENT_KEY } = await import("./rsvpRoster");
  const key = `test-qr-${randomUUID()}`;
  await initializeGuestRsvp();
  const privacy = await db.execute(sql`SELECT relname, relrowsecurity FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relname IN (
      'gf_rsvp_reference_sets', 'gf_rsvp_reference_identities', 'gf_rsvp_guest_events',
      'gf_rsvp_guest_requests', 'gf_rsvp_guest_tickets')`);
  assert.equal(privacy.length, 5);
  assert.ok(privacy.every((row) => row.relrowsecurity === true));
  const access = await db.execute(sql`SELECT count(*) AS exposed FROM pg_roles r,
    unnest(ARRAY['gf_rsvp_reference_sets', 'gf_rsvp_reference_identities', 'gf_rsvp_guest_events',
      'gf_rsvp_guest_requests', 'gf_rsvp_guest_tickets']) AS t(name)
    WHERE r.rolname IN ('anon', 'authenticated') AND has_table_privilege(r.oid, t.name, 'SELECT')`);
  assert.equal(Number(access[0].exposed), 0);
  const realBefore = await db.select().from(rsvpAttendees).where(eq(rsvpAttendees.eventKey, RSVP_EVENT_KEY));
  const [event] = await db.insert(rsvpGuestEvents).values({
    eventKey: key, token: randomBytes(32).toString("hex"), location: "Test AUSA venue",
    guestBaseUrl: "https://example.invalid", enabled: true,
  }).returning();
  const fixtures = ["Returning", "Form", "Ambiguous", "Rollback"].map((name) => ({
    id: randomBytes(32).toString("hex"), eventKey: key, firstName: name,
    lastName: key, fullName: `${name} ${key}`, sourceCategory: "isolated automated test",
  }));
  await db.insert(rsvpAttendees).values(fixtures);
  const ids = fixtures.map((row) => row.id);
  const emails = fixtures.map((_, index) => `${index}-${key}@example.invalid`);
  const identities = new Map([[normalizeRsvpName(fixtures[0].fullName), { email: emails[0], company: "Test company" }],
    [normalizeRsvpName(fixtures[3].fullName), { email: emails[3], company: null }]]);
  const app = express();
  app.use(express.json());
  registerRsvpGuestRoutes(app, (_req, res) => { res.status(401).json({ error: "Sign in required" }); },
    (req, res, next) => {
      if (req.get("x-test-verified") !== "yes") res.status(403).json({ error: "Verification required" });
      else next();
    });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const getFixture = async (index: number) => (await db.select().from(rsvpAttendees).where(eq(rsvpAttendees.id, ids[index])))[0];
  const visitCount = async (index: number) => (await db.select().from(visitors).where(eq(visitors.email, emails[index]))).length;
  const ticketFrom = (result: RsvpGuestResult) => {
    assert.equal(result.status, "form-required");
    if (result.status !== "form-required") throw new Error("Expected form");
    return new URL(result.formUrl, "https://example.invalid").searchParams.get("rsvp")!;
  };
  try {
    assert.equal((await fetch(`${base}/api/rsvp/qr-config`)).status, 401);
    assert.equal((await fetch(`${base}/api/rsvp/qr-config`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    })).status, 401);
    for (const token of ["", "invalid", randomBytes(32).toString("hex")]) {
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      assert.equal((await fetch(`${base}/api/rsvp-guest/context`, { method: "POST", headers, body: "{}" })).status, 403);
      assert.equal((await fetch(`${base}/api/rsvp-guest/search?q=Returning`, { headers })).status, 403);
    }
    assert.equal((await fetch(`${base}/api/rsvp-guest/select`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    })).status, 403);

    const requestId = randomUUID();
    const first = await selectQrAttendee(event, ids[0], requestId, identities);
    assert.equal(first.status, "checked-in");
    const repeated = await selectQrAttendee(event, ids[0], requestId, identities);
    assert.equal(repeated.status, "already-checked-in");
    const rescans = await Promise.all([0, 1, 2].map(() => selectQrAttendee(event, ids[0], randomUUID(), identities)));
    assert.ok(rescans.every((result) => result.status === "already-checked-in"));
    assert.equal(await visitCount(0), 1);
    const attendee = await getFixture(0);
    const [visit] = await db.select().from(visitors).where(eq(visitors.email, emails[0]));
    assert.equal(visit.signedInAt.toISOString(), attendee.checkedInAt?.toISOString());
    assert.equal(visit.location, event.location);
    assert.equal(visit.usCitizen, null);
    assert.equal(visit.documentsAgreed, null);
    assert.equal(visit.phoneNumber, null);
    assert.equal(visit.source, "rsvp-qr");
    assert.equal(attendee.attendanceRevision, 1);
    assert.equal((await db.select().from(leads).where(eq(leads.email, emails[0]))).length, 0);
    await assert.rejects(selectQrAttendee(event, ids[1], requestId, identities), (error: unknown) =>
      error instanceof GuestFlowError && error.status === 409);

    const selection = await selectQrAttendee(event, ids[1], randomUUID(), identities);
    const ticketId = ticketFrom(selection);
    assert.equal((await getFixture(1)).checkedInAt, null);
    assert.equal(await visitCount(1), 0); // Imports, selection and abandoned form are not arrivals.
    const contextResponse = await fetch(`${base}/api/rsvp-guest/form-context`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId }),
    });
    assert.equal(contextResponse.status, 200);
    const context = await contextResponse.json();
    assert.equal(context.fullName, fixtures[1].fullName);
    assert.equal(context.completed, false);
    assert.equal(context.location, event.location);
    assert.equal(context.email, undefined);
    const input = { firstName: fixtures[1].firstName, lastName: fixtures[1].lastName,
      email: emails[1], phoneNumber: "5550000000", title: null, company: "Test form company", acePoc: null };
    await assert.rejects(completeRsvpForm(ticketId, { ...input, firstName: "Different" }), /RSVP name/);
    assert.equal((await getFixture(1)).checkedInAt, null);
    // Inject failure after contact/lead/visit inserts: every table must roll back.
    const originalTransaction = db.transaction;
    try {
      db.transaction = ((callback: any) => originalTransaction.call(db, async (tx) => {
        const update = tx.update.bind(tx);
        tx.update = ((table: any) => {
          if (table === rsvpAttendees) throw new Error("Test injected arrival write failure");
          return update(table);
        }) as typeof tx.update;
        return callback(tx);
      })) as typeof db.transaction;
      await assert.rejects(completeRsvpForm(ticketId, input), /injected/);
    } finally { db.transaction = originalTransaction; }
    assert.equal(await visitCount(1), 0);
    assert.equal((await db.select().from(leads).where(eq(leads.email, emails[1]))).length, 0);
    assert.equal((await db.select().from(customers).where(eq(customers.email, emails[1]))).length, 0);
    assert.equal((await getFixture(1)).checkedInAt, null);

    const formResults = await Promise.all([0, 1, 2].map(() => completeRsvpForm(ticketId, input)));
    assert.equal(formResults.filter((r) => r.status === "checked-in").length, 1);
    assert.equal(formResults.filter((r) => r.status === "already-checked-in").length, 2);
    assert.equal(await visitCount(1), 1);
    const [lead] = await db.select().from(leads).where(eq(leads.email, emails[1]));
    const [formVisitor] = await db.select().from(visitors).where(eq(visitors.email, emails[1]));
    assert.equal(lead.location, event.location);
    assert.equal(lead.submittedAt.toISOString(), formVisitor.signedInAt.toISOString());
    assert.equal(lead.customerId, (await db.select().from(customers).where(eq(customers.email, emails[1])))[0].id);
    assert.equal(formVisitor.signedInAt.toISOString(), (await getFixture(1)).checkedInAt?.toISOString());
    assert.equal((await getRsvpFormContext(ticketId)).completed, true);

    // Correction followed by an uncertain old retry must not record a second arrival.
    await db.update(rsvpAttendees).set({ checkedInAt: null, attendanceRevision: 2 }).where(inArray(rsvpAttendees.id, ids.slice(0, 2)));
    await assert.rejects(selectQrAttendee(event, ids[0], requestId, identities), /corrected by staff/);
    await assert.rejects(completeRsvpForm(ticketId, input), /corrected by staff/);
    await assert.rejects(getRsvpFormContext(ticketId), /corrected by staff/);
    assert.equal((await getFixture(0)).checkedInAt, null);
    assert.equal((await getFixture(1)).checkedInAt, null);
    assert.equal(await visitCount(0), 1);
    assert.equal(await visitCount(1), 1);

    const staleTicket = ticketFrom(await selectQrAttendee(event, ids[2], randomUUID(), identities));
    await db.update(rsvpAttendees).set({ attendanceRevision: 2 }).where(eq(rsvpAttendees.id, ids[2]));
    await assert.rejects(completeRsvpForm(staleTicket, { ...input, firstName: fixtures[2].firstName,
      lastName: fixtures[2].lastName, email: emails[2] }), /Attendance changed/);
    assert.equal(await visitCount(2), 0);
    await db.update(rsvpGuestTickets).set({ expiresAt: new Date(0) }).where(eq(rsvpGuestTickets.id, staleTicket));
    await assert.rejects(getRsvpFormContext(staleTicket), /expired/);
    await db.update(rsvpGuestEvents).set({ enabled: false }).where(eq(rsvpGuestEvents.eventKey, key));
    await assert.rejects(getRsvpFormContext(ticketId), /not active/);
    await assert.rejects(completeRsvpForm(ticketId, input), /not active/);
    await assert.rejects(selectQrAttendee(event, ids[3], randomUUID(), identities), /not active/);
    assert.deepEqual(await db.select().from(rsvpAttendees).where(eq(rsvpAttendees.eventKey, RSVP_EVENT_KEY)), realBefore);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await db.delete(rsvpGuestRequests).where(eq(rsvpGuestRequests.eventKey, key));
    await db.delete(rsvpGuestTickets).where(eq(rsvpGuestTickets.eventKey, key));
    await db.delete(rsvpCheckInCorrections).where(inArray(rsvpCheckInCorrections.attendeeId, ids));
    await db.delete(rsvpAttendees).where(eq(rsvpAttendees.eventKey, key));
    await db.delete(rsvpGuestEvents).where(eq(rsvpGuestEvents.eventKey, key));
    await db.delete(visitors).where(inArray(visitors.email, emails));
    await db.delete(leads).where(inArray(leads.email, emails));
    await db.delete(customers).where(inArray(customers.email, emails));
  }
});
