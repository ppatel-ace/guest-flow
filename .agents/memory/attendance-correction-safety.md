---
name: Attendance correction safety
description: Reasons for versioned attendance confirmations and precision-preserving audit records.
---

Treat an undo confirmation as approval of one specific attendance state, not permission to clear whichever arrival happens to exist when the request reaches the server.

**Why:** Another desk may undo and re-check-in an attendee while an old confirmation remains open. Checking only whether an attendee is currently checked in would erase the newer valid arrival.

**How to apply:** Preserve state-version conflict detection whenever extending RSVP corrections, including requests retried after an uncertain response.

Keep original arrival timestamps at their database precision when writing audit history.

**Why:** PostgreSQL timestamps can include microseconds, whereas JavaScript dates and JSON timestamps retain only milliseconds. Copying an arrival through JavaScript silently reduces the audit's precision.

**How to apply:** Copy original audit values inside the database transaction rather than round-tripping arrival times through the browser or JavaScript dates.
