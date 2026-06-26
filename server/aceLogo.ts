import fs from "fs";
import path from "path";
import zlib from "zlib";

/** Monochrome row-major pixels — true = print (black). */
export type MonoGrid = boolean[][];

let cachedLogo: MonoGrid | null = null;

function resolveLogoPath(): string | null {
  const cwd = process.cwd();
  const moduleDir =
    typeof __dirname !== "undefined"
      ? __dirname
      : typeof import.meta !== "undefined" && "dirname" in import.meta && import.meta.dirname
        ? (import.meta.dirname as string)
        : cwd;

  const candidates = [
    path.join(cwd, "dist/public/logos/ace-logo-idle.png"),
    path.join(cwd, "client/public/logos/ace-logo-idle.png"),
    path.join(moduleDir, "public/logos/ace-logo-idle.png"),
    path.join(moduleDir, "../dist/public/logos/ace-logo-idle.png"),
    path.join(moduleDir, "../client/public/logos/ace-logo-idle.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Minimal PNG decoder (8-bit RGB/RGBA/grayscale) → 1-bit grid. */
function decodePngToMono(buffer: Buffer): MonoGrid {
  const sig = buffer.subarray(0, 8);
  if (!sig.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error("Invalid PNG signature");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatParts: Buffer[] = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatParts.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (!width || !height) throw new Error("PNG missing IHDR");
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);

  const bytesPerPixel =
    colorType === 0 ? 1 :
    colorType === 2 ? 3 :
    colorType === 4 ? 2 :
    colorType === 6 ? 4 :
    (() => { throw new Error(`Unsupported PNG color type: ${colorType}`); })();

  const inflated = zlib.inflateSync(Buffer.concat(idatParts));
  const stride = width * bytesPerPixel;
  const bpp = bytesPerPixel;
  const rows: boolean[][] = [];
  let pos = 0;
  let prevRow = Buffer.alloc(stride);

  const paeth = (a: number, b: number, c: number): number => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  };

  for (let y = 0; y < height; y++) {
    const filter = inflated[pos++];
    const raw = inflated.subarray(pos, pos + stride);
    pos += stride;

    const decoded = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const rawByte = raw[i];
      const a = i >= bpp ? decoded[i - bpp] : 0;
      const b = prevRow[i];
      const c = i >= bpp ? prevRow[i - bpp] : 0;
      let v: number;
      switch (filter) {
        case 0: v = rawByte; break;
        case 1: v = (rawByte + a) & 0xff; break;
        case 2: v = (rawByte + b) & 0xff; break;
        case 3: v = (rawByte + Math.floor((a + b) / 2)) & 0xff; break;
        case 4: v = (rawByte + paeth(a, b, c)) & 0xff; break;
        default: v = rawByte;
      }
      decoded[i] = v;
    }
    prevRow = decoded;

    const row = new Array<boolean>(width).fill(false);
    for (let x = 0; x < width; x++) {
      const i = x * bpp;
      let lum: number;
      if (bpp === 1) {
        lum = decoded[i];
      } else if (bpp === 3) {
        lum = 0.299 * decoded[i] + 0.587 * decoded[i + 1] + 0.114 * decoded[i + 2];
      } else {
        lum = 0.299 * decoded[i] + 0.587 * decoded[i + 1] + 0.114 * decoded[i + 2];
        const alpha = decoded[i + 3] / 255;
        lum = lum * alpha + 255 * (1 - alpha);
      }
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

  const logoPath = resolveLogoPath();
  if (!logoPath) {
    console.warn("[aceLogo] ace-logo-idle.png not found — badge will omit logo");
    return null;
  }

  cachedLogo = decodePngToMono(fs.readFileSync(logoPath));
  return cachedLogo;
}

/** Load Ace Electronics logo as a monochrome grid scaled to fit max bounds. */
export function loadAceLogoGrid(maxWidth: number, maxHeight: number): MonoGrid {
  const raw = ensureLogoCached();
  if (!raw?.length) return [];

  const srcW = raw[0].length;
  const srcH = raw.length;
  const scale = Math.min(maxWidth / srcW, maxHeight / srcH, 1);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  return scaleGrid(raw, w, h);
}

/** Blit a smaller grid centred onto a canvas row slice. */
export function blitCentered(
  canvas: MonoGrid,
  sprite: MonoGrid,
  topY: number,
): number {
  if (!sprite.length) return topY;
  const canvasW = canvas[0].length;
  const spriteW = sprite[0].length;
  const xOff = Math.max(0, Math.floor((canvasW - spriteW) / 2));

  for (let y = 0; y < sprite.length; y++) {
    const cy = topY + y;
    if (cy >= canvas.length) break;
    for (let x = 0; x < spriteW; x++) {
      if (sprite[y][x]) canvas[cy][xOff + x] = true;
    }
  }
  return topY + sprite.length;
}
