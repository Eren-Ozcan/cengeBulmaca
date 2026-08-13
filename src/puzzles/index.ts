import type { PuzzleDef } from "../types.ts";
import manifestData from "./manifest.json";

interface ManifestEntry {
  id: string;
  title: string;
  rows: number;
  cols: number;
  difficulty?: "kolay" | "orta" | "zor";
  order: number;
  file: string;
}

const manifest = manifestData as ManifestEntry[];

// Dynamic (lazy) access to all puzzle-N.json files: each is loaded from its
// own chunk on demand (see ensureLoaded), not at startup. Keeps the initial
// load small by preventing the main JS bundle from containing all 300
// puzzles' clue/answer data upfront.
const fileLoaders = import.meta.glob("./puzzle-*.json", {
  import: "default",
}) as Record<string, () => Promise<PuzzleDef>>;

/**
 * Puzzle list sorted by display order (the "order" field in the manifest).
 * The clues/blocks fields start as empty placeholders; the actual content
 * is filled in the background by ensureLoaded/warmPuzzles (see ui.ts
 * openPuzzle — if isLoaded is false, it awaits ensureLoaded and retries).
 */
export const puzzles: PuzzleDef[] = manifest
  .slice()
  .sort((a, b) => a.order - b.order)
  .map((e) => ({
    id: e.id,
    title: e.title,
    rows: e.rows,
    cols: e.cols,
    difficulty: e.difficulty,
    order: e.order,
    clues: [],
  }));

const fileById = new Map(manifest.map((e) => [e.id, e.file]));
const pending = new Map<string, Promise<void>>();

function fill(p: PuzzleDef): Promise<void> {
  if (p.clues.length > 0) return Promise.resolve();
  const file = fileById.get(p.id);
  if (!file) return Promise.resolve();
  let job = pending.get(p.id);
  if (!job) {
    job = fileLoaders[file]().then((full) => {
      Object.assign(p, full);
    });
    // Do NOT leave a rejected promise in the cache: otherwise a one-off
    // network error (a flaky connection) would make this puzzle
    // permanently unopenable until the app restarts — `if (!job)` would
    // stay false forever, and a retry would never be triggered.
    job.catch(() => pending.delete(p.id));
    pending.set(p.id, job);
  }
  return job;
}

/** Has the puzzle's full content (clues/blocks) already been loaded? */
export function isLoaded(p: PuzzleDef): boolean {
  return p.clues.length > 0;
}

/** Downloads a placeholder puzzle's full content; no-ops if already loaded. */
export function ensureLoaded(p: PuzzleDef): Promise<void> {
  return fill(p);
}

const EAGER_COUNT = 20;

/**
 * On app startup, readies the first EAGER_COUNT puzzles (+ the puzzle of
 * the day, so it can open immediately from the featured card), and once
 * that completes, starts downloading the remaining puzzles in the
 * background (without blocking).
 */
export function warmPuzzles(dailyIndex: number): Promise<void> {
  const eagerSet = new Set(puzzles.slice(0, EAGER_COUNT));
  if (puzzles[dailyIndex]) eagerSet.add(puzzles[dailyIndex]);
  return Promise.all([...eagerSet].map(fill)).then(() => {
    void Promise.all(puzzles.filter((p) => !eagerSet.has(p)).map(fill));
  });
}
