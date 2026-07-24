import type { PuzzleDef } from "../types.ts";

// bulmaca-N.json dosyalarının tamamını otomatik yükler (elle 300 import
// satırı yazmak yerine). Sıralama dosya adındaki N'ye göre numeriktir —
// mevcut oyuncuların günlük bulmaca rotasyonunu (dailyIndex) bozmamak için
// 1..N sırası korunmalı.
const modules = import.meta.glob("./bulmaca-*.json", {
  eager: true,
  import: "default",
}) as Record<string, PuzzleDef>;

function puzzleNumber(path: string): number {
  return Number(/bulmaca-(\d+)\.json$/.exec(path)?.[1] ?? 0);
}

export const puzzles: PuzzleDef[] = Object.keys(modules)
  .sort((a, b) => puzzleNumber(a) - puzzleNumber(b))
  .map((path) => modules[path]);
