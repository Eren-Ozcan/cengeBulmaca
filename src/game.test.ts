import { beforeEach, describe, expect, it } from "vitest";
import {
  backspace,
  checkEntries,
  isSolved,
  newGame,
  revealLetter,
  selectCell,
  typeLetter,
} from "./game.ts";
import { installMemoryStorage } from "./test-helpers.ts";
import type { PuzzleDef } from "./types.ts";

const storage = installMemoryStorage();

// puzzle.test.ts'teki 3x3 fikstürün aynısı:
//   [S1][S2][■ ]
//   [B ][A ][L ]
//   [■ ][T ][■ ]
const tiny: PuzzleDef = {
  id: "test-game",
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

beforeEach(() => storage.clear());

describe("selectCell", () => {
  it("hücreyi seçer ve aktif ipucunu belirler", () => {
    const s = newGame(tiny);
    selectCell(s, 1, 0);
    expect(s.selRow).toBe(1);
    expect(s.selCol).toBe(0);
    expect(s.activeClue).toBe(0);
  });

  it("kesişimde tekrar dokununca diğer kelimeye geçer", () => {
    const s = newGame(tiny);
    selectCell(s, 1, 1);
    expect(s.activeClue).toBe(0);
    selectCell(s, 1, 1);
    expect(s.activeClue).toBe(1);
  });

  it("ipucu hücresine dokunuş yok sayılır", () => {
    const s = newGame(tiny);
    selectCell(s, 0, 0);
    expect(s.selRow).toBeNull();
  });
});

describe("typeLetter", () => {
  it("harfi yazar, imleci kelime içinde ilerletir ve küçük harfi büyütür", () => {
    const s = newGame(tiny);
    selectCell(s, 1, 0);
    typeLetter(s, "b");
    expect(s.entries[1 * 3 + 0]).toBe("B");
    expect(s.selCol).toBe(1);
  });

  it("kelimenin sonunda imleç ilerlemez", () => {
    const s = newGame(tiny);
    selectCell(s, 1, 2);
    typeLetter(s, "L");
    expect(s.selCol).toBe(2);
  });

  it("tüm harfler doğru girilince oyunu bitirir", () => {
    const s = newGame(tiny);
    selectCell(s, 1, 0);
    typeLetter(s, "B");
    typeLetter(s, "A");
    typeLetter(s, "L");
    expect(s.completed).toBe(false);
    selectCell(s, 2, 1);
    typeLetter(s, "T");
    expect(isSolved(s)).toBe(true);
    expect(s.completed).toBe(true);
  });
});

describe("backspace", () => {
  it("dolu hücreyi temizler", () => {
    const s = newGame(tiny);
    selectCell(s, 1, 0);
    typeLetter(s, "B"); // imleç (1,1)'e geçti
    selectCell(s, 1, 0);
    backspace(s);
    expect(s.entries[1 * 3 + 0]).toBe("");
  });

  it("boş hücrede bir geri gidip temizler", () => {
    const s = newGame(tiny);
    selectCell(s, 1, 0);
    typeLetter(s, "B"); // imleç (1,1), orası boş
    backspace(s);
    expect(s.selCol).toBe(0);
    expect(s.entries[1 * 3 + 0]).toBe("");
  });
});

describe("checkEntries", () => {
  it("yanlış harfleri sayar ve işaretler", () => {
    const s = newGame(tiny);
    selectCell(s, 1, 0);
    typeLetter(s, "X");
    typeLetter(s, "A");
    expect(checkEntries(s)).toBe(1);
    expect(s.wrongCells.has(1 * 3 + 0)).toBe(true);
    expect(s.wrongCells.has(1 * 3 + 1)).toBe(false);
  });

  it("boş hücreleri yanlış saymaz", () => {
    const s = newGame(tiny);
    expect(checkEntries(s)).toBe(0);
  });
});

describe("revealLetter", () => {
  it("seçili hücrenin doğru harfini açar", () => {
    const s = newGame(tiny);
    selectCell(s, 2, 1);
    revealLetter(s);
    expect(s.entries[2 * 3 + 1]).toBe("T");
  });
});

describe("ilerleme kaydı", () => {
  it("girilen harfler yeni oyunda geri yüklenir", () => {
    const s1 = newGame(tiny);
    selectCell(s1, 1, 0);
    typeLetter(s1, "B");
    const s2 = newGame(tiny);
    expect(s2.entries[1 * 3 + 0]).toBe("B");
  });

  it("tamamlanan bulmacanın ilerleme kaydı silinir", () => {
    const s = newGame(tiny);
    selectCell(s, 1, 0);
    typeLetter(s, "B");
    typeLetter(s, "A");
    typeLetter(s, "L");
    selectCell(s, 2, 1);
    typeLetter(s, "T");
    expect(storage.getItem("cengel-progress-test-game")).toBeNull();
  });
});
