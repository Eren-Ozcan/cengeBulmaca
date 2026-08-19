# Dictionary source data

Working files for expanding `tools/dictionary.mjs` (zero-duplicate-clue
project, started 2026-08-15). Not used at runtime — reference material for
hand-reviewing new dictionary entries across sessions.

## 5letter-tdk-candidates.tsv — DONE (2026-08-17)

All 3696 lines have been hand-reviewed; 1557 new 5-letter words were
added to `dictionary.mjs` (751 -> 2308 total). No further action needed
on this file for the 5-letter category — it's kept only as a provenance
record. The next dictionary-expansion work should pull a fresh candidate
list for a different word length (2/3/4/6/7 letters) using the same
`extract5.mjs`-style script pattern (see git history for the extraction
scripts if they're needed again — they were run from the scratchpad and
not committed, only the output TSV was).

## 6letter-tdk-candidates.tsv — DONE (2026-08-19)

All 6015 candidates have been hand-reviewed; 1402 new 6-letter words were
added to `dictionary.mjs` (54 -> 1456 total). Kept only as a provenance
record. Extraction script: `tools/dict-sources/extract6-detail.mjs`.

## 7letter-tdk-candidates.tsv — DONE (2026-08-19)

7917 candidates extracted with `tools/dict-sources/extract7-detail.mjs`
(same source/filter as the 6-letter file, just `len === 7`) and fully
hand-reviewed; 1239 new 7-letter words were added to `dictionary.mjs`
(33 -> 1272 total).

Both passes used the same pre-filter before hand review: drop entries
tagged `esk.`, `ağz.`, `argo`, `tkz.`, `hlk.`, plus verbal nouns whose
definition is just "…mak işi/durumu". After every batch the whole
dictionary is re-checked for duplicate answers, clue texts longer than
3 words and clue-text collisions between different answers (all zero).

**Clue style going forward: write clues at ≤4 words from the start**
(prefer 1-3 words, synonym-pairs or short noun-phrases) — matching the
real çengel bulmaca style confirmed in a prior session by sampling
hurriyet/haberturk/posta bulmaca pages. Do NOT write long descriptive
clues and shorten them in a second pass — that's what happened with
lengths 2-5 and required a large separate compression pass afterward.

General format/process notes below (written for the 5-letter pass, same
rules apply to 6 and future lengths):

Tab-separated `WORD\tözellik-kısaltmaları\tTDK-tanımı`, one line per
candidate. Sourced from TDK's *Güncel Türkçe Sözlük* (12th edition,
~99,236 madde) via the [ogun/guncel-turkce-sozluk](https://github.com/ogun/guncel-turkce-sozluk)
GitHub dataset (`sozluk/v12/v12.gts.json.tar.gz`, fetched via
`gh api repos/ogun/guncel-turkce-sozluk/git/blobs/<blob-sha> -H "Accept: application/vnd.github.raw"`
— the plain raw.githubusercontent.com URL 429'd during this session),
filtered to:
- single-word entries (no spaces/hyphens/apostrophes)
- exact target length
- not a proper noun (`ozel_mi != "1"`)
- not already present as an answer of that length in `tools/dictionary.mjs`
  at extraction time

Review process: skip dialectal (`ağz.`), archaic (`esk.`), slang (`argo`/`tkz.`),
sensitive/dark topics (profanity, slurs, drugs, violence, religious-sensitive),
and overly narrow technical/regional entries unless the word is still commonly
known; keep common, unambiguous, puzzle-appropriate words. When TDK's captured
sense is an obscure secondary meaning for a very well-known word, write the
word's actual well-known meaning instead of parroting TDK's pick. Write a
short (≤4 words) clue derived from the definition — not a copy-paste of the
full TDK text. Check for duplicate answers and duplicate clue text against
the rest of `dictionary.mjs` before committing (read WORDS, group by `c[]`
text, flag any answer collision — see git history of `dictionary.mjs` for
the exact node one-liners used throughout this project).

This file is a static snapshot — words added to `dictionary.mjs` are **not**
removed from it. To find what's left to review for a given range, diff
against the current answer set in `tools/dictionary.mjs`.
