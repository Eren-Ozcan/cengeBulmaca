import fs from 'fs';
import readline from 'readline';

const base = new URL('.', import.meta.url);

const t = fs.readFileSync('C:/Projects/cengeBulmaca/tools/dictionary.mjs', 'utf8');
const existing = new Set();
const re = /a:\s*"([A-ZÇĞİIÖŞÜ]+)"/g;
let m;
while ((m = re.exec(t))) { if (Array.from(m[1]).length === 6) existing.add(m[1]); }

const rl = readline.createInterface({ input: fs.createReadStream(new URL('gts.json', base)) });
const out = new Map();

rl.on('line', (line) => {
  if (!line.trim()) return;
  let obj;
  try { obj = JSON.parse(line); } catch (e) { return; }
  const w = obj.madde;
  if (!w || w.includes(' ') || w.includes('-') || w.includes('.') || w.includes("'")) return;
  const chars = Array.from(w);
  if (chars.length !== 6) return;
  if (obj.ozel_mi === '1') return;
  const upper = w.toLocaleUpperCase('tr-TR');
  if (existing.has(upper)) return;
  if (out.has(upper)) return;
  const anlam1 = obj.anlamlarListe?.[0];
  const anlamText = anlam1?.anlam ?? '';
  const ozellikler = (anlam1?.ozelliklerListe ?? []).map((o) => o.kisa_adi).join(',');
  out.set(upper, { anlam: anlamText, oz: ozellikler });
});

rl.on('close', () => {
  const words = Array.from(out.keys()).sort((a, b) => a.localeCompare(b, 'tr-TR'));
  const lines = words.map((w) => `${w}\t${out.get(w).oz}\t${out.get(w).anlam}`);
  fs.writeFileSync(new URL('6letter-tdk-candidates.tsv', base), lines.join('\n'));
  console.log('existing 6-letter in dict:', existing.size);
  console.log('new candidates:', words.length);
});
