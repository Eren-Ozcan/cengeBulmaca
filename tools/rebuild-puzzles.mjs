// Regenerates individual puzzles with a strict tracker that reserves the
// answers of the rest of the set. grow-puzzles.mjs rebuilds the whole set
// from scratch and takes hours; this is enough to repair the handful of
// stale files left over when a run gets cut off midway.
//
// Usage: node tools/rebuild-puzzles.mjs <number...> [--apply] [--tries=N]
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPuzzle, createTracker, commitToTracker } from "./generate.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "puzzles");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const tries = Number(args.find((a) => a.startsWith("--tries="))?.split("=")[1] ?? 200);
const targets = args.filter((a) => !a.startsWith("--")).map(Number);
if (!targets.length) { console.error("Kullanım: node tools/rebuild-puzzles.mjs <numara...> [--apply]"); process.exit(1); }

const files = readdirSync(dir).filter((f) => /^puzzle-\d+\.json$/.test(f));
const tracker = createTracker({ strict: true });
for (const f of files) {
  if (targets.includes(Number(/\d+/.exec(f)[0]))) continue;
  commitToTracker(tracker, JSON.parse(readFileSync(join(dir, f), "utf8")).clues);
}

for (const n of targets) {
  const file = `puzzle-${n}.json`;
  const old = JSON.parse(readFileSync(join(dir, file), "utf8"));
  let puzzle = null;
  for (let t = 0; t < tries && !puzzle; t++) {
    const r = buildPuzzle({
      id: old.id, title: old.title, rows: old.rows, cols: old.cols,
      difficulty: old.difficulty, order: old.order,
      seed: 20260822 + n * 1013 + t * 104729, tracker,
    });
    if (r.puzzle) puzzle = r.puzzle;
  }
  if (!puzzle) { console.error(`${old.id}: uretilemedi`); process.exitCode = 1; continue; }
  commitToTracker(tracker, puzzle.clues);
  if (apply) writeFileSync(join(dir, file), JSON.stringify(puzzle, null, 2) + "\n", "utf8");
  console.log(`${old.id}: ${puzzle.clues.length} soru${apply ? " yazildi" : " (kuru kosu)"}`);
}
