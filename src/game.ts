import { isSaveFrozen } from "./cloud-save.ts";
import { buildGrid, trUpper } from "./puzzle.ts";
import { isSolvedPuzzle, recordCompletion } from "./stats.ts";
import type { Grid, LetterCell, PuzzleDef } from "./types.ts";

export interface GameState {
  puzzle: PuzzleDef;
  grid: Grid;
  /** Letters entered by the player; index = row * cols + col, "" if empty */
  entries: string[];
  /** Selected letter cell (null if none) */
  selRow: number | null;
  selCol: number | null;
  /** Selected clue index (active word) */
  activeClue: number | null;
  /** Cells marked wrong by the check result */
  wrongCells: Set<number>;
  completed: boolean;
  /** Tutorial (guide) game: progress isn't saved, isn't recorded in stats */
  practice: boolean;
}

export interface NewGameOptions {
  /** Tutorial game: save/stats are untouched (see GameState.practice) */
  practice?: boolean;
}

const STORAGE_PREFIX = "cengel-progress-";

export function newGame(
  puzzle: PuzzleDef,
  options: NewGameOptions = {},
): GameState {
  const grid = buildGrid(puzzle);
  const entries = new Array(grid.rows * grid.cols).fill("");
  const state: GameState = {
    puzzle,
    grid,
    entries,
    selRow: null,
    selCol: null,
    activeClue: null,
    wrongCells: new Set(),
    completed: false,
    practice: options.practice === true,
  };
  if (!state.practice) {
    loadProgress(state);
    state.completed = isSolved(state);
    // finishIfSolved DELETES the letter save once completed (so it doesn't
    // bloat storage, see clearProgress) — but when the player reopens a
    // solved puzzle from the list, entries comes back empty and the grid
    // would render blank, as if never solved (see ui.ts renderChapter —
    // solved puzzles also call openPuzzle, there's no special branch). No
    // stored progress is needed: the solution is already known client-side
    // (in the crossword data), so if stats.ts says it's solved, the letters
    // are filled directly from the grid's own solution.
    if (!state.completed && isSolvedPuzzle(puzzle.id)) {
      fillWithSolution(state);
      state.completed = true;
    }
  }
  return state;
}

/** Fills all letter cells with their own solution (see newGame). */
function fillWithSolution(s: GameState): void {
  for (const cell of s.grid.cells) {
    if (cell.kind !== "letter") continue;
    s.entries[cellIdx(s, cell.row, cell.col)] = cell.solution;
  }
}

const cellIdx = (s: GameState, r: number, c: number) => r * s.grid.cols + c;

export function letterCellAt(
  s: GameState,
  r: number,
  c: number,
): LetterCell | null {
  if (r < 0 || r >= s.grid.rows || c < 0 || c >= s.grid.cols) return null;
  const cell = s.grid.cells[cellIdx(s, r, c)];
  return cell.kind === "letter" ? cell : null;
}

/**
 * A cell's position within a word = its distance from that word's clue
 * cell: the clue cell is always immediately next to the word's first
 * letter, so the k-th letter's distance from the clue is k+1. -1 if the
 * cell isn't part of the word.
 */
function distanceToClue(s: GameState, ci: number, r: number, c: number): number {
  return s.grid.cluePlacements[ci].findIndex((p) => p.row === r && p.col === c);
}

/** Among the words passing through this cell, the one whose clue is nearest */
function nearestClue(s: GameState, cell: LetterCell): number {
  let best = cell.clueIndexes[0];
  let bestDist = Infinity;
  for (const ci of cell.clueIndexes) {
    const d = distanceToClue(s, ci, cell.row, cell.col);
    if (d >= 0 && d < bestDist) {
      bestDist = d;
      best = ci;
    }
  }
  return best;
}

/**
 * Tapping a cell: the cell is selected and the writing direction locks to
 * the clue NEAREST to the cell — of the two intersecting words, the one
 * whose clue is closer becomes active, so which clue the tapped box
 * belongs to never needs guessing. Tapping the same cell again (if it's an
 * intersection) switches to the other word.
 */
export function selectCell(s: GameState, r: number, c: number): void {
  const cell = letterCellAt(s, r, c);
  if (!cell) return;

  const sameCell = s.selRow === r && s.selCol === c;
  s.selRow = r;
  s.selCol = c;

  const clues = cell.clueIndexes;
  if (sameCell && s.activeClue !== null && clues.includes(s.activeClue)) {
    // tapping the same cell again: switch to the next word
    const i = clues.indexOf(s.activeClue);
    s.activeClue = clues[(i + 1) % clues.length];
  } else {
    s.activeClue = nearestClue(s, cell);
  }
}

/**
 * Moves the cursor within the active word (for the letter boxes in the
 * answer panel). Difference from selectCell: doesn't change direction,
 * doesn't jump to an intersecting word.
 */
export function moveCursorInActiveClue(s: GameState, r: number, c: number): void {
  if (s.activeClue === null) return;
  if (distanceToClue(s, s.activeClue, r, c) < 0) return;
  s.selRow = r;
  s.selCol = c;
}

/** Returns the position of the selected cell within the active word */
function activePos(s: GameState): number {
  if (s.activeClue === null || s.selRow === null) return -1;
  const cells = s.grid.cluePlacements[s.activeClue];
  return cells.findIndex((p) => p.row === s.selRow && p.col === s.selCol);
}

/** Whether every letter of the word has been entered correctly */
export function isWordSolved(s: GameState, ci: number): boolean {
  return s.grid.cluePlacements[ci].every((p) => {
    const i = cellIdx(s, p.row, p.col);
    const cell = s.grid.cells[i];
    return cell.kind === "letter" && s.entries[i] === cell.solution;
  });
}

/**
 * Is this a letter of a correctly completed word? These cells are locked:
 * can't be overwritten or deleted — the cursor skips them. Locking is
 * always per-word, never per individual correct letter, so a letter that
 * happens to be correct within an otherwise wrong word doesn't lock the
 * player out.
 */
export function isCellLocked(s: GameState, r: number, c: number): boolean {
  const cell = letterCellAt(s, r, c);
  if (!cell) return false;
  return cell.clueIndexes.some((ci) => isWordSolved(s, ci));
}

/**
 * Position of the first unlocked cell in the active word, starting from
 * (and including) the given position, along the given direction; -1 if none.
 */
function nextEditablePos(s: GameState, from: number, dir: 1 | -1): number {
  if (s.activeClue === null) return -1;
  const cells = s.grid.cluePlacements[s.activeClue];
  for (let p = from; p >= 0 && p < cells.length; p += dir) {
    if (!isCellLocked(s, cells[p].row, cells[p].col)) return p;
  }
  return -1;
}

/** Moves the cursor to the cell at the given position in the active word */
function moveToPos(s: GameState, pos: number): void {
  const cell = s.grid.cluePlacements[s.activeClue!][pos];
  s.selRow = cell.row;
  s.selCol = cell.col;
}

/**
 * Enters a letter, advances the cursor to the next WRITABLE cell in the
 * word. Never overwrites a locked cell; the cursor moves forward to the
 * first open cell and the letter goes there instead.
 */
export function typeLetter(s: GameState, letter: string): void {
  if (s.selRow === null || s.selCol === null || s.completed) return;

  let pos = activePos(s);
  if (isCellLocked(s, s.selRow, s.selCol)) {
    if (pos < 0) return;
    pos = nextEditablePos(s, pos, 1);
    if (pos < 0) return; // no writable cell left in the word
    moveToPos(s, pos);
  }

  const ch = trUpper(letter);
  const i = cellIdx(s, s.selRow!, s.selCol!);
  s.entries[i] = ch;
  s.wrongCells.delete(i);

  // move to the next writable cell in the word (if this letter completed
  // the word, all its cells lock and the cursor stays put)
  if (pos >= 0) {
    const next = nextEditablePos(s, pos + 1, 1);
    if (next >= 0) moveToPos(s, next);
  }

  finishIfSolved(s);
}

/**
 * Backspace: clears the cell if it's writable and filled; if it's empty or
 * locked, moves backward within the word to the first writable cell and
 * clears that instead.
 */
export function backspace(s: GameState): void {
  if (s.selRow === null || s.selCol === null || s.completed) return;
  const i = cellIdx(s, s.selRow, s.selCol);
  const locked = isCellLocked(s, s.selRow, s.selCol);
  if (!locked && s.entries[i] !== "") {
    s.entries[i] = "";
    s.wrongCells.delete(i);
  } else {
    const pos = activePos(s);
    const prev = pos > 0 ? nextEditablePos(s, pos - 1, -1) : -1;
    if (prev >= 0) {
      moveToPos(s, prev);
      const j = cellIdx(s, s.selRow!, s.selCol!);
      s.entries[j] = "";
      s.wrongCells.delete(j);
    }
  }
  saveProgress(s);
}

/** Checks filled cells, marks the wrong ones. Returns the count of wrong entries. */
export function checkEntries(s: GameState): number {
  s.wrongCells.clear();
  let wrong = 0;
  for (const cell of s.grid.cells) {
    if (cell.kind !== "letter") continue;
    const i = cellIdx(s, cell.row, cell.col);
    if (s.entries[i] !== "" && s.entries[i] !== cell.solution) {
      s.wrongCells.add(i);
      wrong++;
    }
  }
  return wrong;
}

/**
 * Reveals the correct letter for the selected cell. If the cell is already
 * correct (e.g. sitting on a locked intersection letter), the first
 * missing/wrong cell in the active word is revealed instead, so the hint
 * isn't wasted. Returns true if a letter was actually revealed.
 */
export function revealLetter(s: GameState): boolean {
  if (s.selRow === null || s.selCol === null || s.completed) return false;
  let target = letterCellAt(s, s.selRow, s.selCol);
  if (target && s.entries[cellIdx(s, target.row, target.col)] === target.solution) {
    target = firstUnsolvedCell(s);
  }
  if (!target) return false;
  const i = cellIdx(s, target.row, target.col);
  s.entries[i] = target.solution;
  s.wrongCells.delete(i);
  s.selRow = target.row;
  s.selCol = target.col;
  finishIfSolved(s);
  return true;
}

/** The first cell in the active word that isn't correct yet */
function firstUnsolvedCell(s: GameState): LetterCell | null {
  if (s.activeClue === null) return null;
  for (const p of s.grid.cluePlacements[s.activeClue]) {
    const cell = s.grid.cells[cellIdx(s, p.row, p.col)];
    if (cell.kind === "letter" && s.entries[cellIdx(s, p.row, p.col)] !== cell.solution) {
      return cell;
    }
  }
  return null;
}

/** Ends the game and records the streak if solved; otherwise saves progress. */
function finishIfSolved(s: GameState): void {
  if (isSolved(s)) {
    s.completed = true;
    if (s.practice) return;
    clearProgress(s.puzzle.id);
    recordCompletion(s.puzzle.id);
  } else {
    saveProgress(s);
  }
}

export function isSolved(s: GameState): boolean {
  for (const cell of s.grid.cells) {
    if (cell.kind !== "letter") continue;
    if (s.entries[cellIdx(s, cell.row, cell.col)] !== cell.solution)
      return false;
  }
  return true;
}

function saveProgress(s: GameState): void {
  if (s.practice) return;
  // If a new save was just downloaded from the cloud (until the page
  // reloads), don't write: `s.entries` was read when the puzzle was
  // OPENED, i.e. it belongs to the game state before the downloaded
  // progress. Even a single keystroke would overwrite that stale array on
  // top of the new save, and it would then get uploaded to the cloud (see
  // cloud-save.ts isSaveFrozen).
  if (isSaveFrozen()) return;
  try {
    localStorage.setItem(
      STORAGE_PREFIX + s.puzzle.id,
      JSON.stringify({
        entries: s.entries,
        selRow: s.selRow,
        selCol: s.selCol,
        activeClue: s.activeClue,
      }),
    );
  } catch {
    // if storage is unavailable, the game continues without saving
  }
}

function loadProgress(s: GameState): void {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + s.puzzle.id);
    if (!raw) return;
    const saved = JSON.parse(raw);
    // old save format: plain letter array (no cursor position)
    if (Array.isArray(saved)) {
      if (saved.length === s.entries.length) {
        s.entries = saved.map((x) => (typeof x === "string" ? x : ""));
      }
      return;
    }
    if (!saved || !Array.isArray(saved.entries)) return;
    if (saved.entries.length === s.entries.length) {
      s.entries = saved.entries.map((x: unknown) =>
        typeof x === "string" ? x : "",
      );
    }
    // also restore the cell/word where the player left off; they resume
    // from where they last stopped instead of the first empty cell every
    // time. Applied only if both are valid, otherwise falls back to the
    // first-empty-cell default.
    if (
      typeof saved.selRow === "number" &&
      typeof saved.selCol === "number" &&
      letterCellAt(s, saved.selRow, saved.selCol) &&
      typeof saved.activeClue === "number" &&
      saved.activeClue >= 0 &&
      saved.activeClue < s.puzzle.clues.length
    ) {
      s.selRow = saved.selRow;
      s.selCol = saved.selCol;
      s.activeClue = saved.activeClue;
    }
  } catch {
    // a corrupt save is ignored
  }
}

function clearProgress(id: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + id);
  } catch {
    // ignored
  }
}

/**
 * Saved progress ratio (0-1): filled letter cells / total letter cells.
 * For the progress bars in the main menu; 0 if there's no save.
 */
export function savedProgress(puzzle: PuzzleDef): number {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + puzzle.id);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    // old format: plain array. new format: { entries, selRow, selCol, activeClue }
    const entries = Array.isArray(parsed) ? parsed : parsed?.entries;
    if (!Array.isArray(entries)) return 0;
    const grid = buildGrid(puzzle);
    let total = 0;
    let filled = 0;
    for (const cell of grid.cells) {
      if (cell.kind !== "letter") continue;
      total++;
      const v = entries[cell.row * grid.cols + cell.col];
      if (typeof v === "string" && v !== "") filled++;
    }
    return total > 0 ? filled / total : 0;
  } catch {
    return 0;
  }
}
