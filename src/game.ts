import { isSaveFrozen } from "./cloud-save.ts";
import { buildGrid, trUpper } from "./puzzle.ts";
import { isSolvedPuzzle, recordCompletion } from "./stats.ts";
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
  /** Rehber (tutorial) oyunu: ilerleme kaydedilmez, istatistiğe işlenmez */
  practice: boolean;
}

export interface NewGameOptions {
  /** Rehber oyunu: kayıt/istatistik dokunulmaz (bkz. GameState.practice) */
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
    // finishIfSolved harf kaydını tamamlanınca SİLER (depolamayı şişirmesin
    // diye, bkz. clearProgress) — ama oyuncu çözülmüş bir bulmacayı listeden
    // tekrar açtığında entries boş gelir ve grid sanki hiç çözülmemiş gibi
    // bomboş açılır (bkz. ui.ts renderChapter — solved bulmacalar da
    // openPuzzle çağırır, özel bir dal yok). Saklı ilerlemeye gerek yok:
    // çözüm zaten istemcide (crossword verisinde) bilinir, stats.ts'e göre
    // çözülmüşse harfler doğrudan grid'in kendi çözümünden doldurulur.
    if (!state.completed && isSolvedPuzzle(puzzle.id)) {
      fillWithSolution(state);
      state.completed = true;
    }
  }
  return state;
}

/** Tüm harf hücrelerini kendi çözümüyle doldurur (bkz. newGame). */
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
 * Hücrenin kelime içindeki sırası = o kelimenin sorusuna olan uzaklığı:
 * soru hücresi her zaman kelimenin ilk harfinin hemen yanındadır, yani
 * k'ıncı harfin soruya uzaklığı k+1'dir. Hücre kelimede yoksa -1.
 */
function distanceToClue(s: GameState, ci: number, r: number, c: number): number {
  return s.grid.cluePlacements[ci].findIndex((p) => p.row === r && p.col === c);
}

/** Hücreden geçen kelimeler içinde sorusu en yakın olanı */
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
 * Hücreye dokunma: hücre seçilir ve yazma yönü, hücreye EN YAKIN soruya
 * kilitlenir — kesişen iki kelimeden sorusu daha yakın olan aktif olur,
 * böylece dokunulan kutunun hangi soruya ait olduğu tahmin gerektirmez.
 * Aynı hücreye tekrar dokunulursa (kesişimdeyse) diğer kelimeye geçilir.
 */
export function selectCell(s: GameState, r: number, c: number): void {
  const cell = letterCellAt(s, r, c);
  if (!cell) return;

  const sameCell = s.selRow === r && s.selCol === c;
  s.selRow = r;
  s.selCol = c;

  const clues = cell.clueIndexes;
  if (sameCell && s.activeClue !== null && clues.includes(s.activeClue)) {
    // aynı hücrede tekrar dokunuş: sıradaki kelimeye geç
    const i = clues.indexOf(s.activeClue);
    s.activeClue = clues[(i + 1) % clues.length];
  } else {
    s.activeClue = nearestClue(s, cell);
  }
}

/**
 * İmleci aktif kelimenin içinde taşır (cevap panelindeki harf kutuları için).
 * selectCell'den farkı: yönü değiştirmez, kesişen kelimeye atlamaz.
 */
export function moveCursorInActiveClue(s: GameState, r: number, c: number): void {
  if (s.activeClue === null) return;
  if (distanceToClue(s, s.activeClue, r, c) < 0) return;
  s.selRow = r;
  s.selCol = c;
}

/** Aktif kelime içinde seçili hücrenin sırasını döndürür */
function activePos(s: GameState): number {
  if (s.activeClue === null || s.selRow === null) return -1;
  const cells = s.grid.cluePlacements[s.activeClue];
  return cells.findIndex((p) => p.row === s.selRow && p.col === s.selCol);
}

/** Kelimenin tüm harfleri doğru girilmiş mi */
export function isWordSolved(s: GameState, ci: number): boolean {
  return s.grid.cluePlacements[ci].every((p) => {
    const i = cellIdx(s, p.row, p.col);
    const cell = s.grid.cells[i];
    return cell.kind === "letter" && s.entries[i] === cell.solution;
  });
}

/**
 * Doğru tamamlanmış bir kelimenin harfi mi? Bu hücreler kilitlidir: üzerine
 * yazılamaz, silinemez — imleç onları atlar. Kilit hep kelime bazlıdır,
 * tek tek doğru harfler değil; yanlış bir kelimede tesadüfen doğru duran
 * harf oyuncuyu kilitlemesin diye.
 */
export function isCellLocked(s: GameState, r: number, c: number): boolean {
  const cell = letterCellAt(s, r, c);
  if (!cell) return false;
  return cell.clueIndexes.some((ci) => isWordSolved(s, ci));
}

/**
 * Aktif kelimede verilen sıradan başlayarak (dahil) yönü boyunca ilk
 * kilitsiz hücrenin sırası; yoksa -1.
 */
function nextEditablePos(s: GameState, from: number, dir: 1 | -1): number {
  if (s.activeClue === null) return -1;
  const cells = s.grid.cluePlacements[s.activeClue];
  for (let p = from; p >= 0 && p < cells.length; p += dir) {
    if (!isCellLocked(s, cells[p].row, cells[p].col)) return p;
  }
  return -1;
}

/** İmleci aktif kelimenin verilen sırasındaki hücreye taşır */
function moveToPos(s: GameState, pos: number): void {
  const cell = s.grid.cluePlacements[s.activeClue!][pos];
  s.selRow = cell.row;
  s.selCol = cell.col;
}

/**
 * Harf girer, imleci kelime içindeki bir sonraki YAZILABİLİR hücreye
 * ilerletir. Kilitli hücrenin üzerine yazılmaz; imleç öne doğru ilk boş
 * hücreye kayar ve harf oraya düşer.
 */
export function typeLetter(s: GameState, letter: string): void {
  if (s.selRow === null || s.selCol === null || s.completed) return;

  let pos = activePos(s);
  if (isCellLocked(s, s.selRow, s.selCol)) {
    if (pos < 0) return;
    pos = nextEditablePos(s, pos, 1);
    if (pos < 0) return; // kelimede yazılabilir hücre kalmadı
    moveToPos(s, pos);
  }

  const ch = trUpper(letter);
  const i = cellIdx(s, s.selRow!, s.selCol!);
  s.entries[i] = ch;
  s.wrongCells.delete(i);

  // kelime içinde bir sonraki yazılabilir hücreye geç (bu harfle kelime
  // tamamlandıysa hepsi kilitlenir ve imleç yerinde kalır)
  if (pos >= 0) {
    const next = nextEditablePos(s, pos + 1, 1);
    if (next >= 0) moveToPos(s, next);
  }

  finishIfSolved(s);
}

/**
 * Silme: hücre yazılabilir ve doluysa temizler; boş ya da kilitliyse
 * kelimede geriye doğru ilk yazılabilir hücreye gidip onu temizler.
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

/**
 * Seçili hücrenin doğru harfini açar. Hücre zaten doğruysa (ör. kilitli bir
 * kesişim harfinin üzerindeyken) ipucu boşa gitmesin diye aktif kelimedeki
 * ilk eksik/yanlış hücre açılır. Gerçekten bir harf açıldıysa true döner.
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

/** Aktif kelimede henüz doğru olmayan ilk hücre */
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

/** Çözüm tamamlandıysa oyunu bitirir, seriyi işler; değilse ilerlemeyi kaydeder. */
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
  // Buluttan yeni bir kayıt indirildiyse (sayfa yenilenene kadar) yazma:
  // `s.entries` bulmaca AÇILIRKEN okunmuştu, yani indirilen ilerlemeden
  // önceki oyuna ait. Tek bir tuş bile o bayat diziyi yeni kaydın üstüne
  // yazar ve ardından buluta yüklenirdi (bkz. cloud-save.ts isSaveFrozen).
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
