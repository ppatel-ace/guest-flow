import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  rsvpGuestEvents, rsvpGuestRequests, rsvpGuestTickets, rsvpAttendees,
  visitors, leads, customers, type InsertLead,
} from "@shared/schema";
import type { RsvpFormContext, RsvpGuestResult } from "@shared/rsvpGuest";
import { initializeRsvpRoster } from "./rsvpStorage";
import { RSVP_EVENT_KEY, RSVP_EVENT_NAME } from "./rsvpRoster";
import { getVisitorReference, normalizeRsvpName } from "./rsvpReference";

export class GuestFlowError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let initialization: Promise<void> | undefined;
export function initializeGuestRsvp() {
  return initialization ??= (async () => {
    await initializeRsvpRoster();
    for (const name of ["0013_rsvp_guest_qr.sql", "0014_private_rsvp_reference.sql"]) {
      const migration = fs.readFileSync(path.join(process.cwd(), "migrations", name), "utf8");
      for (const statement of migration.split("--> statement-breakpoint")) await db.execute(sql.raw(statement));
    }
  })().catch((error) => { initialization = undefined; throw error; });
}

export async function getQrEvent(eventKey = RSVP_EVENT_KEY) {
  await initializeGuestRsvp();
  const [event] = await db.select().from(rsvpGuestEvents).where(eq(rsvpGuestEvents.eventKey, eventKey));
  return event;
}

export async function configureQrEvent(input: { location: string; guestBaseUrl: string; enabled: boolean }) {
  await initializeGuestRsvp();
  const [event] = await db.insert(rsvpGuestEvents).values({
    eventKey: RSVP_EVENT_KEY, token: randomBytes(32).toString("hex"), ...input,
  }).onConflictDoUpdate({ target: rsvpGuestEvents.eventKey, set: input }).returning();
  return event;
}

export async function requireQrEvent(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new GuestFlowError(403, "Open the event QR link to check in.");
  const event = await getQrEvent();
  if (!event?.enabled || event.token !== token) throw new GuestFlowError(403, "This event QR is not active. Please ask the event staff.");
  return event;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Attendee = typeof rsvpAttendees.$inferSelect;
type Event = typeof rsvpGuestEvents.$inferSelect;
type FormInput = Pick<InsertLead, "title" | "firstName" | "lastName" | "email" | "phoneNumber" | "company" | "acePoc">;
type ArrivalResult = Extract<RsvpGuestResult, { checkedInAt: string }>;

async function arrival(tx: Tx, attendee: Attendee, location: string, input: {
  email: string; company: string | null; form?: FormInput;
}): Promise<ArrivalResult> {
  if (attendee.checkedInAt) {
    return { status: "already-checked-in", fullName: attendee.fullName, checkedInAt: attendee.checkedInAt.toISOString() };
  }
  const now = new Date();
  // A returning visitor is not a new invitation. Update an existing contact if present.
  let [customer] = await tx.select().from(customers).where(sql`lower(${customers.email}) = ${input.email}`).limit(1);
  if (input.form && !customer) {
    [customer] = await tx.insert(customers).values({
      name: attendee.fullName, email: input.email, phone: input.form.phoneNumber,
      status: "checked-in", qrCode: randomUUID(), checkedInAt: now,
    }).onConflictDoNothing().returning();
    if (!customer) [customer] = await tx.select().from(customers).where(eq(customers.email, input.email)).limit(1);
  }
  if (customer) await tx.update(customers).set({ status: "checked-in", checkedInAt: now }).where(eq(customers.id, customer.id));
  if (input.form) {
    await tx.insert(leads).values({
      ...input.form, email: input.email, customerId: customer?.id,
      eventName: RSVP_EVENT_NAME, location, submittedAt: now,
    });
  }
  await tx.insert(visitors).values({
    fullName: attendee.fullName, email: input.email, company: input.company,
    phoneNumber: input.form?.phoneNumber ?? null, acePoc: input.form?.acePoc ?? null,
    location, source: "rsvp-qr", signedInAt: now, signedOutAt: null,
    // No historical citizenship, consent, purpose, or previous-arrival facts are copied.
  });
  await tx.update(rsvpAttendees).set({
    checkedInAt: now, attendanceRevision: attendee.attendanceRevision + 1,
  }).where(eq(rsvpAttendees.id, attendee.id));
  return { status: "checked-in", fullName: attendee.fullName, checkedInAt: now.toISOString() };
}

function replayArrival(result: RsvpGuestResult, attendee: Attendee): RsvpGuestResult {
  if (result.status === "form-required") return result;
  if (attendee.checkedInAt?.toISOString() !== result.checkedInAt) {
    throw new GuestFlowError(409, "Your earlier arrival was corrected by staff. Scan the QR and make a new selection.");
  }
  return { ...result, status: "already-checked-in" };
}

export async function selectQrAttendee(event: Event, attendeeId: string, requestId: string,
  identities?: Map<string, { email: string; company: string | null }>): Promise<RsvpGuestResult> {
  await initializeGuestRsvp();
  const eligibleIdentities = identities ?? (await getVisitorReference()).identities;
  // Resolve eligibility only from the supplied snapshot, never from all database contacts.
  return db.transaction(async (tx) => {
    const [activeEvent] = await tx.select().from(rsvpGuestEvents)
      .where(eq(rsvpGuestEvents.eventKey, event.eventKey)).for("share");
    if (!activeEvent?.enabled || activeEvent.token !== event.token) {
      throw new GuestFlowError(403, "This event QR is not active. Please ask the event staff.");
    }
    const [attendee] = await tx.select().from(rsvpAttendees)
      .where(and(eq(rsvpAttendees.id, attendeeId), eq(rsvpAttendees.eventKey, event.eventKey))).for("update");
    if (!attendee) throw new GuestFlowError(404, "That RSVP name could not be found. Please search again.");
    const [saved] = await tx.select().from(rsvpGuestRequests).where(eq(rsvpGuestRequests.requestId, requestId));
    if (saved) {
      if (saved.attendeeId !== attendeeId || saved.eventKey !== event.eventKey) throw new GuestFlowError(409, "Please start a new name selection.");
      return replayArrival(saved.result, attendee);
    }
    const identity = eligibleIdentities.get(normalizeRsvpName(attendee.fullName));
    let result: RsvpGuestResult;
    if (attendee.checkedInAt) {
      result = { status: "already-checked-in", fullName: attendee.fullName, checkedInAt: attendee.checkedInAt.toISOString() };
    } else if (identity) {
      result = await arrival(tx, attendee, activeEvent.location, identity);
    } else {
      const [ticket] = await tx.insert(rsvpGuestTickets).values({
        id: randomBytes(32).toString("hex"), eventKey: event.eventKey, attendeeId,
        expectedRevision: attendee.attendanceRevision, location: activeEvent.location,
        expiresAt: new Date(Date.now() + 45 * 60 * 1000),
      }).returning();
      result = { status: "form-required", formUrl: `/guest-check-in?rsvp=${ticket.id}#event=${event.token}` };
    }
    await tx.insert(rsvpGuestRequests).values({ requestId, eventKey: event.eventKey, attendeeId, result });
    return result;
  });
}

function validateTicket(ticket: typeof rsvpGuestTickets.$inferSelect | undefined) {
  if (!ticket) throw new GuestFlowError(404, "This form link is invalid. Scan the event QR to start again.");
  if (ticket.expiresAt.getTime() < Date.now()) throw new GuestFlowError(410, "This form link expired. Scan the event QR to start again.");
  return ticket;
}
export async function getRsvpFormContext(ticketId: string): Promise<RsvpFormContext> {
  await initializeGuestRsvp();
  const [row] = await db.select().from(rsvpGuestTickets).where(eq(rsvpGuestTickets.id, ticketId));
  const ticket = validateTicket(row);
  const event = await getQrEvent(ticket.eventKey);
  if (!event?.enabled || event.eventKey !== ticket.eventKey) throw new GuestFlowError(403, "Event check-in is not active. Please ask staff.");
  const [attendee] = await db.select().from(rsvpAttendees).where(and(
    eq(rsvpAttendees.id, ticket.attendeeId), eq(rsvpAttendees.eventKey, ticket.eventKey),
  ));
  if (!attendee) throw new GuestFlowError(404, "This RSVP name could not be found. Please ask staff.");
  if (ticket.completedResult) replayArrival(ticket.completedResult, attendee);
  if (!ticket.completedResult && attendee.attendanceRevision !== ticket.expectedRevision && !attendee.checkedInAt) {
    throw new GuestFlowError(409, "Attendance changed. Scan the event QR to start again.");
  }
  return {
    ticketId, eventName: RSVP_EVENT_NAME, location: ticket.location,
    fullName: attendee.fullName, firstName: attendee.firstName, lastName: attendee.lastName,
    completed: !!ticket.completedResult || !!attendee.checkedInAt,
  };
}

export async function completeRsvpForm(ticketId: string, input: FormInput) {
  await initializeGuestRsvp();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(rsvpGuestTickets).where(eq(rsvpGuestTickets.id, ticketId)).for("update");
    const ticket = validateTicket(row);
    const [event] = await tx.select().from(rsvpGuestEvents).where(eq(rsvpGuestEvents.eventKey, ticket.eventKey)).for("share");
    if (!event?.enabled) throw new GuestFlowError(403, "Event check-in is not active. Please ask staff.");
    const [attendee] = await tx.select().from(rsvpAttendees).where(and(
      eq(rsvpAttendees.id, ticket.attendeeId), eq(rsvpAttendees.eventKey, ticket.eventKey),
    )).for("update");
    if (!attendee) throw new GuestFlowError(404, "RSVP name not found.");
    // An uncertain form retry must not undo a later staff correction/re-arrival.
    if (ticket.completedResult) return replayArrival(ticket.completedResult, attendee);
    if (normalizeRsvpName(`${input.firstName} ${input.lastName}`) !== normalizeRsvpName(attendee.fullName)) {
      throw new GuestFlowError(400, "Please use the RSVP name shown on this form. Ask staff if it needs correcting.");
    }
    if (!attendee.checkedInAt && attendee.attendanceRevision !== ticket.expectedRevision) {
      throw new GuestFlowError(409, "Attendance changed. Scan the event QR to start again.");
    }
    const result = await arrival(tx, attendee, ticket.location, { email: input.email, company: input.company ?? null, form: input });
    await tx.update(rsvpGuestTickets).set({ completedResult: result }).where(eq(rsvpGuestTickets.id, ticketId));
    return result;
  });
}
