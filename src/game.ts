import { buildGrid, trUpper } from "./puzzle.ts";
import { recordCompletion } from "./stats.ts";
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

  finishIfSolved(s);
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
  finishIfSolved(s);
}

/** Çözüm tamamlandıysa oyunu bitirir, seriyi işler; değilse ilerlemeyi kaydeder. */
function finishIfSolved(s: GameState): void {
  if (isSolved(s)) {
    s.completed = true;
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
    // depolama kullanılamıyorsa oyun kayıtsız devam eder
  }
}

function loadProgress(s: GameState): void {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + s.puzzle.id);
    if (!raw) return;
    const saved = JSON.parse(raw);
    // eski kayıt biçimi: düz harf dizisi (imleç konumu yok)
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
    // kaldığı hücreyi/kelimeyi de geri getir; oyuncu her seferinde ilk boş
    // hücreden değil, en son bıraktığı yerden devam eder. İkisi birden
    // geçerliyse uygulanır, aksi halde ilk-boş-hücre varsayılanına düşülür.
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

/**
 * Kayıtlı ilerleme oranı (0-1): dolu harf hücresi / toplam harf hücresi.
 * Ana menüdeki ilerleme çubukları için; kayıt yoksa 0.
 */
export function savedProgress(puzzle: PuzzleDef): number {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + puzzle.id);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    // eski biçim: düz dizi. yeni biçim: { entries, selRow, selCol, activeClue }
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
