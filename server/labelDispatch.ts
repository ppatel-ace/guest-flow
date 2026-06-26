import { printVisitorBadge } from "./printer-helper";
import { resolveReachablePrinter } from "./printer-sync";
import { storage } from "./storage";

export type LabelPrintResult =
  | { success: true; printerName: string }
  | { success: false; error: string };

/** Print a visitor badge on the LAN Brother QL (server-side TCP). */
export async function printVisitorBadgeLabel(
  name: string,
  company: string,
): Promise<{ printerName: string }> {
  const settings = await storage.getKioskSettings();
  if (!settings.labelPrinterEnabled) {
    throw new Error("Label printing is disabled in kiosk settings");
  }

  const target = await resolveReachablePrinter();
  if (!target?.ipAddress) {
    throw new Error("No reachable label printer on the network");
  }

  await printVisitorBadge(target, name, company);
  console.log(`[label-print] badge for "${name}" → ${target.ipAddress} (${target.name})`);
  return { printerName: target.name };
}

/** Same as printVisitorBadgeLabel but never throws — for API responses. */
export async function tryPrintVisitorBadgeLabel(
  name: string,
  company: string,
): Promise<LabelPrintResult> {
  try {
    const { printerName } = await printVisitorBadgeLabel(name, company);
    return { success: true, printerName };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Print failed";
    console.error("[label-print]", error);
    return { success: false, error };
  }
}
