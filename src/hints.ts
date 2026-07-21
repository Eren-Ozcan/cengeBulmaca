// Günlük ücretsiz ipucu hakkı. Hak bitince oyuncu reklam izleyerek
// (bkz. src/ads.ts) bir ipucu daha açabilir — ücretsiz hak sınırsız
// reklamla uzatılabilir, sadece günlük "bedava" kısım sınırlı.

import { dayString } from "./stats.ts";

const FREE_HINTS_PER_DAY = 3;

function todayKey(): string {
  return `cengel-hints-${dayString()}`;
}

/** Bugün kalan ücretsiz ipucu sayısı. */
export function freeHintsRemainingToday(): number {
  try {
    const used = Number(localStorage.getItem(todayKey()) ?? "0");
    return Math.max(0, FREE_HINTS_PER_DAY - used);
  } catch {
    return FREE_HINTS_PER_DAY;
  }
}

/** Bugünkü ücretsiz ipucu haklarından birini kullanır. */
export function consumeFreeHint(): void {
  try {
    const used = Number(localStorage.getItem(todayKey()) ?? "0");
    localStorage.setItem(todayKey(), String(used + 1));
  } catch {
    // depolama yoksa hak takibi oturumla sınırlı kalır
  }
}
