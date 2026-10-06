import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { rsvpAttendees } from "@shared/schema";
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

export async function listRsvpAttendees() {
  await initializeRsvpRoster();
  return db.select().from(rsvpAttendees)
    .where(eq(rsvpAttendees.eventKey, RSVP_EVENT_KEY))
    .orderBy(sql`lower(${rsvpAttendees.lastName})`, sql`lower(${rsvpAttendees.firstName})`);
}

export async function checkInRsvpAttendee(id: string) {
  await initializeRsvpRoster();
  // PostgreSQL row locking + COALESCE retains the original timestamp under retries/concurrency.
  const [attendee] = await db.update(rsvpAttendees)
    .set({ checkedInAt: sql`COALESCE(${rsvpAttendees.checkedInAt}, now())` })
    .where(and(eq(rsvpAttendees.id, id), eq(rsvpAttendees.eventKey, RSVP_EVENT_KEY)))
    .returning();
  return attendee;
}
