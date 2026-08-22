// Bulmacaları ölçülen zorluğa göre yeniden sıralar: 1. bulmaca en kolay,
// sonuncusu en zor. Dosya adları ve "id" alanları DEĞİŞMEZ (oyuncu ilerlemesi
// id'ye bağlı); yalnızca "order", "title" ve "difficulty" alanları yazılır.
//
// Zorluk skoru dört ölçülebilir sinyalin ağırlıklı toplamı:
//   rare   cevabın sözlükte tek ipucu olması, yani sonradan TDK'dan eklenmiş
//          "derin" kelime olması. Çekirdek kelimeler 4-5 ipuçlu.
//   depth  cevabın sözlükteki sırası; sözlük yaygından nadire doğru büyüdü.
//   cross  kesişen hücre oranı; kesişim çözücüye yardım eder, tersi zorluktur.
//   size   ızgara alanı; büyük ızgara ilk bulmaca için caydırıcı.
//
// Kullanım: node tools/reorder-puzzles.mjs [--apply]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as dictMod from "./dictionary.mjs";

const dict = Object.values(dictMod).find(Array.isArray);
const dictIndex = new Map(dict.map((w, i) => [w.a, i]));
const clueCount = new Map(dict.map((w) => [w.a, w.c.length]));

const ARROW = {
  right: { sr: 0, sc: 1, dRow: 0, dCol: 1 },
  down: { sr: 1, sc: 0, dRow: 1, dCol: 0 },
  "right-down": { sr: 0, sc: 1, dRow: 1, dCol: 0 },
  "down-right": { sr: 1, sc: 0, dRow: 0, dCol: 1 },
};

// Not: cevap uzunluğu bilerek dışarıda. Bu sözlükte 4 harfli katman elle
// derlenmiş çekirdek kelimelerden oluşuyor (%68'i çok ipuçlu), 5-7 harfli
// katmanların tamamına yakını ise TDK'dan toplu çekilmiş derin kelimeler.
// Yani uzunluk, "rare" sinyalinin tersten kopyası olurdu.
const WEIGHTS = { rare: 0.45, depth: 0.25, cross: 0.18, size: 0.12 };

const puzzlesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "puzzles");
const files = readdirSync(puzzlesDir)
  .filter((f) => /^puzzle-\d+\.json$/.test(f))
  .sort((a, b) => Number(/\d+/.exec(a)[0]) - Number(/\d+/.exec(b)[0]));

const rows = files.map((file) => {
  const data = JSON.parse(readFileSync(join(puzzlesDir, file), "utf8"));
  const clues = data.clues;
  const usage = new Map();
  for (const clue of clues) {
    const t = ARROW[clue.arrow];
    const len = [...clue.answer].length;
    for (let i = 0; i < len; i++) {
      const key = `${clue.row + t.sr + t.dRow * i},${clue.col + t.sc + t.dCol * i}`;
      usage.set(key, (usage.get(key) ?? 0) + 1);
    }
  }
  const cells = [...usage.values()];

  return {
    file,
    data,
    rare: clues.filter((c) => (clueCount.get(c.answer) ?? 1) === 1).length / clues.length,
    depth:
      clues.reduce((sum, c) => sum + (dictIndex.get(c.answer) ?? dict.length) / dict.length, 0) /
      clues.length,
    // ters çevrildi: kesişim ne kadar azsa o kadar zor
    cross: 1 - cells.filter((v) => v > 1).length / cells.length,
    size: data.rows * data.cols,
  };
});

// her sinyali kendi min-max aralığında 0..1'e getir
for (const key of Object.keys(WEIGHTS)) {
  const values = rows.map((r) => r[key]);
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  for (const r of rows) r[`n_${key}`] = (r[key] - min) / span;
}
for (const r of rows) {
  r.score = Object.entries(WEIGHTS).reduce((sum, [k, w]) => sum + w * r[`n_${k}`], 0);
}

rows.sort((a, b) => a.score - b.score);

// zorluk etiketleri mevcut dağılımı korur, yalnızca hangi bulmacaya
// düştükleri değişir
const previous = rows.map((r) => r.data.difficulty);
const counts = { kolay: 0, orta: 0, zor: 0 };
for (const d of previous) if (d in counts) counts[d]++;
const labelFor = (i) => (i < counts.kolay ? "kolay" : i < counts.kolay + counts.orta ? "orta" : "zor");

const apply = process.argv.includes("--apply");
rows.forEach((r, i) => {
  const order = i + 1;
  const title = `Bulmaca ${order}`;
  const difficulty = labelFor(i);
  if (apply) {
    r.data.order = order;
    r.data.title = title;
    r.data.difficulty = difficulty;
    writeFileSync(join(puzzlesDir, r.file), JSON.stringify(r.data, null, 2) + "\n", "utf8");
  }
  r.newOrder = order;
  r.newDifficulty = difficulty;
});

console.log(`${rows.length} bulmaca zorluğa göre sıralandı${apply ? " ve yazıldı" : " (kuru koşu)"}.`);
console.log("en kolay 5:");
for (const r of rows.slice(0, 5))
  console.log(`  ${r.newOrder}. ${r.data.id} skor ${r.score.toFixed(3)} nadir ${(r.rare * 100) | 0}% kesişim ${(100 - r.cross * 100) | 0}%`);
console.log("en zor 5:");
for (const r of rows.slice(-5))
  console.log(`  ${r.newOrder}. ${r.data.id} skor ${r.score.toFixed(3)} nadir ${(r.rare * 100) | 0}% kesişim ${(100 - r.cross * 100) | 0}%`);
