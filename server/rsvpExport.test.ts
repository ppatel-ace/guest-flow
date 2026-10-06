import assert from "node:assert/strict";
import { test } from "node:test";
import Papa from "papaparse";
import type { RsvpAttendee } from "@shared/schema";
import { createRsvpAttendanceCsv, rsvpCsvCell } from "./rsvpExport";

test("CSV escapes spreadsheet formulas, whitespace prefixes and CSV punctuation", () => {
  for (const value of ["=1+1", "+SUM(A1)", "-1", "@SUM(A1)", " \t=1", "\r=1", "\ntext", "\ttext"]) {
    assert.ok(rsvpCsvCell(value).startsWith(`"'`));
  }
  assert.equal(rsvpCsvCell('O"Neil, Jr.'), '"O""Neil, Jr."');
  assert.equal(rsvpCsvCell("Jean-Luc"), '"Jean-Luc"');
  assert.equal(rsvpCsvCell(2), '"2"');
});

test("CSV round-trips names, source metadata, status and UTC first arrival", () => {
  const csv = createRsvpAttendanceCsv([
    {
      firstName: "Zoë", lastName: 'O"Neil, Jr.', fullName: 'Zoë O"Neil, Jr.',
      sourceCategory: "Notes,\nsecond line", plusOneCount: 3,
      checkedInAt: new Date("2026-10-06T10:45:00-04:00"),
    } as RsvpAttendee,
    {
      firstName: "=1+1", lastName: "", fullName: "=1+1",
      sourceCategory: "", plusOneCount: 0, checkedInAt: null,
    } as RsvpAttendee,
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: true });
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.data[0][6], "Source plus-one count (metadata only; not checked-in guests)");
  assert.deepEqual(parsed.data[1], [
    "Zoë", 'O"Neil, Jr.', 'Zoë O"Neil, Jr.', "Checked in",
    "2026-10-06T14:45:00.000Z", "Notes,\nsecond line", "3",
  ]);
  assert.deepEqual(parsed.data[2], ["'=1+1", "", "'=1+1", "Not checked in", "", "", "0"]);
});

test("empty arrivals export is a valid header-only CSV", () => {
  const parsed = Papa.parse<string[]>(createRsvpAttendanceCsv([]), { skipEmptyLines: true });
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.data.length, 1);
  assert.equal(parsed.data[0].length, 7);
});
