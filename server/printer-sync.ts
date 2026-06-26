import net from "net";
import type { Printer } from "@shared/schema";
import { storage } from "./storage";

const PRINTER_IP   = (process.env.LABEL_PRINTER_IP  || "").trim();
const PRINTER_PORT = parseInt(process.env.LABEL_PRINTER_PORT || "9100", 10);
const PING_MS      = 15_000;   // poll every 15 s so UI reflects reality quickly
const TIMEOUT_MS   = 3_000;

const AUTO_NAME  = "Brother QL (Auto)";
const AUTO_MODEL = "Brother QL-820NWB";

function ping(ip: string, port: number): Promise<{ online: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (online: boolean, reason?: string) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch {}
      resolve({ online, reason });
    };
    sock.setTimeout(TIMEOUT_MS, () => finish(false, `timeout after ${TIMEOUT_MS}ms`));
    sock.once("error", (err) => finish(false, err.message));
    sock.connect(port, ip, () => finish(true));
  });
}

async function ensureAutoCreated(): Promise<string | null> {
  if (!PRINTER_IP) return null;
  const all = await storage.getAllPrinters();
  const existing =
    all.find((p) => p.ipAddress === PRINTER_IP) ??
    all.find((p) => p.name === AUTO_NAME);
  if (existing) {
    if (!existing.ipAddress || existing.port !== PRINTER_PORT) {
      await storage.updatePrinter(existing.id, {
        ipAddress: PRINTER_IP,
        port: PRINTER_PORT,
      });
    }
    return existing.id;
  }

  const created = await storage.createPrinter({
    name: AUTO_NAME,
    model: AUTO_MODEL,
    connectionType: "wifi",
    ipAddress: PRINTER_IP,
    port: PRINTER_PORT,
    status: "offline",
  });
  console.log(`[printer-sync] registered "${AUTO_NAME}" at ${PRINTER_IP}:${PRINTER_PORT}`);
  return created.id;
}

async function pollAllPrinters() {
  const all = await storage.getAllPrinters();

  for (const printer of all) {
    const ip = printer.ipAddress?.trim();
    const port = printer.port ?? 9100;
    if (!ip) continue;

    const { online, reason } = await ping(ip, port);
    const newStatus = online ? "online" : "offline";

    try {
      await storage.updatePrinter(printer.id, { status: newStatus });
      printer.status = newStatus;
    } catch (err) {
      console.error(`[printer-sync] failed to persist status for ${printer.name}:`, err);
    }

    if (online) {
      console.log(`[printer-sync] ${ip}:${port} (${printer.name}) → online`);
    } else {
      console.log(`[printer-sync] ${ip}:${port} (${printer.name}) → offline (${reason})`);
    }
  }

  // Auto-enable label printing when at least one printer is online
  if (all.some((p) => p.status === "online" || (p as any).ipAddress)) {
    const settings = await storage.getKioskSettings();
    if (!settings.labelPrinterEnabled) {
      const anyOnline = all.some((p) => p.status === "online");
      if (anyOnline) {
        await storage.updateKioskSettings({ labelPrinterEnabled: true });
        console.log("[printer-sync] labelPrinterEnabled → true");
      }
    }
  }
}

/** Live TCP ping — do not rely on cached DB status (Supabase row may lag). */
export async function resolveReachablePrinter(): Promise<Printer | null> {
  if (PRINTER_IP) {
    try {
      await ensureAutoCreated();
    } catch (err) {
      console.error("[printer-sync] ensureAutoCreated:", err);
    }
  }

  const all = await storage.getAllPrinters();
  for (const printer of all) {
    const ip = printer.ipAddress?.trim();
    const port = printer.port ?? 9100;
    if (!ip) continue;

    const { online } = await ping(ip, port);
    const newStatus = online ? "online" : "offline";
    if (online) {
      if (printer.status !== newStatus) {
        await storage.updatePrinter(printer.id, { status: newStatus }).catch(() => {});
      }
      return { ...printer, status: newStatus };
    }
  }
  return null;
}

export async function startPrinterSync() {
  // Ensure the env-var-configured printer is registered in the DB
  if (PRINTER_IP) {
    console.log(`[printer-sync] starting — env printer ip=${PRINTER_IP} port=${PRINTER_PORT}`);
    try {
      await ensureAutoCreated();
    } catch (err) {
      console.error("[printer-sync] registration error:", err);
    }
  } else {
    console.log("[printer-sync] LABEL_PRINTER_IP not set — will still poll any DB-registered printers");
  }

  // Initial poll
  try { await pollAllPrinters(); } catch (err) { console.error("[printer-sync] initial poll:", err); }

  // Recurring poll
  setInterval(async () => {
    try {
      if (PRINTER_IP) await ensureAutoCreated();
      await pollAllPrinters();
    } catch (err) {
      console.error("[printer-sync] poll error:", err);
    }
  }, PING_MS);
}
