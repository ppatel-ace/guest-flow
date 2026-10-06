import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import XLSX from "xlsx";

export const RSVP_EVENT_KEY = "ausa-2026";
export const RSVP_EVENT_NAME = "AUSA 2026";
export const RSVP_WORKBOOK = path.join(process.cwd(), "server/data/ausa-2026.xlsx");

export interface RsvpSeedRow {
  id: string;
  eventKey: string;
  firstName: string;
  lastName: string;
  fullName: string;
  sourceCategory: string;
  plusOneCount: number;
}

/** No acceptance filter: staff requested every named source entry. */
export function parseRsvpWorkbook(buffer: Buffer): RsvpSeedRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets["Accepted Attendees"];
  if (!sheet) throw new Error("RSVP workbook is missing the Accepted Attendees sheet");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const header = rows.findIndex((row) =>
    String(row[0]).trim() === "Last Name" && String(row[1]).trim() === "First Name");
  if (header < 0) throw new Error("RSVP workbook name columns are missing");
  const seen = new Set<string>();
  const result: RsvpSeedRow[] = [];
  for (const row of rows.slice(header + 1)) {
    const lastName = String(row[0] ?? "").trim();
    const firstName = String(row[1] ?? "").trim();
    if (!lastName && !firstName) continue;
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const key = `${RSVP_EVENT_KEY}:${firstName.toLowerCase()}:${lastName.toLowerCase()}`;
    if (seen.has(key)) throw new Error("Duplicate attendee name in RSVP workbook");
    seen.add(key);
    const rawCount = Number(row[3] || 0);
    if (!Number.isInteger(rawCount) || rawCount < 0) throw new Error("Invalid RSVP plus-one count");
    result.push({
      id: createHash("sha256").update(key).digest("hex"),
      eventKey: RSVP_EVENT_KEY,
      firstName, lastName, fullName,
      sourceCategory: String(row[2] ?? "").trim(),
      plusOneCount: rawCount,
    });
  }
  if (result.length !== 233) throw new Error(`Expected 233 RSVP attendees, found ${result.length}`);
  return result;
}

export function loadRsvpSeed(): RsvpSeedRow[] {
  return parseRsvpWorkbook(fs.readFileSync(RSVP_WORKBOOK));
}
