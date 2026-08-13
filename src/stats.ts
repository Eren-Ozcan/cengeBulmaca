// Daily streak and solve statistics.
// Rule: the streak continues as long as at least one puzzle is completed
// each day; skipping a day resets it. The same habit-forming model used by
// popular daily puzzle games (Wordle etc.).

export interface Stats {
  /** Day of last completion, "YYYY-MM-DD" (local time) */
  lastDay: string | null;
  /** Number of consecutive days */
  streak: number;
  /** IDs of completed puzzles */
  solved: string[];
}

const KEY = "cengel-stats";

export function dayString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${g}`;
}

function yesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayString(d);
}

export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s === "object") {
        return {
          lastDay: typeof s.lastDay === "string" ? s.lastDay : null,
          streak: typeof s.streak === "number" ? s.streak : 0,
          solved: Array.isArray(s.solved) ? s.solved.filter((x: unknown) => typeof x === "string") : [],
        };
      }
    }
  } catch {
    // corrupt save is ignored
  }
  return { lastDay: null, streak: 0, solved: [] };
}

function saveStats(s: Stats): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // silently skip if storage is unavailable
  }
}

/** Called when a puzzle is completed; returns the updated stats. */
export function recordCompletion(puzzleId: string): Stats {
  const s = loadStats();
  const today = dayString();
  if (s.lastDay === today) {
    // already played today, streak unchanged
  } else if (s.lastDay === yesterdayString()) {
    s.streak += 1;
    s.lastDay = today;
  } else {
    s.streak = 1;
    s.lastDay = today;
  }
  if (!s.solved.includes(puzzleId)) s.solved.push(puzzleId);
  saveStats(s);
  return s;
}

/** Streak to display: broken if the player didn't play yesterday or today. */
export function currentStreak(): number {
  const s = loadStats();
  if (s.lastDay === dayString() || s.lastDay === yesterdayString()) {
    return s.streak;
  }
  return 0;
}

/** Was at least one puzzle completed today? */
export function playedToday(): boolean {
  return loadStats().lastDay === dayString();
}

export function isSolvedPuzzle(id: string): boolean {
  return loadStats().solved.includes(id);
}

/** Number of distinct puzzles completed (cat-unlock thresholds check this). */
export function solvedCount(): number {
  return loadStats().solved.length;
}

/** Daily puzzle: deterministic selection based on the date. */
export function dailyIndex(count: number, d: Date = new Date()): number {
  const s = dayString(d);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return count > 0 ? h % count : 0;
}
