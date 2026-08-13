import type { PuzzleDef } from "../types.ts";

// For tests: loads ALL 300 puzzles (including clues/blocks) synchronously
// and eagerly. Only imported from test files (puzzle.test.ts, cats.test.ts)
// — production code (main.ts/ui.ts) uses the lazy `puzzles` array in
// puzzles/index.ts instead, so this file isn't included in the production
// bundle.
const modules = import.meta.glob("./puzzle-*.json", {
  eager: true,
  import: "default",
}) as Record<string, PuzzleDef>;

function puzzleNumber(path: string): number {
  return Number(/puzzle-(\d+)\.json$/.exec(path)?.[1] ?? 0);
}

function displayOrder(path: string, p: PuzzleDef): number {
  return p.order ?? puzzleNumber(path);
}

export const allPuzzles: PuzzleDef[] = Object.keys(modules)
  .sort((a, b) => displayOrder(a, modules[a]) - displayOrder(b, modules[b]))
  .map((path) => modules[path]);
