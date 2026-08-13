// Daily free hint allowance. Once it runs out, the player can watch an ad
// (see src/ads.ts) to unlock one more hint — the allowance can be extended
// with unlimited ads, only the daily "free" portion is limited.

import { dayString } from "./stats.ts";

const FREE_HINTS_PER_DAY = 3;

function todayKey(): string {
  return `cengel-hints-${dayString()}`;
}

/** Number of free hints remaining today. */
export function freeHintsRemainingToday(): number {
  try {
    const used = Number(localStorage.getItem(todayKey()) ?? "0");
    return Math.max(0, FREE_HINTS_PER_DAY - used);
  } catch {
    return FREE_HINTS_PER_DAY;
  }
}

/** Uses up one of today's free hint allowances. */
export function consumeFreeHint(): void {
  try {
    const used = Number(localStorage.getItem(todayKey()) ?? "0");
    localStorage.setItem(todayKey(), String(used + 1));
  } catch {
    // if storage is unavailable, tracking the allowance is limited to this session
  }
}
