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
import { dirname, join, resolve } from "node:path";
import { WORDS } from "./dictionary.mjs";

const MAX_WORD_LEN = 7;
// Aynı maske için denenecek doldurma sayısı (tracker varken).
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

// ---------- küresel ipucu kullanım takibi ----------
// Tek bir bulmaca içinde cevaplar zaten tekrarlanmıyor; asıl sorun aynı ipucu
// metninin 300 bulmaca boyunca defalarca çıkması. Tracker, hangi metnin kaç kez
// kullanıldığını tutar; doldurucu az kullanılmış kelimeleri, ipucu seçimi de o
// kelimenin en az kullanılmış varyantını tercih eder.
export function createTracker() {
  return { text: new Map(), answer: new Map() };
}

// Kelimenin en az kullanılmış ipucu varyantının kullanım sayısı.
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
  }
}

// Uzunluk başına bit maskesi dizini: maskIndex.get(len).pos[p].get(harf), o
// uzunluktaki kelimelerden p. harfi eşleşenleri gösteren bit kümesidir. Aday
// bulmak, kelime listesini taramak yerine birkaç bit AND'i ile yapılır — sözlük
// büyüdükçe (6600+ kelime) doldurma hızını ayakta tutan şey budur.
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

function popcount(x) {
  x = x - ((x >> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  x = (x + (x >> 4)) & 0x0f0f0f0f;
  return (Math.imul(x, 0x01010101) >> 24) & 0x3f;
}

function fillGrid(slots, cols, rows, rnd, tracker, widen = 1) {
  const letters = Array.from({ length: rows }, () => new Array(cols).fill(null));
  const assigned = new Array(slots.length).fill(null);
  let nodes = 0;
  // Küresel yayılma önceliği bazen çözülemez bir ön eke saplanıyor; düşük düğüm
  // sınırı böyle denemeleri hızla iptal edip yeni tohumla yeniden başlatmayı
  // sağlıyor (yeniden deneme, uzun geri izlemeden ucuz).
  const NODE_LIMIT = tracker ? 20000 : 300000;

  const cellsOf = (s) => {
    const out = [];
    for (let i = 0; i < s.len; i++) {
      out.push(s.dir === "across" ? [s.row, s.col + i] : [s.row + i, s.col]);
    }
    return out;
  };
  const slotCells = slots.map(cellsOf);

  // Kullanılan cevaplar uzunluk başına bit kümesinde tutulur (farklı uzunluktaki
  // cevaplar zaten çakışamaz).
  const usedBits = new Map();
  for (const [len, idx] of maskIndex) usedBits.set(len, new Uint32Array(idx.size));

  // Küresel yayılma: her kelimenin maliyeti = en az kullanılmış ipucu
  // varyantının küresel kullanım sayısı. Uzunluk başına bir eşik seçilir;
  // doldurucu önce eşiğin altındaki (az kullanılmış) kelimeleri dener, tıkanırsa
  // gerisine düşer. Havuz daraltılmaz — daraltmak kesişimleri çözülemez yapıyor.
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
      const c = wordCost(tracker, idx.list[i]);
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

  const scratch = slots.map((s) => new Uint32Array(maskIndex.get(s.len).size));

  // slot için uygun kelimelerin bit maskesini scratch[si]'ye yazar, sayıyı döner.
  function candidateMask(si) {
    const s = slots[si];
    const idx = maskIndex.get(s.len);
    const buf = scratch[si];
    buf.set(idx.all);
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
    // MRV: en az adayı olan boş blok
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
    if (best === -1) return true; // hepsi dolu

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
    // Düğüm başına rastgeleleştirme geri izleme başarısı için şart; küresel
    // yayılma yalnızca "az kullanılmışlar önce" sıralamasıyla veriliyor.
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

// ---------- üretim çekirdeği ----------
// tracker verilirse ipucu metinleri 300 bulmacalık üretim boyunca küresel
// olarak yayılır (bkz. createTracker). Kabul edilen bulmaca commitToTracker ile
// takipçiye işlenmelidir.
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
}) {
  let result = null;
  let attempt = 0;
  const stats = { mask: 0, host: 0, fill: 0 };
  for (; attempt < maxAttempts && !result; attempt++) {
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
    // Deneme başarısızsa bir sonrakinde eşiği hızla genişlet; birkaç denemede
    // fiilen tüm sözlüğe açılır.
    const widen = 1 + attempt;
    // Aynı maske için birkaç farklı doldurma dene ve küresel olarak en az
    // kullanılmış ipuçlarını içereni seç: geri izleme sırasında kesişim
    // kısıtları yüzünden sık kullanılmış kelimelere düşmek kaçınılmaz, ama
    // birkaç adaydan en iyisini almak tekrarları belirgin biçimde azaltıyor.
    let filled = null;
    if (tracker) {
      let bestScore = Infinity;
      for (let k = 0; k < FILL_TRIES; k++) {
        const f = fillGrid(slots, cols, rows, rnd, tracker, widen);
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
      filled = fillGrid(slots, cols, rows, rnd, tracker, widen);
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
  if (difficulty) puzzle.difficulty = difficulty;
  if (order !== undefined) puzzle.order = order;
  validatePuzzle(puzzle);
  return { puzzle, attempt, stats, mask, letters: filled.letters, slots };
}

// ---------- komut satırı ----------
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

  // çözümü konsola bas (gözden geçirme için)
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
