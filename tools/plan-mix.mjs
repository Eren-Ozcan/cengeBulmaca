// Puzzle set planner: computes, from dictionary supply alone, how many puzzles
// the set can hold and what length/difficulty mix each puzzle should target.
//
// Writes no files. It only prints the plan so the curve and the column sums can
// be checked before generation is changed.
//
// Usage: node tools/plan-mix.mjs [--n=320] [--util=0.88] [--tau=70] [--floor=2.5]
//        [--minlen=3] [--csv]
//
// Model
// -----
// Every answer belongs to one of six buckets: 3h, 4h-easy, 4h-hard, 5h, 6h, 7h.
// "easy" = the word has more than one clue variant in the dictionary; those are
// the everyday words. Length and rarity are almost the same axis (5h/6h/7h are
// ~100% single-clue), so the difficulty curve is mostly a curve on the short,
// multi-clue buckets.
//
// Per puzzle i the plan fixes an easy-answer budget e(i) from a decaying curve,
// then fills the rest of the grid proportionally to the *remaining* supply of
// the hard buckets. Because the split follows what is left, no layer can be
// drained ahead of the others: in the limit every bucket empties together.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { WORDS } from "./dictionary.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const num = (name, dflt) =>
  Number(args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? dflt);
const csv = args.includes("--csv");

// Words shorter than this stay out of the plan (2h layer is still closed).
const MIN_LEN = num("minlen", 3);
// Fraction of the dictionary the plan is allowed to spend. Never plan for 100%:
// the last words left are odd letter patterns and the filler stalls on them.
const UTIL = num("util", 0.88);
// Difficulty curve: easy(i) = amp * exp(-i / tau) + floor.
const TAU = num("tau", 70);
const EASY_FLOOR = num("floor", 2.5);

// ---------- supply ----------
const isEasy = (w) => w.c.length > 1;
const bucketOf = (w) => {
  const l = [...w.a].length;
  if (l === 4) return isEasy(w) ? "4e" : "4h";
  return `${l}`;
};
const EASY_BUCKETS = new Set(["2", "3", "4e"]);
const supply = {};
for (const w of WORDS) {
  if ([...w.a].length < MIN_LEN) continue;
  const b = bucketOf(w);
  supply[b] = (supply[b] ?? 0) + 1;
}
const BUCKETS = Object.keys(supply).sort();
const lenOf = (b) => Number(b[0]);

const total = Object.values(supply).reduce((a, b) => a + b, 0);
const easySupply = BUCKETS.filter((b) => EASY_BUCKETS.has(b))
  .reduce((a, b) => a + supply[b], 0);

// ---------- shapes ----------
// Measured clue counts of the existing set: the plan reuses its shape mix and
// its per-shape question count, so the numbers stay comparable to the live set.
const puzzleDir = join(root, "src", "puzzles");
const shapeQ = new Map();
const shapeSeq = [];
for (const f of readdirSync(puzzleDir).filter((x) => /^puzzle-\d+\.json$/.test(x))) {
  const p = JSON.parse(readFileSync(join(puzzleDir, f), "utf8"));
  const k = `${p.cols}x${p.rows}`;
  const e = shapeQ.get(k) ?? { n: 0, q: 0, cols: p.cols, rows: p.rows };
  e.n++;
  e.q += p.clues.length;
  shapeQ.set(k, e);
  shapeSeq.push(k);
}
for (const e of shapeQ.values()) e.avg = e.q / e.n;
const avgQ = shapeSeq.reduce((a, k) => a + shapeQ.get(k).avg, 0) / shapeSeq.length;

// N: how many puzzles the planned budget pays for.
const budget = total * UTIL;
const N = Math.round(num("n", budget / avgQ));

// The easy curve is normalised so its sum spends exactly the easy budget.
// amp is solved from sum_i (amp * exp(-i/tau) + floor) = easyBudget.
const easyBudget = easySupply * UTIL;
let decaySum = 0;
for (let i = 0; i < N; i++) decaySum += Math.exp(-i / TAU);
const amp = (easyBudget - EASY_FLOOR * N) / decaySum;

// ---------- plan ----------
const remaining = { ...supply };
const rows = [];
let spent = 0;
for (let i = 0; i < N; i++) {
  const shape = shapeSeq[i % shapeSeq.length];
  const Q = shapeQ.get(shape).avg;
  const t = {};

  // 1) easy budget for this puzzle, clipped to what is left and to the grid.
  const easyLeft = BUCKETS.filter((b) => EASY_BUCKETS.has(b))
    .reduce((a, b) => a + remaining[b], 0);
  let e = Math.min(amp * Math.exp(-i / TAU) + EASY_FLOOR, Q * 0.7, easyLeft);
  if (e < 0) e = 0;
  for (const b of BUCKETS) {
    if (!EASY_BUCKETS.has(b)) continue;
    t[b] = easyLeft > 0 ? (e * remaining[b]) / easyLeft : 0;
  }

  // 2) the rest follows the remaining hard supply: a bucket that is running out
  //    loses share automatically, so all layers drain at the same rate.
  const hardLeft = BUCKETS.filter((b) => !EASY_BUCKETS.has(b))
    .reduce((a, b) => a + remaining[b], 0);
  const rest = Math.max(0, Q - e);
  for (const b of BUCKETS) {
    if (EASY_BUCKETS.has(b)) continue;
    t[b] = hardLeft > 0 ? (rest * remaining[b]) / hardLeft : 0;
  }

  for (const b of BUCKETS) {
    remaining[b] = Math.max(0, remaining[b] - t[b]);
    spent += t[b];
  }
  const hard = BUCKETS.filter((b) => !EASY_BUCKETS.has(b)).reduce((a, b) => a + t[b], 0);
  rows.push({ i, shape, Q, e, hardShare: hard / Q, t });
}

// ---------- report ----------
const fmt = (x, d = 2) => x.toFixed(d).padStart(d + 4);
if (csv) {
  console.log(["i", "shape", "Q", "easy", ...BUCKETS].join(","));
  for (const r of rows)
    console.log([r.i + 1, r.shape, r.Q.toFixed(2), r.e.toFixed(2),
      ...BUCKETS.map((b) => r.t[b].toFixed(3))].join(","));
} else {
  console.log(`sozluk (>=${MIN_LEN}h): ${total} kelime, ${easySupply} kolay (%${Math.round(100 * easySupply / total)})`);
  console.log(`arz: ${BUCKETS.map((b) => `${b}=${supply[b]}`).join(" ")}`);
  console.log(`ortalama Q=${avgQ.toFixed(2)}  kullanim hedefi %${Math.round(UTIL * 100)}  -> N=${N}\n`);
  console.log(`bulmaca  sekil    Q   kolay  zor%  ${BUCKETS.map((b) => b.padStart(6)).join("")}`);
  const marks = [0, 4, 9, 19, 49, 99, 149, 199, 249, N - 1].filter((x, k, a) => x < N && a.indexOf(x) === k);
  for (const i of marks) {
    const r = rows[i];
    console.log(
      `${String(i + 1).padStart(7)}  ${r.shape.padEnd(6)} ${fmt(r.Q, 1)} ${fmt(r.e)}  ${String(Math.round(r.hardShare * 100)).padStart(3)}%  ` +
      BUCKETS.map((b) => fmt(r.t[b]).padStart(6)).join(""),
    );
  }
  console.log(`\nplanlanan toplam: ${Math.round(spent)} cevap / ${N} bulmaca`);
  console.log("katman tuketimi (plan):");
  for (const b of BUCKETS) {
    const used = supply[b] - remaining[b];
    console.log(`  ${b}: ${Math.round(used)}/${supply[b]}  %${Math.round(100 * used / supply[b])}`);
  }
}
