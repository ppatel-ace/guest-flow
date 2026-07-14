import { storage } from "./storage";
import { printLabel } from "./printer-helper";

async function processJobs() {
  try {
    const jobs = await storage.getPendingPrintJobs(5);
    for (const job of jobs) {
      try {
        const printer = (await storage.getAllPrinters()).find(p => p.id === (job as any).printerId);
        if (!printer) {
          await storage.markPrintJobStatus(job.id, 'failed', (job as any).attempts + 1, 'Printer not found');
          continue;
        }
        await storage.markPrintJobStatus(job.id, 'in_progress', (job as any).attempts + 1, null);
        await printLabel(printer as any, [(job as any).labelText]);
        await storage.markPrintJobStatus(job.id, 'done', (job as any).attempts + 1, null);
      } catch (err: any) {
        const attempts = ((job as any).attempts || 0) + 1;
        const status = attempts >= 3 ? 'failed' : 'pending';
        await storage.markPrintJobStatus(job.id, status, attempts, String(err?.message ?? err));
      }
    }
  } catch (err) {
    console.error('[print-worker] error', err);
  }
}

// Poll every 3 seconds
setInterval(processJobs, 3000);

processJobs().catch(console.error);
