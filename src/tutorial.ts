// Oyun ilk kez açıldığında bir kereye mahsus oynanan rehber.
//
// Anlatmak yerine oynatır: oyuncu küçük ama gerçek bir çengel bulmacayı
// (3 kelime, 11 harf) Duman'ın adım adım yönlendirmesiyle çözer. Bu sırada
// soru hücreleri/oklar, cevap paneli, yazma, kesişen kelimeler ve yön
// kilidi, Kontrol/İpucu araçları ve yolculuğun amacı tanıtılır.
//
// Rehber bulmacası "practice" modunda oynanır: ne ilerleme kaydedilir ne de
// istatistiklere/kedi ödüllerine işlenir (bkz. game.ts GameState.practice).

import type { GameState } from "./game.ts";
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
    // depolama yoksa bir sonraki açılışta tekrar gösterilir
  }
}

/**
 * Rehberin mini bulmacası (4x5):
 *
 *   [■ ][■ ][■ ][S3↓][■ ]
 *   [S1→][K ][E ][D  ][İ ]
 *   [S2→][S ][A ][A  ][T ]
 *   [■ ][■ ][■ ][L  ][■ ]
 *
 * KEDİ ile DAL (1,3)'te, DAL ile SAAT (2,3)'te kesişir; ikinci kesişim
 * "kutu en yakın soruya kilitlenir" kuralını göstermek için kullanılır.
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

/** Rehber bulmacasındaki kelimelerin ipucu indeksleri */
const KEDI = 0;
const DAL = 1;
const SAAT = 2;

export interface TutorialStep {
  /** Duman'ın bu adımda söyledikleri */
  text: string;
  /** Dolu ise adım bu butonla geçilir; boşsa oyuncunun hamlesi beklenir */
  cta?: string;
  /**
   * Işıldayarak dokunulacak yeri gösteren hücre. Bu adımda klavye kapalıdır
   * (tek beklenen hamle dokunuş), bu yüzden yazdırma her zaman ayrı bir
   * adımda gelir.
   */
  target?: { row: number; col: number };
  /** Modalda Kontrol/İpucu butonlarının örneği gösterilsin mi */
  highlightTools?: boolean;
  /** Hamle bekleyen adımlarda tamamlanma koşulu */
  done?: (s: GameState) => boolean;
}

/** Bir kelimenin tüm harfleri doğru mu */
function wordSolved(s: GameState, ci: number): boolean {
  return s.grid.cluePlacements[ci].every((p) => {
    const i = p.row * s.grid.cols + p.col;
    const cell = s.grid.cells[i];
    return cell.kind === "letter" && s.entries[i] === cell.solution;
  });
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
    done: (s) => wordSolved(s, KEDI),
  },
  {
    text:
      "Süper! Doğru tamamlanan kelime yeşile döner ve öyle kalır. " +
      "Yanlış yazarsan da sorun yok, üstüne tekrar yazabilirsin.",
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
      "aşağı ilerleyeceksin. Cevap DAL — kesişen D zaten yerinde, yine de " +
      "baştan yazabilirsin.",
    done: (s) => wordSolved(s, DAL),
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
      "Cevap SAAT — bir harfi kesişmeden hazır geldi bile. " +
      "Yaz ve bulmacayı bitir!",
    done: (s) => wordSolved(s, SAAT),
  },
  {
    text:
      "İşte bu kadar! 🎉 Çözdüğün her bulmaca beni yeni bir şehre, yeni bir " +
      "bekçi kediye yaklaştırır. Her gün uğrarsan serin de büyür 🔥 " +
      "Hazırsan yola çıkalım.",
    cta: "Oynamaya başla",
  },
];
