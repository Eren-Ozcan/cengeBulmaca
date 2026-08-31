// Cleans up cat portraits downloaded from the Gemini web UI
// (public/cats/*.png).
//
// Observed issue: Gemini web's "Download full size" output doesn't contain
// REAL alpha transparency — the requested "transparent background" is baked
// into FULLY OPAQUE pixels as a preview checkerboard pattern (or sometimes a
// flat pale color) (alpha=255 everywhere). There's also a semi-transparent
// Gemini spark logo in the bottom-right corner. This script:
//  1. Samples the ground color(s) from the image's 4 corners (a checkerboard
//     usually yields 1-2 distinct tones, a flat color yields one).
//  2. Runs a flood-fill from the corners to actually make all connected
//     pixels close to these colors transparent (alpha=0). Because it's
//     connectivity-based, it stops at a thick outline — even a white-furred
//     cat that shares the ground's color won't leak past the outline. The
//     corner logo disappears on its own in this step since it's connected
//     to the ground.
//  3. Trims the transparent margins, leaving only the cat.
//  4. Places the result centered on a fixed square canvas — so all 16
//     characters appear at the same framing/scale in the app.
//
// Usage: node tools/process-cat-images.mjs
// Safe to run more than once (on an already-cleaned file the corners are
// already transparent, so flood-fill and trim make no change).

import sharp from "sharp";
import { readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATS_DIR = join(__dirname, "..", "public/cats");
const CANVAS = 900;
const CONTENT = 760; // cat size within CANVAS, the rest is transparent margin
const COLOR_TOLERANCE = 26; // allowed deviation per channel

function colorDist(r1, g1, b1, r2, g2, b2) {
  return Math.max(Math.abs(r1 - r2), Math.abs(g1 - g2), Math.abs(b1 - b2));
}

function matchesAnyReference(r, g, b, refs) {
  return refs.some((ref) => colorDist(r, g, b, ref[0], ref[1], ref[2]) <= COLOR_TOLERANCE);
}

/** Collects ground-color samples from the corners (dedupes near-identical ones). */
function sampleCornerColors(data, width, height, channels) {
  const pts = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
  ];
  const colors = [];
  for (const [x, y] of pts) {
    const i = (y * width + x) * channels;
    const c = [data[i], data[i + 1], data[i + 2]];
    if (!colors.some((ex) => colorDist(ex[0], ex[1], ex[2], c[0], c[1], c[2]) <= 6)) {
      colors.push(c);
    }
  }
  return colors;
}

/** Starting from the corners, makes connected pixels close to the ground color transparent. */
function floodFillBackground(data, width, height, channels, refs) {
  const visited = new Uint8Array(width * height);
  const stack = [0, width - 1, (height - 1) * width, height * width - 1];
  while (stack.length) {
    const idx = stack.pop();
    if (visited[idx]) continue;
    visited[idx] = 1;
    const x = idx % width;
    const y = (idx / width) | 0;
    const p = idx * channels;
    if (!matchesAnyReference(data[p], data[p + 1], data[p + 2], refs)) continue;

    data[p + 3] = 0; // make transparent

    if (x > 0) stack.push(idx - 1);
    if (x < width - 1) stack.push(idx + 1);
    if (y > 0) stack.push(idx - width);
    if (y < height - 1) stack.push(idx + width);
  }
}

async function processOne(path) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const refs = sampleCornerColors(data, width, height, channels);
  floodFillBackground(data, width, height, channels, refs);

  const cleaned = await sharp(data, { raw: { width, height, channels } }).png().toBuffer();

  // trim transparent margins so only the cat is left
  const trimmed = await sharp(cleaned).trim({ threshold: 10 }).toBuffer();
  const trimmedMeta = await sharp(trimmed).metadata();

  // place centered on the fixed canvas
  const scale = Math.min(CONTENT / trimmedMeta.width, CONTENT / trimmedMeta.height, 1);
  const outW = Math.round(trimmedMeta.width * scale);
  const outH = Math.round(trimmedMeta.height * scale);
  const resized = await sharp(trimmed).resize(outW, outH).toBuffer();

  const final = await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, left: Math.round((CANVAS - outW) / 2), top: Math.round((CANVAS - outH) / 2) }])
    .png()
    .toBuffer();

  writeFileSync(path, final);
}

async function main() {
  const files = readdirSync(CATS_DIR).filter((f) => f.toLowerCase().endsWith(".png"));
  if (files.length === 0) {
    console.log("public/cats/ içinde .png bulunamadı.");
    return;
  }
  for (const f of files) {
    const path = join(CATS_DIR, f);
    await processOne(path);
    console.log(`temizlendi: ${f}`);
  }
  console.log(`Tamamlandı: ${files.length} görsel.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
