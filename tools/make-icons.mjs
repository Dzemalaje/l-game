// Generates Expo/web icons from the DESIGN.md brand mark (Deep Forest tile, Warm Canvas "L").
// The Godot export only ever shipped the stock engine icon, so the installed app had no identity.
// Written with zlib + a minimal PNG encoder so the build needs no image dependency.
//
//   node tools/make-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const GREEN = [0x31, 0x5a, 0x35];
const IVORY = [0xf4, 0xf1, 0xe8];
const SS = 4; // supersampling factor; the only antialiasing we need for flat shapes

const crcTable = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 0);
  return Buffer.concat([head, data, crc]);
};

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // truecolour with alpha
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const insideRoundedRect = (x, y, left, top, size, radius) => {
  const right = left + size;
  const bottom = top + size;
  if (x < left || x > right || y < top || y > bottom) return false;
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
};

/**
 * The brand "L": a stem and a foot, proportioned like the oversized letterform used on the home
 * hero rather than a font glyph, so the icon needs no text rendering.
 */
const insideL = (x, y, size, scale, offsetY) => {
  const glyph = size * scale;
  const left = (size - glyph * 0.62) / 2;
  const top = (size - glyph) / 2 + offsetY;
  const stem = glyph * 0.24;
  const foot = glyph * 0.24;
  const inStem = x >= left && x <= left + stem && y >= top && y <= top + glyph;
  const inFoot = x >= left && x <= left + glyph * 0.62 && y >= top + glyph - foot && y <= top + glyph;
  return inStem || inFoot;
};

function render(size, { fullBleed, glyphScale, radiusRatio }) {
  const big = size * SS;
  const accum = Buffer.alloc(size * size * 4);
  const radius = big * radiusRatio;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x * SS + sx + 0.5;
          const py = y * SS + sy + 0.5;
          const onTile = fullBleed || insideRoundedRect(px, py, 0, 0, big, radius);
          if (!onTile) continue;
          const onGlyph = insideL(px, py, big, glyphScale, 0);
          const [cr, cg, cb] = onGlyph ? IVORY : GREEN;
          r += cr; g += cg; b += cb; a += 255;
        }
      }
      const samples = SS * SS;
      const index = (y * size + x) * 4;
      // Premultiplied averaging would darken the antialiased edge; average the covered samples only.
      const covered = a / 255;
      accum[index] = covered ? Math.round(r / covered) : 0;
      accum[index + 1] = covered ? Math.round(g / covered) : 0;
      accum[index + 2] = covered ? Math.round(b / covered) : 0;
      accum[index + 3] = Math.round(a / samples);
    }
  }
  return encodePng(size, size, accum);
}

mkdirSync(OUT, { recursive: true });
const write = (name, buffer) => {
  writeFileSync(join(OUT, name), buffer);
  console.log(`${name.padEnd(26)} ${(buffer.length / 1024).toFixed(1)} kB`);
};

// "any" icons keep the rounded tile silhouette; maskable icons fill the square so Android can crop
// them to any shape without clipping the letterform.
write("icon-192.png", render(192, { fullBleed: false, glyphScale: 0.62, radiusRatio: 0.22 }));
write("icon-512.png", render(512, { fullBleed: false, glyphScale: 0.62, radiusRatio: 0.22 }));
write("maskable-192.png", render(192, { fullBleed: true, glyphScale: 0.44, radiusRatio: 0 }));
write("maskable-512.png", render(512, { fullBleed: true, glyphScale: 0.44, radiusRatio: 0 }));
write("apple-touch-icon.png", render(180, { fullBleed: true, glyphScale: 0.56, radiusRatio: 0 }));
write("favicon-32.png", render(32, { fullBleed: false, glyphScale: 0.66, radiusRatio: 0.22 }));
