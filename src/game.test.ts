import { beforeEach, describe, expect, it } from "vitest";
import {
  backspace,
  checkEntries,
  isCellLocked,
  isSolved,
  moveCursorInActiveClue,
  newGame,
  revealLetter,
  selectCell,
  typeLetter,
} from "./game.ts";
import { installMemoryStorage } from "./test-helpers.ts";
import type { PuzzleDef } from "./types.ts";

const storage = installMemoryStorage();

// same 3x3 fixture as in puzzle.test.ts:
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

  it("kesişimde yön, sorusu en yakın olan kelimeye kilitlenir", () => {
    const s = newGame(tiny);
    // (1,1) is both BAL's 2nd letter (distance 2 from its clue) and AT's
    // 1st letter (distance 1) — the nearer one, AT, wins
    selectCell(s, 1, 1);
    expect(s.activeClue).toBe(1);
  });

  it("aktif kelime uzak kalsa bile dokunulan kutu yakın soruya geçer", () => {
    const s = newGame(tiny);
    selectCell(s, 1, 0); // BAL
    expect(s.activeClue).toBe(0);
    selectCell(s, 1, 1); // intersection: AT's clue is nearer
    expect(s.activeClue).toBe(1);
  });

  it("kesişimde tekrar dokununca diğer kelimeye geçer", () => {
    const s = newGame(tiny);
    selectCell(s, 1, 1);
    expect(s.activeClue).toBe(1);
    selectCell(s, 1, 1);
    expect(s.activeClue).toBe(0);
  });

  it("ipucu hücresine dokunuş yok sayılır", () => {
    const s = newGame(tiny);
    selectCell(s, 0, 0);
    expect(s.selRow).toBeNull();
  });
});

describe("moveCursorInActiveClue", () => {
  it("imleci taşır ama aktif kelimeyi değiştirmez", () => {
    const s = newGame(tiny);
    selectCell(s, 1, 0); // BAL
    moveCursorInActiveClue(s, 1, 1); // intersection, but direction shouldn't change
    expect(s.selCol).toBe(1);
    expect(s.activeClue).toBe(0);
  });

  it("aktif kelimenin dışındaki hücreyi yok sayar", () => {
    const s = newGame(tiny);
    selectCell(s, 1, 0); // BAL
    moveCursorInActiveClue(s, 2, 1); // only part of AT
    expect(s.selRow).toBe(1);
    expect(s.selCol).toBe(0);
  });
});

describe("rehber (practice) modu", () => {
  it("ilerlemeyi kaydetmez ve çözüm istatistiğe işlenmez", () => {
    const s = newGame(tiny, { practice: true });
    selectCell(s, 1, 0);
    typeLetter(s, "B");
    typeLetter(s, "A");
    typeLetter(s, "L");
    selectCell(s, 2, 1);
    typeLetter(s, "T");

    expect(s.completed).toBe(true);
    expect(storage.getItem("cengel-progress-test-game")).toBeNull();
    expect(storage.getItem("cengel-stats")).toBeNull();
  });

  it("kayıtlı ilerlemeyi yüklemez", () => {
    const s1 = newGame(tiny);
    selectCell(s1, 1, 0);
    typeLetter(s1, "B");
    const s2 = newGame(tiny, { practice: true });
    expect(s2.entries[1 * 3 + 0]).toBe("");
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

describe("çözülmüş kelimenin harfleri kilitlenir", () => {
  /** Completes BAL correctly; the intersecting (1,1)='A' is now locked */
  function solveBal(s: ReturnType<typeof newGame>): void {
    selectCell(s, 1, 0);
    typeLetter(s, "B");
    typeLetter(s, "A");
    typeLetter(s, "L");
  }

  it("kilitli hücreye yazılamaz, harf sonraki boş kutuya düşer", () => {
    const s = newGame(tiny);
    solveBal(s);
    expect(isCellLocked(s, 1, 1)).toBe(true);

    // switch to AT: with the cursor on the locked 'A', the typed letter goes to (2,1)
    selectCell(s, 1, 1);
    expect(s.activeClue).toBe(1);
    typeLetter(s, "T");
    expect(s.entries[1 * 3 + 1]).toBe("A"); // the locked letter wasn't touched
    expect(s.entries[2 * 3 + 1]).toBe("T");
  });

  it("imleç yazdıktan sonra kilitli hücreleri atlar", () => {
    const s = newGame(tiny);
    // solve AT first: (1,1) and (2,1) correct -> both locked
    selectCell(s, 2, 1);
    typeLetter(s, "T");
    selectCell(s, 1, 1);
    typeLetter(s, "A");
    expect(isCellLocked(s, 2, 1)).toBe(true);

    // type BAL: after B, the cursor skips the locked (1,1) and goes to (1,2)
    selectCell(s, 1, 0);
    expect(s.activeClue).toBe(0);
    typeLetter(s, "B");
    expect(s.selRow).toBe(1);
    expect(s.selCol).toBe(2);
  });

  it("kilitli harf silinmez, serbest harfler silinmeye devam eder", () => {
    const s = newGame(tiny);
    solveBal(s);

    // with AT active and the cursor on the locked 'A': the typed letter goes to (2,1)
    selectCell(s, 1, 1);
    typeLetter(s, "X");
    expect(s.entries[2 * 3 + 1]).toBe("X");

    // a free cell is deleted normally
    backspace(s);
    expect(s.entries[2 * 3 + 1]).toBe("");

    // with the cursor on the locked cell, backspace doesn't touch the locked letter
    selectCell(s, 1, 1);
    backspace(s);
    expect(s.entries[1 * 3 + 1]).toBe("A");
  });
});

describe("backspace", () => {
  it("dolu hücreyi temizler", () => {
    const s = newGame(tiny);
    selectCell(s, 1, 0);
    typeLetter(s, "B"); // cursor moved to (1,1)
    selectCell(s, 1, 0);
    backspace(s);
    expect(s.entries[1 * 3 + 0]).toBe("");
  });

  it("boş hücrede bir geri gidip temizler", () => {
    const s = newGame(tiny);
    selectCell(s, 1, 0);
    typeLetter(s, "B"); // cursor at (1,1), which is empty
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

  it("çözülmüş bulmaca tekrar açılınca bomboş değil, çözümüyle gelir", () => {
    const s1 = newGame(tiny);
    selectCell(s1, 1, 0);
    typeLetter(s1, "B");
    typeLetter(s1, "A");
    typeLetter(s1, "L");
    selectCell(s1, 2, 1);
    typeLetter(s1, "T");
    expect(storage.getItem("cengel-progress-test-game")).toBeNull();

    const s2 = newGame(tiny);
    expect(s2.completed).toBe(true);
    expect(isSolved(s2)).toBe(true);
    expect(s2.entries[1 * 3 + 0]).toBe("B");
    expect(s2.entries[1 * 3 + 1]).toBe("A");
    expect(s2.entries[1 * 3 + 2]).toBe("L");
    expect(s2.entries[2 * 3 + 1]).toBe("T");
  });
});
