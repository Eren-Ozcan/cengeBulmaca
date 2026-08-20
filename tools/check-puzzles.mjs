// Verifies the generated puzzle set: every answer and every clue text must
// appear exactly once across all puzzles. Prints the worst offenders and exits
// non-zero when anything repeats.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "puzzles");
const files = readdirSync(dir).filter((f) => /^puzzle-\d+\.json$/.test(f));

const answers = new Map();
const texts = new Map();
let questions = 0;

for (const f of files) {
  const p = JSON.parse(readFileSync(join(dir, f), "utf8"));
  for (const c of p.clues) {
    questions++;
    answers.set(c.answer, (answers.get(c.answer) ?? 0) + 1);
    texts.set(c.text, (texts.get(c.text) ?? 0) + 1);
  }
}

const repeatedAnswers = [...answers].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
const repeatedTexts = [...texts].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);

console.log(`${files.length} bulmaca, ${questions} soru`);
console.log(`farklı cevap: ${answers.size}, tekrar eden: ${repeatedAnswers.length}`);
for (const [a, n] of repeatedAnswers.slice(0, 20)) console.log(`   ${n}x ${a}`);
console.log(`farklı ipucu metni: ${texts.size}, tekrar eden: ${repeatedTexts.length}`);
for (const [t, n] of repeatedTexts.slice(0, 20)) console.log(`   ${n}x ${t}`);

if (repeatedAnswers.length || repeatedTexts.length) process.exitCode = 1;
