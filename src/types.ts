// Çengel bulmaca veri modeli.
//
// Izgara iki tür hücreden oluşur:
//  - İpucu hücresi: soru metnini ve cevabın yönünü gösteren oku içerir.
//  - Harf hücresi: çözümün bir harfini taşır.
//
// Ok türleri (ipucu hücresine göre cevabın başlangıcı ve yönü):
//  - "right":      cevap ipucunun sağındaki hücreden başlar, sağa gider
//  - "down":       cevap ipucunun altındaki hücreden başlar, aşağı gider
//  - "right-down": cevap ipucunun sağındaki hücreden başlar, aşağı gider
//  - "down-right": cevap ipucunun altındaki hücreden başlar, sağa gider

export type ArrowDir = "right" | "down" | "right-down" | "down-right";

export interface ClueDef {
  /** Soru metni (hücre içinde gösterilir) */
  text: string;
  /** Cevap, Türkçe büyük harf (İ, I, Ğ, Ü, Ş, Ö, Ç dahil) */
  answer: string;
  /** İpucu hücresinin satırı (0 tabanlı) */
  row: number;
  /** İpucu hücresinin sütunu (0 tabanlı) */
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
  /** Soru barındırmayan koyu (blok) hücreler */
  blocks?: { row: number; col: number }[];
  /** Zorluk etiketi; verilmezse listede gösterilmez */
  difficulty?: Difficulty;
}

/** Cevabın yerleştiği hücreler: başlangıç konumu ve ilerleme yönü */
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
  /** Çözüm harfi */
  solution: string;
  /** Bu hücreden geçen ipuçlarının indeksleri (puzzle.clues içinde) */
  clueIndexes: number[];
}

export interface ClueCell {
  kind: "clue";
  row: number;
  col: number;
  /** Bu hücrede duran ipuçlarının indeksleri (en fazla 2) */
  clueIndexes: number[];
}

export type Cell = LetterCell | ClueCell;

export interface Grid {
  rows: number;
  cols: number;
  /** rows*cols; index = row * cols + col */
  cells: Cell[];
  /** Her ipucu için hesaplanmış harf hücresi konumları */
  cluePlacements: { row: number; col: number }[][];
}
