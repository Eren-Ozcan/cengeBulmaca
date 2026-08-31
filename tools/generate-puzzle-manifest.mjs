// Generates src/puzzles/manifest.json: not each puzzle's full content
// (clues/blocks), but the lightweight metadata that listing screens need
// (id/title/rows/cols/difficulty/order/file name).
//
// Why it's needed: puzzles/index.ts now lazy-loads the full puzzle content
// (all but the first N, in the background); but display order depends on
// the puzzle's "order" field, which can't be known without reading the file
// content. This script extracts the order info into a small manifest as a
// one-off/pre-build step, so index.ts can sort without opening all 300 files.
//
// Re-run whenever a puzzle is added or order/title changes:
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
