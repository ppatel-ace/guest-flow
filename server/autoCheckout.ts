import { storage } from "./storage";

const INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

async function runAutoCheckout(): Promise<void> {
  try {
    const hours = await storage.getAutoCheckoutHours();
    const count = await storage.autoCheckoutStaleVisitors(hours);
    if (count > 0) {
      console.log(`[auto-checkout] Signed out ${count} visitor(s) after ${hours}h`);
    }
  } catch (err) {
    console.error("[auto-checkout] failed:", err);
  }
}

/** Periodically auto-sign-out open visits older than the configured hours. */
export function startAutoCheckoutLoop(): void {
  // First pass shortly after boot so long-open visits aren't wait 5m
  setTimeout(() => {
    void runAutoCheckout();
  }, 15_000);
  setInterval(() => {
    void runAutoCheckout();
  }, INTERVAL_MS);
  console.log("[auto-checkout] background job scheduled (every 5 minutes)");
}
