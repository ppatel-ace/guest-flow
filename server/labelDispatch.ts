import { formatVisitDate } from "./badgeAssets";
import { printVisitorBadge, type VisitorBadgeFields } from "./printer-helper";
import { resolveReachablePrinter } from "./printer-sync";
import { storage } from "./storage";

export type LabelPrintResult =
  | { success: true; printerName: string }
  | { success: false; error: string };

export type VisitorBadgeInput = {
  name: string;
  company?: string;
  email?: string;
  visitDate?: string | Date;
};

function normalizeBadgeFields(input: VisitorBadgeInput): VisitorBadgeFields {
  const visitDate =
    input.visitDate instanceof Date
      ? formatVisitDate(input.visitDate)
      : input.visitDate?.trim() || formatVisitDate();

  return {
    name: input.name.trim(),
    company: input.company?.trim() || "—",
    email: input.email?.trim() || "—",
    visitDate,
  };
}

/** Print a visitor badge on the LAN Brother QL (server-side TCP). */
export async function printVisitorBadgeLabel(
  input: VisitorBadgeInput,
): Promise<{ printerName: string }> {
  const settings = await storage.getKioskSettings();
  if (!settings.labelPrinterEnabled) {
    throw new Error("Label printing is disabled in kiosk settings");
  }

  const target = await resolveReachablePrinter();
  if (!target?.ipAddress) {
    throw new Error("No reachable label printer on the network");
  }

  const fields = normalizeBadgeFields(input);
  await printVisitorBadge(target, fields);
  console.log(`[label-print] badge for "${fields.name}" → ${target.ipAddress} (${target.name})`);
  return { printerName: target.name };
}

/** Same as printVisitorBadgeLabel but never throws — for API responses. */
export async function tryPrintVisitorBadgeLabel(
  input: VisitorBadgeInput,
): Promise<LabelPrintResult> {
  try {
    const { printerName } = await printVisitorBadgeLabel(input);
    return { success: true, printerName };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Print failed";
    console.error("[label-print]", error);
    return { success: false, error };
  }
}
