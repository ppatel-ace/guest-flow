---
name: RSVP check-in scope
description: Confirmed access and roster inclusion rules for the AUSA RSVP check-in page.
---

The existing AUSA RSVP staff desk is for signed-in staff. Include every named entry in the supplied attendee workbook, regardless of its acceptance-category label.

**Why:** The user initially selected staff-only access and all named entries rather than only rows marked accepted. On 2026-10-06 they additionally requested a guest-facing QR workflow; this changes the prior restriction against all guest self-service.

**How to apply:** Protect roster retrieval and check-in actions with staff authentication. Do not silently exclude rows marked RSVP notes, added per request, or with an empty acceptance category.

Event-desk enhancements belong in the existing GuestFlow staff workflow, not a standalone app, mockup, or duplicate roster.

**Why:** The user explicitly scoped full-screen check-in as an enhancement to GuestFlow, retaining its branding and attendance workflow.

**How to apply:** Extend the existing protected RSVP page for event-desk presentation changes; do not move it into the mockup sandbox. Keep staff functions protected when adding a separate guest entry flow.

Guests should scan an event QR, select a name from the supplied RSVP roster, and be compared with a second user-supplied list of people already in the system. Matching people should be checked in from that guest flow without completing the form; nonmatching people must complete the check-in form. Importing a list must not itself mark arrivals.

**Why:** The user requested this QR-based conditional check-in workflow on 2026-10-06, explicitly replacing the earlier staff-only interaction as the way guests arrive. They reiterated that scanning directly into the ordinary form is not the requested experience.

**How to apply:** The designated RSVP QR must open name selection first; it is not interchangeable with the ordinary registration QR. Preserve a distinction between roster membership and actual arrival, and retain the form branch for guests not found in the reference list. Do not treat the entire reference list as already checked in.

Use a reusable event QR, not an expiring or rotating QR.

**Why:** The user explicitly selected a reusable event QR on 2026-10-06.

**How to apply:** Support one printable/displayable QR entry link. Do not promise that it proves an on-site scan or identity: the link can be reopened or shared.

Keep historical visitor-log uploads unversioned and retain only the matching information needed for this event in restricted storage.

**Why:** Visitor logs include personal and compliance information about past visits that is unrelated to deciding whether a guest can skip the form. Copying whole logs into application source exposes that information unnecessarily.

**How to apply:** Future reference-list updates should use private storage, not committed datasets or publicly served files.

Do not label a configured QR as live or published without checking the guest-facing deployment.

**Why:** The RSVP settings were saved while an older public build still redirected the RSVP entry to the normal form and did not contain the name-selector UI. Calling the saved code “Live QR” hid the remaining publishing requirement.

**How to apply:** Distinguish saved event settings from deployment readiness, and verify the public entry before claiming a guest scan works.
