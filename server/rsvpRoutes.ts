import type { Express, RequestHandler } from "express";
import { checkInRsvpAttendee, listRsvpAttendees } from "./rsvpStorage";
import { RSVP_EVENT_NAME } from "./rsvpRoster";

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
}
