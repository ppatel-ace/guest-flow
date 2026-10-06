import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "./db";
import { rsvpAttendees, rsvpCheckInCorrections } from "@shared/schema";
import { loadRsvpSeed, RSVP_EVENT_KEY } from "./rsvpRoster";

// Same database connection as all application queries. Safe to retry after outages.
let initialization: Promise<void> | undefined;
export function initializeRsvpRoster(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      const seed = loadRsvpSeed();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS gf_rsvp_attendees (
          id varchar PRIMARY KEY,
          event_key text NOT NULL,
          first_name text NOT NULL,
          last_name text NOT NULL,
          full_name text NOT NULL,
          source_category text NOT NULL DEFAULT '',
          plus_one_count integer NOT NULL DEFAULT 0 CHECK (plus_one_count >= 0),
          checked_in_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`ALTER TABLE gf_rsvp_attendees
        ADD COLUMN IF NOT EXISTS attendance_revision integer NOT NULL DEFAULT 0`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS gf_rsvp_check_in_corrections (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          attendee_id varchar NOT NULL REFERENCES gf_rsvp_attendees(id),
          prior_arrival_at timestamptz NOT NULL,
          prior_revision integer NOT NULL,
          corrected_by text NOT NULL,
          corrected_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      // Never update existing records: reimports cannot reset first arrival time.
      await db.insert(rsvpAttendees).values(seed).onConflictDoNothing();
      console.log(`[rsvp] ${seed.length} source attendees loaded; existing check-ins preserved`);
    })().catch((error) => {
      initialization = undefined;
      throw error;
    });
  }
  return initialization;
}

export async function listRsvpAttendees(arrivalsOnly = false) {
  await initializeRsvpRoster();
  return db.select().from(rsvpAttendees)
    .where(and(
      eq(rsvpAttendees.eventKey, RSVP_EVENT_KEY),
      arrivalsOnly ? isNotNull(rsvpAttendees.checkedInAt) : undefined,
    ))
    .orderBy(sql`lower(${rsvpAttendees.lastName})`, sql`lower(${rsvpAttendees.firstName})`);
}

export async function checkInRsvpAttendee(id: string) {
  await initializeRsvpRoster();
  // PostgreSQL row locking + COALESCE retains the original timestamp under retries/concurrency.
  const [attendee] = await db.update(rsvpAttendees)
    .set({
      checkedInAt: sql`COALESCE(${rsvpAttendees.checkedInAt}, now())`,
      attendanceRevision: sql`CASE WHEN ${rsvpAttendees.checkedInAt} IS NULL
        THEN ${rsvpAttendees.attendanceRevision} + 1 ELSE ${rsvpAttendees.attendanceRevision} END`,
    })
    .where(and(eq(rsvpAttendees.id, id), eq(rsvpAttendees.eventKey, RSVP_EVENT_KEY)))
    .returning();
  return attendee;
}

export async function undoRsvpCheckIn(id: string, expectedRevision: number, staffId: string) {
  await initializeRsvpRoster();
  return db.transaction(async (tx) => {
    // Lock the same row check-in updates use. Audit and correction commit together.
    const [prior] = await tx.select().from(rsvpAttendees)
      .where(and(eq(rsvpAttendees.id, id), eq(rsvpAttendees.eventKey, RSVP_EVENT_KEY)))
      .for("update");
    if (!prior) return { status: "not-found" } as const;
    if (!prior.checkedInAt || prior.attendanceRevision !== expectedRevision) {
      return { status: "conflict" } as const;
    }
    // Insert from the stored row to preserve PostgreSQL's full timestamp precision.
    await tx.execute(sql`
      INSERT INTO ${rsvpCheckInCorrections}
        (attendee_id, prior_arrival_at, prior_revision, corrected_by)
      SELECT id, checked_in_at, attendance_revision, ${staffId}
      FROM ${rsvpAttendees} WHERE id = ${id}
    `);
    const [attendee] = await tx.update(rsvpAttendees)
      .set({ checkedInAt: null, attendanceRevision: prior.attendanceRevision + 1 })
      .where(eq(rsvpAttendees.id, id)).returning();
    return { status: "corrected", attendee } as const;
  });
}
