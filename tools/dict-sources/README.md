# Dictionary source data

Working files for expanding `tools/dictionary.mjs` (zero-duplicate-clue
project, started 2026-08-15). Not used at runtime — reference material for
hand-reviewing new dictionary entries across sessions.

## 5letter-tdk-candidates.tsv

Tab-separated `WORD\tözellik-kısaltmaları\tTDK-tanımı`, one line per
candidate. Sourced from TDK's *Güncel Türkçe Sözlük* (12th edition,
~99,236 madde) via the [ogun/guncel-turkce-sozluk](https://github.com/ogun/guncel-turkce-sozluk)
GitHub dataset (`sozluk/v12/v12.gts.json.tar.gz`), filtered to:
- single-word entries (no spaces/hyphens)
- exactly 5 letters
- not a proper noun (`ozel_mi != "1"`)
- not already present as a 5-letter answer in `tools/dictionary.mjs` at
  extraction time (2026-08-17)

Review process: skip dialectal (`ağz.`), archaic (`esk.`), slang (`argo`/`tkz.`),
and overly narrow technical/regional entries unless the word is still commonly
known; keep common, unambiguous, puzzle-appropriate words. Write a short
(3-6 word) clue derived from the TDK definition — not a copy-paste of the
full definition. Check for duplicate answers and duplicate clue text against
the rest of `dictionary.mjs` before committing (see the node one-liners used
in past sessions — read WORDS, group by `c[]` text, flag any answer collision).

This file is a static snapshot — words added to `dictionary.mjs` are **not**
removed from it. To find what's left to review for a given range, diff
against the current answer set in `tools/dictionary.mjs`.
