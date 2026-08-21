// TDK Güncel Türkçe Sözlük'ten 4 harfli aday kelimeleri çıkarır.
//
// extract6-detail.mjs / extract7-detail.mjs ile aynı desen, iki farkla:
//   - hedef uzunluk 4,
//   - özel isimler atılmıyor, ayrı bir dosyaya yazılıyor. Çengel bulmacada
//     il/ilçe adları da cevap oluyor, bu yüzden kendi başına değerlendirilecek
//     bir havuz.
//
// Girdi: bu klasörde `gts.json` (gitignore'lu, README'deki gh api komutuyla
// indirilip açılır). Çıktı: 4letter-tdk-candidates.tsv ve
// 4letter-tdk-proper.tsv.

import fs from 'fs';
import readline from 'readline';

const base = new URL('.', import.meta.url);

const t = fs.readFileSync('C:/Projects/cengeBulmaca/tools/dictionary.mjs', 'utf8');
const existing = new Set();
// Cevaplarda düzeltme işaretli harfler de geçiyor (Â/Î/Û: DÜKKÂN, MAHKÛM, HAKÎ),
// bu yüzden harf sınıfı yerine tırnak arası her şeyi al.
const re = /a:\s*"([^"]+)"/g;
let m;
while ((m = re.exec(t))) { if (Array.from(m[1]).length === 4) existing.add(m[1]); }

const rl = readline.createInterface({ input: fs.createReadStream(new URL('gts.json', base)) });
const common = new Map();
const proper = new Map();

rl.on('line', (line) => {
  if (!line.trim()) return;
  let obj;
  try { obj = JSON.parse(line); } catch (e) { return; }
  const w = obj.madde;
  // Ünlem maddeleri ("bak!") tek kelime sayılıyor ama cevap olamaz.
  if (!w || /[ \-.'!]/.test(w)) return;
  const chars = Array.from(w);
  if (chars.length !== 4) return;
  const upper = w.toLocaleUpperCase('tr-TR');
  if (existing.has(upper)) return;
  const out = obj.ozel_mi === '1' ? proper : common;
  if (out.has(upper)) return;
  const anlam1 = obj.anlamlarListe?.[0];
  const anlamText = anlam1?.anlam ?? '';
  const ozellikler = (anlam1?.ozelliklerListe ?? []).map((o) => o.kisa_adi).join(',');
  out.set(upper, { anlam: anlamText, oz: ozellikler });
});

function write(map, file) {
  const words = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, 'tr-TR'));
  const lines = words.map((w) => `${w}\t${map.get(w).oz}\t${map.get(w).anlam}`);
  fs.writeFileSync(new URL(file, base), lines.join('\n'));
  return words.length;
}

rl.on('close', () => {
  console.log('existing 4-letter in dict:', existing.size);
  console.log('new candidates:', write(common, '4letter-tdk-candidates.tsv'));
  console.log('new proper nouns:', write(proper, '4letter-tdk-proper.tsv'));
});
