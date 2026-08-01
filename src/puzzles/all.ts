import type { PuzzleDef } from "../types.ts";

// Testler için: 300 bulmacanın TAMAMINI (clues/blocks dahil) senkron/eager
// yükler. Sadece test dosyalarından import edilir (puzzle.test.ts,
// cats.test.ts) — production kodu (main.ts/ui.ts) bunun yerine
// puzzles/index.ts'teki lazy `puzzles` dizisini kullanır, bu yüzden bu
// dosya production bundle'ına dahil olmaz.
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
