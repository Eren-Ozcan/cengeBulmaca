// Hooked crossword (Çengel bulmaca) data model.
//
// The grid consists of two kinds of cells:
//  - Clue cell: contains the clue text and the arrow showing the answer's direction.
//  - Letter cell: carries one letter of the solution.
//
// Arrow types (the answer's starting point and direction relative to the clue cell):
//  - "right":      the answer starts in the cell to the right of the clue, goes right
//  - "down":       the answer starts in the cell below the clue, goes down
//  - "right-down": the answer starts in the cell to the right of the clue, goes down
//  - "down-right": the answer starts in the cell below the clue, goes right

export type ArrowDir = "right" | "down" | "right-down" | "down-right";

export interface ClueDef {
  /** Clue text (shown inside the cell) */
  text: string;
  /** Answer, uppercase Turkish (including İ, I, Ğ, Ü, Ş, Ö, Ç) */
  answer: string;
  /** Row of the clue cell (0-based) */
  row: number;
  /** Column of the clue cell (0-based) */
  col: number;
  arrow: ArrowDir;
}

export type Difficulty = "kolay" | "orta" | "zor";

export interface PuzzleDef {
  id: string;
  title: string;
  rows: number;
  cols: number;
  clues: ClueDef[];
  /** Dark (block) cells that don't hold a clue */
  blocks?: { row: number; col: number }[];
  /** Difficulty label; not shown in the list if omitted */
  difficulty?: Difficulty;
  /** Order the puzzle is shown to the player in (for gradual easy-to-hard
   * difficulty progression). If omitted, the number in the file name is
   * used — see puzzles/index.ts. */
  order?: number;
}

/** Cells the answer occupies: starting position and direction of travel */
export interface Placement {
  startRow: number;
  startCol: number;
  dRow: 0 | 1;
  dCol: 0 | 1;
}

export interface LetterCell {
  kind: "letter";
  row: number;
  col: number;
  /** Solution letter */
  solution: string;
  /** Indexes of the clues that pass through this cell (into puzzle.clues) */
  clueIndexes: number[];
}

export interface ClueCell {
  kind: "clue";
  row: number;
  col: number;
  /** Indexes of the clues sitting in this cell (at most 2) */
  clueIndexes: number[];
}

export type Cell = LetterCell | ClueCell;

export interface Grid {
  rows: number;
  cols: number;
  /** rows*cols; index = row * cols + col */
  cells: Cell[];
  /** Computed letter cell positions for each clue */
  cluePlacements: { row: number; col: number }[][];
}
