// Çengel bulmaca üretici.
//
// Kullanım:
//   node tools/generate.mjs <id> <başlık> [seed] [cols] [rows] [zorluk]
//   zorluk: kolay | orta | zor (isteğe bağlı etiket)
//
// Akış: rastgele maske üret -> ipucu hücrelerine soru ataması yap ->
// sözlükten backtracking ile doldur -> doğrula -> src/puzzles/<id>.json yaz.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { WORDS } from "./dictionary.mjs";

const MAX_WORD_LEN = 7;

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

// ---------- maske ----------
function genMask(cols, rows, rnd) {
  // '#' ipucu hücresi, '.' harf hücresi. İlk satır tamamen ipucu:
  // aşağı inen cevapların soruları oradan sorulur (klasik "üstten soru" düzeni).
  const mask = [];
  mask.push("#".repeat(cols).split(""));
  for (let r = 1; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(rnd() < 0.17 ? "#" : ".");
    mask.push(row);
  }
  return mask;
}

// Maskeyi kullanılabilir hale getirmeye çalışır:
// uzun blokları ortasından böler, yalıtık harf hücrelerini ipucuna çevirir.
function repairMask(mask, cols, rows, rnd) {
  for (let iter = 0; iter < 60; iter++) {
    let changed = false;

    // uzun yatay blokları böl
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
    // uzun dikey blokları böl
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
    // 0. sütunda başlayan yatay blokların sorusu ancak üstten sorulabilir;
    // üstte harf varsa bloğun başını ipucu hücresine çevir
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
    // yalıtık hücreler (ne yatay ne dikey bir bloğa girer) -> ipucu hücresi
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

function maskProblems(mask, cols, rows, slots) {
  // uzunluk sınırı
  for (const s of slots) {
    if (s.len > MAX_WORD_LEN) return `uzun blok (${s.len})`;
  }
  // her harf hücresi en az bir bloğa ait olmalı
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

// Her blok için soru hücresi adayları (hücre + ok yönü).
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

// Kapasite 2 ile geri izlemeli atama.
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
    // az yüklü hücreleri önce dene: boş kalan blok hücre sayısını azaltır
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

// ---------- doldurma ----------
const byLen = new Map();
for (const w of WORDS) {
  const len = [...w.a].length;
  if (!byLen.has(len)) byLen.set(len, []);
  byLen.get(len).push(w);
}

function fillGrid(slots, cols, rows, rnd) {
  const letters = Array.from({ length: rows }, () => new Array(cols).fill(null));
  const assigned = new Array(slots.length).fill(null);
  const used = new Set();
  let nodes = 0;
  const NODE_LIMIT = 300000;

  const cellsOf = (s) => {
    const out = [];
    for (let i = 0; i < s.len; i++) {
      out.push(
        s.dir === "across" ? [s.row, s.col + i] : [s.row + i, s.col],
      );
    }
    return out;
  };
  const slotCells = slots.map(cellsOf);

  function candidates(si) {
    const list = byLen.get(slots[si].len) ?? [];
    const cells = slotCells[si];
    const out = [];
    for (const w of list) {
      if (used.has(w.a)) continue;
      const chars = [...w.a];
      let ok = true;
      for (let i = 0; i < chars.length; i++) {
        const cur = letters[cells[i][0]][cells[i][1]];
        if (cur !== null && cur !== chars[i]) {
          ok = false;
          break;
        }
      }
      if (ok) out.push(w);
    }
    return out;
  }

  function bt() {
    if (++nodes > NODE_LIMIT) return false;
    // MRV: en az adayı olan boş blok
    let best = -1;
    let bestCands = null;
    for (let i = 0; i < slots.length; i++) {
      if (assigned[i]) continue;
      const c = candidates(i);
      if (c.length === 0) return false;
      if (bestCands === null || c.length < bestCands.length) {
        best = i;
        bestCands = c;
      }
      if (bestCands.length === 1) break;
    }
    if (best === -1) return true; // hepsi dolu

    const cells = slotCells[best];
    for (const w of shuffled(bestCands, rnd)) {
      const chars = [...w.a];
      const prev = cells.map(([r, c]) => letters[r][c]);
      cells.forEach(([r, c], i) => (letters[r][c] = chars[i]));
      assigned[best] = w;
      used.add(w.a);
      if (bt()) return true;
      used.delete(w.a);
      assigned[best] = null;
      cells.forEach(([r, c], i) => (letters[r][c] = prev[i]));
    }
    return false;
  }

  return bt() ? { letters, assigned } : null;
}

// ---------- son doğrulama (oyun motorundaki kurallarla aynı) ----------
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

// ---------- ana akış ----------
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
let seed = Number(seedArg ?? 1);

let result = null;
let attempt = 0;
const stats = { mask: 0, host: 0, fill: 0 };
for (; attempt < 2000 && !result; attempt++) {
  const rnd = mulberry32(seed + attempt * 7919);
  const mask = genMask(cols, rows, rnd);
  repairMask(mask, cols, rows, rnd);
  const slots = computeRuns(mask, cols, rows);
  if (maskProblems(mask, cols, rows, slots)) {
    stats.mask++;
    continue;
  }
  const hosts = assignHosts(slots, mask);
  if (!hosts) {
    stats.host++;
    continue;
  }
  const filled = fillGrid(slots, cols, rows, rnd);
  if (!filled) {
    stats.fill++;
    continue;
  }
  result = { mask, slots, hosts, filled, rnd };
}

if (!result) {
  console.error(
    `${attempt} denemede üretilemedi. Elenme: maske=${stats.mask} atama=${stats.host} doldurma=${stats.fill}`,
  );
  process.exit(1);
}

const { mask, slots, hosts, filled, rnd } = result;
const clues = slots.map((s, i) => ({
  text: filled.assigned[i].c[Math.floor(rnd() * filled.assigned[i].c.length)],
  answer: filled.assigned[i].a,
  row: hosts[i].r,
  col: hosts[i].c,
  arrow: hosts[i].arrow,
}));

// hiç soru barındırmayan '#' hücreleri: blok
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
if (diffArg) puzzle.difficulty = diffArg;
validatePuzzle(puzzle);

// çözümü konsola bas (gözden geçirme için)
console.log(`Deneme ${attempt}, ${slots.length} soru. Çözüm:`);
for (let r = 0; r < rows; r++) {
  let line = "";
  for (let c = 0; c < cols; c++) {
    line += mask[r][c] === "#" ? " ■" : " " + filled.letters[r][c];
  }
  console.log(line);
}
console.log("\nSorular:");
for (const cl of clues) {
  console.log(`  (${cl.row},${cl.col}) ${cl.arrow.padEnd(10)} ${cl.answer.padEnd(8)} ${cl.text}`);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "puzzles");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${id}.json`);
writeFileSync(outFile, JSON.stringify(puzzle, null, 2), "utf8");
console.log(`\nYazıldı: ${outFile}`);
