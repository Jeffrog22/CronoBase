#!/usr/bin/env node
// Gera os ícones PNG do PWA CronoBase sem dependências externas.
// Uso: node scripts/gen-icons.js
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "icons");
const SS = 4; // supersampling (antialias)

const BLUE = [37, 99, 235]; // #2563eb
const BLUE_DARK = [29, 78, 216]; // #1d4ed8
const WHITE = [255, 255, 255];

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

// Distância do ponto p ao segmento ab (2D)
function distSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const dx = px - (ax + t * vx), dy = py - (ay + t * vy);
  return Math.hypot(dx, dy);
}

// Cor de um ponto (normalizado 0..1) no espaço do ícone
function sample(u, v, glyphScale) {
  const cx = 0.5, cy = 0.575;
  const r = 0.285 * glyphScale;
  const stroke = 0.052 * glyphScale;

  // fundo: degradê vertical sutil
  let col = mix(BLUE, BLUE_DARK, Math.min(1, Math.max(0, v)));

  // coroa (topo): haste + barra
  const stemW = 0.035 * glyphScale, stemTop = cy - r - 0.115 * glyphScale, stemBot = cy - r - 0.01 * glyphScale;
  if (u > cx - stemW && u < cx + stemW && v > stemTop && v < stemBot) col = WHITE;
  const barHalf = 0.075 * glyphScale, barY = stemTop, barH = 0.04 * glyphScale;
  if (Math.abs(u - cx) < barHalf && v > barY - barH / 2 && v < barY + barH / 2) col = WHITE;

  // botão lateral (45°)
  const ang = Math.PI / 4;
  const bx = cx + Math.cos(-ang) * r, by = cy + Math.sin(-ang) * r;
  const bx2 = cx + Math.cos(-ang) * (r + 0.075 * glyphScale), by2 = cy + Math.sin(-ang) * (r + 0.075 * glyphScale);
  const dSide = distSeg(u, v, bx, by, bx2, by2);
  if (dSide < 0.028 * glyphScale) col = WHITE;

  // aro do mostrador
  const d = Math.hypot(u - cx, v - cy);
  const ring = Math.abs(d - r);
  if (ring < stroke / 2) col = WHITE;

  // ponteiros
  const dH1 = distSeg(u, v, cx, cy, cx + r * 0.52, cy - r * 0.52);
  const dH2 = distSeg(u, v, cx, cy, cx + r * 0.68, cy + r * 0.18);
  const hw = 0.030 * glyphScale;
  if (dH1 < hw || dH2 < hw) col = WHITE;
  if (Math.hypot(u - cx, v - cy) < 0.035 * glyphScale) col = WHITE;

  return col;
}

function render(size, { safe = false } = {}) {
  const big = size * SS;
  const buf = Buffer.alloc(big * big * 4);
  // no maskable, glyph é reduzido para caber na zona segura (80%)
  const glyphScale = safe ? 0.72 : 1;
  for (let y = 0; y < big; y++) {
    const v = y / (big - 1);
    for (let x = 0; x < big; x++) {
      const u = x / (big - 1);
      const [r, g, b] = sample(u, v, glyphScale);
      const i = (y * big + x) * 4;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    }
  }
  // downsample com média (box filter)
  const out = Buffer.alloc(size * size * 4);
  const area = SS * SS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * big + (x * SS + sx)) * 4;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3];
        }
      }
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / area);
      out[o + 1] = Math.round(g / area);
      out[o + 2] = Math.round(b / area);
      out[o + 3] = Math.round(a / area);
    }
  }
  return out;
}

mkdirSync(OUT, { recursive: true });
const targets = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["icon-maskable-192.png", 192, { safe: true }],
  ["icon-maskable-512.png", 512, { safe: true }],
  ["apple-touch-icon.png", 180, {}],
];
for (const [name, size, opts] of targets) {
  const png = encodePNG(size, render(size, opts));
  writeFileSync(join(OUT, name), png);
  console.log(`[icons] ${name} (${size}x${size}) — ${png.length} bytes`);
}
