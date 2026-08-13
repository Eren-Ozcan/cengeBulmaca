import type { PuzzleDef } from "../types.ts";
import manifestData from "./manifest.json";

interface ManifestEntry {
  id: string;
  title: string;
  rows: number;
  cols: number;
  difficulty?: "kolay" | "orta" | "zor";
  order: number;
  file: string;
}

const manifest = manifestData as ManifestEntry[];

// puzzle-N.json dosyalarının tamamına dinamik (lazy) erişim: her biri
// açılışta değil, gerektiğinde (bkz. ensureLoaded) kendi chunk'ından yüklenir.
// Ana JS bundle'ının 300 bulmacanın tüm soru/cevap verisini baştan içermesini
// engelleyerek başlangıç yükünü küçültür.
const fileLoaders = import.meta.glob("./puzzle-*.json", {
  import: "default",
}) as Record<string, () => Promise<PuzzleDef>>;

/**
 * Görüntüleme sırasına göre (manifest'teki "order" alanı) dizilmiş bulmaca
 * listesi. clues/blocks alanları başlangıçta boş yer tutucudur; gerçek
 * içerik ensureLoaded/warmPuzzles ile arka planda doldurulur (bkz. ui.ts
 * openPuzzle — isLoaded false ise ensureLoaded bekleyip tekrar dener).
 */
export const puzzles: PuzzleDef[] = manifest
  .slice()
  .sort((a, b) => a.order - b.order)
  .map((e) => ({
    id: e.id,
    title: e.title,
    rows: e.rows,
    cols: e.cols,
    difficulty: e.difficulty,
    order: e.order,
    clues: [],
  }));

const fileById = new Map(manifest.map((e) => [e.id, e.file]));
const pending = new Map<string, Promise<void>>();

function fill(p: PuzzleDef): Promise<void> {
  if (p.clues.length > 0) return Promise.resolve();
  const file = fileById.get(p.id);
  if (!file) return Promise.resolve();
  let job = pending.get(p.id);
  if (!job) {
    job = fileLoaders[file]().then((full) => {
      Object.assign(p, full);
    });
    // Reddedilen sözü önbellekte BIRAKMA: aksi halde bir kerelik ağ
    // hatası (flaky bağlantı) bu bulmacayı uygulama yeniden başlatılana
    // kadar kalıcı olarak açılamaz yapardı — `if (!job)` her seferinde
    // false kalır, yeniden deneme hiç tetiklenmez.
    job.catch(() => pending.delete(p.id));
    pending.set(p.id, job);
  }
  return job;
}

/** Bulmacanın tam içeriği (clues/blocks) zaten yüklendi mi? */
export function isLoaded(p: PuzzleDef): boolean {
  return p.clues.length > 0;
}

/** Yer tutucu bir bulmacanın tam içeriğini indirir; zaten yüklüyse no-op. */
export function ensureLoaded(p: PuzzleDef): Promise<void> {
  return fill(p);
}

const EAGER_COUNT = 20;

/**
 * Uygulama açılışında ilk EAGER_COUNT bulmacayı (+ günün bulmacasını, öne
 * çıkan karttan hemen açılabilsin diye) hazır hale getirir ve bu tamamlanınca
 * kalan bulmacaları arka planda (bloklamadan) indirmeye başlar.
 */
export function warmPuzzles(dailyIndex: number): Promise<void> {
  const eagerSet = new Set(puzzles.slice(0, EAGER_COUNT));
  if (puzzles[dailyIndex]) eagerSet.add(puzzles[dailyIndex]);
  return Promise.all([...eagerSet].map(fill)).then(() => {
    void Promise.all(puzzles.filter((p) => !eagerSet.has(p)).map(fill));
  });
}
