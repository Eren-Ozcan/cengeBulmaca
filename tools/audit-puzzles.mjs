// Yayına hazırlık denetimi: check-puzzles.mjs yalnızca tekrarlara bakar, bu
// script her bulmacanın kendi içinde tutarlı ve çözülebilir olduğunu doğrular.
//
// Kontroller:
//   1. Şema: zorunlu alanlar, id ile dosya adının uyuşması, order/title uyumu.
//   2. Izgara: her cevap sınırlar içinde mi, ipucu hücresi ızgarada mı.
//   3. Çakışma: cevap harfleri ipucu hücrelerinin ya da blokların üstüne
//      yazılmıyor mu, kesişen cevapların ortak hücrede harfleri aynı mı.
//   4. Klavye: cevaplar yalnızca oyundaki klavyede bulunan harflerden mi
//      oluşuyor (A-Z + ÇĞİÖŞÜ; düzeltme işaretli Â/Î/Û yazılamaz).
//   5. Sözlük: her cevap sözlükte var mı, ipucu metni o cevabın ipuçlarından
//      biri mi (üretimden kalan bayat metin yakalanır).
//   6. Manifest: dosya kümesi ile manifest.json birebir örtüşüyor mu.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as dictMod from "./dictionary.mjs";

const dict = Object.values(dictMod).find(Array.isArray);
const cluesOf = new Map(dict.map((w) => [w.a, new Set(w.c)]));

const ARROW = {
  right: { sr: 0, sc: 1, dRow: 0, dCol: 1 },
  down: { sr: 1, sc: 0, dRow: 1, dCol: 0 },
  "right-down": { sr: 0, sc: 1, dRow: 1, dCol: 0 },
  "down-right": { sr: 1, sc: 0, dRow: 0, dCol: 1 },
};
const KEYBOARD = /^[A-ZÇĞİÖŞÜ]+$/;

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "puzzles");
const files = readdirSync(dir)
  .filter((f) => /^puzzle-\d+\.json$/.test(f))
  .sort((a, b) => Number(/\d+/.exec(a)[0]) - Number(/\d+/.exec(b)[0]));

const problems = [];
const report = (file, kind, detail) => problems.push({ file, kind, detail });

for (const file of files) {
  const p = JSON.parse(readFileSync(join(dir, file), "utf8"));

  for (const field of ["id", "title", "rows", "cols", "clues", "blocks", "difficulty", "order"])
    if (p[field] === undefined) report(file, "eksik alan", field);
  if (p.id !== file.replace(/\.json$/, "")) report(file, "id uyuşmuyor", p.id);
  if (p.title !== `Bulmaca ${p.order}`) report(file, "başlık order ile uyuşmuyor", `${p.title} / order ${p.order}`);
  if (!["kolay", "orta", "zor"].includes(p.difficulty)) report(file, "geçersiz zorluk", p.difficulty);

  const blocked = new Set(p.blocks.map((b) => `${b.row},${b.col}`));
  const clueCells = new Set(p.clues.map((c) => `${c.row},${c.col}`));
  const letters = new Map();

  for (const c of p.clues) {
    const arrow = ARROW[c.arrow];
    if (!arrow) { report(file, "bilinmeyen ok", `${c.answer} ${c.arrow}`); continue; }
    if (c.row < 0 || c.row >= p.rows || c.col < 0 || c.col >= p.cols)
      report(file, "ipucu ızgara dışında", `${c.answer} (${c.row},${c.col})`);

    if (!KEYBOARD.test(c.answer)) report(file, "klavyede olmayan harf", c.answer);
    if (!cluesOf.has(c.answer)) report(file, "sözlükte yok", c.answer);
    else if (!cluesOf.get(c.answer).has(c.text))
      report(file, "ipucu sözlükle uyuşmuyor", `${c.answer}: "${c.text}"`);

    const chars = [...c.answer];
    for (let i = 0; i < chars.length; i++) {
      const row = c.row + arrow.sr + arrow.dRow * i;
      const col = c.col + arrow.sc + arrow.dCol * i;
      const key = `${row},${col}`;
      if (row < 0 || row >= p.rows || col < 0 || col >= p.cols) {
        report(file, "cevap ızgara dışına taşıyor", `${c.answer} (${row},${col})`);
        continue;
      }
      if (blocked.has(key)) report(file, "cevap bloğun üstünde", `${c.answer} (${key})`);
      if (clueCells.has(key)) report(file, "cevap ipucu hücresinin üstünde", `${c.answer} (${key})`);
      const seen = letters.get(key);
      if (seen === undefined) letters.set(key, chars[i]);
      else if (seen !== chars[i])
        report(file, "kesişimde harf çelişkisi", `${key}: ${seen} ≠ ${chars[i]} (${c.answer})`);
    }
  }
}

const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
const inManifest = new Set(manifest.map((e) => e.file.replace("./", "")));
for (const f of files) if (!inManifest.has(f)) report(f, "manifest'te yok", "");
for (const f of inManifest) if (!files.includes(f)) report(f, "manifest'te fazladan", "");
const orders = manifest.map((e) => e.order);
if (orders.some((o, i) => o !== i + 1)) report("manifest.json", "order 1..n kesintisiz değil", "");

console.log(`${files.length} bulmaca denetlendi.`);
if (!problems.length) {
  console.log("sorun yok: şema, ızgara, kesişim, klavye, sözlük ve manifest temiz.");
} else {
  const byKind = new Map();
  for (const p of problems) byKind.set(p.kind, (byKind.get(p.kind) ?? 0) + 1);
  console.log(`${problems.length} sorun:`);
  for (const [kind, n] of [...byKind].sort((a, b) => b[1] - a[1])) console.log(`  ${n}x ${kind}`);
  for (const p of problems.slice(0, 40)) console.log(`   ${p.file}: ${p.kind} — ${p.detail}`);
  process.exitCode = 1;
}
