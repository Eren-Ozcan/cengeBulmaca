// src/puzzles/manifest.json dosyasını üretir: her bulmacanın tam içeriğini
// (clues/blocks) değil, listeleme ekranlarının ihtiyaç duyduğu hafif meta
// verisini (id/title/rows/cols/difficulty/order/dosya adı) içerir.
//
// Neden gerekli: puzzles/index.ts artık tam bulmaca içeriğini lazy (ilk N
// hariç arka planda) yüklüyor; ama görüntüleme sırası puzzle içindeki
// "order" alanına bağlı, o da dosya içeriği okunmadan bilinemez. Bu script
// bir kerelik/derleme-öncesi adım olarak order bilgisini küçük bir
// manifest'e çıkarır ki index.ts tüm 300 dosyayı açmadan sıralayabilsin.
//
// Yeni bulmaca eklendiğinde veya order/title değiştiğinde tekrar çalıştır:
//   npm run puzzles:manifest
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const puzzlesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "puzzles");
const files = readdirSync(puzzlesDir).filter((f) => /^puzzle-\d+\.json$/.test(f));

const entries = files.map((file) => {
  const data = JSON.parse(readFileSync(join(puzzlesDir, file), "utf8"));
  const fileNumber = Number(/puzzle-(\d+)\.json$/.exec(file)[1]);
  return {
    id: data.id,
    title: data.title,
    rows: data.rows,
    cols: data.cols,
    difficulty: data.difficulty,
    order: data.order ?? fileNumber,
    file: `./${file}`,
  };
});

entries.sort((a, b) => a.order - b.order);

const outFile = join(puzzlesDir, "manifest.json");
writeFileSync(outFile, JSON.stringify(entries, null, 2) + "\n", "utf8");
console.log(`Yazıldı: ${outFile} (${entries.length} bulmaca)`);
