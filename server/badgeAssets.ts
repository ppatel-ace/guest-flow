import fs from "fs";
import path from "path";

/** Monochrome row-major pixels — true = print (black). */
export type MonoGrid = boolean[][];

export interface VisitorBadgeFields {
  name: string;
  company: string;
  email: string;
  visitDate: string;
}

export function resolveAssetPath(fileName: string): string | null {
  const cwd = process.cwd();
  const moduleDir =
    typeof __dirname !== "undefined"
      ? __dirname
      : typeof import.meta !== "undefined" && "dirname" in import.meta && import.meta.dirname
        ? (import.meta.dirname as string)
        : cwd;

  const candidates = [
    path.join(cwd, "server/assets", fileName),
    path.join(moduleDir, "../server/assets", fileName),
    path.join(moduleDir, "assets", fileName),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function formatVisitDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
