// Measures how many puzzles can be generated under the zero-repeat rule
// with the dictionary's current contents.
//
// Usage: node tools/grow-puzzles.mjs [baseSeed] [--apply]
//
// First regenerates the existing puzzles with a shared strict tracker, then
// tries adding new puzzles until the pool is exhausted. Without `--apply`,
// no file is written — only the reached count is reported.

import { readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPuzzle, createTracker, commitToTracker } from "./generate.mjs";

const puzzleDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "puzzles");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const baseSeed = Number(args.find((a) => !a.startsWith("--")) ?? 20260821);
const num = (name, dflt) => Number(args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? dflt);
// Filling gets harder as the pool shrinks; how many seeds get tried directly
// affects the outcome, so it's configurable from outside.
const TRIES = num("tries", 8);
const GIVE_UP = num("giveup", 12);
// Number of 3-letter answers allowed per puzzle. 0 = old behavior.
// Ignored if --profiles is given.
const THREE = num("three", 0);
// Profile mix: for each puzzle, pick whichever profile best fits the
// remaining pool.
const USE_PROFILES = args.includes("--profiles");
// Water-filling mix: each puzzle's target length distribution is given
// proportional to the remaining supply in the dictionary. As a layer empties
// out, its share drops, which automatically lowers demand for it — at the
// limit, every layer runs out at the same time. The profile key and the
// greedy selector were a crude approximation of this (see
// dict-sources/README.md).
const USE_MIX = args.includes("--mix");
// Skip phase 1 (regenerate the existing set): build the tracker from the
// clues already on disk and go straight to phase 2 (add new puzzles). Since
// the set is already the output of a deterministic regen and the audit is
// clean, regeneration would produce the same files, so phase 2's result is
// unchanged — this just removes the hours-long phase 1 repeat. Note: a
// puzzle that fails to regenerate is no longer deleted.
const EXTEND = args.includes("--extend");
// Cap on buildPuzzle's mask attempts. Default 2000; a mask with shapeRuns is
// ~10x more expensive: a single ungeneratable puzzle burns TRIES x 2000
// attempts and locks up the run for minutes. A typical successful puzzle
// stays under 100 attempts, so lowering the cap doesn't hurt the success
// rate — it just makes failure cheaper.
const ATTEMPTS = num("attempts", USE_MIX ? 1500 : 2000);
// Difficulty curve. The water-filling target keeps the average right but
// gives every puzzle the same mix, so the set is the same difficulty from
// start to finish. The curve skews the target based on generation order:
// short/multi-clue layers are weighted up for the earlier puzzles and down
// for the later ones. The skew is undone by the water-filling itself on the
// next round, so the overall usage rate isn't affected. Play order is set
// separately by reorder-puzzles.mjs; the curve's job here isn't ordering,
// it's producing the *distribution* to be ordered.
// Fixed grid shape, in "8x10" form. If given, every puzzle in the set
// (including regenerated ones) switches to this shape. 8x10 fits the phone's
// grid area's (386x477) aspect ratio: at a 47.7 px cell — the largest in the
// set — the 52 px of side margin closes up, and clues per puzzle go from
// 15.7 to 19.2. Square shapes (9x9) close the side margin but open a bigger
// one at the bottom.
const SHAPE = args.find((x) => x.startsWith("--shape="))?.split("=")[1] ?? null;
const sabitSekil = SHAPE
  ? { cols: Number(SHAPE.split("x")[0]), rows: Number(SHAPE.split("x")[1]) }
  : null;

const CURVE = num("curve", 0.6);
const CURVE_TAU = num("curvetau", 70);

// Measured demand vectors (average answer count per puzzle, per length).
// Measured across 25 seeds x 5 grid sizes with scratch/prof.mjs.
// Goal: fit the set's demand mix to the dictionary's supply mix. A set
// generated with a single profile consumed short layers at 2x the supply
// rate, leaving a third of the long layers completely unused.
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
  // includes the 2-letter layer: 99% of the 81 words are multi-clue, i.e.
  // it lands right where the difficulty curve is thinnest.
  if (l >= 2) kalan[l] = (kalan[l] ?? 0) + 1;
}

// How many more puzzles this profile can sustain: the narrowest layer decides.
function kapasite(prof) {
  let min = Infinity;
  for (const [l, d] of Object.entries(prof.talep)) {
    if (d <= 0) continue;
    min = Math.min(min, (kalan[l] ?? 0) / d);
  }
  return min;
}

// Pick the profile that can be sustained longest: as the pool shrinks, the
// mix self-corrects (moves to "uzun" once 3-letter runs out, to "cokuzun"
// once 4-letter runs out).
// Target vector proportional to remaining supply. Absolute magnitude doesn't
// matter: shapeRuns scales the target to the mask's own slot count, only the
// ratios are used.
// The curve's skew at puzzle i: positive = toward the easy end, negative =
// toward the hard end. The damped exponential's own mean is subtracted so
// the overall average stays close to zero.
function egriSapmasi(i, n) {
  if (CURVE <= 0 || n <= 1) return 0;
  const ort = (CURVE_TAU / n) * (1 - Math.exp(-n / CURVE_TAU));
  return Math.exp(-i / CURVE_TAU) - ort;
}

function karisimHedefi(i = 0) {
  const tot = Object.values(kalan).reduce((x, y) => x + Math.max(0, y), 0);
  if (tot <= 0) return null;
  const nTahmin = Math.max(1, Math.round(tot / 21.5) + i);
  const g = CURVE * egriSapmasi(i, nTahmin);
  const t = {};
  for (const [l, n] of Object.entries(kalan)) {
    const yon = Number(l) <= 4 ? 1 : Number(l) >= 6 ? -1 : 0;
    t[l] = Math.max(0, (21.5 * Math.max(0, n)) / tot) * (1 + yon * g);
  }
  return t;
}

function profilSec() {
  if (USE_MIX) {
    const i = uretilen;
    return {
      ad: "karisim",
      opts: {
        targetMix: karisimHedefi(i),
        preferEasy: egriSapmasi(i, 300) > 0,
        // Spend rigid words first: a run dies from the search getting stuck,
        // not from the pool running out, so saving flexible words for last
        // delays that moment.
        preferRigid: true,
      },
    };
  }
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
// Generation order: the difficulty curve is read against this.
let uretilen = 0;
// Wall-clock limit for the new-puzzle-adding phase (minutes). Per-puzzle
// time explodes as the pool shrinks; once the limit hits, the run ends
// cleanly on its own instead of being killed by hand. 0 = unlimited.
const MAX_MINUTES = num("maxminutes", 0);

const files = readdirSync(puzzleDir)
  .filter((f) => /^puzzle-\d+\.json$/.test(f))
  .map((f) => ({ file: f, n: Number(f.match(/\d+/)[0]) }))
  .sort((a, b) => a.n - b.n);

const tracker = createTracker({ strict: true });
let built = 0, failed = 0, clues = 0;
let maxN = 0, maxOrder = 0;
// Give new puzzles the existing set's size/difficulty distribution.
const shapes = [], difficulties = [];

for (const { file, n } of files) {
  const old = JSON.parse(readFileSync(join(puzzleDir, file), "utf8"));
  maxN = Math.max(maxN, n);
  maxOrder = Math.max(maxOrder, old.order ?? 0);
  const sekil = sabitSekil ?? { rows: old.rows, cols: old.cols };
  shapes.push(sekil);
  difficulties.push(old.difficulty);

  if (EXTEND) {
    // Phase 1 skipped: fill the tracker from the clues on disk.
    commitToTracker(tracker, old.clues);
    havuzDus(old.clues);
    clues += old.clues.length;
    built++;
    if (built % 40 === 0) console.log(`  yuklendi ${built}/${files.length} | soru ${clues}`);
    continue;
  }

  const prof = profilSec();
  let p = null;
  for (let t = 0; t < TRIES && !p; t++) {
    const r = buildPuzzle({
      id: old.id, title: old.title, rows: sekil.rows, cols: sekil.cols,
      difficulty: old.difficulty, order: old.order,
      seed: baseSeed + n * 1013 + t * 104729, tracker, maxAttempts: ATTEMPTS, ...prof.opts,
    });
    if (r.puzzle) p = r.puzzle;
  }
  if (!p) {
    // The old content of a puzzle that fails to regenerate conflicts with
    // the new set: since its old answers were never committed to the
    // tracker, later puzzles reuse them. The file is deleted to avoid
    // producing a broken set.
    failed++;
    console.error(`${old.id}: uretilemedi - dosya siliniyor`);
    if (apply) rmSync(join(puzzleDir, file), { force: true });
    continue;
  }
  commitToTracker(tracker, p.clues);
  havuzDus(p.clues);
  uretilen++;
  profilSayaci[prof.ad] = (profilSayaci[prof.ad] ?? 0) + 1;
  clues += p.clues.length;
  built++;
  if (apply) writeFileSync(join(puzzleDir, file), JSON.stringify(p, null, 2) + "\n", "utf8");
  if (built % 20 === 0) console.log(`  mevcut ${built}/${files.length} | soru ${clues}`);
}

console.log(`\n${EXTEND ? "mevcut set diskten yuklendi" : "mevcut set yeniden uretildi"}: ${built} bulmaca, ${clues} soru, ${failed} basarisiz`);
console.log(`havuz tuketilene kadar yeni bulmaca deneniyor...\n`);

// If GIVE_UP attempts in a row come up empty, the pool is considered exhausted.
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
  // Record which seed offset succeeded: the run is deterministic, so this log
  // lets a later run skip the expensive misses and rebuild the set directly.
  let p = null, hitT = -1;
  for (let t = 0; t < TRIES && !p; t++) {
    const r = buildPuzzle({
      id, title: `Bulmaca ${n}`, rows: shape.rows, cols: shape.cols,
      difficulty, order, seed: baseSeed + n * 1013 + t * 104729, tracker, maxAttempts: ATTEMPTS,
      ...prof.opts,
    });
    if (r.puzzle) { p = r.puzzle; hitT = t; }
  }
  if (!p) { miss++; continue; }
  miss = 0;
  commitToTracker(tracker, p.clues);
  havuzDus(p.clues);
  uretilen++;
  profilSayaci[prof.ad] = (profilSayaci[prof.ad] ?? 0) + 1;
  clues += p.clues.length;
  added++;
  console.log(`  HIT n=${n} t=${hitT} ${id} | soru ${p.clues.length} | toplam ${built + added}`);
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
