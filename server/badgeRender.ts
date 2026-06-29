import fs from "fs";
import sharp from "sharp";
import type { MonoGrid, VisitorBadgeFields } from "./badgeAssets";
import { resolveAssetPath } from "./badgeAssets";

/**
 * Badge layout @ 300 dpi for Brother QL with 62 mm continuous tape.
 *
 * Raster orientation:
 *   • SVG width  = feed direction  (991 dots ≈ 90 mm)
 *   • SVG height = tape width      (696 dots = 62 mm printable)
 *
 * When buildRasterPacket iterates `for (const col of grid)` it sends each
 * SVG *column* as a raster line, so the image is rotated 90° CCW on the
 * tape — which is exactly how a landscape label should appear when the
 * tape feeds out of the printer.
 */
const LAYOUT = {
  /** Dots along the feed direction (≈ 90 mm). */
  width:  991,
  /** Dots across the tape (62 mm printable). */
  height: 696,

  /** Logo: left zone, vertically centred. */
  logoX:  24,
  logoY:  148,   // (696 − 400) / 2
  logoW:  400,
  logoH:  400,

  /** Text: right of the logo, four evenly-spaced lines. */
  textX:    460,
  fontSize:  52,
  fontFamily: "DejaVu Sans, Arial, Helvetica, sans-serif",
  lines: [
    { y:  98, label: "Name",          key: "name"      as const },
    { y: 232, label: "Company",       key: "company"   as const },
    { y: 366, label: "Email",         key: "email"     as const },
    { y: 500, label: "Date of visit", key: "visitDate" as const },
  ],
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateForWidth(
  text: string,
  maxWidthPx: number,
  fontSizePx: number,
): string {
  const cleaned = text.replace(/[^\x20-\x7E]/g, "?").trim();
  const maxChars = Math.max(8, Math.floor(maxWidthPx / (fontSizePx * 0.55)));
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, Math.max(1, maxChars - 1))}…`;
}

async function logoDataUri(): Promise<string | null> {
  const logoPath = resolveAssetPath("ace-visitor-logo.bmp")
    ?? resolveAssetPath("ace-visitor-logo.png")
    ?? resolveAssetPath("ace-visitor-logo.jpg");
  if (!logoPath) return null;

  const png = await sharp(fs.readFileSync(logoPath))
    .resize(LAYOUT.logoW, LAYOUT.logoH, {
      fit: "inside",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  return `data:image/png;base64,${png.toString("base64")}`;
}

function fieldValue(
  fields: VisitorBadgeFields,
  key: (typeof LAYOUT.lines)[number]["key"],
): string {
  switch (key) {
    case "name":      return fields.name;
    case "company":   return fields.company;
    case "email":     return fields.email;
    case "visitDate": return fields.visitDate;
  }
}

function buildBadgeSvg(
  fields: VisitorBadgeFields,
  logoUri: string | null,
): string {
  const maxTextWidth = LAYOUT.width - LAYOUT.textX - 16;
  const { fontSize, fontFamily, textX } = LAYOUT;

  const textEls = LAYOUT.lines.map(({ y, label, key }) => {
    const value = truncateForWidth(fieldValue(fields, key), maxTextWidth, fontSize);
    const line  = `${label}: ${value}`;
    return (
      `<text x="${textX}" y="${y}" ` +
      `font-family="${fontFamily}" font-size="${fontSize}" ` +
      `font-weight="bold" fill="#000000" dominant-baseline="hanging">` +
      `${escapeXml(line)}</text>`
    );
  });

  const logoEl = logoUri
    ? `<image href="${logoUri}" x="${LAYOUT.logoX}" y="${LAYOUT.logoY}" ` +
      `width="${LAYOUT.logoW}" height="${LAYOUT.logoH}" ` +
      `preserveAspectRatio="xMidYMid meet"/>`
    : "";

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${LAYOUT.width}" height="${LAYOUT.height}" ` +
    `viewBox="0 0 ${LAYOUT.width} ${LAYOUT.height}">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>` +
    logoEl +
    textEls.join("") +
    `</svg>`
  );
}

/**
 * Rasterize the visitor badge (SVG → sharp → monochrome column-major grid).
 *
 * Returns boolean[width][height] where width = feed direction (991),
 * height = tape width (696).  buildRasterPacket iterates columns as raster
 * lines, so the landscape layout prints correctly.
 */
export async function renderVisitorBadgeGrid(
  fields: VisitorBadgeFields,
): Promise<MonoGrid> {
  const logoUri = await logoDataUri();
  const svg     = buildBadgeSvg(fields, logoUri);

  const { data, info } = await sharp(Buffer.from(svg))
    .flatten({ background: "#ffffff" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;   // 991
  const h = info.height;  // 696

  const grid: MonoGrid = Array.from({ length: w }, () => new Array(h).fill(false));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const lum = data[y * w + x];
      if (lum < 180) grid[x][y] = true;
    }
  }

  return grid;
}
