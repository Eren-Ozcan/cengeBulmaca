// Duman temalı app icon / favicon üretici.
//
// Kaynak: tools/icon-src/duman-icon-raw.png (Gemini ile üretilen, kare,
// köşeleri beyaz kare üstünde turuncu daire içinde kedi portresi).
//
// Akış:
//  1. Köşelerden flood-fill ile beyaz arka planı şeffaflaştır (turuncu
//     daire + kedi olduğu gibi kalır) -> foreground.png
//  2. Dairenin turuncu rengini örnekle -> adaptive icon background rengi
//     (aynı renk olunca daire kenarı görünmez, hangi maske şekli
//     uygulanırsa uygulansın kaynaşır).
//  3. sharp ile Android mipmap yoğunluklarına ve favicon'a ölçekle.
//
// Kullanım: node tools/generate-icons.mjs

import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const SRC = join(root, "tools/icon-src/duman-icon-raw.png");

const RES = join(root, "android/app/src/main/res");
// legacy launcher / round: dp boyutu = px boyutu (mdpi baz)
const LAUNCHER_SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
// adaptive foreground: 108dp tuval, yoğunluğa göre ölçekli
const FOREGROUND_SIZES = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

function colorDistToWhite(r, g, b) {
  return 255 - Math.min(r, g, b);
}

/** Köşelerden başlayıp beyaza yakın, birbirine bağlı pikselleri şeffaflaştırır. */
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

  const THRESHOLD = 18; // beyazdan sapma toleransı

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
    if (colorDistToWhite(r, g, b) > THRESHOLD) continue; // beyaz değil, sınır

    raw[p + 3] = 0; // şeffaf yap

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

  // dairenin turuncu tonunu örnekle: üst-orta, kedi kulaklarının üstü
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
  // turuncu zemin üstünde tam kare, kenardan kenara ikon (tarayıcı sekmesi için)
  const bgLayer = { create: { width, height, channels: 4, background: bgHex } };
  const flatFull = await sharp(bgLayer).composite([{ input: foregroundBuf }]).png().toBuffer();
  const faviconBuf = await sharp(flatFull).resize(256, 256).png().toBuffer();
  writeFileSync(join(root, "public/favicon.png"), faviconBuf);
  console.log("public/favicon.png yazıldı");

  // ---------- adaptive icon background rengi ----------
  writeFileSync(
    join(RES, "values/ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${bgHex}</color>\n</resources>\n`,
  );
  writeFileSync(
    join(RES, "drawable/ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="108dp"\n    android:height="108dp"\n    android:viewportHeight="108"\n    android:viewportWidth="108">\n    <path android:fillColor="${bgHex}" android:pathData="M0,0h108v108h-108z" />\n</vector>\n`,
  );
  console.log("adaptive icon background güncellendi:", bgHex);

  // ---------- her yoğunluk için raster üret ----------
  for (const [density, size] of Object.entries(LAUNCHER_SIZES)) {
    const dir = join(RES, `mipmap-${density}`);
    mkdirSync(dir, { recursive: true });

    // legacy ic_launcher / ic_launcher_round: kenardan kenara, arka plan
    // rengiyle kaynaşmış tam kare (API < 26 maskesiz gösterir)
    const flat = await sharp(flatFull).resize(size, size).png().toBuffer();
    writeFileSync(join(dir, "ic_launcher.png"), flat);
    writeFileSync(join(dir, "ic_launcher_round.png"), flat);

    // adaptive foreground: 108dp tuval, OS maskesi (yuvarlak/squircle) sadece
    // iç ~66dp'lik "güvenli alan"ı garanti gösterir; konuyu ~%65 ölçekleyip
    // şeffaf boşlukla ortala ki kulaklar kesilmesin
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

  console.log("Tamamlandı.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
