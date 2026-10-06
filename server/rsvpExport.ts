import type { RsvpAttendee } from "@shared/schema";

/** Quoting handles CSV syntax; the apostrophe also prevents spreadsheet formulas. */
export function rsvpCsvCell(value: string | number): string {
  const text = String(value);
  const safe = /^(?:[\s\u0000-\u001f]*[=+\-@]|[\t\r\n])/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function createRsvpAttendanceCsv(attendees: RsvpAttendee[]): string {
  const rows: Array<Array<string | number>> = [[
    "First name",
    "Last name",
    "Full name",
    "Checked-in status",
    "First arrival timestamp (UTC)",
    "Source RSVP category",
    "Source plus-one count (metadata only; not checked-in guests)",
  ]];
  for (const attendee of attendees) {
    rows.push([
      attendee.firstName,
      attendee.lastName,
      attendee.fullName,
      attendee.checkedInAt ? "Checked in" : "Not checked in",
      attendee.checkedInAt?.toISOString() ?? "",
      attendee.sourceCategory,
      attendee.plusOneCount,
    ]);
  }
  // UTF-8 BOM makes names readable in Excel; even an empty export has its header.
  return "\uFEFF" + rows.map((row) => row.map(rsvpCsvCell).join(",")).join("\r\n") + "\r\n";
}
