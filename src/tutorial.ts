// One-time tutorial played the first time the game is launched.
//
// It teaches by playing rather than explaining: the player solves a small
// but real crossword (3 words, 11 letters) with Duman guiding them step by
// step. Along the way it introduces clue cells/arrows, the answer panel,
// typing, intersecting words and direction locking, the Check/Hint tools,
// and the goal of the journey.
//
// The tutorial puzzle is played in "practice" mode: neither progress nor
// stats/cat rewards are recorded (see game.ts GameState.practice).

import { isWordSolved, type GameState } from "./game.ts";
import type { PuzzleDef } from "./types.ts";

const KEY = "cengel-tutorial-seen";

export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // if storage is unavailable, it's shown again on the next launch
  }
}

/**
 * The tutorial's mini puzzle (4x5):
 *
 *   [■ ][■ ][■ ][S3↓][■ ]
 *   [S1→][K ][E ][D  ][İ ]
 *   [S2→][S ][A ][A  ][T ]
 *   [■ ][■ ][■ ][L  ][■ ]
 *
 * KEDİ (cat) intersects DAL (branch) at (1,3), and DAL intersects SAAT
 * (clock) at (2,3); the second intersection is used to demonstrate the
 * "the cell locks to the nearest clue" rule.
 */
export const TUTORIAL_PUZZLE: PuzzleDef = {
  id: "tutorial",
  title: "Nasıl oynanır?",
  rows: 4,
  cols: 5,
  clues: [
    { text: "Miyavlayan dost", answer: "KEDİ", row: 1, col: 0, arrow: "right" },
    { text: "Ağacın kolu", answer: "DAL", row: 0, col: 3, arrow: "down" },
    { text: "Zamanı gösterir", answer: "SAAT", row: 2, col: 0, arrow: "right" },
  ],
  blocks: [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 0, col: 4 },
    { row: 3, col: 0 },
    { row: 3, col: 1 },
    { row: 3, col: 2 },
    { row: 3, col: 4 },
  ],
};

/** Clue indexes of the words in the tutorial puzzle */
const KEDI = 0;
const DAL = 1;
const SAAT = 2;

export interface TutorialStep {
  /** What Duman says at this step */
  text: string;
  /** If set, the step is advanced with this button; if empty, waits for the player's move */
  cta?: string;
  /**
   * The cell shown glowing as the spot to tap. The keyboard is disabled
   * during this step (the only expected move is a tap), so typing always
   * comes as a separate step.
   */
  target?: { row: number; col: number };
  /** Whether to show a sample of the Check/Hint buttons in the modal */
  highlightTools?: boolean;
  /** Completion condition for steps waiting on a move */
  done?: (s: GameState) => boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    text:
      "Merhaba, ben Duman! 🐾 Başlamadan önce minik bir bulmaca çözelim — " +
      "bir dakika bile sürmez, sonrası tamamen senin.",
    cta: "Hadi başlayalım",
  },
  {
    text:
      "Gri kutular sorulardır; içindeki ok cevabın hangi kutudan başlayıp " +
      "hangi yöne gideceğini gösterir. Işıldayan soruya dokun.",
    target: { row: 1, col: 0 },
    done: (s) => s.activeClue === KEDI,
  },
  {
    text:
      "Soru aşağıdaki panelde büyük büyük yazıyor, altındaki kutular da " +
      "cevabın kaç harf olduğunu söylüyor. Cevap KEDİ — klavyeden yaz.",
    done: (s) => isWordSolved(s, KEDI),
  },
  {
    text:
      "Süper! Doğru tamamlanan kelime yeşile döner ve kilitlenir — o " +
      "harflerin üstüne artık yazılamaz, imleç onları kendiliğinden atlar. " +
      "Yanlış yazdıklarını ise istediğin kadar değiştirebilirsin.",
    cta: "Devam",
  },
  {
    text:
      "Kelimeler birbirini keser. Bir kutuya dokunduğunda kutu, kendisine " +
      "en yakın soruya kilitlenir: ışıldayan D kutusuna dokun, aşağı inen " +
      "soruya geçelim.",
    target: { row: 1, col: 3 },
    done: (s) => s.activeClue === DAL,
  },
  {
    text:
      "Gördün mü? Panel artık aşağı inen soruyu gösteriyor, yazdıkça da " +
      "aşağı ilerleyeceksin. Cevap DAL — kesişen D kilitli olduğu için imleç " +
      "onu atlar; sana kalan iki harf var: A ve L.",
    done: (s) => isWordSolved(s, DAL),
  },
  {
    text:
      "Yukarıdaki iki araç her zaman yanında: Kontrol yazdığın harfleri " +
      "denetler, İpucu seçili kutunun harfini açar. Her gün birkaç ipucu " +
      "bedava; bitince joker harcar ya da kısa bir reklam izlersin.",
    cta: "Anladım",
    highlightTools: true,
  },
  {
    text: "Şimdi sıra tamamen sende: ışıldayan son soruya dokun.",
    target: { row: 2, col: 0 },
    done: (s) => s.activeClue === SAAT,
  },
  {
    text:
      "Cevap SAAT — üçüncü harfi kesişmeden hazır geldi ve kilitli. " +
      "Kalan S, A, T'yi yaz, bulmaca bitsin!",
    done: (s) => isWordSolved(s, SAAT),
  },
  {
    text:
      "İşte bu kadar! 🎉 Çözdüğün her bulmaca beni yeni bir şehre, yeni bir " +
      "bekçi kediye yaklaştırır. Her gün uğrarsan serin de büyür 🔥 " +
      "Hazırsan yola çıkalım.",
    cta: "Oynamaya başla",
  },
];
