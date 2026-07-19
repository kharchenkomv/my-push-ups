#!/usr/bin/env node
// Traces the push-up figure out of assets/images/logo.png into vector paths.
//
// The figure in the old logo is exactly the pose we want to keep; only its
// colours are off-brand. Rather than redraw it by eye (which produced a crude
// stick figure), this decodes the PNG, isolates the white silhouette inside the
// ring, walks its contours, simplifies them, and emits SVG path data.

const fs = require("fs");
const zlib = require("zlib");

const SRC = process.argv[2];
const OUT = process.argv[3];
if (!SRC || !OUT) {
  console.error("usage: trace-logo.js <logo.png> <out.ts>");
  process.exit(1);
}

// ---- minimal PNG decode (8-bit, colour type 2 or 6, non-interlaced) ----
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let pos = 8;
  let w = 0;
  let h = 0;
  let colorType = 0;
  let bitDepth = 0;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error("interlaced PNG unsupported");
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`bit depth ${bitDepth} unsupported`);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`colour type ${colorType} unsupported`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(w * h * channels);

  // Undo PNG per-scanline filters.
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= channels ? prev[i - channels] : 0;
      const x = line[i];
      let v;
      if (filter === 0) v = x;
      else if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error(`bad filter ${filter}`);
      cur[i] = v & 0xff;
    }
  }
  return { w, h, channels, data: out };
}

const img = decodePng(fs.readFileSync(SRC));
const { w, h, channels, data } = img;
console.log(`decoded ${w}x${h}, ${channels} channels`);

// ---- isolate the figure ----
// Bright pixels, but the ring is bright too. Flood fill into components and
// discard any that stray out to the ring's radius; what is left is the body
// and the (detached) head.
const cx = w / 2;
const cy = h / 2;
const RING_GUARD = 0.30 * w; // anything beyond this radius belongs to the ring

const bright = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) {
  const o = i * channels;
  const lum = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  bright[i] = lum > 170 ? 1 : 0;
}

const label = new Int32Array(w * h).fill(-1);
const comps = [];
for (let start = 0; start < w * h; start++) {
  if (!bright[start] || label[start] !== -1) continue;
  const id = comps.length;
  const stack = [start];
  label[start] = id;
  const px = [];
  let touchesRing = false;
  while (stack.length) {
    const p = stack.pop();
    px.push(p);
    const x = p % w;
    const y = (p / w) | 0;
    if (Math.hypot(x - cx, y - cy) > RING_GUARD) touchesRing = true;
    const nbrs = [
      x > 0 ? p - 1 : -1,
      x < w - 1 ? p + 1 : -1,
      y > 0 ? p - w : -1,
      y < h - 1 ? p + w : -1,
    ];
    for (const n of nbrs) {
      if (n >= 0 && bright[n] && label[n] === -1) {
        label[n] = id;
        stack.push(n);
      }
    }
  }
  comps.push({ id, size: px.length, touchesRing, px });
}

const figure = comps
  .filter((c) => !c.touchesRing && c.size > 500)
  .sort((a, b) => b.size - a.size);
console.log(
  `components kept: ${figure.length} (sizes: ${figure.map((c) => c.size).join(", ")})`,
);

// Mask containing only the kept components.
const mask = new Uint8Array(w * h);
for (const c of figure) for (const p of c.px) mask[p] = 1;

// ---- contour extraction ----
// Walk the boundary of each component with a Moore-neighbourhood trace.
const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x]);

function traceComponent(comp) {
  // Topmost-leftmost pixel is guaranteed to be on the outer contour.
  let startP = comp.px[0];
  for (const p of comp.px) if (p < startP) startP = p;
  const sx = startP % w;
  const sy = (startP / w) | 0;

  const DIRS = [
    [1, 0], [1, 1], [0, 1], [-1, 1],
    [-1, 0], [-1, -1], [0, -1], [1, -1],
  ];
  const contour = [];
  let cxp = sx;
  let cyp = sy;
  let dir = 6; // start looking up
  const maxSteps = comp.size * 8 + 1000;
  for (let step = 0; step < maxSteps; step++) {
    contour.push([cxp, cyp]);
    let found = false;
    // Turn left from the direction we came, then scan clockwise.
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8;
      const nx = cxp + DIRS[d][0];
      const ny = cyp + DIRS[d][1];
      if (at(nx, ny)) {
        cxp = nx;
        cyp = ny;
        dir = d;
        found = true;
        break;
      }
    }
    if (!found) break;
    if (cxp === sx && cyp === sy && contour.length > 2) break;
  }
  return contour;
}

// ---- Douglas-Peucker simplification ----
function simplify(points, eps) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    let maxD = -1;
    let idx = -1;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const d = Math.abs((px - ax) * dy - (py - ay) * dx) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// ---- normalise to a 0..100 box and emit ----
const traced = figure.map((c) => traceComponent(c));

let minX = Infinity;
let minY = Infinity;
let maxX = -Infinity;
let maxY = -Infinity;
for (const c of traced)
  for (const [x, y] of c) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

const spanX = maxX - minX;
const spanY = maxY - minY;
const scale = 100 / spanX; // width normalised to 100 units
const EPS = spanX * 0.0009; // simplification tolerance, in source pixels

const paths = traced.map((c) => {
  const s = simplify(c, EPS);
  const pts = s.map(([x, y]) => [
    ((x - minX) * scale).toFixed(2),
    ((y - minY) * scale).toFixed(2),
  ]);
  return `M ${pts.map((p) => p.join(" ")).join(" L ")} Z`;
});

console.log(
  `traced: ${traced.map((c, i) => `${c.length}->${paths[i].split("L").length}`).join(", ")} points`,
);
console.log(
  `normalised box: 100 x ${((spanY * scale)).toFixed(2)} units`,
);

const ts = `// GENERATED by scripts/trace-logo.js — do not edit by hand.
//
// The push-up figure traced from the original logo artwork, normalised so the
// silhouette is 100 units wide. Path 0 is the body, path 1 the (detached) head.
export const FIGURE_PATHS = [
${paths.map((p) => `  "${p}",`).join("\n")}
] as const;

/** Height of the silhouette, in the same units (width is 100). */
export const FIGURE_HEIGHT = ${(spanY * scale).toFixed(2)};
`;

fs.writeFileSync(OUT, ts);
console.log(`wrote ${OUT} (${(ts.length / 1024).toFixed(1)} KB)`);
