# Design / Visual Asset Checklist

A list of the visual elements added with the cat-themed content update, plus
ones that could be strengthened later. Unlocked cats are now shown with real
portrait images generated with Gemini and cleaned up via
`tools/process-cat-images.mjs` (`public/cats/*.png`, see `cat-avatar.ts`).
Locked cats are still shown with a hand-drawn, generic (cat-agnostic)
parametric SVG silhouette — it reveals no identity and carries no external
asset/copyright risk. The app icon/favicon is likewise based on a Duman
portrait generated with Gemini and processed locally (see "App icon / brand
assets").

## Characters

| Character | Region | Status | Note |
|---|---|---|---|
| Duman (guide) | İstanbul | ✅ Real portrait (PNG) | The app icon/favicon is also based on a Gemini-generated, hand-processed portrait of Duman |
| Pamuk | Van | ✅ Real portrait (PNG) | Heterochromatic eyes applied |
| Bulut | Ankara | ✅ Real portrait (PNG) | |
| Fıstık | İzmir | ✅ Real portrait (PNG) | |
| Yasemin | Antalya | ✅ Real portrait (PNG) | |
| Fındık | Trabzon | ✅ Real portrait (PNG) | |
| Gri Dede | Kapadokya | ✅ Real portrait (PNG) | |
| Kum | Şanlıurfa | ✅ Real portrait (PNG) | |
| Zeytin | Bursa | ✅ Real portrait (PNG) | |
| Şeker | Konya | ✅ Real portrait (PNG) | |
| Yayla | Rize | ✅ Real portrait (PNG) | |
| Nar | Mardin | ✅ Real portrait (PNG) | |
| İnci | Çanakkale | ✅ Real portrait (PNG) | |
| Baklava | Gaziantep | ✅ Real portrait (PNG) | |
| Kar | Erzurum | ✅ Real portrait (PNG) | |
| Fener | Sinop | ✅ Real portrait (PNG) | The closing story is now triggered here (final cat) |

The `furColor`/`patternColor`/`pattern`/`eyeColor` fields on `CatDef` now feed
not only the appearance of the locked-silhouette SVG but the story/lore data as
well; the real visual is now independent of these fields — a hand-picked Gemini
portrait (see `src/cats.ts`, `src/cat-avatar.ts`).

### Unlock model (2 months of progression)

Cats are no longer tied to a specific puzzle but to the **total number of
distinct puzzles solved** (`CatDef.unlockAt`). Thresholds: 2, 6, 10, 14, 18,
22, 26, 30, 34, 38, 42, 46, 50, 55, 60. An average player solving one puzzle a
day reaches the final cat (Fener) in about 2 months. Re-solving the same puzzle
does not increment the counter. The locked cat card states the required puzzle
count; the completion modal and the main menu teaser show how many puzzles
remain until the next cat.

**Puzzle pool (2026-07-24, raised to 300):** `src/puzzles/` now contains 300
puzzles (generated with `tools/generate.mjs`; `src/puzzles/index.ts` now loads
them automatically in numeric order with `import.meta.glob` instead of 300
manual import lines). The cat unlock thresholds are independent of pool size —
the journey still completes once 60 distinct puzzles are solved; the larger
pool only keeps the daily puzzle rotation (`dailyIndex`) repeat-free for far
longer.

**Large/detail view (✅ done):** `catFullBody` (cat-avatar.ts) returns the same
Gemini portrait (the same image as `catAvatar`) when unlocked, and a silhouette
SVG with body + tail + paws when locked. Used in: the story intro, Duman's
portrait in the closing story, the cat detail modal, and the unlock celebration
at the end of a puzzle. The collection grid, map pins and teaser preview show
the same portrait as `catAvatar` in a small square frame.

**Idle animation (✅ done, minimal version):** A CSS-only "breathing" loop in
the cat detail modal (`cat-idle-breathe` @keyframes, style.css) — a slight
scale up/down plus a tiny tilt, disabled under `prefers-reduced-motion`. Real
blinking / tail wagging was not attempted (the portraits are single frames,
with no separate eye/tail layer); if desired, a second "eyes closed" frame
could be generated and crossfaded — see "On hold".

**On hold (later stage, optional):**
- Real blinking: a second "eyes closed" Gemini portrait could be generated for
  each cat, aligned to the same framing and periodically crossfaded.
- A separate, somewhat larger/more detailed "hero" illustration for Duman.

## Screens

| Screen | Status |
|---|---|
| Main menu + cat teaser card | ✅ |
| Story intro (first launch) | ✅ |
| "Kedi Dostlarım" (My Cat Friends) collection screen | ✅ |
| Cat detail modal | ✅ |
| Cat unlock celebration on puzzle completion | ✅ |
| Closing story (once all cats are collected) | ✅ |
| Region map (progress visualization over Anatolia) | ✅ "Anadolu Haritası" (Anatolia Map) screen (`src/turkey-map.ts` + `renderMap`), opened from Kedi Dostlarım via 🗺️ |

## Box / card components (existing style system)

All new components use the existing CSS variable system (`--surface`,
`--radius`, `--shadow`, `--accent`, etc.); they adapt automatically to both the
modern and the newspaper theme:
- `.cats-teaser` — collection summary card on the main menu
- `.cat-card` — individual cat card in the collection grid (locked/unlocked)
- `.cat-modal` / `.cat-reveal-tag` — detail and celebration modal
- `.modal-cat-next` — the "N puzzles to the next cat" row in the completion modal
- `.intro-screen` — story narration screen
- `.map-canvas` / `.map-outline` / `.map-pin` — Anatolia map screen; the
  silhouette was produced by simplifying public-domain (CC0/PDDL) country
  border data (`datasets/geo-countries`, listed as CC0 under Wikimedia Commons
  `Data:Turkey.map`), smoothing it with Catmull-Rom curves, and embedding it as
  a static SVG path (no external data is fetched at runtime, see
  `src/turkey-map.ts`). Region pins were computed from real city
  latitude/longitude using the same projection.

(`.puzzle-cat-badge` was removed: since cats unlock by total solve count rather
than per puzzle, there is no longer a cat badge in the puzzle list.)

## Sound / haptics

- Cat unlock moment: confetti + pop animation + `playWin()` + now a separate
  "meow" sound (`playCatUnlock`, `src/sound.ts`). There is no audio file; it is
  synthesized with an oscillator + bandpass filter (no increase in bundle
  size), the same approach as the existing sound system.

## App icon / brand assets

- ✅ Done. A flat-vector portrait of Duman generated with Gemini (Google) was
  used as the source (`tools/icon-src/duman-icon-raw.png`), then
  `tools/generate-icons.mjs` (sharp) produced:
  - `public/favicon.png` (browser tab icon, `index.html` updated),
  - Android `ic_launcher` / `ic_launcher_round` (all densities, edge to edge,
    blended with the background),
  - Android adaptive icon foreground (transparent, scaled within the safe area)
    + background color (an orange tone sampled automatically from the image).
  To regenerate: `npm run icons`.

## Priority suggestion

The main items on the checklist (app icon/favicon, sound effect, region map,
real cat portraits, minimal idle animation) are done. The remaining optional
ideas are in the "On hold" notes (a real blinking frame, a separate hero
illustration, etc.).
