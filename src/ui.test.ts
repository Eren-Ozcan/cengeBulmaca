// @vitest-environment jsdom
//
// App sınıfını gerçek bir DOM üzerinde, kullanıcı gibi (ekran klavyesine
// tıklayarak, kartlara/pimlere dokunarak) sürüp render edilen sonucu
// doğrulayan uçtan uca stil testler. Alt katmanlar (game.ts, stats.ts,
// cats.ts) kendi birim testlerinde ayrıca doğrulanıyor; burada amaç bu
// parçaların ui.ts içinde doğru bağlandığını görmek.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

/** Testlerde zaman aşımına dayalı açılış ekranını atlayarak App kurar. */
function newApp(root: HTMLElement, puzzles: PuzzleDef[]): App {
  return new App(root, puzzles, { skipSplash: true });
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
    newApp(root, [PUZZLE_A]).start();

    expect(root.querySelector(".intro-screen")).toBeTruthy();
    clickWithText(root, ".intro-btn", "Yolculuğa başla");

    expect(root.querySelector(".intro-screen")).toBeFalsy();
    expect(root.querySelector(".home")).toBeTruthy();
    expect(storage.getItem("cengel-story-seen")).toBe("1");
  });

  it("daha önce görüldüyse doğrudan ana menü açılır", () => {
    storage.setItem("cengel-story-seen", "1");
    const root = freshRoot();
    newApp(root, [PUZZLE_A, PUZZLE_B]).start();

    expect(root.querySelector(".intro-screen")).toBeFalsy();
    expect(root.querySelectorAll(".puzzle-card").length).toBe(2);
  });
});

describe("bulmaca çözme akışı", () => {
  it("ekran klavyesiyle bulmaca tamamlanınca kutlama modalı açılır ve çözüm kaydedilir", () => {
    storage.setItem("cengel-story-seen", "1");
    const root = freshRoot();
    newApp(root, [PUZZLE_A]).start();

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
    newApp(root, [PUZZLE_A, PUZZLE_B]).start();

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

describe("ipucu, joker ve reklam", () => {
  it("günlük ücretsiz ipucu bitince joker harcanır", () => {
    storage.setItem("cengel-story-seen", "1");
    const root = freshRoot();
    newApp(root, [PUZZLE_A]).start();
    clickNth(root, ".puzzle-card", 0);

    for (let i = 0; i < 3; i++) {
      clickWithText(root, ".action-btn", `İpucu (${3 - i})`);
    }

    // ücretsiz hak bitti, sıradaki 5 joker devreye girer
    clickWithText(root, ".action-btn", "🃏 İpucu (5)");
    expect(storage.getItem("cengel-jokers")).toBe("4");
  });

  it("ücretsiz ipucu ve joker ikisi de tükenince buton reklam izlemeye döner ve Mağaza'ya yönlendiren bir seçenek belirir; web ortamında reklam gösterilemediği için ipucu açılmaz", async () => {
    storage.setItem("cengel-story-seen", "1");
    storage.setItem("cengel-jokers-init", "1");
    storage.setItem("cengel-jokers", "0");
    const root = freshRoot();
    newApp(root, [PUZZLE_A]).start();
    clickNth(root, ".puzzle-card", 0);

    for (let i = 0; i < 3; i++) {
      clickWithText(root, ".action-btn", `İpucu (${3 - i})`);
    }

    const adBtn = Array.from(root.querySelectorAll<HTMLElement>(".action-btn")).find(
      (b) => b.textContent === "🎬 İpucu",
    );
    expect(adBtn).toBeTruthy();
    expect(root.querySelector(".joker-cta-chip")).toBeTruthy();

    adBtn!.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(root.querySelector(".toast")?.textContent).toContain("Reklam tamamlanmadı");
  });
});

describe("ana menü kabuğu", () => {
  it("alt gezinme çubuğu Kediler/Mağaza/Ayarlar sekmeleri arasında geçiş yapar", () => {
    storage.setItem("cengel-story-seen", "1");
    const root = freshRoot();
    newApp(root, [PUZZLE_A]).start();

    expect(root.querySelector(".bottom-nav-btn.active")?.textContent).toContain("Ana Sayfa");

    clickWithText(root, ".bottom-nav-label", "Mağaza");
    expect(root.querySelector(".shop-screen")).toBeTruthy();
    expect(root.querySelectorAll(".shop-pack-card").length).toBeGreaterThan(0);

    clickWithText(root, ".bottom-nav-label", "Ayarlar");
    expect(root.querySelector(".settings-screen")).toBeTruthy();
    expect(root.querySelectorAll(".settings-row").length).toBe(3);

    clickWithText(root, ".bottom-nav-label", "Kediler");
    expect(root.querySelector(".cats-screen")).toBeTruthy();

    clickWithText(root, ".bottom-nav-label", "Ana Sayfa");
    expect(root.querySelector(".home-top")).toBeTruthy();
  });

  it("joker rozetine dokununca Mağaza açılır; joker paketi satın alınca bakiye artar", async () => {
    storage.setItem("cengel-story-seen", "1");
    const root = freshRoot();
    newApp(root, [PUZZLE_A]).start();

    clickNth(root, ".joker-pill", 0);
    expect(root.querySelector(".shop-screen")).toBeTruthy();

    clickNth(root, ".shop-pack-card", 0);
    await new Promise((r) => setTimeout(r, 0));

    expect(root.querySelector(".toast")?.textContent).toContain("Joker eklendi");
  });

  it("Ayarlar'daki Müzik/Sesler anahtarları tercihleri kalıcı değiştirir", () => {
    storage.setItem("cengel-story-seen", "1");
    const root = freshRoot();
    newApp(root, [PUZZLE_A]).start();

    clickWithText(root, ".bottom-nav-label", "Ayarlar");
    clickWithText(root, ".settings-label", "Müzik");
    expect(storage.getItem("cengel-music")).toBe("off");

    clickWithText(root, ".settings-label", "Sesler");
    expect(storage.getItem("cengel-sound")).toBe("off");
  });
});

describe("açılış ekranı (splash)", () => {
  afterEach(() => vi.useRealTimers());

  it("kısa süre gösterilir, sonra hikaye/ana menüye geçer", () => {
    storage.setItem("cengel-story-seen", "1");
    vi.useFakeTimers();
    const root = freshRoot();
    new App(root, [PUZZLE_A]).start();

    expect(root.querySelector(".splash-screen")).toBeTruthy();
    expect(root.querySelector(".home")).toBeFalsy();

    vi.advanceTimersByTime(2000);

    expect(root.querySelector(".splash-screen")).toBeFalsy();
    expect(root.querySelector(".home")).toBeTruthy();
  });
});

describe("ilk bulmaca rehberi (tutorial)", () => {
  it("ilk bulmacada gösterilir, ilk harf yazılınca kalıcı olarak kapanır", () => {
    storage.setItem("cengel-story-seen", "1");
    const root = freshRoot();
    newApp(root, [PUZZLE_A]).start();

    clickNth(root, ".puzzle-card", 0);
    expect(root.querySelector(".tutorial-coach")).toBeTruthy();

    clickWithText(root, ".kb-key", "B");
    expect(root.querySelector(".tutorial-coach")).toBeFalsy();
    expect(storage.getItem("cengel-tutorial-seen")).toBe("1");

    // bir sonraki açılışta bile tekrar gösterilmez
    const back = root.querySelector<HTMLElement>(".icon-btn")!;
    back.click();
    clickNth(root, ".puzzle-card", 0);
    expect(root.querySelector(".tutorial-coach")).toBeFalsy();
  });

  it("Anladım butonuyla da kapatılabilir", () => {
    storage.setItem("cengel-story-seen", "1");
    const root = freshRoot();
    newApp(root, [PUZZLE_A]).start();

    clickNth(root, ".puzzle-card", 0);
    clickWithText(root, ".tutorial-coach-btn", "Anladım, başlıyorum!");

    expect(root.querySelector(".tutorial-coach")).toBeFalsy();
    expect(storage.getItem("cengel-tutorial-seen")).toBe("1");
  });
});

describe("kedi açılma joker ödülü", () => {
  it("yeni bekçi kedi açılınca joker bakiyesi artar ve kutlamada gösterilir", () => {
    storage.setItem("cengel-story-seen", "1");
    storage.setItem(
      "cengel-stats",
      JSON.stringify({ lastDay: null, streak: 0, solved: ["x1"] }),
    );
    const root = freshRoot();
    newApp(root, [PUZZLE_A]).start();

    const before = Number(storage.getItem("cengel-jokers") ?? "5");
    clickNth(root, ".puzzle-card", 0);
    solveTinyPuzzle(root);

    const modal = root.querySelector(".modal")!;
    expect(modal.querySelector(".cat-reward-line")?.textContent).toContain("Joker");
    expect(Number(storage.getItem("cengel-jokers"))).toBe(before + 2);
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
    newApp(root, [PUZZLE_A]).start();

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
    newApp(root, [PUZZLE_A]).start();

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
    newApp(root, [PUZZLE_A]).start();

    clickNth(root, ".theme-btn", 0);
    expect(storage.getItem("cengel-theme")).toBe("gazete");
    expect(document.documentElement.dataset.theme).toBe("gazete");
  });
});
