#!/usr/bin/env node
// Generates the "My Trainer" app icon as an opaque PNG.
//
// No image libraries are available here, so shapes are rendered from signed
// distance fields (exact analytic coverage, so edges are properly antialiased)
// and encoded into a PNG by hand.
//
//   node scripts/generate-icon.js assets/images/icon.png 1024 cream
//
// Ships the "cream" theme: ink figure and clay arc on the app's own cream
// canvas. Chosen over the "clay" alternative after comparing both at 40px —
// the ink figure is the darkest element, so it holds its shape when the icon is
// downscaled, whereas a light figure on clay merges with the light track ring.
// Cream also matches splash.backgroundColor, so launch has no seam.
//
// The figure comes from components/figurePaths.ts, so the icon and the in-app
// mark always show the same silhouette. Re-run scripts/trace-logo.js if the
// source artwork changes, then re-run this.

const fs = require("fs");
const zlib = require("zlib");

const SIZE = Number(process.argv[3]) || 1024;
const OUT = process.argv[2];
if (!OUT) {
  console.error("usage: gen-icon.js <out.png> [size]");
  process.exit(1);
}

// Everything below is authored against a 1024 grid, then scaled to SIZE.
const K = SIZE / 1024;

// Two candidate palettes, compared at home-screen size before committing.
const THEMES = {
  // Cream mark on a clay field — mirrors Habit-Visualizer's cream-on-teal.
  clay: {
    FIELD: [0xa4, 0x54, 0x2f],
    TRACK: [0xcf, 0xa6, 0x91], // cream at ~50% over the field
    ARC: [0xfb, 0xf9, 0xf2],
    FIG: [0xfb, 0xf9, 0xf2],
  },
  // Ink on the app's own cream canvas: highest figure contrast, and identical
  // to the splash background so there is no seam at launch.
  cream: {
    FIELD: [0xfb, 0xf9, 0xf2],
    TRACK: [0xe8, 0xe0, 0xcd],
    ARC: [0xa4, 0x54, 0x2f],
    FIG: [0x3b, 0x33, 0x30],
  },
};

const THEME = THEMES[process.argv[4] || "cream"];
if (!THEME) {
  console.error("unknown theme; use 'clay' or 'cream'");
  process.exit(1);
}
const { FIELD, TRACK, ARC: ARC_C, FIG: FIG_C } = THEME;

const C = { x: 512 * K, y: 512 * K };
const RING_R = 330 * K;
const RING_HW = 18 * K; // half stroke

// Arc sweeps from 12 o'clock clockwise ~109°, matching the in-app mark.
const ARC_A0 = (-90 * Math.PI) / 180;
const ARC_A1 = (19 * Math.PI) / 180;

// The figure is the original logo silhouette, traced to vector by
// scripts/trace-logo.js and shared with the app (components/figurePaths.ts), so
// the icon and the in-app mark are guaranteed to show the same artwork.
const figSrc = fs.readFileSync(
  require("path").join(__dirname, "../components/figurePaths.ts"),
  "utf8",
);
const POLYS = [...figSrc.matchAll(/"(M [^"]+)"/g)].map((m) =>
  m[1]
    .replace(/^M /, "")
    .replace(/ Z$/, "")
    .split(/ L /)
    .map((p) => p.trim().split(/\s+/).map(Number)),
);
if (!POLYS.length) throw new Error("no figure paths found");
const FIG_H = Number(/FIGURE_HEIGHT = ([\d.]+)/.exec(figSrc)[1]);

// Fill ~86% of the ring's inner diameter, centred.
const INNER_D = 2 * (330 - 18);
const S = ((0.86 * INNER_D) / 100) * K;
const TX = 512 * K - (S * 100) / 2;
const TY = 512 * K - (S * FIG_H) / 2;

// Polygons in device space, plus a bounding box to skip whole rows cheaply.
const SHAPES = POLYS.map((poly) => {
  const pts = poly.map(([x, y]) => [TX + S * x, TY + S * y]);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { pts, x0, y0, x1, y1 };
});

function inPoly(pts, x, y) {
  let win = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      win = !win;
  }
  return win;
}

/** Figure coverage at a pixel, supersampled (polygons have no cheap SDF). */
const FIG_SS = 4;
function figureCoverage(px, py) {
  let hits = 0;
  for (const s of SHAPES) {
    if (px < s.x0 - 1 || px > s.x1 + 1 || py < s.y0 - 1 || py > s.y1 + 1)
      continue;
    for (let sy = 0; sy < FIG_SS; sy++) {
      for (let sx = 0; sx < FIG_SS; sx++) {
        const x = px - 0.5 + (sx + 0.5) / FIG_SS;
        const y = py - 0.5 + (sy + 0.5) / FIG_SS;
        if (inPoly(s.pts, x, y)) hits++;
      }
    }
  }
  return Math.min(1, hits / (FIG_SS * FIG_SS));
}

const sdRing = (px, py) =>
  Math.abs(Math.hypot(px - C.x, py - C.y) - RING_R) - RING_HW;

function sdArc(px, py) {
  const vx = px - C.x;
  const vy = py - C.y;
  const ang = Math.atan2(vy, vx);
  if (ang >= ARC_A0 && ang <= ARC_A1) {
    return Math.abs(Math.hypot(vx, vy) - RING_R) - RING_HW;
  }
  // Outside the sweep: distance to the nearer round cap.
  const p0 = [C.x + RING_R * Math.cos(ARC_A0), C.y + RING_R * Math.sin(ARC_A0)];
  const p1 = [C.x + RING_R * Math.cos(ARC_A1), C.y + RING_R * Math.sin(ARC_A1)];
  const d = Math.min(
    Math.hypot(px - p0[0], py - p0[1]),
    Math.hypot(px - p1[0], py - p1[1]),
  );
  return d - RING_HW;
}

/** Analytic 1px-wide antialiasing from a signed distance. */
const cov = (d) => (d <= -0.5 ? 1 : d >= 0.5 ? 0 : 0.5 - d);

let maxFigR = 0;
const buf = Buffer.alloc(SIZE * SIZE * 3);

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const px = x + 0.5;
    const py = y + 0.5;

    let r = FIELD[0];
    let g = FIELD[1];
    let b = FIELD[2];

    const blend = (color, a) => {
      if (a <= 0) return;
      r = r + (color[0] - r) * a;
      g = g + (color[1] - g) * a;
      b = b + (color[2] - b) * a;
    };

    // Track ring, then the accent arc over it.
    blend(
      TRACK,
      cov(sdRing(px, py)),
    );
    blend(ARC_C, cov(sdArc(px, py)));

    const a = figureCoverage(px, py);
    blend(FIG_C, a);

    if (a > 0.5) {
      const dc = Math.hypot(px - C.x, py - C.y);
      if (dc > maxFigR) maxFigR = dc;
    }

    const i = (y * SIZE + x) * 3;
    buf[i] = Math.round(r);
    buf[i + 1] = Math.round(g);
    buf[i + 2] = Math.round(b);
  }
}

// ---- PNG encoding (RGB8, no alpha: iOS icons must be opaque) ----

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++)
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type: truecolour
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

// Each scanline gets filter byte 0 (None) — the art is flat colour, so this
// still compresses hard.
const raw = Buffer.alloc(SIZE * (SIZE * 3 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 3 + 1)] = 0;
  buf.copy(raw, y * (SIZE * 3 + 1) + 1, y * SIZE * 3, (y + 1) * SIZE * 3);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

fs.writeFileSync(OUT, png);
console.log(`wrote ${OUT} (${SIZE}x${SIZE}, ${(png.length / 1024).toFixed(1)} KB)`);
console.log(`  figure reaches r=${maxFigR.toFixed(0)}; ring inner edge r=${(RING_R - RING_HW).toFixed(0)}; clearance=${(RING_R - RING_HW - maxFigR).toFixed(0)}px`);
