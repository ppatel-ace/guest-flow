import fs from "fs";
import path from "path";
import sharp from "sharp";
import type { MonoGrid, VisitorBadgeFields } from "./badgeAssets";
import { resolveAssetPath } from "./badgeAssets";

const PT_TO_DOTS = 300 / 72;

/** Brother ace printer .lbxs layout @ 300 dpi (landscape 90×29 mm). */
const LAYOUT = {
  width: 991,
  height: 306,
  fontSize: 32,
  fontFamily: "DejaVu Sans, Arial, Helvetica, sans-serif",
  logoX: Math.round(8.4 * PT_TO_DOTS),
  logoY: Math.round(4.4 * PT_TO_DOTS),
  logoW: Math.round(73.4 * PT_TO_DOTS),
  logoH: Math.round(73.4 * PT_TO_DOTS),
  textX: Math.round(100.5 * PT_TO_DOTS),
  lines: [
    { y: Math.round(14.3 * PT_TO_DOTS), label: "Name", key: "name" as const },
    { y: Math.round(25.1 * PT_TO_DOTS), label: "Company", key: "company" as const },
    { y: Math.round(36.7 * PT_TO_DOTS), label: "Email", key: "email" as const },
    { y: Math.round(48.2 * PT_TO_DOTS), label: "Date of visit", key: "visitDate" as const },
  ],
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateForWidth(text: string, maxWidthPx: number, fontSizePx: number): string {
  const cleaned = text.replace(/[^\x20-\x7E]/g, "?").trim();
  const maxChars = Math.max(8, Math.floor(maxWidthPx / (fontSizePx * 0.55)));
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, Math.max(1, maxChars - 1))}…`;
}

async function logoDataUri(): Promise<string | null> {
  const logoPath = resolveAssetPath("ace-visitor-logo.bmp");
  if (!logoPath) return null;

  const png = await sharp(fs.readFileSync(logoPath))
    .resize(LAYOUT.logoW, LAYOUT.logoH, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  return `data:image/png;base64,${png.toString("base64")}`;
}

function fieldValue(fields: VisitorBadgeFields, key: (typeof LAYOUT.lines)[number]["key"]): string {
  switch (key) {
    case "name": return fields.name;
    case "company": return fields.company;
    case "email": return fields.email;
    case "visitDate": return fields.visitDate;
  }
}

function buildBadgeSvg(fields: VisitorBadgeFields, logoUri: string | null): string {
  const maxTextWidth = LAYOUT.width - LAYOUT.textX - 12;
  const textLines = LAYOUT.lines.map((line) => {
    const value = truncateForWidth(fieldValue(fields, line.key), maxTextWidth, LAYOUT.fontSize);
    const text = `${line.label}: ${value}`;
    return `<text x="${LAYOUT.textX}" y="${line.y}" font-family="${LAYOUT.fontFamily}" font-size="${LAYOUT.fontSize}" fill="#000000" dominant-baseline="hanging">${escapeXml(text)}</text>`;
  });

  const logoEl = logoUri
    ? `<image href="${logoUri}" x="${LAYOUT.logoX}" y="${LAYOUT.logoY}" width="${LAYOUT.logoW}" height="${LAYOUT.logoH}" preserveAspectRatio="xMidYMid meet"/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${LAYOUT.width}" height="${LAYOUT.height}" viewBox="0 0 ${LAYOUT.width} ${LAYOUT.height}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${logoEl}
  ${textLines.join("\n  ")}
</svg>`;
}

/** Rasterize badge with real font outlines (SVG → sharp) for Brother QL. */
export async function renderVisitorBadgeGrid(fields: VisitorBadgeFields): Promise<MonoGrid> {
  const logoUri = await logoDataUri();
  const svg = buildBadgeSvg(fields, logoUri);

  const { data, info } = await sharp(Buffer.from(svg))
    .flatten({ background: "#ffffff" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const grid: MonoGrid = Array.from({ length: w }, () => new Array(h).fill(false));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const lum = data[y * w + x];
      if (lum < 180) grid[x][y] = true;
    }
  }

  return grid;
}
