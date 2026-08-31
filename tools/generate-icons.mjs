// Duman-themed app icon / favicon generator.
//
// Source: tools/icon-src/duman-icon-raw.png (generated with Gemini, square,
// cat portrait inside an orange circle on a white square, corners included).
//
// Flow:
//  1. Flood-fill from the corners to make the white background transparent
//     (the orange circle + cat stay as-is) -> foreground.png
//  2. Sample the circle's orange tone -> adaptive icon background color
//     (same color makes the circle's edge invisible, blending in whatever
//     mask shape gets applied).
//  3. Scale with sharp to Android mipmap densities and to the favicon.
//
// Usage: node tools/generate-icons.mjs

import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const SRC = join(root, "tools/icon-src/duman-icon-raw.png");

const RES = join(root, "android/app/src/main/res");
// legacy launcher / round: dp size = px size (mdpi baseline)
const LAUNCHER_SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
// adaptive foreground: 108dp canvas, scaled per density
const FOREGROUND_SIZES = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

function colorDistToWhite(r, g, b) {
  return 255 - Math.min(r, g, b);
}

/** Starting from the corners, makes connected near-white pixels transparent. */
function floodFillTransparentBg(raw, width, height, channels) {
  const visited = new Uint8Array(width * height);
  const stack = [];
  const seeds = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  for (const [x, y] of seeds) stack.push(y * width + x);

  const THRESHOLD = 18; // tolerance for deviation from white

  while (stack.length) {
    const idx = stack.pop();
    if (visited[idx]) continue;
    visited[idx] = 1;
    const x = idx % width;
    const y = (idx / width) | 0;
    const p = idx * channels;
    const r = raw[p];
    const g = raw[p + 1];
    const b = raw[p + 2];
    if (colorDistToWhite(r, g, b) > THRESHOLD) continue; // not white, boundary

    raw[p + 3] = 0; // make transparent

    if (x > 0) stack.push(idx - 1);
    if (x < width - 1) stack.push(idx + 1);
    if (y > 0) stack.push(idx - width);
    if (y < height - 1) stack.push(idx + width);
  }
}

async function main() {
  const img = sharp(SRC).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  floodFillTransparentBg(data, width, height, channels);

  // sample the circle's orange tone: top-center, above the cat's ears
  const sampleX = Math.round(width * 0.5);
  const sampleY = Math.round(height * 0.14);
  const sp = (sampleY * width + sampleX) * channels;
  const bgHex = `#${data[sp].toString(16).padStart(2, "0")}${data[sp + 1]
    .toString(16)
    .padStart(2, "0")}${data[sp + 2].toString(16).padStart(2, "0")}`;
  console.log("Arka plan rengi örneklendi:", bgHex);

  const foreground = sharp(data, { raw: { width, height, channels } }).png();
  const foregroundBuf = await foreground.toBuffer();

  // ---------- favicon ----------
  // full square, edge-to-edge icon on an orange ground (for the browser tab)
  const bgLayer = { create: { width, height, channels: 4, background: bgHex } };
  const flatFull = await sharp(bgLayer).composite([{ input: foregroundBuf }]).png().toBuffer();
  const faviconBuf = await sharp(flatFull).resize(256, 256).png().toBuffer();
  writeFileSync(join(root, "public/favicon.png"), faviconBuf);
  console.log("public/favicon.png yazıldı");

  // ---------- adaptive icon background color ----------
  writeFileSync(
    join(RES, "values/ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${bgHex}</color>\n</resources>\n`,
  );
  writeFileSync(
    join(RES, "drawable/ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="108dp"\n    android:height="108dp"\n    android:viewportHeight="108"\n    android:viewportWidth="108">\n    <path android:fillColor="${bgHex}" android:pathData="M0,0h108v108h-108z" />\n</vector>\n`,
  );
  console.log("adaptive icon background güncellendi:", bgHex);

  // ---------- generate raster for every density ----------
  for (const [density, size] of Object.entries(LAUNCHER_SIZES)) {
    const dir = join(RES, `mipmap-${density}`);
    mkdirSync(dir, { recursive: true });

    // legacy ic_launcher / ic_launcher_round: edge-to-edge full square
    // blended with the background color (API < 26 shows it unmasked)
    const flat = await sharp(flatFull).resize(size, size).png().toBuffer();
    writeFileSync(join(dir, "ic_launcher.png"), flat);
    writeFileSync(join(dir, "ic_launcher_round.png"), flat);

    // adaptive foreground: 108dp canvas; the OS mask (circle/squircle) only
    // guarantees the inner ~66dp "safe zone" is shown, so scale the subject
    // to ~65% and center it with transparent padding so the ears aren't cut off
    const fgSize = FOREGROUND_SIZES[density];
    const inner = Math.round(fgSize * 0.65);
    const pad = Math.round((fgSize - inner) / 2);
    const fg = await sharp(foregroundBuf)
      .resize(inner, inner)
      .extend({
        top: pad,
        bottom: fgSize - inner - pad,
        left: pad,
        right: fgSize - inner - pad,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    writeFileSync(join(dir, "ic_launcher_foreground.png"), fg);

    console.log(`mipmap-${density}: ${size}px launcher, ${fgSize}px foreground`);
  }

  // ---------- Play Store: 512x512 high-resolution icon ----------
  const storeAssetsDir = join(root, "docs/store-assets");
  mkdirSync(storeAssetsDir, { recursive: true });
  const icon512 = await sharp(flatFull).resize(512, 512).png().toBuffer();
  writeFileSync(join(storeAssetsDir, "icon-512.png"), icon512);
  console.log("docs/store-assets/icon-512.png yazıldı");

  // ---------- Play Store: 1024x500 feature graphic ----------
  const FG_W = 1024;
  const FG_H = 500;
  const PORTRAIT_SIZE = 360;
  const portrait = await sharp(foregroundBuf).resize(PORTRAIT_SIZE, PORTRAIT_SIZE).toBuffer();
  const textSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${FG_W}" height="${FG_H}">
  <text x="56" y="215" font-family="Arial, sans-serif" font-size="66" font-weight="900" fill="#2b2430">Çengel Bulmaca</text>
  <text x="58" y="270" font-family="Arial, sans-serif" font-size="27" font-weight="700" fill="#5b4a35">Bekçi kedileriyle Anadolu turu</text>
</svg>`);
  const featureGraphic = await sharp({
    create: { width: FG_W, height: FG_H, channels: 4, background: bgHex },
  })
    .composite([
      {
        input: portrait,
        left: FG_W - PORTRAIT_SIZE - 40,
        top: Math.round((FG_H - PORTRAIT_SIZE) / 2),
      },
      { input: textSvg, left: 0, top: 0 },
    ])
    .flatten({ background: bgHex })
    .removeAlpha() // Play Store feature graphic requires a PNG with no alpha channel (24-bit)
    .png()
    .toBuffer();
  writeFileSync(join(storeAssetsDir, "feature-graphic.png"), featureGraphic);
  console.log("docs/store-assets/feature-graphic.png yazıldı");

  console.log("Tamamlandı.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
