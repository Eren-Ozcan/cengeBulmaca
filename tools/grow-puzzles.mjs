// Sözlüğün şu anki hâliyle sıfır tekrar kuralı altında kaç bulmaca
// üretilebildiğini ölçer.
//
// Kullanım: node tools/grow-puzzles.mjs [baseSeed] [--apply]
//
// Önce mevcut bulmacaları ortak bir strict takipçiyle yeniden üretir, sonra
// havuz tükenene kadar yeni bulmaca eklemeyi dener. `--apply` verilmezse
// hiçbir dosya yazılmaz, yalnızca ulaşılan sayı raporlanır.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPuzzle, createTracker, commitToTracker } from "./generate.mjs";

const puzzleDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "puzzles");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const baseSeed = Number(args.find((a) => !a.startsWith("--")) ?? 20260821);
const num = (name, dflt) => Number(args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? dflt);
// Havuz daraldıkça doldurma zorlaşıyor; kaç tohum denendiği sonucu doğrudan
// etkiliyor, bu yüzden dışarıdan ayarlanabilir.
const TRIES = num("tries", 8);
const GIVE_UP = num("giveup", 12);

const files = readdirSync(puzzleDir)
  .filter((f) => /^puzzle-\d+\.json$/.test(f))
  .map((f) => ({ file: f, n: Number(f.match(/\d+/)[0]) }))
  .sort((a, b) => a.n - b.n);

const tracker = createTracker({ strict: true });
let built = 0, failed = 0, clues = 0;
let maxN = 0, maxOrder = 0;
// Yeni bulmacalara mevcut setin boyut/zorluk dağılımını ver.
const shapes = [], difficulties = [];

for (const { file, n } of files) {
  const old = JSON.parse(readFileSync(join(puzzleDir, file), "utf8"));
  maxN = Math.max(maxN, n);
  maxOrder = Math.max(maxOrder, old.order ?? 0);
  shapes.push({ rows: old.rows, cols: old.cols });
  difficulties.push(old.difficulty);

  let p = null;
  for (let t = 0; t < TRIES && !p; t++) {
    const r = buildPuzzle({
      id: old.id, title: old.title, rows: old.rows, cols: old.cols,
      difficulty: old.difficulty, order: old.order,
      seed: baseSeed + n * 1013 + t * 104729, tracker,
    });
    if (r.puzzle) p = r.puzzle;
  }
  if (!p) { failed++; console.error(`${old.id}: uretilemedi`); continue; }
  commitToTracker(tracker, p.clues);
  clues += p.clues.length;
  built++;
  if (apply) writeFileSync(join(puzzleDir, file), JSON.stringify(p, null, 2) + "\n", "utf8");
  if (built % 20 === 0) console.log(`  mevcut ${built}/${files.length} | soru ${clues}`);
}

console.log(`\nmevcut set yeniden uretildi: ${built} bulmaca, ${clues} soru, ${failed} basarisiz`);
console.log(`havuz tuketilene kadar yeni bulmaca deneniyor...\n`);

// Arka arkaya GIVE_UP deneme boşa giderse havuz bitmiş sayılır.
let miss = 0, added = 0, n = maxN, order = maxOrder;

while (miss < GIVE_UP) {
  n++; order++;
  const shape = shapes[added % shapes.length];
  const difficulty = difficulties[added % difficulties.length];
  const id = `puzzle-${n}`;
  let p = null;
  for (let t = 0; t < TRIES && !p; t++) {
    const r = buildPuzzle({
      id, title: `Bulmaca ${n}`, rows: shape.rows, cols: shape.cols,
      difficulty, order, seed: baseSeed + n * 1013 + t * 104729, tracker,
    });
    if (r.puzzle) p = r.puzzle;
  }
  if (!p) { miss++; continue; }
  miss = 0;
  commitToTracker(tracker, p.clues);
  clues += p.clues.length;
  added++;
  if (apply) writeFileSync(join(puzzleDir, `${id}.json`), JSON.stringify(p, null, 2) + "\n", "utf8");
  if (added % 5 === 0) console.log(`  yeni ${added} | toplam ${built + added} bulmaca | soru ${clues}`);
}

console.log(`\nSONUC: ${built + added} bulmaca (${built} mevcut + ${added} yeni), ${clues} soru`);
console.log(`farkli ipucu metni: ${tracker.text.size}`);
const { WORDS } = await import("./dictionary.mjs");
const havuz = {}, kullanilan = {};
for (const w of WORDS) { const l = [...w.a].length; havuz[l] = (havuz[l] ?? 0) + 1; }
for (const a of tracker.answer?.keys() ?? []) { const l = [...a].length; kullanilan[l] = (kullanilan[l] ?? 0) + 1; }
console.log("");
console.log("katman tuketimi:");
for (const l of Object.keys(havuz).sort()) console.log(`  ${l} harf: ${kullanilan[l] ?? 0}/${havuz[l]}  %${Math.round(100 * (kullanilan[l] ?? 0) / havuz[l])}`);
console.log(apply ? "dosyalar yazildi" : "kuru kosu - dosya yazilmadi");
