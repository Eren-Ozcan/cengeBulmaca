# Çengel Bulmaca

A Turkish-language classic çengel bulmaca (Swedish-style crossword) mobile
game. Clues are written inside the dark cells of the grid; an arrow shows
which cell the answer starts from and in which direction it is written.

Built with web technology (Vite + TypeScript, no framework) and packaged as
an Android app with Capacitor.

## Features

- Classic çengel format: in-cell clues, 4 arrow directions, cells with two clues
- 10 puzzles, three difficulty levels (easy / medium / hard)
- Puzzle of the day (deterministic selection by date) and 🔥 daily streak
- Turkish on-screen keyboard (Ğ Ü Ş İ Ö Ç), check and hint (reveal a letter)
- Sound effects (Web Audio, can be toggled) and haptic feedback
- Share your result (Web Share API, falls back to clipboard copy)
- Progress saving (localStorage) — continue where you left off
- Light/dark theme (follows the system preference)

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
```

## Generating new puzzles

Puzzles are generated with `tools/generate.mjs`: a random mask is generated,
repaired, clue cells are assigned, and the grid is filled with a backtracking
algorithm using the dictionary in `tools/dictionary.mjs`. The output is
validated both inside the tool and in the game engine (intersections /
overflow / empty cells).

```bash
npm run gen -- <id> <title> [seed] [columns] [rows] [difficulty]
npm run gen -- bulmaca-11 "Bulmaca 11" 1234 8 11 orta
```

The generated JSON is written under `src/puzzles/`; to add it to the game,
append it to the `src/puzzles/index.ts` list.

To enrich the dictionary, add `{ a: "CEVAP", c: ["clue text"] }` entries to
`tools/dictionary.mjs`. (Dictionary entries and clue text are Turkish — that
is the game's content language.)

## Android (APK)

Requirements: Android SDK, JDK 17+.

```bash
npm run android
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

### Release (signed)

Copy `android/keystore.properties.example` to `keystore.properties` and enter
your key details (the file is not committed to git), then:

```bash
npm run android:release
# APK: android/app/build/outputs/apk/release/app-release.apk
```

For Play Store release preparation, see `docs/store-listing.md` and
`PRIVACY.md`.

## Architecture

- `src/types.ts` — puzzle data model (clue cell + 4 arrow types + difficulty)
- `src/puzzle.ts` — building the grid from a definition and validating consistency
- `src/game.ts` — game state: selection, letter entry, checking, saving (localStorage)
- `src/stats.ts` — daily streak, solve statistics, puzzle-of-the-day selection
- `src/ui.ts` — grid, active clue bar, Turkish on-screen keyboard, sharing
- `src/sound.ts` — Web Audio sound effects (synthesized, no audio files)
- `src/haptics.ts` — vibration feedback
- `src/*.test.ts` — vitest unit tests
- `tools/` — puzzle generator and dictionary (646 entries)
