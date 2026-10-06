---
name: RSVP check-in scope
description: Confirmed access and roster inclusion rules for the AUSA RSVP check-in page.
---

The AUSA RSVP check-in page is for signed-in staff only, not public guest self-service. Include every named entry in the supplied attendee workbook, regardless of its acceptance-category label.

**Why:** The user explicitly selected staff-only access and all named entries rather than only rows marked accepted.

**How to apply:** Protect roster retrieval and check-in actions with staff authentication. Do not silently exclude rows marked RSVP notes, added per request, or with an empty acceptance category.

Event-desk enhancements belong in the existing GuestFlow staff workflow, not a standalone app, mockup, or duplicate roster.

**Why:** The user explicitly scoped full-screen check-in as an enhancement to GuestFlow, retaining its branding and attendance workflow.

**How to apply:** Extend the existing protected RSVP page for event-desk presentation changes; do not move it into the mockup sandbox or expose it as guest self-service.
