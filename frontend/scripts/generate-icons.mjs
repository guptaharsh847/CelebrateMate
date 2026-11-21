// Generates PWA icons (PNG) without dependencies: a white gift on the brand purple.
//   node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');
const PURPLE = [0x79, 0x54, 0xc8];
const WHITE = [255, 255, 255];

// ── PNG encoding ──────────────────────────────────────────────────────────
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Shapes in a 64×64 design space (matches public/favicon.svg) ──────────
const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

function gift(x, y) {
  const bow = inEllipse(x, y, 26.5, 20.5, 6, 3.6) || inEllipse(x, y, 37.5, 20.5, 6, 3.6);
  const lid = inRoundRect(x, y, 15, 24, 49, 32, 3);
  const box = inRoundRect(x, y, 19, 31, 45, 51, 4);
  if (!(bow || lid || box)) return null;
  const ribbon = x >= 30.4 && x <= 33.6 && y >= 24 && y <= 51;
  const bowHole = inEllipse(x, y, 27, 20.5, 2.6, 1.2) || inEllipse(x, y, 37, 20.5, 2.6, 1.2);
  return ribbon || bowHole ? PURPLE : WHITE;
}

/**
 * @param size output pixels
 * @param opts.rounded transparent rounded corners (purpose "any") vs full bleed
 * @param opts.scale   how much of the canvas the gift occupies (maskable needs ≤ ~0.8 safe zone)
 */
function render(size, { rounded, scale }) {
  const px = Buffer.alloc(size * size * 4);
  const S = 4; // 4×4 supersampling
  for (let py = 0; py < size; py++) {
    for (let pxl = 0; pxl < size; pxl++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const u = ((pxl + (sx + 0.5) / S) / size) * 64;
          const v = ((py + (sy + 0.5) / S) / size) * 64;
          if (rounded && !inRoundRect(u, v, 0, 0, 64, 64, 14)) continue;
          const gu = 32 + (u - 32) / scale;
          const gv = 32 + (v - 33) / scale + 1;
          const c = gift(gu, gv) || PURPLE;
          r += c[0]; g += c[1]; b += c[2]; a += 255;
        }
      }
      const n = S * S;
      const i = (py * size + pxl) * 4;
      const coverage = a / 255;
      px[i] = coverage ? Math.round(r / coverage) : 0;
      px[i + 1] = coverage ? Math.round(g / coverage) : 0;
      px[i + 2] = coverage ? Math.round(b / coverage) : 0;
      px[i + 3] = Math.round(a / n);
    }
  }
  return encodePng(size, px);
}

mkdirSync(OUT, { recursive: true });
const icons = [
  ['icon-192.png', 192, { rounded: true, scale: 1 }],
  ['icon-512.png', 512, { rounded: true, scale: 1 }],
  ['maskable-512.png', 512, { rounded: false, scale: 0.72 }],
  ['apple-touch-icon.png', 180, { rounded: false, scale: 0.85 }],
];
for (const [name, size, opts] of icons) {
  writeFileSync(resolve(OUT, name), render(size, opts));
  console.log('wrote', name);
}
