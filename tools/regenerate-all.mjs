// Regenerates all puzzles with a global clue tracker.
//
// Usage:
//   node tools/regenerate-all.mjs [baseSeed] [--strict]
//
// --strict: each answer is used only once across the whole generation run,
// so the same clue never appears in two puzzles either. If the dictionary
// runs short, puzzles can't be generated and the old files are kept.
//
// Each src/puzzles/puzzle-N.json file's id, title, row/column count,
// difficulty, and order are preserved; only the grid and clues are
// regenerated. Thanks to the tracker in generate.mjs, the same clue text is
// repeated as little as possible across the 300 puzzles (see
// createTracker/commitToTracker).

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
  // Try a few different seeds for the same puzzle: if the first seed fails
  // to generate (mask/assignment/fill rejection), move on to the next one.
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

// ---------- summary ----------
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
