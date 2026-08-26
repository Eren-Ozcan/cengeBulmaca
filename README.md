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

## Store material

The screenshots, the feature graphic and the promo video are generated from the
real app, so they can be rebuilt after any UI change instead of being recorded
by hand from someone's phone:

```bash
node scripts/showcase.mjs shots            # 1080x1920 stills, driven by real clicks
node scripts/showcase.mjs shots --tablet   # 1600x2560, for Play's tablet slots
node scripts/showcase.mjs video            # screencast frames + their timings
python scripts/make_store_shots.py         # adds the caption band (--tablet for the other set)
python scripts/make_feature_graphic.py     # 1024x500
python scripts/make_promo_video.py         # 1920x1080 promo cut: phone, captions, music
```

`showcase.mjs` seeds a showcase save (31 puzzles solved, a 12-day streak, 8 of
15 cats) before the app boots and drives a headless Chrome through the screens,
so nothing depends on a personal save file. Everything lands in
`docs/store-assets-originals/`, which is gitignored — see CLAUDE.md for where
the finished files are kept.

The vertical clip and the GIF are encoded from the same capture:

```bash
cd docs/store-assets-originals/frames
ffmpeg -y -f concat -safe 0 -i frames.txt -vf "scale=720:1280:flags=lanczos,fps=30"   -c:v libx264 -pix_fmt yuv420p -crf 21 -movflags +faststart ../demo-vertical-720x1280.mp4
ffmpeg -y -f concat -safe 0 -i frames.txt   -vf "fps=12,scale=360:640:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4"   ../demo-vertical-360x640.gif
```

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
