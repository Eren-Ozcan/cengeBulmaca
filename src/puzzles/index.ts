import type { PuzzleDef } from "../types.ts";

// bulmaca-N.json dosyalarının tamamını otomatik yükler (elle 300 import
// satırı yazmak yerine). Oyuncuya gösterilme sırası her dosyanın kendi
// "order" alanına göredir (kademeli zorluk için: önce tüm kolaylar, sonra
// ortalar, sonra zorlar) — dosya adındaki N ile aynı olmak zorunda değil.
// order eksikse (ör. elle eklenmiş yeni bir bulmaca) dosya adındaki
// numaraya düşülür.
const modules = import.meta.glob("./bulmaca-*.json", {
  eager: true,
  import: "default",
}) as Record<string, PuzzleDef>;

function puzzleNumber(path: string): number {
  return Number(/bulmaca-(\d+)\.json$/.exec(path)?.[1] ?? 0);
}

function displayOrder(path: string, p: PuzzleDef): number {
  return p.order ?? puzzleNumber(path);
}

export const puzzles: PuzzleDef[] = Object.keys(modules)
  .sort((a, b) => displayOrder(a, modules[a]) - displayOrder(b, modules[b]))
  .map((path) => modules[path]);
