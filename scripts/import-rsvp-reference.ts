import fs from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { rsvpReferenceIdentities, rsvpReferenceSets } from "../shared/schema";
import { initializeGuestRsvp } from "../server/rsvpGuestStorage";
import { loadRsvpSeed, RSVP_EVENT_KEY } from "../server/rsvpRoster";
import { parseVisitorReference, normalizeRsvpName, summarizeReference } from "../server/rsvpReference";

// Run against the app database using an ignored local source file. Never print contact fields.
async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Provide a local existing-visitor CSV file path.");
  const source = parseVisitorReference(fs.readFileSync(file, "utf8"));
  const roster = loadRsvpSeed();
  const eligibleNames = new Set(roster.map((row) => normalizeRsvpName(row.fullName)));
  const minimalRows = Array.from(source.identities.entries())
    .filter(([name]) => eligibleNames.has(name))
    .map(([normalizedName, identity]) => ({ eventKey: RSVP_EVENT_KEY, normalizedName, ...identity }));
  await initializeGuestRsvp();
  await db.transaction(async (tx) => {
    await tx.delete(rsvpReferenceIdentities).where(eq(rsvpReferenceIdentities.eventKey, RSVP_EVENT_KEY));
    if (minimalRows.length) await tx.insert(rsvpReferenceIdentities).values(minimalRows);
    await tx.insert(rsvpReferenceSets).values({ eventKey: RSVP_EVENT_KEY, visits: source.visits, names: source.names })
      .onConflictDoUpdate({ target: rsvpReferenceSets.eventKey, set: { visits: source.visits, names: source.names } });
  });
  console.log("Private RSVP reference imported (no arrivals created):", summarizeReference(source, roster));
}
main().catch((error) => {
  console.error("Reference import failed:", error instanceof Error ? error.name : "Unknown error");
  process.exitCode = 1;
}).finally(async () => { await db.$client.end(); });
