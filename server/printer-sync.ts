import net from "net";
import { storage } from "./storage";

const PRINTER_IP   = (process.env.LABEL_PRINTER_IP  || "").trim();
const PRINTER_PORT = parseInt(process.env.LABEL_PRINTER_PORT || "9100", 10);
const PING_MS      = 30_000;
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

async function findOrCreate(): Promise<string> {
  const all = await storage.getAllPrinters();
  const existing = all.find((p) => (p as any).ipAddress === PRINTER_IP);
  if (existing) return existing.id;

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

async function tick(printerId: string) {
  const { online, reason } = await ping(PRINTER_IP, PRINTER_PORT);
  const status = online ? "online" : "offline";
  await storage.updatePrinter(printerId, { status });
  if (online) {
    console.log(`[printer-sync] ${PRINTER_IP}:${PRINTER_PORT} → online`);
  } else {
    console.log(`[printer-sync] ${PRINTER_IP}:${PRINTER_PORT} → offline (${reason})`);
  }

  if (online) {
    const settings = await storage.getKioskSettings();
    if (!settings.labelPrinterEnabled) {
      await storage.updateKioskSettings({ labelPrinterEnabled: true });
      console.log("[printer-sync] labelPrinterEnabled → true");
    }
  }
}

export async function startPrinterSync() {
  if (!PRINTER_IP) {
    console.log("[printer-sync] LABEL_PRINTER_IP not set — skipping");
    return;
  }

  console.log(`[printer-sync] starting — ip=${PRINTER_IP} port=${PRINTER_PORT}`);

  let id: string;
  try {
    id = await findOrCreate();
  } catch (err) {
    console.error("[printer-sync] registration error:", err);
    return;
  }

  try { await tick(id); } catch (err) { console.error("[printer-sync] initial ping:", err); }

  setInterval(async () => {
    try {
      // Re-fetch in case the record was deleted and needs re-creating
      const all = await storage.getAllPrinters();
      if (!all.find((p) => p.id === id)) {
        id = await findOrCreate();
      }
      await tick(id);
    } catch (err) {
      console.error("[printer-sync] poll error:", err);
    }
  }, PING_MS);
}
