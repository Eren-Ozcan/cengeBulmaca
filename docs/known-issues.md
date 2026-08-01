# Known Issues

Issues seen during playtesting that have not been fixed yet. Each item is added
here as it is found, and removed or marked "✅ fixed" once resolved.

## 2026-07-28 playtest

1. **✅ fixed** — The answer to the clue "Haftanın üçüncü günü" ("The third day
   of the week") was wrong (it was calculated using the American week start:
   Sunday=1, Monday=2, Tuesday=3). The clue text was changed to "Haftanın
   ikinci günü" ("The second day of the week") — in the Turkish system
   Monday=1, Tuesday=2, so the answer stays SALI and only the clue text was
   corrected. The change was applied both to the SALI entry in
   `tools/dictionary.mjs` and to the 6 already-generated puzzle files
   (`bulmaca-104/117/12/174/46/87.json`).

2. **✅ fixed** — Text/cell size was calculated from a fixed "390px" estimate
   rather than the grid's actual free vertical + horizontal space.
   `App.sizeGrid()` (ui.ts) now computes the width from the actually measured
   area of `.grid-wrap` (height is derived automatically from the cells'
   aspect-ratio:1 property); letter font size was switched to the `cqw` unit;
   and the font-fitting logic for clue text (`fitClueTexts`) no longer only
   shrinks — it genuinely grows in large cells too.

3. **✅ fixed** — Letter entries were already being saved, but on every return
   to the app the cursor jumped to the "first empty cell", making the user feel
   they had lost their place. The save format in `game.ts` now contains
   `{entries, selRow, selCol, activeClue}` (backwards compatible with the old
   flat-array saves), and `openPuzzle` in `ui.ts` preserves the saved cursor if
   there is one. A partial progress bar and a "Devam et" ("Continue") label
   were also added to the "Günün Bulmacası" (Puzzle of the Day) card
   (previously they existed only in the puzzle list).

4. **✅ fixed (there was no actual bug)** — The toggle logic in
   `music.ts`/`sound.ts` was tested (`play()`/`pause()` fire correctly,
   localStorage updates correctly); no real defect was found. The control is
   only available from the "Müzik" (Music) row on the Settings screen — a
   deliberate choice to keep it that way (no separate sound button was added to
   the home screen).
