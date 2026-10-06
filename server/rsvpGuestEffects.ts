import { notifyCheckIn } from "./email";
import { storage } from "./storage";
import { printLabel } from "./printer-helper";

/** Best-effort effects after a committed arrival; failures never turn it into a failed check-in. */
export function dispatchRsvpArrival(input: {
  fullName: string; email: string; company: string | null; location: string; acePoc?: string | null;
}) {
  void notifyCheckIn({ ...input, documentsAgreed: null }, input.acePoc ?? null, input.location)
    .catch(() => console.error("[rsvp-guest] Notification dispatch failed"));
  void (async () => {
    const settings = await storage.getKioskSettings();
    if (!settings.labelPrinterEnabled) return;
    const printer = (await storage.getAllPrinters()).find((p) => p.status === "online" && p.ipAddress);
    if (printer) await printLabel(printer, [input.fullName, input.company ?? "", new Date().toLocaleDateString()]);
  })().catch(() => console.error("[rsvp-guest] Label dispatch failed"));
}
