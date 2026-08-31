// Reorders puzzles by measured difficulty: puzzle 1 is the easiest, the last
// one is the hardest. File names and "id" fields are UNCHANGED (player
// progress is keyed on id); only "order", "title", and "difficulty" fields
// are written.
//
// The difficulty score is the weighted sum of four measurable signals:
//   rare   the answer has only one clue in the dictionary, i.e. it's a
//          "deep" word added later from TDK. Core words have 4-5 clues.
//   depth  the answer's position in the dictionary; the dictionary grew from
//          common to rare words.
//   cross  the fraction of intersecting cells; intersections help the
//          solver, so fewer of them means harder.
//
// Grid area used to be a fourth signal, but once the set moved to a single
// 8x10 shape it took the same value for every puzzle and stopped
// contributing to the ranking at all; its weight was redistributed
// proportionally across the other three signals.
//
// Usage: node tools/reorder-puzzles.mjs [--apply]
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

// Note: answer length is deliberately left out. In this dictionary the
// 4-letter layer is made of hand-curated core words (68% multi-clue), while
// almost all of the 5-7 letter layers are deep words pulled in bulk from
// TDK. So length would just be an inverted copy of the "rare" signal.
const WEIGHTS = { rare: 0.51, depth: 0.29, cross: 0.20 };

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
    // inverted: the fewer the intersections, the harder
    cross: 1 - cells.filter((v) => v > 1).length / cells.length,
  };
});

// normalize each signal to 0..1 within its own min-max range
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

// difficulty labels keep the existing distribution; only which puzzle
// they land on changes
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
