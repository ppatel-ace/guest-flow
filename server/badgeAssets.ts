import fs from "fs";
import path from "path";

/** Monochrome row-major pixels — true = print (black). */
export type MonoGrid = boolean[][];

let cachedLogo: MonoGrid | null = null;

const PT_TO_DOTS = 300 / 72;

function resolveAssetPath(fileName: string): string | null {
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

/** Decode 32-bit BMP (BI_RGB) → 1-bit grid (true = print). */
function decodeBmp32ToMono(buffer: Buffer): MonoGrid {
  if (buffer.length < 54 || buffer.toString("ascii", 0, 2) !== "BM") {
    throw new Error("Invalid BMP signature");
  }

  const dataOffset = buffer.readUInt32LE(10);
  const width = buffer.readInt32LE(18);
  const height = Math.abs(buffer.readInt32LE(22));
  const bpp = buffer.readUInt16LE(28);
  if (bpp !== 32) throw new Error(`Unsupported BMP bit depth: ${bpp}`);

  const rowBytes = width * 4;
  const rows: MonoGrid = [];

  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y;
    const rowOffset = dataOffset + srcY * rowBytes;
    const row = new Array<boolean>(width).fill(false);
    for (let x = 0; x < width; x++) {
      const i = rowOffset + x * 4;
      const b = buffer[i];
      const g = buffer[i + 1];
      const r = buffer[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      row[x] = lum < 180;
    }
    rows.push(row);
  }

  return rows;
}

function scaleGrid(grid: MonoGrid, targetW: number, targetH: number): MonoGrid {
  const srcH = grid.length;
  const srcW = grid[0]?.length ?? 0;
  if (!srcW || !srcH) return [];

  const out: MonoGrid = [];
  for (let y = 0; y < targetH; y++) {
    const row = new Array<boolean>(targetW).fill(false);
    const sy = Math.min(srcH - 1, Math.floor((y * srcH) / targetH));
    for (let x = 0; x < targetW; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x * srcW) / targetW));
      row[x] = grid[sy][sx];
    }
    out.push(row);
  }
  return out;
}

function ensureLogoCached(): MonoGrid | null {
  if (cachedLogo) return cachedLogo;

  const logoPath = resolveAssetPath("ace-visitor-logo.bmp");
  if (!logoPath) {
    console.warn("[badgeAssets] ace-visitor-logo.bmp not found — badge will omit logo");
    return null;
  }

  cachedLogo = decodeBmp32ToMono(fs.readFileSync(logoPath));
  return cachedLogo;
}

/** Ace logo from Brother label template, scaled to fit max bounds. */
export function loadVisitorLogoGrid(maxWidth: number, maxHeight: number): MonoGrid {
  const raw = ensureLogoCached();
  if (!raw?.length) return [];

  const srcW = raw[0].length;
  const srcH = raw.length;
  const scale = Math.min(maxWidth / srcW, maxHeight / srcH, 1);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  return scaleGrid(raw, w, h);
}

/** Positions for 29×90 mm landscape @ 300 dpi (fontScale 10 — 2×2 field grid beside logo). */
export const BADGE_LAYOUT = {
  ptToDots: PT_TO_DOTS,
  fontScale: 10,
  /** Smaller logo so large text fits to the right */
  logoRow: Math.round(8.4 * PT_TO_DOTS),
  logoCol: Math.round(4.4 * PT_TO_DOTS),
  logoRowSpan: Math.round(38 * PT_TO_DOTS),
  logoColSpan: Math.round(70 * PT_TO_DOTS),
  /** First text row along the 90 mm feed axis (just past logo) */
  textRowStart: Math.round(46 * PT_TO_DOTS),
  /** Second text row (Company / Date) */
  textRowSecond: Math.round(46 * PT_TO_DOTS) + 320,
  /** Two vertical bands for side-by-side fields */
  textColLeft: 6,
  textColRight: 142,
} as const;

export function formatVisitDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
