import type { Express, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import QRCode from "qrcode";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { rsvpAttendees } from "@shared/schema";
import { RSVP_EVENT_NAME } from "./rsvpRoster";
import { referenceSummary, normalizeRsvpName, getVisitorReference } from "./rsvpReference";
import { dispatchRsvpArrival } from "./rsvpGuestEffects";
import {
  configureQrEvent, getQrEvent, requireQrEvent, selectQrAttendee,
  getRsvpFormContext, GuestFlowError,
} from "./rsvpGuestStorage";

export function sendGuestError(res: Parameters<RequestHandler>[1], error: unknown) {
  if (error instanceof GuestFlowError) return res.status(error.status).json({ error: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ error: "Check your information and try again." });
  // Database messages can contain reference contact details. Do not log raw errors.
  console.error("[rsvp-guest] Request failed:", error instanceof Error ? error.name : "Unknown error");
  return res.status(503).json({ error: "Unable to complete this request. Please try again; ask staff if it continues." });
}

const ticketSchema = z.string().regex(/^[a-f0-9]{64}$/);
export function registerRsvpGuestRoutes(app: Express, requireAuth: RequestHandler, protectWrite: RequestHandler) {
  const readLimit = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false,
    message: { error: "Too many searches. Please wait a moment and try again." } });
  const writeLimit = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false,
    message: { error: "Too many attempts. Please wait a moment or ask the event staff." } });
  app.use("/api/rsvp-guest", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  }, readLimit);

  const configResponse = async () => {
    const event = await getQrEvent();
    const guestUrl = event ? `${event.guestBaseUrl}/rsvp-arrival#event=${event.token}` : null;
    return {
      eventName: RSVP_EVENT_NAME, location: event?.location ?? null,
      // Verified published URL; staff may instead choose this preview or their guest deployment.
      guestBaseUrl: event?.guestBaseUrl ?? "https://aceregistration.replit.app",
      enabled: event?.enabled ?? false, guestUrl,
      qrCode: guestUrl ? await QRCode.toDataURL(guestUrl, { width: 768, margin: 4, errorCorrectionLevel: "M" }) : null,
      referenceSummary: await referenceSummary(),
    };
  };
  app.get("/api/rsvp/qr-config", requireAuth, async (_req, res) => {
    try { res.json(await configResponse()); } catch (error) { sendGuestError(res, error); }
  });
  app.post("/api/rsvp/qr-config", requireAuth, async (req, res) => {
    try {
      const input = z.object({
        location: z.string().trim().min(1).max(100),
        guestBaseUrl: z.string().url().max(500),
        enabled: z.boolean(),
      }).parse(req.body);
      const url = new URL(input.guestBaseUrl);
      if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
        (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
        throw new GuestFlowError(400, "Enter the base HTTPS address of this guest app, without a path or query.");
      }
      await configureQrEvent({ ...input, guestBaseUrl: url.origin });
      res.json(await configResponse());
    } catch (error) { sendGuestError(res, error); }
  });
  app.post("/api/rsvp-guest/context", async (req, res) => {
    try {
      const event = await requireQrEvent(req.get("authorization")?.replace(/^Bearer /, "") ?? "");
      res.json({ eventName: RSVP_EVENT_NAME, location: event.location });
    } catch (error) { sendGuestError(res, error); }
  });
  app.get("/api/rsvp-guest/search", async (req, res) => {
    try {
      const event = await requireQrEvent(req.get("authorization")?.replace(/^Bearer /, "") ?? "");
      const q = normalizeRsvpName(z.string().trim().min(2).max(80).parse(req.query.q));
      // Substring matching, not SQL wildcard matching. Return names only, with a bounded result.
      const matches = await db.select({ id: rsvpAttendees.id, fullName: rsvpAttendees.fullName })
        .from(rsvpAttendees).where(and(
          eq(rsvpAttendees.eventKey, event.eventKey),
          sql`strpos(lower(regexp_replace(${rsvpAttendees.fullName}, '\\s+', ' ', 'g')), ${q}) > 0`,
        )).orderBy(rsvpAttendees.fullName).limit(21);
      res.json({ attendees: matches.slice(0, 20), truncated: matches.length > 20 });
    } catch (error) { sendGuestError(res, error); }
  });
  app.post("/api/rsvp-guest/select", writeLimit, protectWrite, async (req, res) => {
    try {
      const event = await requireQrEvent(req.get("authorization")?.replace(/^Bearer /, "") ?? "");
      const input = z.object({ attendeeId: ticketSchema, requestId: z.string().uuid() }).parse(req.body);
      const result = await selectQrAttendee(event, input.attendeeId, input.requestId);
      if (result.status === "checked-in") {
        const identity = (await getVisitorReference()).identities.get(normalizeRsvpName(result.fullName));
        if (identity) dispatchRsvpArrival({ ...identity, fullName: result.fullName, location: event.location });
      }
      res.json(result);
    } catch (error) { sendGuestError(res, error); }
  });
  app.post("/api/rsvp-guest/form-context", async (req, res) => {
    try {
      const ticketId = ticketSchema.parse(req.body?.ticketId);
      res.json(await getRsvpFormContext(ticketId));
    } catch (error) { sendGuestError(res, error); }
  });
}
