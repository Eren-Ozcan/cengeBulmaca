// Tüm bulmacaları küresel ipucu takibiyle yeniden üretir.
//
// Kullanım:
//   node tools/regenerate-all.mjs [baseSeed] [--strict]
//
// --strict: aynı cevap tüm üretim boyunca yalnızca bir kez kullanılır, dolayısıyla
// aynı soru da iki bulmacada çıkmaz. Sözlük yetmezse bulmacalar üretilemez ve
// eski dosyaları korunur.
//
// Her src/puzzles/puzzle-N.json dosyasının kimliği, başlığı, satır/sütun
// sayısı, zorluğu ve sırası korunur; sadece ızgara ve sorular yenilenir.
// generate.mjs'teki tracker sayesinde aynı ipucu metni 300 bulmaca boyunca
// mümkün olduğunca az tekrarlanır (bkz. createTracker/commitToTracker).

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPuzzle, createTracker, commitToTracker } from "./generate.mjs";

const puzzleDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "puzzles",
);

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const baseSeed = Number(args.find((a) => !a.startsWith("--")) ?? 20260819);

const files = readdirSync(puzzleDir)
  .filter((f) => /^puzzle-\d+\.json$/.test(f))
  .map((f) => ({ file: f, n: Number(f.match(/\d+/)[0]) }))
  .sort((a, b) => a.n - b.n);

const tracker = createTracker({ strict });
const failures = [];
let totalClues = 0;

for (const { file, n } of files) {
  const path = join(puzzleDir, file);
  const old = JSON.parse(readFileSync(path, "utf8"));

  let built = null;
  // Aynı bulmaca için birkaç farklı tohum dene: ilk tohum üretilemezse
  // (maske/atama/doldurma elemesi) sonraki tohumla devam et.
  for (let t = 0; t < 5 && !built; t++) {
    const { puzzle } = buildPuzzle({
      id: old.id,
      title: old.title,
      rows: old.rows,
      cols: old.cols,
      difficulty: old.difficulty,
      order: old.order,
      seed: baseSeed + n * 1013 + t * 104729,
      tracker,
    });
    if (puzzle) built = puzzle;
  }

  if (!built) {
    failures.push(old.id);
    console.error(`${old.id}: üretilemedi, eski dosya korundu`);
    continue;
  }

  commitToTracker(tracker, built.clues);
  totalClues += built.clues.length;
  writeFileSync(path, JSON.stringify(built, null, 2) + "\n", "utf8");
  if (n % 25 === 0) console.log(`${n}/${files.length} ...`);
}

// ---------- özet ----------
const counts = [...tracker.text.values()];
const dupGroups = counts.filter((v) => v > 1).length;
const dupSlots = counts.reduce((s, v) => s + (v > 1 ? v : 0), 0);
console.log(
  `\n${files.length} bulmaca, ${totalClues} soru, ${tracker.text.size} farklı ipucu metni.`,
);
console.log(
  `Tekrarlanan metin grubu: ${dupGroups}, tekrar içeren soru: ${dupSlots}.`,
);
if (failures.length) console.log(`Üretilemeyen: ${failures.join(", ")}`);
