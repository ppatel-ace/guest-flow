import net from "net";
import { Printer } from "@shared/schema";

const DEFAULT_PORT = 9100;

export async function printLabel(printer: Printer, lines: string[]): Promise<void> {
  const ip = (printer as any).ipAddress;
  const port = (printer as any).port || DEFAULT_PORT;
  if (!ip) throw new Error("Printer has no ipAddress configured");

  const payload = lines.map(l => l.trim()).join('\n') + '\n\n';

  return new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;
    const cleanup = () => {
      try { socket.destroy(); } catch (e) {}
    };

    socket.setTimeout(5000, () => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error('Print socket timeout'));
      }
    });

    socket.once('error', (err) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(err);
      }
    });

    socket.connect(port, ip, () => {
      socket.write(payload, (err) => {
        if (err) {
          if (!settled) {
            settled = true;
            cleanup();
            reject(err);
          }
          return;
        }
        // Give the printer a short moment then resolve
        setTimeout(() => {
          if (!settled) {
            settled = true;
            cleanup();
            resolve();
          }
        }, 300);
      });
    });
  });
}

export default { printLabel };
