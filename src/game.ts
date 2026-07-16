import { buildGrid, trUpper } from "./puzzle.ts";
import type { Grid, LetterCell, PuzzleDef } from "./types.ts";

export interface GameState {
  puzzle: PuzzleDef;
  grid: Grid;
  /** Oyuncunun girdiği harfler; index = row * cols + col, boşsa "" */
  entries: string[];
  /** Seçili harf hücresi (yoksa null) */
  selRow: number | null;
  selCol: number | null;
  /** Seçili ipucu indeksi (aktif kelime) */
  activeClue: number | null;
  /** Kontrol sonucu yanlış işaretlenen hücreler */
  wrongCells: Set<number>;
  completed: boolean;
}

const STORAGE_PREFIX = "cengel-progress-";

export function newGame(puzzle: PuzzleDef): GameState {
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
  };
  loadProgress(state);
  state.completed = isSolved(state);
  return state;
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
 * Hücreye dokunma: hücre seçilir, aktif kelime belirlenir.
 * Aynı hücreye tekrar dokunulursa (iki kelimenin kesişimindeyse)
 * diğer kelimeye geçilir.
 */
export function selectCell(s: GameState, r: number, c: number): void {
  const cell = letterCellAt(s, r, c);
  if (!cell) return;

  const sameCell = s.selRow === r && s.selCol === c;
  s.selRow = r;
  s.selCol = c;

  const clues = cell.clueIndexes;
  if (s.activeClue !== null && clues.includes(s.activeClue) && sameCell) {
    // aynı hücrede tekrar dokunuş: sıradaki kelimeye geç
    const i = clues.indexOf(s.activeClue);
    s.activeClue = clues[(i + 1) % clues.length];
  } else if (s.activeClue === null || !clues.includes(s.activeClue)) {
    s.activeClue = clues[0];
  }
}

/** Aktif kelime içinde seçili hücrenin sırasını döndürür */
function activePos(s: GameState): number {
  if (s.activeClue === null || s.selRow === null) return -1;
  const cells = s.grid.cluePlacements[s.activeClue];
  return cells.findIndex((p) => p.row === s.selRow && p.col === s.selCol);
}

/** Harf girer, imleci kelime içinde ilerletir */
export function typeLetter(s: GameState, letter: string): void {
  if (s.selRow === null || s.selCol === null || s.completed) return;
  const ch = trUpper(letter);
  const i = cellIdx(s, s.selRow, s.selCol);
  s.entries[i] = ch;
  s.wrongCells.delete(i);

  // kelime içinde bir sonraki hücreye geç
  const pos = activePos(s);
  if (pos >= 0) {
    const cells = s.grid.cluePlacements[s.activeClue!];
    if (pos + 1 < cells.length) {
      s.selRow = cells[pos + 1].row;
      s.selCol = cells[pos + 1].col;
    }
  }

  if (isSolved(s)) {
    s.completed = true;
    clearProgress(s.puzzle.id);
  } else {
    saveProgress(s);
  }
}

/** Silme: hücre doluysa temizler, boşsa bir geri gidip temizler */
export function backspace(s: GameState): void {
  if (s.selRow === null || s.selCol === null || s.completed) return;
  const i = cellIdx(s, s.selRow, s.selCol);
  if (s.entries[i] !== "") {
    s.entries[i] = "";
    s.wrongCells.delete(i);
  } else {
    const pos = activePos(s);
    if (pos > 0) {
      const cells = s.grid.cluePlacements[s.activeClue!];
      s.selRow = cells[pos - 1].row;
      s.selCol = cells[pos - 1].col;
      const j = cellIdx(s, s.selRow, s.selCol);
      s.entries[j] = "";
      s.wrongCells.delete(j);
    }
  }
  saveProgress(s);
}

/** Dolu hücreleri kontrol eder, yanlışları işaretler. Yanlış sayısını döndürür. */
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

/** Seçili hücrenin doğru harfini açar */
export function revealLetter(s: GameState): void {
  if (s.selRow === null || s.selCol === null || s.completed) return;
  const cell = letterCellAt(s, s.selRow, s.selCol);
  if (!cell) return;
  const i = cellIdx(s, s.selRow, s.selCol);
  s.entries[i] = cell.solution;
  s.wrongCells.delete(i);
  if (isSolved(s)) {
    s.completed = true;
    clearProgress(s.puzzle.id);
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
  try {
    localStorage.setItem(
      STORAGE_PREFIX + s.puzzle.id,
      JSON.stringify(s.entries),
    );
  } catch {
    // depolama kullanılamıyorsa oyun kayıtsız devam eder
  }
}

function loadProgress(s: GameState): void {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + s.puzzle.id);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved) && saved.length === s.entries.length) {
      s.entries = saved.map((x) => (typeof x === "string" ? x : ""));
    }
  } catch {
    // bozuk kayıt yok sayılır
  }
}

function clearProgress(id: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + id);
  } catch {
    // yok sayılır
  }
}
