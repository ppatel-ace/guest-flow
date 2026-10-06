import Papa from "papaparse";
import { loadRsvpSeed } from "./rsvpRoster";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { rsvpReferenceSets, rsvpReferenceIdentities } from "@shared/schema";
import { RSVP_EVENT_KEY } from "./rsvpRoster";

export const normalizeRsvpName = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
export type ReferenceIdentity = { email: string; company: string | null };

export function parseVisitorReference(csv: string) {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: "greedy" });
  if (parsed.errors.length || !["Full Name", "Email", "Company"].every((column) => parsed.meta.fields?.includes(column))) {
    throw new Error("Invalid existing-visitor reference CSV");
  }
  const groups = new Map<string, Record<string, string>[]>();
  for (const row of parsed.data) {
    const name = normalizeRsvpName(row["Full Name"] ?? "");
    if (!name) throw new Error("Reference row is missing its name");
    groups.set(name, [...(groups.get(name) ?? []), row]);
  }
  const identities = new Map<string, ReferenceIdentity>();
  for (const [name, visits] of Array.from(groups.entries())) {
    const emails = visits.map((visit) => visit.Email?.trim().toLowerCase() ?? "");
    // Unknown identities and names associated with multiple emails must use the form.
    if (emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || new Set(emails).size !== 1) continue;
    const latest = [...visits].sort((a, b) =>
      (Date.parse(b["Signed In"] ?? "") || 0) - (Date.parse(a["Signed In"] ?? "") || 0));
    identities.set(name, { email: emails[0], company: latest.find((v) => v.Company?.trim())?.Company.trim() ?? null });
  }
  return { identities, visits: parsed.data.length, names: groups.size };
}

/** Private database snapshot, populated separately from ignored source uploads. */
export async function getVisitorReference() {
  const [source] = await db.select().from(rsvpReferenceSets).where(eq(rsvpReferenceSets.eventKey, RSVP_EVENT_KEY));
  if (!source) throw new Error("Returning-guest reference is not configured");
  const rows = await db.select().from(rsvpReferenceIdentities)
    .where(eq(rsvpReferenceIdentities.eventKey, RSVP_EVENT_KEY));
  return {
    visits: source.visits, names: source.names,
    identities: new Map(rows.map((row) => [row.normalizedName, { email: row.email, company: row.company }])),
  };
}
export function summarizeReference(source: { visits: number; names: number; identities: Map<string, ReferenceIdentity> },
  roster: Array<{ fullName: string }>) {
  const automaticMatches = roster.filter((row) => source.identities.has(normalizeRsvpName(row.fullName))).length;
  return { visits: source.visits, names: source.names, automaticMatches, formRequired: roster.length - automaticMatches };
}
export async function referenceSummary() {
  return summarizeReference(await getVisitorReference(), loadRsvpSeed());
}
