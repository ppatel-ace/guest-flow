/**
 * Visitor badge printing — always via GuestFlow server → LAN Brother QL (TCP).
 * Works in Safari, iOS Capacitor shell, and kiosk browsers (no native Bluetooth plugin required).
 */
export async function printVisitorLabel(
  name: string,
  company: string,
  email?: string,
): Promise<{ printerName: string }> {
  const res = await fetch("/api/kiosk/print-label", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, company, email: email ?? "" }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    printed?: boolean;
    printerName?: string;
    error?: string;
    message?: string;
  };

  if (!res.ok || !data.success || !data.printed) {
    throw new Error(data.message || data.error || `Print failed (${res.status})`);
  }

  return { printerName: data.printerName ?? "Brother QL" };
}

/** @deprecated Network printing is server-side; returns empty list. */
export async function getPairedBrotherPrinters(): Promise<string[]> {
  return [];
}
