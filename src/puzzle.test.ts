import { describe, expect, it } from "vitest";
import { buildGrid, trUpper } from "./puzzle.ts";
import { puzzles } from "./puzzles/index.ts";
import type { PuzzleDef } from "./types.ts";

// 3x3 asgari geçerli bulmaca: bir yatay, bir dikey soru, (1,1)'de kesişim.
//   [S1][S2][■ ]
//   [B ][A ][L ]
//   [■ ][T ][■ ]
const tiny: PuzzleDef = {
  id: "test-tiny",
  title: "Test",
  rows: 3,
  cols: 3,
  clues: [
    { text: "Arıların ürünü", answer: "BAL", row: 0, col: 0, arrow: "down-right" },
    { text: "Binek hayvanı", answer: "AT", row: 0, col: 1, arrow: "down" },
  ],
  blocks: [
    { row: 0, col: 2 },
    { row: 2, col: 0 },
    { row: 2, col: 2 },
  ],
};

describe("trUpper", () => {
  it("Türkçe harfleri doğru büyütür", () => {
    expect(trUpper("i")).toBe("İ");
    expect(trUpper("ı")).toBe("I");
    expect(trUpper("çğüşö")).toBe("ÇĞÜŞÖ");
  });
});

describe("buildGrid", () => {
  it("geçerli bulmacayı kurar", () => {
    const grid = buildGrid(tiny);
    expect(grid.rows).toBe(3);
    expect(grid.cols).toBe(3);
    expect(grid.cluePlacements[0]).toEqual([
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
    ]);
    expect(grid.cluePlacements[1]).toEqual([
      { row: 1, col: 1 },
      { row: 2, col: 1 },
    ]);
  });

  it("kesişim hücresine iki ipucunu da bağlar", () => {
    const grid = buildGrid(tiny);
    const cross = grid.cells[1 * 3 + 1];
    expect(cross.kind).toBe("letter");
    if (cross.kind === "letter") {
      expect(cross.solution).toBe("A");
      expect(cross.clueIndexes).toEqual([0, 1]);
    }
  });

  it("ızgaradan taşan cevabı reddeder", () => {
    const bad: PuzzleDef = {
      ...tiny,
      clues: [{ ...tiny.clues[0], answer: "BALIK" }, tiny.clues[1]],
    };
    expect(() => buildGrid(bad)).toThrow(/taşıyor/);
  });

  it("kesişim uyuşmazlığını reddeder", () => {
    const bad: PuzzleDef = {
      ...tiny,
      clues: [tiny.clues[0], { ...tiny.clues[1], answer: "OT" }],
    };
    expect(() => buildGrid(bad)).toThrow(/uyuşmazlığı/);
  });

  it("boş hücre kalan bulmacayı reddeder", () => {
    const bad: PuzzleDef = { ...tiny, blocks: tiny.blocks!.slice(0, 2) };
    expect(() => buildGrid(bad)).toThrow(/boş/);
  });
});

describe("yayınlanan bulmacalar", () => {
  it("en az 10 bulmaca içerir", () => {
    expect(puzzles.length).toBeGreaterThanOrEqual(10);
  });

  it.each(puzzles.map((p) => [p.id, p] as const))(
    "%s oyun motorundan geçer",
    (_id, p) => {
      const grid = buildGrid(p);
      // her ipucunun en az 2 harflik yerleşimi olmalı
      for (const placement of grid.cluePlacements) {
        expect(placement.length).toBeGreaterThanOrEqual(2);
      }
    },
  );

  it("id'ler tekildir", () => {
    const ids = puzzles.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
