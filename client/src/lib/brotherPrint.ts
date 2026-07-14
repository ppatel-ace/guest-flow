import { registerPlugin } from "@capacitor/core";

interface BrotherPrintPlugin {
  printLabel(options: { name: string; company: string; date: string }): Promise<void>;
  getPairedPrinters(): Promise<{ printers: string[] }>;
}

const BrotherPrint = registerPlugin<BrotherPrintPlugin>("BrotherPrint");

function isNative(): boolean {
  return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.();
}

/**
 * Print a visitor badge label to the paired Brother QL-820NWB via Bluetooth.
 * Silently no-ops on web/browser — native iOS only.
 */
export async function printVisitorLabel(
  name: string,
  company: string,
  date: string
): Promise<void> {
  if (!isNative()) return;
  try {
    await BrotherPrint.printLabel({ name, company, date });
  } catch (err) {
    console.warn("[brother-print] printLabel failed:", err);
    throw err;
  }
}

/**
 * Returns the list of paired Brother printers found over Bluetooth.
 * Returns [] on web/browser.
 */
export async function getPairedBrotherPrinters(): Promise<string[]> {
  if (!isNative()) return [];
  try {
    const { printers } = await BrotherPrint.getPairedPrinters();
    return printers;
  } catch (err) {
    console.warn("[brother-print] getPairedPrinters failed:", err);
    return [];
  }
}
