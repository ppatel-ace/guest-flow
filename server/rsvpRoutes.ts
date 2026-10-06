import type { Express, RequestHandler } from "express";
import { checkInRsvpAttendee, listRsvpAttendees, undoRsvpCheckIn } from "./rsvpStorage";
import type { AceAuthRequest } from "./aceSso";
import { RSVP_EVENT_KEY, RSVP_EVENT_NAME } from "./rsvpRoster";
import { createRsvpAttendanceCsv } from "./rsvpExport";

export function registerRsvpRoutes(app: Express, requireAuth: RequestHandler) {
  // Authentication precedes all roster reads or initialization.
  app.use("/api/rsvp", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });
  app.get("/api/rsvp/attendees", requireAuth, async (_req, res) => {
    try {
      res.json({ eventName: RSVP_EVENT_NAME, attendees: await listRsvpAttendees() });
    } catch (error) {
      console.error("[rsvp] Roster retrieval failed", error);
      res.status(503).json({ error: "Unable to load the RSVP roster. Please try again." });
    }
  });
  app.get("/api/rsvp/attendance.csv", requireAuth, async (req, res) => {
    const scope = req.query.scope ?? "all";
    if (scope !== "all" && scope !== "arrivals") {
      return res.status(400).json({ error: "Choose all attendees or arrivals only for the attendance export." });
    }
    try {
      // Query persisted attendance, never the browser's cached/search-filtered roster.
      const attendees = await listRsvpAttendees(scope === "arrivals");
      const csv = createRsvpAttendanceCsv(attendees);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${RSVP_EVENT_KEY}-attendance-${scope}.csv"`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(csv);
    } catch (error) {
      console.error("[rsvp] Attendance export failed", error);
      res.status(503).json({ error: "Unable to download RSVP attendance. Please try again." });
    }
  });
  app.post("/api/rsvp/attendees/:id/check-in", requireAuth, async (req, res) => {
    if (!/^[a-f0-9]{64}$/.test(req.params.id)) {
      return res.status(400).json({ error: "Invalid attendee identifier" });
    }
    try {
      const attendee = await checkInRsvpAttendee(req.params.id);
      if (!attendee) return res.status(404).json({ error: "Attendee not found" });
      res.json(attendee);
    } catch (error) {
      console.error("[rsvp] Check-in failed", error);
      res.status(503).json({ error: "Unable to save check-in. Please try again." });
    }
  });
  app.post("/api/rsvp/attendees/:id/undo-check-in", requireAuth, async (req, res) => {
    const staffId = (req as AceAuthRequest).user?.id;
    if (!staffId) return res.status(403).json({ error: "A staff identity is required to correct attendance." });
    if (!/^[a-f0-9]{64}$/.test(req.params.id)) {
      return res.status(400).json({ error: "Invalid attendee identifier" });
    }
    const revision = req.body?.expectedRevision;
    if (req.body?.confirmed !== true || !Number.isSafeInteger(revision) || revision < 0) {
      return res.status(400).json({ error: "Confirm the correction and provide the current attendance revision." });
    }
    try {
      const result = await undoRsvpCheckIn(req.params.id, revision, staffId);
      if (result.status === "not-found") return res.status(404).json({ error: "Attendee not found" });
      if (result.status === "conflict") {
        return res.status(409).json({ error: "Attendance has changed. Refresh the roster and confirm again." });
      }
      res.json(result.attendee);
    } catch (error) {
      console.error("[rsvp] Check-in correction failed", error);
      res.status(503).json({ error: "Unable to undo check-in. Please try again." });
    }
  });
}
