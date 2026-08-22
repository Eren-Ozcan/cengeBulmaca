// Sözlüğün şu anki hâliyle sıfır tekrar kuralı altında kaç bulmaca
// üretilebildiğini ölçer.
//
// Kullanım: node tools/grow-puzzles.mjs [baseSeed] [--apply]
//
// Önce mevcut bulmacaları ortak bir strict takipçiyle yeniden üretir, sonra
// havuz tükenene kadar yeni bulmaca eklemeyi dener. `--apply` verilmezse
// hiçbir dosya yazılmaz, yalnızca ulaşılan sayı raporlanır.

import { readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPuzzle, createTracker, commitToTracker } from "./generate.mjs";

const puzzleDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "puzzles");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const baseSeed = Number(args.find((a) => !a.startsWith("--")) ?? 20260821);
const num = (name, dflt) => Number(args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? dflt);
// Havuz daraldıkça doldurma zorlaşıyor; kaç tohum denendiği sonucu doğrudan
// etkiliyor, bu yüzden dışarıdan ayarlanabilir.
const TRIES = num("tries", 8);
const GIVE_UP = num("giveup", 12);
// Bulmaca başına izin verilen 3 harfli cevap sayısı. 0 = eski davranış.
// --profiles verilirse yok sayılır.
const THREE = num("three", 0);
// Profil karışımı: her bulmaca için, kalan havuza en iyi oturan profil seçilir.
const USE_PROFILES = args.includes("--profiles");

// Ölçülmüş talep vektörleri (bulmaca başına ortalama cevap sayısı, uzunluk
// başına). 25 tohum x 5 ızgara boyutu, scratch/prof.mjs ile ölçüldü.
// Amaç: setin talep karışımını sözlüğün arz karışımına oturtmak. Tek profille
// üretilen set kısa katmanları arzın 2 katı hızda tüketiyor, uzun katmanların
// üçte biri hiç kullanılmadan kalıyordu.
const PROFILES = [
  { ad: "kisa", opts: { minWordLen: 4, shortBudget: 3 }, talep: { 3: 2.72, 4: 6.48, 5: 7.04, 6: 3.88, 7: 4.04 } },
  { ad: "uzun", opts: { minWordLen: 5, shortBudget: 4 }, talep: { 3: 0.0, 4: 3.77, 5: 5.46, 6: 5.31, 7: 4.38 } },
  { ad: "cokuzun", opts: { minWordLen: 5, shortBudget: 2 }, talep: { 3: 0.0, 4: 1.83, 5: 8.50, 6: 4.17, 7: 4.83 } },
];

// Kalan havuz: uzunluk basina sozlukte kalan kelime sayisi.
const { WORDS: ALL_WORDS } = await import("./dictionary.mjs");
const kalan = {};
for (const w of ALL_WORDS) {
  const l = [...w.a].length;
  if (l >= 3) kalan[l] = (kalan[l] ?? 0) + 1;
}

// Bu profille kaç bulmaca daha sürdürülebilir: en dar katman belirler.
function kapasite(prof) {
  let min = Infinity;
  for (const [l, d] of Object.entries(prof.talep)) {
    if (d <= 0) continue;
    min = Math.min(min, (kalan[l] ?? 0) / d);
  }
  return min;
}

// En uzun süre sürdürülebilir profili seç: havuz daraldıkça karışım kendi
// kendini düzeltir (3 harfli bitince "uzun"a, 4 harfli bitince "cokuzun"a).
function profilSec() {
  if (!USE_PROFILES) return { ad: "sabit", opts: { minWordLen: 4, shortBudget: THREE } };
  let best = PROFILES[0], bestScore = -1;
  for (const p of PROFILES) {
    const k = kapasite(p);
    if (k > bestScore) { bestScore = k; best = p; }
  }
  return best;
}

function havuzDus(clues) {
  for (const c of clues) {
    const l = [...c.answer].length;
    if (kalan[l] !== undefined) kalan[l]--;
  }
}

const profilSayaci = {};
// Yeni bulmaca ekleme aşaması için duvar saati sınırı (dakika). Havuz
// daraldıkça bulmaca başına süre patlıyor; sınıra gelince koşu elle
// öldürülmek yerine kendi kendine düzgün biter. 0 = sınırsız.
const MAX_MINUTES = num("maxminutes", 0);

const files = readdirSync(puzzleDir)
  .filter((f) => /^puzzle-\d+\.json$/.test(f))
  .map((f) => ({ file: f, n: Number(f.match(/\d+/)[0]) }))
  .sort((a, b) => a.n - b.n);

const tracker = createTracker({ strict: true });
let built = 0, failed = 0, clues = 0;
let maxN = 0, maxOrder = 0;
// Yeni bulmacalara mevcut setin boyut/zorluk dağılımını ver.
const shapes = [], difficulties = [];

for (const { file, n } of files) {
  const old = JSON.parse(readFileSync(join(puzzleDir, file), "utf8"));
  maxN = Math.max(maxN, n);
  maxOrder = Math.max(maxOrder, old.order ?? 0);
  shapes.push({ rows: old.rows, cols: old.cols });
  difficulties.push(old.difficulty);

  const prof = profilSec();
  let p = null;
  for (let t = 0; t < TRIES && !p; t++) {
    const r = buildPuzzle({
      id: old.id, title: old.title, rows: old.rows, cols: old.cols,
      difficulty: old.difficulty, order: old.order,
      seed: baseSeed + n * 1013 + t * 104729, tracker, ...prof.opts,
    });
    if (r.puzzle) p = r.puzzle;
  }
  if (!p) {
    // Yeniden üretilemeyen bulmacanın eski içeriği yeni setle çakışır: eski
    // cevaplar takipçiye işlenmediği için sonraki bulmacalar onları tekrar
    // kullanır. Bozuk set üretmemek için dosya silinir.
    failed++;
    console.error(`${old.id}: uretilemedi - dosya siliniyor`);
    if (apply) rmSync(join(puzzleDir, file), { force: true });
    continue;
  }
  commitToTracker(tracker, p.clues);
  havuzDus(p.clues);
  profilSayaci[prof.ad] = (profilSayaci[prof.ad] ?? 0) + 1;
  clues += p.clues.length;
  built++;
  if (apply) writeFileSync(join(puzzleDir, file), JSON.stringify(p, null, 2) + "\n", "utf8");
  if (built % 20 === 0) console.log(`  mevcut ${built}/${files.length} | soru ${clues}`);
}

console.log(`\nmevcut set yeniden uretildi: ${built} bulmaca, ${clues} soru, ${failed} basarisiz`);
console.log(`havuz tuketilene kadar yeni bulmaca deneniyor...\n`);

// Arka arkaya GIVE_UP deneme boşa giderse havuz bitmiş sayılır.
let miss = 0, added = 0, n = maxN, order = maxOrder;

const deadline = MAX_MINUTES > 0 ? Date.now() + MAX_MINUTES * 60_000 : Infinity;
let timedOut = false;

while (miss < GIVE_UP) {
  if (Date.now() > deadline) { timedOut = true; break; }
  n++; order++;
  const shape = shapes[added % shapes.length];
  const difficulty = difficulties[added % difficulties.length];
  const id = `puzzle-${n}`;
  const prof = profilSec();
  let p = null;
  for (let t = 0; t < TRIES && !p; t++) {
    const r = buildPuzzle({
      id, title: `Bulmaca ${n}`, rows: shape.rows, cols: shape.cols,
      difficulty, order, seed: baseSeed + n * 1013 + t * 104729, tracker,
      ...prof.opts,
    });
    if (r.puzzle) p = r.puzzle;
  }
  if (!p) { miss++; continue; }
  miss = 0;
  commitToTracker(tracker, p.clues);
  havuzDus(p.clues);
  profilSayaci[prof.ad] = (profilSayaci[prof.ad] ?? 0) + 1;
  clues += p.clues.length;
  added++;
  if (apply) writeFileSync(join(puzzleDir, `${id}.json`), JSON.stringify(p, null, 2) + "\n", "utf8");
  if (added % 5 === 0) console.log(`  yeni ${added} | toplam ${built + added} bulmaca | soru ${clues}`);
}

if (timedOut) console.log(`\n[${MAX_MINUTES} dk siniri doldu - ekleme durduruldu]`);
console.log(`\nSONUC: ${built + added} bulmaca (${built} mevcut + ${added} yeni), ${clues} soru`);
console.log(`farkli ipucu metni: ${tracker.text.size}`);
console.log(`profil dagilimi: ${Object.entries(profilSayaci).map(([k, v]) => `${k}=${v}`).join(" ")}`);
const WORDS = ALL_WORDS;
const havuz = {}, kullanilan = {};
for (const w of WORDS) { const l = [...w.a].length; havuz[l] = (havuz[l] ?? 0) + 1; }
for (const a of tracker.answer?.keys() ?? []) { const l = [...a].length; kullanilan[l] = (kullanilan[l] ?? 0) + 1; }
console.log("");
console.log("katman tuketimi:");
for (const l of Object.keys(havuz).sort()) console.log(`  ${l} harf: ${kullanilan[l] ?? 0}/${havuz[l]}  %${Math.round(100 * (kullanilan[l] ?? 0) / havuz[l])}`);
console.log(apply ? "dosyalar yazildi" : "kuru kosu - dosya yazilmadi");
