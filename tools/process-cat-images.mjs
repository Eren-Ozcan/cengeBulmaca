// Gemini web arayüzünden indirilen kedi portrelerini (public/cats/*.png)
// temizler.
//
// Gözlemlenen sorun: Gemini web'in "Tam boyutu indir" çıktısı GERÇEK alfa
// şeffaflığı içermiyor — istenen "transparent background" bir önizleme
// dama deseni (ya da bazen düz soluk bir renk) olarak TAMAMEN OPAK
// piksellere gömülüyor (alpha=255 her yerde). Ayrıca sağ alt köşede
// yarı saydam bir Gemini kıvılcım logosu bulunuyor. Bu script:
//  1. Görselin 4 köşesinden zemin renk(ler)ini örnekler (dama deseni ise
//     genelde 1-2 farklı ton çıkar, düz renkse tek ton).
//  2. Köşelerden başlayan bir flood-fill ile bu renklere yakın, birbirine
//     bağlı tüm pikselleri gerçekten şeffaflaştırır (alpha=0). Bağlantı
//     tabanlı olduğu için kalın kontur çizgisinde durur — beyaz tüylü bir
//     kedi zeminle aynı renkte olsa bile konturun içine sızmaz. Köşedeki
//     logo, zeminle bağlantılı olduğu için bu adımda kendiliğinden gider.
//  3. Şeffaf kenar boşluklarını kırpıp (trim) sadece kediyi bırakır.
//  4. Sonucu sabit bir kare tuvale ortalanmış halde yerleştirir — 16
//     karakterin hepsi uygulamada aynı çerçeveleme/ölçekte görünsün diye.
//
// Kullanım: node tools/process-cat-images.mjs
// Birden fazla kez çalıştırmak güvenlidir (zaten temizlenmiş bir
// dosyada köşeler zaten şeffaftır, flood-fill ve trim değişiklik yapmaz).

import sharp from "sharp";
import { readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATS_DIR = join(__dirname, "..", "public/cats");
const CANVAS = 900;
const CONTENT = 760; // CANVAS içindeki kedi boyutu, geri kalanı şeffaf kenar boşluğu
const COLOR_TOLERANCE = 26; // kanal başına izin verilen sapma

function colorDist(r1, g1, b1, r2, g2, b2) {
  return Math.max(Math.abs(r1 - r2), Math.abs(g1 - g2), Math.abs(b1 - b2));
}

function matchesAnyReference(r, g, b, refs) {
  return refs.some((ref) => colorDist(r, g, b, ref[0], ref[1], ref[2]) <= COLOR_TOLERANCE);
}

/** Köşelerden zemin rengi örnekleri toplar (birbirine çok yakın olanları tekilleştirir). */
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

/** Köşelerden başlayıp zemin rengine yakın, birbirine bağlı pikselleri şeffaflaştırır. */
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

    data[p + 3] = 0; // şeffaf yap

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

  // sadece kediyi bırakacak şekilde şeffaf kenarları kırp
  const trimmed = await sharp(cleaned).trim({ threshold: 10 }).toBuffer();
  const trimmedMeta = await sharp(trimmed).metadata();

  // sabit tuvale ortalanmış şekilde yerleştir
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
