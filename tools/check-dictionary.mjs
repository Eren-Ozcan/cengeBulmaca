// Dictionary sanity checks run after every batch of clue edits:
// the same clue text on two different answers, clues longer than four words,
// and answers that appear twice. Prints counts and exits non-zero on failure.
import { WORDS } from "./dictionary.mjs";

const byClue = new Map();
const byAnswer = new Map();
const longClues = [];

for (const w of WORDS) {
  byAnswer.set(w.a, (byAnswer.get(w.a) ?? 0) + 1);
  for (const c of w.c) {
    if (c.trim().split(/\s+/).length > 4) longClues.push(`${w.a}: ${c}`);
    if (!byClue.has(c)) byClue.set(c, new Set());
    byClue.get(c).add(w.a);
  }
}

const shared = [...byClue].filter(([, answers]) => answers.size > 1);
const dupAnswers = [...byAnswer].filter(([, n]) => n > 1);

console.log("shared clue texts:", shared.length);
for (const [c, a] of shared) console.log("  ", c, "=>", [...a].join(" / "));
console.log("clues longer than 4 words:", longClues.length);
for (const l of longClues) console.log("  ", l);
console.log("duplicate answers:", dupAnswers.length);
for (const [a, n] of dupAnswers) console.log("  ", a, n);

const ok = shared.length === 0 && longClues.length === 0 && dupAnswers.length === 0;
if (!ok) process.exitCode = 1;
