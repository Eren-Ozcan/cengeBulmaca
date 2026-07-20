// @vitest-environment jsdom
//
// App sınıfını gerçek bir DOM üzerinde, kullanıcı gibi (ekran klavyesine
// tıklayarak, kartlara/pimlere dokunarak) sürüp render edilen sonucu
// doğrulayan uçtan uca stil testler. Alt katmanlar (game.ts, stats.ts,
// cats.ts) kendi birim testlerinde ayrıca doğrulanıyor; burada amaç bu
// parçaların ui.ts içinde doğru bağlandığını görmek.

import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./ui.ts";
import { installMemoryStorage } from "./test-helpers.ts";
import { CATS } from "./cats.ts";
import type { PuzzleDef } from "./types.ts";

const storage = installMemoryStorage();

// game.test.ts / puzzle.test.ts'teki 3x3 fikstürün aynısı:
//   [S1][S2][■ ]
//   [B ][A ][L ]
//   [■ ][T ][■ ]
const PUZZLE_A: PuzzleDef = {
  id: "ui-test-a",
  title: "Test A",
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
const PUZZLE_B: PuzzleDef = { ...PUZZLE_A, id: "ui-test-b", title: "Test B" };

function freshRoot(): HTMLElement {
  document.body.innerHTML = '<div id="app"></div>';
  return document.getElementById("app")!;
}

function clickNth(root: HTMLElement, selector: string, index = 0): void {
  const el = root.querySelectorAll<HTMLElement>(selector)[index];
  if (!el) throw new Error(`eleman bulunamadı: ${selector}[${index}]`);
  el.click();
}

function clickWithText(root: HTMLElement, selector: string, text: string): void {
  const el = Array.from(root.querySelectorAll<HTMLElement>(selector)).find(
    (e) => e.textContent === text,
  );
  if (!el) throw new Error(`eleman bulunamadı: ${selector} "${text}"`);
  el.click();
}

/** Ekran klavyesine tıklayarak bir kelime yazar (aktif soruya). */
function typeWord(root: HTMLElement, word: string): void {
  for (const ch of word) clickWithText(root, ".kb-key", ch);
}

/** Açık bir bulmacayı ekran klavyesiyle uçtan uca çözer. */
function solveTinyPuzzle(root: HTMLElement): void {
  typeWord(root, "BAL");
  typeWord(root, "AT");
}

beforeEach(() => {
  storage.clear();
});

describe("hikaye intro", () => {
  it("ilk açılışta gösterilir, devam edince ana menüye geçer ve görüldü olarak işaretlenir", () => {
    const root = freshRoot();
    new App(root, [PUZZLE_A]).start();

    expect(root.querySelector(".intro-screen")).toBeTruthy();
    clickWithText(root, ".intro-btn", "Yolculuğa başla");

    expect(root.querySelector(".intro-screen")).toBeFalsy();
    expect(root.querySelector(".home")).toBeTruthy();
    expect(storage.getItem("cengel-story-seen")).toBe("1");
  });

  it("daha önce görüldüyse doğrudan ana menü açılır", () => {
    storage.setItem("cengel-story-seen", "1");
    const root = freshRoot();
    new App(root, [PUZZLE_A, PUZZLE_B]).start();

    expect(root.querySelector(".intro-screen")).toBeFalsy();
    expect(root.querySelectorAll(".puzzle-card").length).toBe(2);
  });
});

describe("bulmaca çözme akışı", () => {
  it("ekran klavyesiyle bulmaca tamamlanınca kutlama modalı açılır ve çözüm kaydedilir", () => {
    storage.setItem("cengel-story-seen", "1");
    const root = freshRoot();
    new App(root, [PUZZLE_A]).start();

    clickNth(root, ".puzzle-card", 0);
    solveTinyPuzzle(root);

    const modal = root.querySelector(".modal");
    expect(modal).toBeTruthy();
    expect(modal!.querySelector(".modal-title")!.textContent).toBe("Tebrikler!");
    expect(modal!.querySelector(".cat-reveal-tag")).toBeFalsy();

    const stats = JSON.parse(storage.getItem("cengel-stats")!);
    expect(stats.solved).toContain("ui-test-a");

    clickWithText(root, ".modal-btn", "Ana menüye dön");
    expect(root.querySelector(".home")).toBeTruthy();
    expect(root.querySelectorAll(".puzzle-card")[0].querySelector(".puzzle-num")).toHaveProperty(
      "className",
      "puzzle-num solved",
    );
  });

  it("eşiğe ulaşan ikinci farklı çözüm bekçi kedi açılma kutlamasını tetikler", () => {
    storage.setItem("cengel-story-seen", "1");
    const root = freshRoot();
    new App(root, [PUZZLE_A, PUZZLE_B]).start();

    clickNth(root, ".puzzle-card", 0);
    solveTinyPuzzle(root);
    clickWithText(root, ".modal-btn", "Ana menüye dön");

    clickNth(root, ".puzzle-card", 1);
    solveTinyPuzzle(root);

    // CATS[0] (Pamuk) unlockAt: 2 — bu ikinci farklı çözümle tam eşleşir
    const modal = root.querySelector(".modal")!;
    expect(modal.querySelector(".cat-reveal-tag")).toBeTruthy();
    expect(modal.querySelector(".modal-title")!.textContent).toBe(CATS[0].name);
  });
});

describe("Kedi Dostlarım koleksiyonu", () => {
  it("kilit durumları eşiklerle uyumlu, açık karta dokununca detay modalı açılır", () => {
    storage.setItem("cengel-story-seen", "1");
    storage.setItem(
      "cengel-stats",
      JSON.stringify({ lastDay: null, streak: 0, solved: ["x1", "x2"] }),
    );
    const root = freshRoot();
    new App(root, [PUZZLE_A]).start();

    clickNth(root, ".cats-teaser", 0);
    const cards = root.querySelectorAll(".cat-card");
    expect(cards.length).toBe(CATS.length);
    expect(cards[0].classList.contains("unlocked")).toBe(true); // Pamuk, unlockAt 2
    expect(cards[1].classList.contains("locked")).toBe(true); // Bulut, unlockAt 6

    (cards[0] as HTMLElement).click();
    expect(root.querySelector(".cat-modal .modal-title")!.textContent).toBe(CATS[0].name);
  });
});

describe("Anadolu Haritası", () => {
  it("pim durumları koleksiyonla aynı, kilitli pime dokununca uyarı gösterir", () => {
    storage.setItem("cengel-story-seen", "1");
    storage.setItem(
      "cengel-stats",
      JSON.stringify({ lastDay: null, streak: 0, solved: ["x1", "x2"] }),
    );
    const root = freshRoot();
    new App(root, [PUZZLE_A]).start();

    clickNth(root, ".cats-teaser", 0);
    clickWithText(root, ".icon-btn", "🗺️");

    const pins = root.querySelectorAll(".map-pin:not(.map-pin-start)");
    expect(pins.length).toBe(CATS.length);
    expect(pins[0].classList.contains("unlocked")).toBe(true);
    expect(pins[1].classList.contains("locked")).toBe(true);

    (pins[1] as HTMLElement).click();
    expect(root.querySelector(".toast")?.textContent).toContain(CATS[1].region);
    expect(root.querySelector(".cat-modal")).toBeFalsy();

    (pins[0] as HTMLElement).click();
    expect(root.querySelector(".cat-modal .modal-title")!.textContent).toBe(CATS[0].name);
  });
});

describe("tema geçişi", () => {
  it("tema butonu data-theme'i değiştirir ve kalıcı kaydeder", () => {
    storage.setItem("cengel-story-seen", "1");
    const root = freshRoot();
    new App(root, [PUZZLE_A]).start();

    clickNth(root, ".theme-btn", 0);
    expect(storage.getItem("cengel-theme")).toBe("gazete");
    expect(document.documentElement.dataset.theme).toBe("gazete");
  });
});
