// Hooked crossword generator.
//
// Usage:
//   node tools/generate.mjs <id> <title> [seed] [cols] [rows] [difficulty]
//   difficulty: kolay | orta | zor (optional label)
//
// Flow: generate a random mask -> assign clues to clue cells ->
// fill from the dictionary with backtracking -> validate -> write
// src/puzzles/<id>.json.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { WORDS } from "./dictionary.mjs";

const MAX_WORD_LEN = 7;
// Probability that a mask cell becomes a clue (block) cell. A higher value
// produces short runs, a lower value produces long runs; this directly
// decides which letter-length layer gets consumed. Adjustable per puzzle to
// fit the set's demand mix to the dictionary's supply mix (see the
// buildPuzzle profile).
const DEFAULT_BLOCK_DENSITY = 0.17;
// Number of fills to try for the same mask (when a tracker is present).
const FILL_TRIES = 6;

// ---------- seeded RNG ----------
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- mask ----------
function genMask(cols, rows, rnd, density = DEFAULT_BLOCK_DENSITY) {
  // '#' is a clue cell, '.' is a letter cell. The first row is entirely clue
  // cells: down-going answers are clued from there (the classic "clue on top" layout).
  const mask = [];
  mask.push("#".repeat(cols).split(""));
  for (let r = 1; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(rnd() < density ? "#" : ".");
    mask.push(row);
  }
  return mask;
}

// Tries to make the mask usable:
// splits long runs down the middle, turns isolated letter cells into clue cells.
function repairMask(mask, cols, rows, rnd) {
  for (let iter = 0; iter < 60; iter++) {
    let changed = false;

    // split long horizontal runs
    for (let r = 1; r < rows; r++) {
      let c = 0;
      while (c < cols) {
        if (mask[r][c] === ".") {
          let len = 0;
          while (c + len < cols && mask[r][c + len] === ".") len++;
          if (len > MAX_WORD_LEN) {
            mask[r][c + 2 + Math.floor(rnd() * (len - 4))] = "#";
            changed = true;
          }
          c += len;
        } else c++;
      }
    }
    // split long vertical runs
    for (let c = 0; c < cols; c++) {
      let r = 1;
      while (r < rows) {
        if (mask[r][c] === ".") {
          let len = 0;
          while (r + len < rows && mask[r + len][c] === ".") len++;
          if (len > MAX_WORD_LEN) {
            mask[r + 2 + Math.floor(rnd() * (len - 4))][c] = "#";
            changed = true;
          }
          r += len;
        } else r++;
      }
    }
    // A horizontal run starting in column 0 can only be clued from above;
    // if the cell above holds a letter, turn the run's start into a clue cell
    for (let r = 1; r < rows; r++) {
      if (
        mask[r][0] === "." &&
        mask[r][1] === "." &&
        mask[r - 1][0] !== "#"
      ) {
        mask[r][0] = "#";
        changed = true;
      }
    }
    // isolated cells (in neither a horizontal nor a vertical run) -> clue cell
    for (let r = 1; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (mask[r][c] !== ".") continue;
        const inAcross =
          (c > 0 && mask[r][c - 1] === ".") ||
          (c < cols - 1 && mask[r][c + 1] === ".");
        const inDown =
          (r > 0 && mask[r - 1][c] === ".") ||
          (r < rows - 1 && mask[r + 1][c] === ".");
        if (!inAcross && !inDown) {
          mask[r][c] = "#";
          changed = true;
        }
      }
    }
    if (!changed) return;
  }
}

function computeRuns(mask, cols, rows) {
  const across = [];
  const down = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (mask[r][c] === ".") {
        let len = 0;
        while (c + len < cols && mask[r][c + len] === ".") len++;
        if (len >= 2) across.push({ dir: "across", row: r, col: c, len });
        c += len;
      } else c++;
    }
  }
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      if (mask[r][c] === ".") {
        let len = 0;
        while (r + len < rows && mask[r + len][c] === ".") len++;
        if (len >= 2) down.push({ dir: "down", row: r, col: c, len });
        r += len;
      } else r++;
    }
  }
  return [...across, ...down];
}

// Pass that thins out 2-letter answers.
//
// A random mask naturally produced far too many 2-letter runs (~31% of
// clues). Since there are very few 2-letter words total in Turkish, this was
// the main reason the same clue repeated dozens of times across 300 puzzles.
// For each short run, it first tries opening a neighboring clue cell to
// extend the run, and if that fails, turns one of the run's cells into a
// clue cell to eliminate it.
const MIN_WORD_LEN = 4;

// Absolute floor. When `shortBudget` is given, the grid can go down to this
// instead of MIN_WORD_LEN: the 3-letter layer (394 words) was never used
// under the zero-repeat rule, because a random mask produces short slots at
// several times the supply. Opening it with a per-puzzle quota reduces
// demand on the bottlenecked 4-letter layer.
const HARD_MIN_WORD_LEN = 2;

// Extra allowance added on top of the target for the short-run quota in
// targetMix mode. Measured at 0: an allowance of 1 or 2 raises 3-letter
// demand from 1.55 to 1.90 and 2.23, and drops the set ceiling from 252 to
// 207 and 177. Keeping the quota right at the target ceiling doesn't hurt
// filling either (40/40 success). Overridable via CB_SHORT_SLACK for
// measurement.
const SHORT_SLACK = Number(process.env.CB_SHORT_SLACK ?? 0);

// Lengths of the neighboring runs in the perpendicular direction if (r,c) becomes '#'.
function segmentLengths(mask, r, c, cols, rows, dir) {
  let before = 0;
  let after = 0;
  if (dir === "down") {
    let i = r - 1;
    while (i >= 1 && mask[i][c] === ".") {
      before++;
      i--;
    }
    i = r + 1;
    while (i < rows && mask[i][c] === ".") {
      after++;
      i++;
    }
  } else {
    let i = c - 1;
    while (i >= 0 && mask[r][i] === ".") {
      before++;
      i--;
    }
    i = c + 1;
    while (i < cols && mask[r][i] === ".") {
      after++;
      i++;
    }
  }
  return [before, after];
}

// Total length of the run passing through (r,c).
function runLengthThrough(mask, r, c, cols, rows, dir) {
  const [a, b] = segmentLengths(mask, r, c, cols, rows, dir);
  return a + b + 1;
}

function isCovered(mask, r, c, cols, rows) {
  const inAcross =
    (c > 0 && mask[r][c - 1] === ".") || (c < cols - 1 && mask[r][c + 1] === ".");
  const inDown =
    (r > 1 && mask[r - 1][c] === ".") || (r < rows - 1 && mask[r + 1][c] === ".");
  return inAcross || inDown;
}

// 3-letter runs are the most plentiful, but 3-letter words are scarce in
// Turkish: to keep the same clue from appearing over and over across 300
// puzzles, this pass breaks demand by extending extendable 3-letter runs
// with a certain probability. Runs that can't be extended are left as-is —
// 3-letter answers don't disappear, they're just thinned out.
function thinThreeRuns(
  mask, cols, rows, rnd, upTo = MIN_WORD_LEN, budget = 0, keepLen = HARD_MIN_WORD_LEN,
) {
  for (let iter = 0; iter < 20; iter++) {
    const runs = computeRuns(mask, cols, rows).filter((s) => s.len <= upTo);
    if (runs.length === 0) return;
    // Up to the quota's worth of 3-letter runs are kept; the rest is thinned.
    let spare = budget;
    let changed = false;
    for (const run of shuffled(runs, rnd)) {
      // The shortest runs are always tried for extension; borderline ones are
      // left alone half the time, otherwise the grid gets too sparse and
      // generation stalls.
      if (run.len === upTo && rnd() < 0.5) continue;
      if (run.len === keepLen && spare > 0) {
        spare--;
        continue;
      }
      const opens = [];
      if (run.dir === "across") {
        if (run.col > 0 && mask[run.row][run.col - 1] === "#")
          opens.push([run.row, run.col - 1]);
        if (run.col + run.len < cols && mask[run.row][run.col + run.len] === "#")
          opens.push([run.row, run.col + run.len]);
      } else {
        if (run.row > 1 && mask[run.row - 1][run.col] === "#")
          opens.push([run.row - 1, run.col]);
        if (run.row + run.len < rows && mask[run.row + run.len][run.col] === "#")
          opens.push([run.row + run.len, run.col]);
      }
      for (const [r, c] of shuffled(opens, rnd)) {
        mask[r][c] = ".";
        if (
          runLengthThrough(mask, r, c, cols, rows, "across") <= MAX_WORD_LEN &&
          runLengthThrough(mask, r, c, cols, rows, "down") <= MAX_WORD_LEN
        ) {
          changed = true;
          break;
        }
        mask[r][c] = "#";
      }
    }
    if (!changed) return;
  }
}

function shortenShortRuns(
  mask, cols, rows, rnd,
  floor = MIN_WORD_LEN, softMin = MIN_WORD_LEN, budget = 0,
) {
  for (let iter = 0; iter < 80; iter++) {
    const runs = computeRuns(mask, cols, rows);
    // Anything below `floor` is always eliminated; the ones between floor
    // and softMin are kept up to the quota, only the excess is eliminated.
    const mandatory = runs.filter((s) => s.len < floor);
    const optional = shuffled(
      runs.filter((s) => s.len >= floor && s.len < softMin),
      rnd,
    ).slice(budget);
    const shorts = [...mandatory, ...optional];
    if (shorts.length === 0) return;
    let changed = false;
    for (const run of shuffled(shorts, rnd)) {
      // 1) Extend: turn an adjacent clue cell into a letter cell.
      const opens = [];
      if (run.dir === "across") {
        if (run.col > 0 && mask[run.row][run.col - 1] === "#")
          opens.push([run.row, run.col - 1]);
        if (run.col + run.len < cols && mask[run.row][run.col + run.len] === "#")
          opens.push([run.row, run.col + run.len]);
      } else {
        if (run.row > 1 && mask[run.row - 1][run.col] === "#")
          opens.push([run.row - 1, run.col]);
        if (run.row + run.len < rows && mask[run.row + run.len][run.col] === "#")
          opens.push([run.row + run.len, run.col]);
      }
      let extended = false;
      for (const [r, c] of shuffled(opens, rnd)) {
        mask[r][c] = ".";
        if (
          runLengthThrough(mask, r, c, cols, rows, "across") <= MAX_WORD_LEN &&
          runLengthThrough(mask, r, c, cols, rows, "down") <= MAX_WORD_LEN
        ) {
          changed = true;
          extended = true;
          break;
        }
        mask[r][c] = "#";
      }
      if (extended) continue;

      // 2) Remove: turn one of the run's cells into a clue cell. If the
      // perpendicular run gets split in two, both pieces must be long
      // enough; the remaining cells must also still belong to some run.
      const cells = [];
      for (let i = 0; i < run.len; i++) {
        cells.push(
          run.dir === "across"
            ? [run.row, run.col + i]
            : [run.row + i, run.col],
        );
      }
      const perp = run.dir === "across" ? "down" : "across";
      for (const [r, c] of shuffled(cells, rnd)) {
        const [a, b] = segmentLengths(mask, r, c, cols, rows, perp);
        if ((a !== 0 && a < floor) || (b !== 0 && b < floor)) continue;
        mask[r][c] = "#";
        let ok = true;
        for (const [r2, c2] of cells) {
          if (r2 === r && c2 === c) continue;
          if (!isCovered(mask, r2, c2, cols, rows)) {
            ok = false;
            break;
          }
        }
        if (ok) {
          changed = true;
          break;
        }
        mask[r][c] = ".";
      }
    }
    if (!changed) return;
  }
}

// Slot-length shaping pass.
//
// The passes above only look *below* the floor: they remove or stretch runs
// that are too short and leave everything else alone. Nothing shapes the
// 4/5/6/7 distribution, which is why a random mask always over-consumes the
// 4-letter layer while a third of the 5h and 7h layers is never touched.
//
// This pass takes a target histogram (answers wanted per length, for this
// puzzle) and walks the mask towards it with local moves: open a clue cell, or
// close a letter cell. The target is rescaled to the mask's current slot count
// each round, so the pass only redistributes lengths - it does not try to
// change how many answers the grid holds (that is bounded by the host cells).
//
// Moves keep every invariant maskProblems checks, so it can run last.
// The horizontal runs of one row / the vertical runs of one column. When a
// single cell is flipped, only that row's horizontal runs and that column's
// vertical runs change; the shaping pass updates the histogram
// incrementally from just those two slices (a full computeRuns is too
// expensive per candidate — the mask attempt is often already eliminated
// during filling anyway).
function lineRuns(mask, cols, rows, r, c) {
  const out = [];
  let i = 0;
  while (i < cols) {
    if (mask[r][i] === ".") {
      let len = 0;
      while (i + len < cols && mask[r][i + len] === ".") len++;
      if (len >= 2) out.push(len);
      i += len;
    } else i++;
  }
  let j = 0;
  while (j < rows) {
    if (mask[j][c] === ".") {
      let len = 0;
      while (j + len < rows && mask[j + len][c] === ".") len++;
      if (len >= 2) out.push(len);
      j += len;
    } else j++;
  }
  return out;
}

// Slot-length shaping pass.
//
// The passes above only look *below* the floor: they stretch or remove runs
// that are too short and leave everything else alone. Nothing shapes the
// 4/5/6/7 distribution, which is why a random mask always over-consumes the
// 4-letter layer while a third of the 5h and 7h layers is never touched.
//
// This pass takes a target histogram (answers wanted per length, for this
// puzzle) and walks the mask towards it with local moves: open a clue cell at
// the end of a run (lengthen it) or close an interior cell (split it). The
// target is rescaled to the mask's own slot count each round, so the pass only
// redistributes lengths - it does not try to change how many answers the grid
// holds (that is bounded by the host cells).
//
// Moves keep every invariant maskProblems checks, so it can run last.
function shapeRuns(mask, cols, rows, rnd, target, floor, softMin, budget) {
  if (!target) return;
  let want = 0;
  for (const v of target.values()) want += v;
  if (want <= 0) return;

  const hist = new Map();
  let count = 0;
  for (const s of computeRuns(mask, cols, rows)) {
    hist.set(s.len, (hist.get(s.len) ?? 0) + 1);
    count++;
  }
  const add = (lens, sign) => {
    for (const l of lens) {
      hist.set(l, (hist.get(l) ?? 0) + sign);
      count += sign;
    }
  };
  // Distance to the target, rescaled to the current slot count. The error is
  // *relative*: one answer too many costs more on a thin layer than on a fat
  // one. That is the quantity that actually matters - how many puzzles the set
  // can still hold is min over layers of supply/demand, and the target is
  // proportional to supply, so 1/target is proportional to 1/supply.
  const measure = () => {
    const scale = count / want;
    let err = 0;
    for (let l = HARD_MIN_WORD_LEN; l <= MAX_WORD_LEN; l++) {
      const w = (target.get(l) ?? 0) * scale;
      err += Math.abs((hist.get(l) ?? 0) - w) / Math.max(w, 0.25);
    }
    return err;
  };
  // Short runs must still respect the quota maskProblems enforces.
  const quotaOk = () => {
    let short = 0;
    for (const [l, n] of hist) {
      if (n <= 0) continue;
      if (l < floor || l > MAX_WORD_LEN) return false;
      if (l < softMin) short += n;
    }
    return short <= budget;
  };
  // Every letter cell touched by the flip must still belong to a run.
  const coveredOk = (r, c) => {
    for (const [r2, c2] of [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      if (r2 < 0 || c2 < 0 || r2 >= rows || c2 >= cols) continue;
      if (mask[r2][c2] === "." && !isCovered(mask, r2, c2, cols, rows)) return false;
    }
    return true;
  };

  let err = measure();
  for (let iter = 0; iter < 30 && err > 0.5; iter++) {
    const scale = count / want;
    const surplus = (l) => {
      const w = (target.get(l) ?? 0) * scale;
      return ((hist.get(l) ?? 0) - w) / Math.max(w, 0.25);
    };
    // Work on the most over-represented lengths first: those are the runs that
    // have to become longer or shorter.
    const runs = computeRuns(mask, cols, rows);
    const order = shuffled(runs, rnd)
      .filter((s) => surplus(s.len) > 0)
      .sort((a, b) => surplus(b.len) - surplus(a.len));
    let moved = false;
    let evals = 0;
    for (const run of order) {
      const flips = [];
      if (run.dir === "across") {
        if (run.col > 0) flips.push([run.row, run.col - 1]);
        if (run.col + run.len < cols) flips.push([run.row, run.col + run.len]);
        for (let i = 1; i < run.len - 1; i++) flips.push([run.row, run.col + i]);
      } else {
        if (run.row > 1) flips.push([run.row - 1, run.col]);
        if (run.row + run.len < rows) flips.push([run.row + run.len, run.col]);
        for (let i = 1; i < run.len - 1; i++) flips.push([run.row + i, run.col]);
      }
      for (const [r, c] of shuffled(flips, rnd)) {
        if (r < 1) continue;
        if (evals++ > 30) break;
        const was = mask[r][c];
        const before = lineRuns(mask, cols, rows, r, c);
        mask[r][c] = was === "#" ? "." : "#";
        const after = lineRuns(mask, cols, rows, r, c);
        add(before, -1);
        add(after, +1);
        if (quotaOk() && coveredOk(r, c)) {
          const e = measure();
          if (e < err - 1e-9) {
            err = e;
            moved = true;
            break;
          }
        }
        add(after, -1);
        add(before, +1);
        mask[r][c] = was;
      }
      if (moved || evals > 30) break;
    }
    if (!moved) return;
  }
}

function maskProblems(
  mask, cols, rows, slots,
  floor = MIN_WORD_LEN, softMin = MIN_WORD_LEN, budget = 0,
) {
  // length limit
  let short = 0;
  for (const s of slots) {
    if (s.len > MAX_WORD_LEN) return `uzun blok (${s.len})`;
    if (s.len < floor) return `kısa blok (${s.len})`;
    if (s.len < softMin) short++;
  }
  if (short > budget) return `kota üstü kısa blok (${short}/${budget})`;
  // every letter cell must belong to at least one run
  const covered = Array.from({ length: rows }, () => new Array(cols).fill(false));
  for (const s of slots) {
    for (let i = 0; i < s.len; i++) {
      const r = s.dir === "across" ? s.row : s.row + i;
      const c = s.dir === "across" ? s.col + i : s.col;
      covered[r][c] = true;
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r][c] === "." && !covered[r][c]) return `yalıtık hücre (${r},${c})`;
    }
  }
  return null;
}

// Candidate clue cells for each run (cell + arrow direction).
function hostCandidates(slot, mask) {
  const { row, col, dir } = slot;
  const out = [];
  if (dir === "across") {
    if (col > 0 && mask[row][col - 1] === "#")
      out.push({ r: row, c: col - 1, arrow: "right" });
    if (row > 0 && mask[row - 1][col] === "#")
      out.push({ r: row - 1, c: col, arrow: "down-right" });
  } else {
    if (row > 0 && mask[row - 1][col] === "#")
      out.push({ r: row - 1, c: col, arrow: "down" });
    if (col > 0 && mask[row][col - 1] === "#")
      out.push({ r: row, c: col - 1, arrow: "right-down" });
  }
  return out;
}

// Backtracking assignment with capacity 2.
function assignHosts(slots, mask) {
  const cand = slots.map((s) => hostCandidates(s, mask));
  if (cand.some((c) => c.length === 0)) return null;
  const load = new Map();
  const order = slots
    .map((_, i) => i)
    .sort((a, b) => cand[a].length - cand[b].length);
  const result = new Array(slots.length);

  function bt(k) {
    if (k === order.length) return true;
    const i = order[k];
    // try lightly loaded cells first: reduces the number of runs left without a host
    const ordered = cand[i]
      .slice()
      .sort(
        (a, b) =>
          (load.get(a.r * 1000 + a.c) ?? 0) - (load.get(b.r * 1000 + b.c) ?? 0),
      );
    for (const h of ordered) {
      const key = h.r * 1000 + h.c;
      const n = load.get(key) ?? 0;
      if (n >= 2) continue;
      load.set(key, n + 1);
      result[i] = h;
      if (bt(k + 1)) return true;
      load.set(key, n);
    }
    return false;
  }
  return bt(0) ? result : null;
}

// ---------- filling ----------
const byLen = new Map();
for (const w of WORDS) {
  const len = [...w.a].length;
  if (!byLen.has(len)) byLen.set(len, []);
  byLen.get(len).push(w);
}

// ---------- global clue usage tracking ----------
// Answers already don't repeat within a single puzzle; the real problem is
// the same clue text showing up over and over across 300 puzzles. The
// tracker keeps how many times each text has been used; the filler prefers
// lightly used words, and clue selection prefers that word's least-used
// variant.
// strict: an answer can be used only once across the entire generation run
// (and so its clue text never repeats either). Used words are never offered
// to the filler again as candidates, so generation stalls if the dictionary
// runs short.
export function createTracker({ strict = false } = {}) {
  const banned = new Map();
  if (strict) {
    for (const [len, idx] of maskIndex) banned.set(len, new Uint32Array(idx.size));
  }
  return { text: new Map(), answer: new Map(), strict, banned };
}

// Usage count of the word's least-used clue variant.
function wordCost(tracker, w) {
  let min = Infinity;
  for (const t of w.c) {
    const n = tracker.text.get(t) ?? 0;
    if (n < min) min = n;
  }
  return min;
}

function pickClue(tracker, w, rnd) {
  if (!tracker) return w.c[Math.floor(rnd() * w.c.length)];
  let best = w.c[0];
  let bestN = Infinity;
  for (const t of w.c) {
    const n = tracker.text.get(t) ?? 0;
    if (n < bestN) {
      bestN = n;
      best = t;
    }
  }
  return best;
}

export function commitToTracker(tracker, clues) {
  if (!tracker) return;
  for (const cl of clues) {
    tracker.text.set(cl.text, (tracker.text.get(cl.text) ?? 0) + 1);
    tracker.answer.set(cl.answer, (tracker.answer.get(cl.answer) ?? 0) + 1);
    if (!tracker.strict) continue;
    const slot = wordSlot.get(cl.answer);
    if (!slot) continue;
    tracker.banned.get(slot.len)[slot.i >> 5] |= 1 << (slot.i & 31);
  }
}

// Bitmask index per length: maskIndex.get(len).pos[p].get(letter) is the bit
// set of words of that length whose p-th letter matches. Finding candidates
// is done with a handful of bitwise ANDs instead of scanning the word list —
// this is what keeps fill speed up as the dictionary grows (6600+ words).
const maskIndex = new Map();
for (const [len, list] of byLen) {
  const n = list.length;
  const size = (n + 31) >> 5;
  const all = new Uint32Array(size);
  for (let i = 0; i < n; i++) all[i >> 5] |= 1 << (i & 31);
  const pos = [];
  for (let p = 0; p < len; p++) pos.push(new Map());
  list.forEach((w, i) => {
    const chars = [...w.a];
    for (let p = 0; p < len; p++) {
      let bits = pos[p].get(chars[p]);
      if (!bits) {
        bits = new Uint32Array(size);
        pos[p].set(chars[p], bits);
      }
      bits[i >> 5] |= 1 << (i & 31);
    }
  });
  maskIndex.set(len, { list, n, size, all, pos });
}

// Maps answer text to its position in the mask index: lets strict mode flag
// a used-up word without rescanning the index.
const wordSlot = new Map();
for (const [len, idx] of maskIndex) {
  idx.list.forEach((w, i) => wordSlot.set(w.a, { len, i }));
}

function popcount(x) {
  x = x - ((x >> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  x = (x + (x >> 4)) & 0x0f0f0f0f;
  return (Math.imul(x, 0x01010101) >> 24) & 0x3f;
}

// preferEasy: a word counts as "easy" if it has more than one clue variant
// in the dictionary — everyday words are like that. Length and rarity are
// almost the same axis (~100% of 5h/6h/7h words have a single clue), so the
// difficulty curve can effectively only be shaped in the 3h/4h layer.
// true = multi-clue words are cheap, false = single-clue words are cheap,
// null = no bias.
const isEasyWord = (w) => w.c.length > 1;

// A word's "flexibility": how common its letter pattern is. A word with
// common letters fits many grid positions, one with rare letters (Ğ, J, F)
// fits few. Under the zero-repeat rule a run dies from the search getting
// stuck, not from the pool running out: the words left at the end are
// oddly-patterned leftovers. Spending rigid words while the grid is still
// flexible leaves fillable words for the end. The median score per length is
// taken as the cutoff; half the words count as "rigid".
const flexScore = new Map();
const rigidCut = new Map();
{
  const freq = new Map(); // length -> position -> letter -> count
  for (const w of WORDS) {
    const chars = [...w.a];
    const len = chars.length;
    if (!freq.has(len)) freq.set(len, []);
    const pos = freq.get(len);
    chars.forEach((ch, i) => {
      if (!pos[i]) pos[i] = new Map();
      pos[i].set(ch, (pos[i].get(ch) ?? 0) + 1);
    });
  }
  const byLenScores = new Map();
  for (const w of WORDS) {
    const chars = [...w.a];
    const pos = freq.get(chars.length);
    let sc = 0;
    chars.forEach((ch, i) => (sc += Math.log(pos[i].get(ch) ?? 1)));
    flexScore.set(w.a, sc);
    if (!byLenScores.has(chars.length)) byLenScores.set(chars.length, []);
    byLenScores.get(chars.length).push(sc);
  }
  for (const [len, arr] of byLenScores) {
    arr.sort((x, y) => x - y);
    rigidCut.set(len, arr[Math.floor(arr.length / 2)]);
  }
}
// true = rigid (rare-pattern) word.
const isRigidWord = (w) =>
  (flexScore.get(w.a) ?? 0) <= (rigidCut.get([...w.a].length) ?? 0);

function fillGrid(slots, cols, rows, rnd, tracker, widen = 1, preferEasy = null, nodeLimit = 0, preferRigid = false) {
  const letters = Array.from({ length: rows }, () => new Array(cols).fill(null));
  const assigned = new Array(slots.length).fill(null);
  let nodes = 0;
  // The global-spread priority sometimes gets stuck on an unsolvable prefix;
  // a low node limit cancels such attempts quickly and lets a fresh seed
  // restart (retrying is cheaper than a long backtrack).
  // Node limit: keeping it low on early attempts is right (restarting with a
  // fresh seed is cheaper than a long backtrack), but this flips as the pool
  // shrinks — at puzzle 151, 57% of the dictionary was still empty and the
  // run stopped because filling got stuck, not because the pool ran out.
  // buildPuzzle grows the limit with the attempt count, so deep backtracking
  // is allowed on later puzzles.
  const NODE_LIMIT = nodeLimit > 0 ? nodeLimit : tracker ? 20000 : 300000;

  const cellsOf = (s) => {
    const out = [];
    for (let i = 0; i < s.len; i++) {
      out.push(s.dir === "across" ? [s.row, s.col + i] : [s.row + i, s.col]);
    }
    return out;
  };
  const slotCells = slots.map(cellsOf);

  // Used answers are kept in a bit set per length (answers of different
  // lengths can't collide anyway).
  const usedBits = new Map();
  for (const [len, idx] of maskIndex) usedBits.set(len, new Uint32Array(idx.size));

  // Global spread: each word's cost = the global usage count of its
  // least-used clue variant. A threshold is chosen per length; the filler
  // tries words below the threshold (lightly used) first, and falls back to
  // the rest if it gets stuck. The pool itself is never narrowed — doing so
  // makes intersections unsolvable.
  const costs = new Map();
  const threshold = new Map();
  for (const [len, idx] of maskIndex) {
    const arr = new Int32Array(idx.n);
    if (!tracker) {
      costs.set(len, arr);
      threshold.set(len, 0);
      continue;
    }
    const hist = [];
    for (let i = 0; i < idx.n; i++) {
      // The bias is folded into cost as +1: when the threshold calculation
      // covers the desired bucket on its own, the filler tries it first and
      // falls back to the rest if it gets stuck. The pool isn't narrowed,
      // only the order changes.
      let bias =
        preferEasy === null || isEasyWord(idx.list[i]) === preferEasy ? 0 : 1;
      if (preferRigid && !isRigidWord(idx.list[i])) bias += 1;
      const c = wordCost(tracker, idx.list[i]) + bias;
      arr[i] = c;
      hist[c] = (hist[c] ?? 0) + 1;
    }
    const need = slots.reduce((n, s) => n + (s.len === len ? 1 : 0), 0);
    const target = Math.min(idx.n, Math.max(40, need * 6 * widen));
    let acc = 0;
    let thr = 0;
    for (let c = 0; c < hist.length; c++) {
      acc += hist[c] ?? 0;
      thr = c;
      if (acc >= target) break;
    }
    costs.set(len, arr);
    threshold.set(len, thr);
  }

  // In strict mode, words with exhausted clue variants are excluded up
  // front; since the mask is kept on the tracker, it isn't recomputed per fill.
  const banned = tracker?.strict ? tracker.banned : new Map();

  const scratch = slots.map((s) => new Uint32Array(maskIndex.get(s.len).size));

  // Writes the bitmask of words that fit the slot into scratch[si], returns the count.
  function candidateMask(si) {
    const s = slots[si];
    const idx = maskIndex.get(s.len);
    const buf = scratch[si];
    buf.set(idx.all);
    const ban = banned.get(s.len);
    if (ban) {
      for (let i = 0; i < idx.size; i++) buf[i] &= ~ban[i];
    }
    const cells = slotCells[si];
    for (let p = 0; p < s.len; p++) {
      const ch = letters[cells[p][0]][cells[p][1]];
      if (ch === null) continue;
      const bits = idx.pos[p].get(ch);
      if (!bits) return 0;
      for (let i = 0; i < idx.size; i++) buf[i] &= bits[i];
    }
    const used = usedBits.get(s.len);
    let count = 0;
    for (let i = 0; i < idx.size; i++) {
      buf[i] &= ~used[i];
      count += popcount(buf[i]);
    }
    return count;
  }

  function bt() {
    if (++nodes > NODE_LIMIT) return false;
    // MRV: the empty run with the fewest candidates
    let best = -1;
    let bestCount = Infinity;
    for (let i = 0; i < slots.length; i++) {
      if (assigned[i]) continue;
      const c = candidateMask(i);
      if (c === 0) return false;
      if (c < bestCount) {
        best = i;
        bestCount = c;
      }
      if (bestCount === 1) break;
    }
    if (best === -1) return true; // everything filled

    const s = slots[best];
    const idx = maskIndex.get(s.len);
    const buf = scratch[best];
    const cost = costs.get(s.len);
    const thr = threshold.get(s.len);
    const cheap = [];
    const rest = [];
    for (let wi = 0; wi < idx.size; wi++) {
      let bits = buf[wi];
      while (bits !== 0) {
        const lsb = bits & -bits;
        const i = (wi << 5) + (31 - Math.clz32(lsb));
        (cost[i] <= thr ? cheap : rest).push(i);
        bits ^= lsb;
      }
    }
    // Per-node randomization is essential for backtracking to succeed;
    // global spread is applied purely through the "lightly-used first" ordering.
    const ordered = shuffled(cheap, rnd).concat(shuffled(rest, rnd));

    const cells = slotCells[best];
    const used = usedBits.get(s.len);
    for (const i of ordered) {
      const w = idx.list[i];
      const chars = [...w.a];
      const prev = cells.map(([r, c]) => letters[r][c]);
      cells.forEach(([r, c], k) => (letters[r][c] = chars[k]));
      assigned[best] = w;
      used[i >> 5] |= 1 << (i & 31);
      if (bt()) return true;
      used[i >> 5] &= ~(1 << (i & 31));
      assigned[best] = null;
      cells.forEach(([r, c], k) => (letters[r][c] = prev[k]));
    }
    return false;
  }

  return bt() ? { letters, assigned } : null;
}

// ---------- final validation (same rules as the game engine) ----------
function validatePuzzle(p) {
  const idx = (r, c) => r * p.cols + c;
  const cells = new Array(p.rows * p.cols).fill(null);
  for (const b of p.blocks ?? []) {
    cells[idx(b.row, b.col)] = { kind: "clue", n: 0 };
  }
  for (const clue of p.clues) {
    const cur = cells[idx(clue.row, clue.col)];
    if (cur === null) cells[idx(clue.row, clue.col)] = { kind: "clue", n: 1 };
    else if (cur.kind === "clue") {
      cur.n++;
      if (cur.n > 2) throw new Error(`(${clue.row},${clue.col}) 2'den fazla soru`);
    } else throw new Error(`(${clue.row},${clue.col}) harf/soru çakışması`);
  }
  for (const clue of p.clues) {
    const d = {
      right: [0, 1, 0, 1],
      down: [1, 0, 1, 0],
      "right-down": [0, 1, 1, 0],
      "down-right": [1, 0, 0, 1],
    }[clue.arrow];
    let r = clue.row + d[0];
    let c = clue.col + d[1];
    for (const ch of [...clue.answer]) {
      if (r >= p.rows || c >= p.cols)
        throw new Error(`${clue.answer} ızgaradan taşıyor`);
      const cur = cells[idx(r, c)];
      if (cur === null) cells[idx(r, c)] = { kind: "letter", ch };
      else if (cur.kind === "letter") {
        if (cur.ch !== ch)
          throw new Error(`(${r},${c}) kesişim uyuşmazlığı: ${cur.ch}≠${ch}`);
      } else throw new Error(`(${r},${c}) soru hücresine harf yazılıyor`);
      r += d[2];
      c += d[3];
    }
  }
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === null)
      throw new Error(`(${Math.floor(i / p.cols)},${i % p.cols}) boş hücre`);
  }
}

// ---------- generation core ----------
// If a tracker is given, clue texts are spread globally across the 300-puzzle
// generation run (see createTracker). An accepted puzzle must be committed
// to the tracker with commitToTracker.
export function buildPuzzle({
  id,
  title,
  rows,
  cols,
  seed = 1,
  difficulty,
  order,
  tracker = null,
  maxAttempts = 2000,
  // This puzzle's target shortest answer (its "profile"). 4 = default.
  // Raising it shifts demand toward longer layers: this is the real lever
  // for fitting the set's demand mix to the dictionary's supply mix. Block
  // density is not — the mask repair passes already normalize it out (measured).
  minWordLen = MIN_WORD_LEN,
  // How many runs one length below minWordLen are allowed per puzzle. 0 =
  // none. A hard floor doesn't converge (removing a short run also requires
  // the perpendicular runs to clear the floor), so the floor is kept soft:
  // short runs beyond the quota are eliminated, up to the quota is kept.
  shortBudget = 0,
  // This puzzle's target length distribution: Map(length -> answers wanted).
  // If given, after short-run cleanup the mask is shaped toward this
  // histogram (see shapeRuns), and `shortBudget` is derived from the
  // target's 3-letter component. This is the real lever for fitting the
  // demand mix to the dictionary's supply mix: the hard floor/profile key
  // approach was too crude.
  targetMix = null,
  // Difficulty axis: should this puzzle favor multi-clue (easy) answers or
  // single-clue (hard) ones. null = no bias. Only makes a difference in the
  // 3h/4h layer, where both buckets are populated.
  preferEasy = null,
  // Spend rigid (rare-letter-pattern) words first; leave flexible ones for
  // the end. Delays filling from getting stuck as the pool shrinks.
  preferRigid = false,
  // Block density; its effect after mask repair isn't measurable, kept
  // around for backward compatibility.
  blockDensity = DEFAULT_BLOCK_DENSITY,
}) {
  const mix = targetMix ? new Map(Object.entries(targetMix).map(([k, v]) => [Number(k), v])) : null;
  const softMin = Math.max(MIN_WORD_LEN, minWordLen);
  // With a target mix, the floor and quota derive from a single source: the
  // floor is the shortest length with a meaningful share of the target; the
  // quota is the target sum across every length below softMin. That way even
  // the 2-letter layer opens on its own once it has a share of the target,
  // and closes on its own once that share is gone.
  let shortWanted = shortBudget;
  let mixFloor = softMin;
  if (mix) {
    let toplam = 0;
    for (let l = HARD_MIN_WORD_LEN; l < softMin; l++) {
      const v = mix.get(l) ?? 0;
      if (v <= 0.05) continue;
      if (l < mixFloor) mixFloor = l;
      toplam += v;
    }
    shortWanted = Math.ceil(toplam);
  }
  const floor = mix ? mixFloor : shortWanted > 0 ? Math.max(HARD_MIN_WORD_LEN, softMin - 1) : softMin;
  // With targetMix given, keeping the quota tight is pointless: getting
  // close to the target is shapeRuns's job, and it treats 3-letter the same
  // as any other length. When the quota was tight, over 90% of mask attempts
  // were eliminated in maskProblems (646 attempts per puzzle at 9x13). Here
  // it's just an upper bound.
  const budget =
    floor < softMin ? (mix ? shortWanted + SHORT_SLACK : shortWanted) : 0;
  let result = null;
  let attempt = 0;
  const stats = { mask: 0, host: 0, fill: 0 };
  for (; attempt < maxAttempts && !result; attempt++) {
    const rnd = mulberry32(seed + attempt * 7919);
    const mask = genMask(cols, rows, rnd, blockDensity);
    repairMask(mask, cols, rows, rnd);
    shortenShortRuns(mask, cols, rows, rnd, floor, softMin, budget);
    // repairMask can spawn new short runs while splitting long ones; leave
    // the final word to short-run cleanup (this pass never produces an
    // invalid mask: perpendicular runs either disappear or stay at least floor long).
    repairMask(mask, cols, rows, rnd);
    shortenShortRuns(mask, cols, rows, rnd, floor, softMin, budget);
    thinThreeRuns(mask, cols, rows, rnd, softMin, budget, floor);
    shortenShortRuns(mask, cols, rows, rnd, floor, softMin, budget);
    shapeRuns(mask, cols, rows, rnd, mix, floor, softMin, budget);
    const slots = computeRuns(mask, cols, rows);
    if (maskProblems(mask, cols, rows, slots, floor, softMin, budget)) {
      stats.mask++;
      continue;
    }
    const hosts = assignHosts(slots, mask);
    if (!hosts) {
      stats.host++;
      continue;
    }
    // If an attempt fails, widen the threshold quickly on the next one; a
    // few attempts in, it's effectively open to the whole dictionary.
    const widen = 1 + attempt;
    // If retries aren't working, grow the search depth.
    const nodeLimit = tracker
      ? Math.min(300000, 20000 * (1 + Math.floor(attempt / 40)))
      : 300000;
    // Try several different fills for the same mask and pick the one with
    // the globally least-used clues: falling back to heavily-used words is
    // unavoidable during backtracking because of intersection constraints,
    // but taking the best of a few candidates noticeably cuts down repeats.
    let filled = null;
    if (tracker) {
      let bestScore = Infinity;
      for (let k = 0; k < FILL_TRIES; k++) {
        const f = fillGrid(slots, cols, rows, rnd, tracker, widen, preferEasy, nodeLimit, preferRigid);
        if (!f) continue;
        let score = 0;
        for (const w of f.assigned) score += wordCost(tracker, w);
        if (score < bestScore) {
          bestScore = score;
          filled = f;
        }
        if (bestScore === 0) break;
      }
    } else {
      filled = fillGrid(slots, cols, rows, rnd, tracker, widen, preferEasy, nodeLimit, preferRigid);
    }
    if (!filled) {
      stats.fill++;
      continue;
    }
    result = { mask, slots, hosts, filled, rnd };
  }
  if (!result) return { puzzle: null, attempt, stats };

  const { mask, slots, hosts, filled, rnd } = result;
  const clues = slots.map((s, i) => ({
    text: pickClue(tracker, filled.assigned[i], rnd),
    answer: filled.assigned[i].a,
    row: hosts[i].r,
    col: hosts[i].c,
    arrow: hosts[i].arrow,
  }));

  // '#' cells that don't host any clue: blocks
  const usedHosts = new Set(hosts.map((h) => h.r * 1000 + h.c));
  const blocks = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r][c] === "#" && !usedHosts.has(r * 1000 + c)) {
        blocks.push({ row: r, col: c });
      }
    }
  }

  const puzzle = { id, title, rows, cols, clues, blocks };
  if (difficulty) puzzle.difficulty = difficulty;
  if (order !== undefined) puzzle.order = order;
  validatePuzzle(puzzle);
  return { puzzle, attempt, stats, mask, letters: filled.letters, slots };
}

// ---------- command line ----------
const isCli =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isCli) {
  const [id, title, seedArg, colsArg, rowsArg, diffArg] = process.argv.slice(2);
  if (!id || !title) {
    console.error("Kullanım: node tools/generate.mjs <id> <başlık> [seed] [cols] [rows] [zorluk]");
    process.exit(1);
  }
  if (diffArg && !["kolay", "orta", "zor"].includes(diffArg)) {
    console.error(`Geçersiz zorluk '${diffArg}': kolay | orta | zor`);
    process.exit(1);
  }
  const cols = Number(colsArg ?? 7);
  const rows = Number(rowsArg ?? 10);
  const seed = Number(seedArg ?? 1);

  const { puzzle, attempt, stats, mask, letters, slots } = buildPuzzle({
    id,
    title,
    rows,
    cols,
    seed,
    difficulty: diffArg,
  });

  if (!puzzle) {
    console.error(
      `${attempt} denemede üretilemedi. Elenme: maske=${stats.mask} atama=${stats.host} doldurma=${stats.fill}`,
    );
    process.exit(1);
  }

  // print the solution to the console (for review)
  console.log(`Deneme ${attempt}, ${slots.length} soru. Çözüm:`);
  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) {
      line += mask[r][c] === "#" ? " ■" : " " + letters[r][c];
    }
    console.log(line);
  }
  console.log("\nSorular:");
  for (const cl of puzzle.clues) {
    console.log(`  (${cl.row},${cl.col}) ${cl.arrow.padEnd(10)} ${cl.answer.padEnd(8)} ${cl.text}`);
  }

  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "puzzles");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${id}.json`);
  writeFileSync(outFile, JSON.stringify(puzzle, null, 2), "utf8");
  console.log(`\nYazıldı: ${outFile}`);
}
