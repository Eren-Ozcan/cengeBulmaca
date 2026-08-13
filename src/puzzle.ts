import type { ArrowDir, Cell, ClueDef, Grid, PuzzleDef } from "./types.ts";

/** Uppercases according to Turkish rules (i→İ, ı→I). */
export function trUpper(s: string): string {
  return s.toLocaleUpperCase("tr-TR");
}

function startAndDelta(clue: ClueDef): {
  startRow: number;
  startCol: number;
  dRow: 0 | 1;
  dCol: 0 | 1;
} {
  const table: Record<
    ArrowDir,
    { sr: number; sc: number; dRow: 0 | 1; dCol: 0 | 1 }
  > = {
    right: { sr: 0, sc: 1, dRow: 0, dCol: 1 },
    down: { sr: 1, sc: 0, dRow: 1, dCol: 0 },
    "right-down": { sr: 0, sc: 1, dRow: 1, dCol: 0 },
    "down-right": { sr: 1, sc: 0, dRow: 0, dCol: 1 },
  };
  const t = table[clue.arrow];
  return {
    startRow: clue.row + t.sr,
    startCol: clue.col + t.sc,
    dRow: t.dRow,
    dCol: t.dCol,
  };
}

/**
 * Builds the grid from a puzzle definition and validates its consistency.
 * Throws with a descriptive message on error — broken puzzle data must
 * never reach the player.
 */
export function buildGrid(p: PuzzleDef): Grid {
  const idx = (r: number, c: number) => r * p.cols + c;
  const cells: (Cell | undefined)[] = new Array(p.rows * p.cols).fill(
    undefined,
  );
  const cluePlacements: { row: number; col: number }[][] = [];
  const errors: string[] = [];

  // Place block cells (dark squares with no clue)
  for (const b of p.blocks ?? []) {
    cells[idx(b.row, b.col)] = {
      kind: "clue",
      row: b.row,
      col: b.col,
      clueIndexes: [],
    };
  }

  // First place all clue cells
  p.clues.forEach((clue, ci) => {
    if (clue.row < 0 || clue.row >= p.rows || clue.col < 0 || clue.col >= p.cols) {
      errors.push(`İpucu ${ci} (${clue.text}): hücre ızgara dışında`);
      return;
    }
    const existing = cells[idx(clue.row, clue.col)];
    if (existing) {
      if (existing.kind !== "clue") {
        errors.push(
          `İpucu ${ci} (${clue.text}): (${clue.row},${clue.col}) hem harf hem ipucu hücresi olamaz`,
        );
        return;
      }
      if (existing.clueIndexes.length >= 2) {
        errors.push(
          `İpucu ${ci} (${clue.text}): (${clue.row},${clue.col}) hücresinde 2'den fazla ipucu`,
        );
        return;
      }
      existing.clueIndexes.push(ci);
    } else {
      cells[idx(clue.row, clue.col)] = {
        kind: "clue",
        row: clue.row,
        col: clue.col,
        clueIndexes: [ci],
      };
    }
  });

  // Then place the answer letters
  p.clues.forEach((clue, ci) => {
    const answer = trUpper(clue.answer);
    const { startRow, startCol, dRow, dCol } = startAndDelta(clue);
    const placement: { row: number; col: number }[] = [];
    const letters = [...answer]; // code-point based, for Turkish characters

    for (let i = 0; i < letters.length; i++) {
      const r = startRow + dRow * i;
      const c = startCol + dCol * i;
      if (r >= p.rows || c >= p.cols) {
        errors.push(`İpucu ${ci} (${clue.text}): cevap ızgaradan taşıyor`);
        return;
      }
      const existing = cells[idx(r, c)];
      if (existing?.kind === "clue") {
        errors.push(
          `İpucu ${ci} (${clue.text}): (${r},${c}) ipucu hücresiyle çakışıyor`,
        );
        return;
      }
      if (existing?.kind === "letter") {
        if (existing.solution !== letters[i]) {
          errors.push(
            `İpucu ${ci} (${clue.text}): (${r},${c}) kesişimde harf uyuşmazlığı ` +
              `('${existing.solution}' ≠ '${letters[i]}')`,
          );
          return;
        }
        existing.clueIndexes.push(ci);
      } else {
        cells[idx(r, c)] = {
          kind: "letter",
          row: r,
          col: c,
          solution: letters[i],
          clueIndexes: [ci],
        };
      }
      placement.push({ row: r, col: c });
    }
    cluePlacements[ci] = placement;
  });

  // There must be no empty cells left
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      if (!cells[idx(r, c)]) {
        errors.push(`(${r},${c}) hücresi boş: ne harf ne ipucu`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Bulmaca "${p.id}" tutarsız:\n` + errors.join("\n"));
  }

  return {
    rows: p.rows,
    cols: p.cols,
    cells: cells as Cell[],
    cluePlacements,
  };
}

export function cellAt(grid: Grid, row: number, col: number): Cell {
  return grid.cells[row * grid.cols + col];
}
