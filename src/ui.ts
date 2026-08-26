import {
  backspace,
  checkEntries,
  isWordSolved,
  moveCursorInActiveClue,
  newGame,
  revealLetter,
  savedProgress,
  selectCell,
  typeLetter,
  type GameState,
} from "./game.ts";
import {
  currentStreak,
  dailyIndex,
  isSolvedPuzzle,
  loadStats,
  playedToday,
  solvedCount,
} from "./stats.ts";
import {
  playCatUnlock,
  playCorrect,
  playKey,
  playWin,
  playWrong,
  soundEnabled,
  toggleSound,
} from "./sound.ts";
import { hapticKey, hapticWin, hapticWrong } from "./haptics.ts";
import { maybeShowInterstitial, showRewardedHintAd } from "./ads.ts";
import { consumeFreeHint, freeHintsRemainingToday } from "./hints.ts";
import { CAT_UNLOCK_REWARD, grantJokers, jokerBalance, spendJoker } from "./economy.ts";
import {
  adsRemoved,
  JOKER_PACKS,
  loadStorePrices,
  priceLabelFor,
  purchaseJokerPack,
  purchaseRemoveAds,
  REMOVE_ADS_PRICE_LABEL,
  REMOVE_ADS_PRODUCT_ID,
} from "./billing.ts";
import { musicEnabled, toggleMusic } from "./music.ts";
import { currentTheme, toggleTheme } from "./theme.ts";
import { ensureLoaded, isLoaded } from "./puzzles/index.ts";
import type { ArrowDir, PuzzleDef } from "./types.ts";
import {
  CATS,
  DUMAN,
  allCatsUnlocked,
  catUnlocked,
  catUnlockedAt,
  nextLockedCat,
  regionDative,
  type CatDef,
} from "./cats.ts";
import { catAvatar, catFullBody } from "./cat-avatar.ts";
import {
  ISTANBUL_POS,
  MAP_VIEWBOX,
  OUTLINE_PATH,
  percentPos,
  regionPos,
} from "./turkey-map.ts";
import {
  STORY_TITLE,
  STORY_PARAGRAPHS,
  storySeen,
  markStorySeen,
  EPILOGUE_TITLE,
  EPILOGUE_PARAGRAPHS,
  epilogueSeen,
  markEpilogueSeen,
} from "./story.ts";
import {
  tutorialSeen,
  markTutorialSeen,
  TUTORIAL_PUZZLE,
  TUTORIAL_STEPS,
  type TutorialStep,
} from "./tutorial.ts";
import { claimFirstPuzzleReferralReward, shareInvite } from "./referral.ts";
import { cloudSettingsRow } from "./cloud-ui.ts";

// Arrow icons: classic crossword-style arrows (SVG, currentColor)
const ARROW_SVG: Record<ArrowDir, string> = {
  right: `<svg viewBox="0 0 10 10"><path d="M2.5 1.5 L8 5 L2.5 8.5 Z"/></svg>`,
  down: `<svg viewBox="0 0 10 10"><path d="M1.5 2.5 L5 8 L8.5 2.5 Z"/></svg>`,
  "right-down": `<svg viewBox="0 0 10 10"><path d="M0.5 2 H5.2 V4.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.8 4.6 L5.2 8.8 L7.6 4.6 Z"/></svg>`,
  "down-right": `<svg viewBox="0 0 10 10"><path d="M2 0.5 V5.2 H4.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.6 2.8 L8.8 5.2 L4.6 7.6 Z"/></svg>`,
};

const KEY_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "Ğ", "Ü"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ş", "İ"],
  ["Z", "X", "C", "V", "B", "N", "M", "Ö", "Ç", "⌫"],
];

const SPLASH_FLAVORS = [
  "Patiler ısınıyor…",
  "Anadolu haritası açılıyor…",
  "Bekçi kediler uyandırılıyor…",
  "Bulmaca mürekkebi hazırlanıyor…",
];
const SPLASH_DURATION_MS = 1700;
const SPLASH_FLAVOR_INTERVAL_MS = 500;

/** The puzzle list is split into chapters of this size (e.g. 1-25, 26-50, ...) —
 * with hundreds of puzzles, the home screen shows a short chapter list
 * instead of one long list, so the player doesn't have to scroll all the
 * way to where they left off every time. */
const CHAPTER_SIZE = 25;

export interface AppOptions {
  /** Skips the timeout-based splash screen in tests. */
  skipSplash?: boolean;
}

export class App {
  private root: HTMLElement;
  private puzzles: PuzzleDef[];
  private options: AppOptions;
  private state: GameState | null = null;
  /** Last cell where a letter was entered; gets a pop animation on the next render */
  private popIdx: number | null = null;
  /** Word just completed correctly; its cells flash green */
  private flashClue: number | null = null;
  /** Clue font sizes fitted to their cells; key is "cell:clue" */
  private clueFontCache = new Map<string, string>();
  /** Grid width the cache is valid for */
  private clueFontWidth = 0;
  /** Cat just unlocked by this move, if any; shown on the celebration screen */
  private justUnlockedCat: CatDef | null = null;
  /** True if this move unlocked the last guardian cat and completed the journey */
  private journeyJustCompleted = false;
  /** Index of the active tutorial step if the tutorial is running, otherwise null */
  private tutorialStep: number | null = null;
  /** Callback to run when the tutorial finishes */
  private tutorialDone: (() => void) | null = null;
  /**
   * The currently rendered top-level screen. Kept only so the Android back
   * button knows where to return to (see handleBack); it can't be read from
   * the bottom nav's "active" tab, because the chapter list also marks
   * itself as the "home" tab.
   */
  private screen:
    | "home"
    | "chapter"
    | "cats"
    | "map"
    | "shop"
    | "settings"
    | "game" = "home";
  /**
   * Epoch ms until which the "press back again to exit" warning is armed
   * when the back button is pressed on the home screen. Prevents accidentally
   * exiting the game with a single tap.
   */
  private exitArmedUntil = 0;
  /** Whether store prices have been fetched once (see renderShop) */
  private storePricesLoaded = false;

  constructor(root: HTMLElement, puzzles: PuzzleDef[], options: AppOptions = {}) {
    this.root = root;
    this.puzzles = puzzles;
    this.options = options;
  }

  start(): void {
    // Measurements shift once the web font loads later or the window is
    // resized; refit the font sizes
    document.fonts?.ready.then(() => this.refitClueTexts());
    window.addEventListener("resize", () => this.refitClueTexts());

    const enter = () => {
      if (storySeen()) {
        this.enterAfterStory();
      } else {
        this.renderIntro(() => this.enterAfterStory());
      }
    };
    if (this.options.skipSplash) {
      enter();
    } else {
      this.renderSplash(enter);
    }
  }

  /**
   * First stop after the story: a player opening the game for the first time
   * plays the tutorial first (one-time, cannot be skipped), everyone else
   * goes straight to the home menu.
   */
  private enterAfterStory(): void {
    if (tutorialSeen()) this.renderHome();
    else this.startTutorial(() => this.renderHome());
  }

  // ---------- splash screen ----------

  /** Short, fixed-duration brand splash; shown in parallel with real SDK initializations (initAds etc.). */
  private renderSplash(done: () => void): void {
    this.root.innerHTML = "";
    const wrap = el("div", "splash-screen");

    const avatar = el("div", "cat-avatar-wrap cat-avatar-lg splash-avatar");
    avatar.innerHTML = catFullBody(DUMAN);
    wrap.appendChild(avatar);

    const brand = el("div", "brand splash-brand");
    brand.appendChild(el("span", "brand-mark", "Ç"));
    brand.appendChild(el("span", "brand-name", "Çengel Bulmaca"));
    wrap.appendChild(brand);

    const track = el("div", "splash-bar-track");
    const fill = el("div", "splash-bar-fill");
    track.appendChild(fill);
    wrap.appendChild(track);

    const flavor = el("div", "splash-flavor", SPLASH_FLAVORS[0]);
    wrap.appendChild(flavor);

    this.root.appendChild(wrap);
    requestAnimationFrame(() => {
      fill.style.transitionDuration = `${SPLASH_DURATION_MS}ms`;
      fill.classList.add("splash-bar-anim");
    });

    let i = 0;
    const flavorTimer = window.setInterval(() => {
      i = (i + 1) % SPLASH_FLAVORS.length;
      flavor.textContent = SPLASH_FLAVORS[i];
    }, SPLASH_FLAVOR_INTERVAL_MS);

    window.setTimeout(() => {
      clearInterval(flavorTimer);
      done();
    }, SPLASH_DURATION_MS);
  }

  // ---------- opening story ----------

  /** Tells Duman's story full-screen; calls returnTo when the player continues. */
  private renderIntro(returnTo: () => void): void {
    this.root.innerHTML = "";
    const wrap = el("div", "home intro-screen");

    const avatar = el("div", "cat-avatar-wrap cat-avatar-lg intro-avatar");
    avatar.innerHTML = catFullBody(DUMAN);
    wrap.appendChild(avatar);

    wrap.appendChild(el("h1", "intro-title", STORY_TITLE));
    const body = el("div", "intro-body");
    for (const p of STORY_PARAGRAPHS) {
      body.appendChild(el("p", "intro-p", p));
    }
    wrap.appendChild(body);

    const btn = el("button", "modal-btn intro-btn", "Yolculuğa başla");
    btn.addEventListener("click", () => {
      markStorySeen();
      returnTo();
    });
    wrap.appendChild(btn);

    this.root.appendChild(wrap);
  }

  /** Closing story shown once all guardian cats are collected; calls returnTo when the player continues. */
  private renderEpilogue(returnTo: () => void): void {
    this.root.innerHTML = "";
    const wrap = el("div", "home intro-screen epilogue-screen");

    const family = el("div", "epilogue-family");
    const dumanAvatar = el("div", "cat-avatar-wrap cat-avatar-lg");
    dumanAvatar.innerHTML = catFullBody(DUMAN);
    family.appendChild(dumanAvatar);
    CATS.forEach((cat) => {
      const mini = el("div", "cat-avatar-wrap cat-avatar-mini");
      mini.innerHTML = catAvatar(cat);
      family.appendChild(mini);
    });
    wrap.appendChild(family);

    wrap.appendChild(el("h1", "intro-title", EPILOGUE_TITLE));
    const body = el("div", "intro-body");
    for (const p of EPILOGUE_PARAGRAPHS) {
      body.appendChild(el("p", "intro-p", p));
    }
    wrap.appendChild(body);

    const btn = el("button", "modal-btn intro-btn", "Anadolu'ya dön");
    btn.addEventListener("click", () => {
      markEpilogueSeen();
      returnTo();
    });
    wrap.appendChild(btn);

    this.root.appendChild(wrap);
  }

  // ---------- bottom nav & joker badge ----------

  /** Nav bar between the 4 top-level tabs; not shown on the game/map/story screens. */
  private renderBottomNav(active: "home" | "cats" | "shop" | "settings"): HTMLElement {
    const nav = el("nav", "bottom-nav");
    const tabs: { key: typeof active; icon: string; label: string; go: () => void }[] = [
      { key: "home", icon: "🏠", label: "Ana Sayfa", go: () => this.renderHome() },
      { key: "cats", icon: "🐈", label: "Kediler", go: () => this.renderCollection() },
      { key: "shop", icon: "🛍️", label: "Mağaza", go: () => this.renderShop() },
      { key: "settings", icon: "⚙️", label: "Ayarlar", go: () => this.renderSettings() },
    ];
    for (const tab of tabs) {
      const btn = el(
        "button",
        "bottom-nav-btn" + (tab.key === active ? " active" : ""),
      );
      btn.appendChild(el("span", "bottom-nav-icon", tab.icon));
      btn.appendChild(el("span", "bottom-nav-label", tab.label));
      if (tab.key !== active) btn.addEventListener("click", tab.go);
      nav.appendChild(btn);
    }
    return nav;
  }

  /** Badge showing the joker balance; visible on every top-level screen, opens the Shop on tap. */
  private jokerPill(): HTMLElement {
    const pill = el("button", "joker-pill");
    pill.appendChild(el("span", "joker-pill-icon", "🃏"));
    pill.appendChild(el("span", "joker-pill-count", String(jokerBalance())));
    pill.appendChild(el("span", "joker-pill-plus", "＋"));
    pill.setAttribute("aria-label", "Joker bakiyesi, Mağaza'yı aç");
    pill.addEventListener("click", () => this.renderShop());
    return pill;
  }

  // ---------- home menu ----------

  private renderHome(): void {
    this.screen = "home";
    this.root.innerHTML = "";
    const home = el("div", "home");

    // top bar: logo + joker badge + streak badge
    const top = el("div", "home-top");
    const brand = el("div", "brand");
    brand.appendChild(el("span", "brand-mark", "Ç"));
    brand.appendChild(el("span", "brand-name", "Çengel"));
    top.appendChild(brand);
    const right = el("div", "home-top-right");
    right.appendChild(this.jokerPill());
    const themeBtn = el(
      "button",
      "icon-btn theme-btn",
      currentTheme() === "gazete" ? "🎨" : "📰",
    );
    themeBtn.title = "Tema değiştir: modern / gazete";
    themeBtn.setAttribute("aria-label", "Tema değiştir");
    themeBtn.addEventListener("click", () => {
      toggleTheme();
      this.renderHome();
    });
    right.appendChild(themeBtn);
    const streak = currentStreak();
    const chip = el("div", "streak-chip" + (playedToday() ? " streak-hot" : ""));
    chip.appendChild(el("span", "streak-flame", "🔥"));
    chip.appendChild(el("span", "streak-count", String(streak)));
    right.appendChild(chip);
    top.appendChild(right);
    home.appendChild(top);

    // Duman's greeting: time-of-day salutation + journey status
    const solvedForGreet = solvedCount();
    const greet = el("button", "duman-greet");
    const greetAvatar = el("div", "cat-avatar-wrap duman-greet-avatar");
    greetAvatar.innerHTML = catAvatar(DUMAN, false);
    greet.appendChild(greetAvatar);
    const greetText = el("div", "duman-greet-text");
    greetText.appendChild(el("div", "duman-greet-hello", `${timeGreeting()} 👋`));
    const greetNextCat = nextLockedCat(solvedForGreet);
    greetText.appendChild(
      el(
        "div",
        "duman-greet-sub",
        greetNextCat
          ? `Duman şu an ${regionDative(greetNextCat.region)} doğru yol alıyor 🐾`
          : "Duman Anadolu'nun her köşesinde bir dost buldu 🎉",
      ),
    );
    greet.appendChild(greetText);
    greet.addEventListener("click", () => this.renderCollection());
    home.appendChild(greet);

    // daily puzzle card
    const di = dailyIndex(this.puzzles.length);
    const daily = this.puzzles[di];
    const dailyDone = isSolvedPuzzle(daily.id);
    const dailyProg = dailyDone ? 0 : savedProgress(daily);
    const hero = el("button", "daily-card");
    const heroInfo = el("div", "daily-info");
    heroInfo.appendChild(el("div", "daily-label", "GÜNÜN BULMACASI"));
    heroInfo.appendChild(
      el(
        "div",
        "daily-date",
        new Date().toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "long",
          weekday: "long",
        }),
      ),
    );
    heroInfo.appendChild(
      el(
        "div",
        "daily-meta",
        `${daily.title} · ${daily.cols}×${daily.rows}` +
          (daily.difficulty ? ` · ${capitalizeTr(daily.difficulty)}` : ""),
      ),
    );
    if (dailyProg > 0) {
      const bar = el("div", "puzzle-progress daily-progress");
      const fill = el("div", "puzzle-progress-fill");
      fill.style.width = `${Math.max(4, Math.round(dailyProg * 100))}%`;
      bar.appendChild(fill);
      heroInfo.appendChild(bar);
    }
    hero.appendChild(heroInfo);
    hero.appendChild(
      el(
        "div",
        "daily-cta" + (dailyDone ? " done" : ""),
        dailyDone ? "✓" : dailyProg > 0 ? "Devam et" : "Oyna",
      ),
    );
    hero.addEventListener("click", () => this.openPuzzle(daily));
    home.appendChild(hero);

    // stats row
    const stats = loadStats();
    const statRow = el("div", "stat-row");
    statRow.appendChild(statCard("🔥", String(streak), "Günlük seri"));
    statRow.appendChild(statCard("✅", String(stats.solved.length), "Çözülen"));
    home.appendChild(statRow);

    // cat collection teaser card
    const solved = solvedForGreet;
    const collected = CATS.filter((c) => catUnlocked(c, solved)).length;
    const catsCard = el("button", "cats-teaser");
    const preview = el("div", "cats-teaser-preview");
    CATS.slice(0, 5).forEach((c) => {
      const mini = el("div", "cat-avatar-wrap cat-avatar-mini");
      mini.innerHTML = catAvatar(c, !catUnlocked(c, solved));
      preview.appendChild(mini);
    });
    catsCard.appendChild(preview);
    const catsInfo = el("div", "cats-teaser-info");
    catsInfo.appendChild(el("div", "cats-teaser-title", "Kedi Dostlarım"));
    const next = nextLockedCat(solved);
    catsInfo.appendChild(
      el(
        "div",
        "cats-teaser-sub",
        `${collected}/${CATS.length} bekçi kedi toplandı` +
          (next ? ` · sıradaki ${next.unlockAt - solved} bulmaca sonra` : ""),
      ),
    );
    catsCard.appendChild(catsInfo);
    catsCard.appendChild(el("div", "puzzle-badge", "›"));
    catsCard.addEventListener("click", () => this.renderCollection());
    home.appendChild(catsCard);

    // puzzle chapters
    home.appendChild(el("div", "section-title", "Bulmacalar"));
    const chapterList = el("div", "puzzle-list");
    const chapterCount = Math.ceil(this.puzzles.length / CHAPTER_SIZE);
    const nextChapter = this.nextChapterIndex();
    for (let c = 0; c < chapterCount; c++) {
      const start = c * CHAPTER_SIZE;
      const end = Math.min(start + CHAPTER_SIZE, this.puzzles.length);
      const chunk = this.puzzles.slice(start, end);
      const solvedInChunk = chunk.filter((p) => isSolvedPuzzle(p.id)).length;
      const isNext = c === nextChapter;
      const btn = el(
        "button",
        "puzzle-card chapter-card" + (isNext ? " chapter-next" : ""),
      );
      btn.style.setProperty("--i", String(c));
      const num = el(
        "div",
        "puzzle-num" + (solvedInChunk === chunk.length ? " solved" : ""),
        String(c + 1),
      );
      btn.appendChild(num);
      const info = el("div", "puzzle-info");
      const titleRow = el("div", "puzzle-title-row");
      titleRow.appendChild(
        el("span", "puzzle-title", `${start + 1}–${end}. Bulmacalar`),
      );
      if (isNext) titleRow.appendChild(el("span", "diff-chip chip-next", "SIRADA"));
      info.appendChild(titleRow);
      info.appendChild(
        el("div", "puzzle-sub", `${solvedInChunk}/${chunk.length} çözüldü`),
      );
      const prog = solvedInChunk / chunk.length;
      if (prog > 0) {
        const bar = el("div", "puzzle-progress");
        const fill = el("div", "puzzle-progress-fill");
        fill.style.width = `${Math.max(4, Math.round(prog * 100))}%`;
        bar.appendChild(fill);
        info.appendChild(bar);
      }
      btn.appendChild(info);
      btn.appendChild(
        el(
          "div",
          "puzzle-badge" + (solvedInChunk === chunk.length ? " solved" : ""),
          solvedInChunk === chunk.length ? "✓" : "›",
        ),
      );
      btn.addEventListener("click", () => this.renderChapter(c));
      chapterList.appendChild(btn);
    }
    home.appendChild(chapterList);

    this.root.appendChild(home);
    this.root.appendChild(this.renderBottomNav("home"));
  }

  /** Global index of the first unsolved puzzle (puzzles.length if all are solved). */
  private firstUnsolvedIndex(): number {
    const idx = this.puzzles.findIndex((p) => !isSolvedPuzzle(p.id));
    return idx === -1 ? this.puzzles.length : idx;
  }

  /**
   * Puzzles unlock sequentially: this puzzle can't be played until the
   * previous one is solved. The Daily Puzzle card (renderHome) is
   * deliberately exempt from this restriction.
   */
  private isLocked(globalIndex: number): boolean {
    return globalIndex > this.firstUnsolvedIndex();
  }

  /** Index of the first chapter that still has an unsolved puzzle (last chapter if all are done). */
  private nextChapterIndex(): number {
    const idx = Math.min(this.firstUnsolvedIndex(), this.puzzles.length - 1);
    return Math.floor(idx / CHAPTER_SIZE);
  }

  /** Lists the puzzles in a chapter (using the existing card design). */
  private renderChapter(chapterIndex: number): void {
    this.screen = "chapter";
    this.root.innerHTML = "";
    const wrap = el("div", "home");

    const bar = el("div", "topbar");
    const back = el("button", "icon-btn");
    back.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 L9 12 L15 6"/></svg>`;
    back.setAttribute("aria-label", "Bölümler");
    back.addEventListener("click", () => this.renderHome());
    bar.appendChild(back);
    const start = chapterIndex * CHAPTER_SIZE;
    const end = Math.min(start + CHAPTER_SIZE, this.puzzles.length);
    bar.appendChild(el("div", "topbar-title", `${start + 1}–${end}. Bulmacalar`));
    wrap.appendChild(bar);

    const list = el("div", "puzzle-list");
    this.puzzles.slice(start, end).forEach((p, i) => {
      const gi = start + i;
      const solved = isSolvedPuzzle(p.id);
      const locked = !solved && this.isLocked(gi);
      const btn = el("button", "puzzle-card" + (locked ? " locked" : ""));
      btn.style.setProperty("--i", String(i));
      const num = el("div", "puzzle-num", String(gi + 1));
      if (solved) num.classList.add("solved");
      btn.appendChild(num);
      const info = el("div", "puzzle-info");
      const titleRow = el("div", "puzzle-title-row");
      titleRow.appendChild(el("span", "puzzle-title", p.title));
      if (p.difficulty) {
        titleRow.appendChild(
          el("span", `diff-chip diff-${p.difficulty}`, capitalizeTr(p.difficulty)),
        );
      }
      info.appendChild(titleRow);
      info.appendChild(
        el("div", "puzzle-sub", `${p.cols}×${p.rows} · ${p.clues.length} soru`),
      );
      const prog = solved ? 0 : savedProgress(p);
      if (prog > 0) {
        const progBar = el("div", "puzzle-progress");
        const fill = el("div", "puzzle-progress-fill");
        fill.style.width = `${Math.max(4, Math.round(prog * 100))}%`;
        progBar.appendChild(fill);
        info.appendChild(progBar);
      }
      btn.appendChild(info);
      btn.appendChild(
        el(
          "div",
          "puzzle-badge" + (solved ? " solved" : locked ? " locked" : ""),
          solved ? "✓" : locked ? "🔒" : "›",
        ),
      );
      btn.addEventListener("click", () => {
        if (locked) toast(this.root, "Önce sıradaki bulmacayı çözmelisin");
        else this.openPuzzle(p);
      });
      list.appendChild(btn);
    });
    wrap.appendChild(list);

    this.root.appendChild(wrap);
    this.root.appendChild(this.renderBottomNav("home"));
  }

  // ---------- cat collection ----------

  private renderCollection(): void {
    this.screen = "cats";
    this.root.innerHTML = "";
    const wrap = el("div", "home cats-screen");

    const bar = el("div", "topbar");
    const back = el("button", "icon-btn");
    back.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 L9 12 L15 6"/></svg>`;
    back.setAttribute("aria-label", "Ana menü");
    back.addEventListener("click", () => this.renderHome());
    bar.appendChild(back);
    bar.appendChild(el("div", "topbar-title", "Kedi Dostlarım"));
    const mapBtn = el("button", "icon-btn", "🗺️");
    mapBtn.title = "Anadolu haritası";
    mapBtn.setAttribute("aria-label", "Anadolu haritası");
    mapBtn.addEventListener("click", () => this.renderMap());
    bar.appendChild(mapBtn);
    const storyBtn = el("button", "icon-btn", "📖");
    storyBtn.title = "Hikayeyi tekrar oku";
    storyBtn.setAttribute("aria-label", "Hikayeyi tekrar oku");
    storyBtn.addEventListener("click", () => {
      this.renderIntro(() => this.renderCollection());
    });
    bar.appendChild(storyBtn);
    wrap.appendChild(bar);

    const solved = solvedCount();
    const collected = CATS.filter((c) => catUnlocked(c, solved)).length;
    wrap.appendChild(
      el("div", "cats-progress", `${collected}/${CATS.length} bekçi kedi toplandı`),
    );

    const grid = el("div", "cats-grid");
    CATS.forEach((cat, i) => {
      const unlocked = catUnlocked(cat, solved);
      const card = el("button", "cat-card" + (unlocked ? " unlocked" : " locked"));
      card.style.setProperty("--i", String(i));
      const avatar = el("div", "cat-avatar-wrap");
      avatar.innerHTML = catAvatar(cat, !unlocked);
      card.appendChild(avatar);
      card.appendChild(el("div", "cat-name", unlocked ? cat.name : "???"));
      card.appendChild(
        el("div", "cat-region", unlocked ? cat.region : `${cat.unlockAt} bulmaca çöz`),
      );
      if (unlocked) {
        card.addEventListener("click", () => this.showCatDetail(cat));
      }
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    this.root.appendChild(wrap);
    this.root.appendChild(this.renderBottomNav("cats"));
  }

  /** Shows Duman's journey across Anatolia on a map: each region's guardian
   * cat sits as a pin at its approximate location, colored by
   * unlocked/locked status. The map is stylized, not geographically
   * precise; tapping a pin shows the region name and status. */
  private renderMap(): void {
    this.screen = "map";
    this.root.innerHTML = "";
    const wrap = el("div", "home map-screen");

    const bar = el("div", "topbar");
    const back = el("button", "icon-btn");
    back.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 L9 12 L15 6"/></svg>`;
    back.setAttribute("aria-label", "Kedi Dostlarım");
    back.addEventListener("click", () => this.renderCollection());
    bar.appendChild(back);
    bar.appendChild(el("div", "topbar-title", "Anadolu Haritası"));
    wrap.appendChild(bar);

    const solved = solvedCount();
    const collected = CATS.filter((c) => catUnlocked(c, solved)).length;
    wrap.appendChild(
      el("div", "cats-progress", `${collected}/${CATS.length} bölgeye ulaşıldı`),
    );

    const canvas = el("div", "map-canvas");

    const vb = `0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`;
    const svg = el("div", "map-bg-svg");
    svg.innerHTML = `
<svg viewBox="${vb}" preserveAspectRatio="none" aria-hidden="true">
  <path d="${OUTLINE_PATH}" class="map-outline"/>
</svg>`.trim();
    canvas.appendChild(svg);

    const startPin = el("div", "map-pin map-pin-start");
    startPin.title = "Duman'ın yolculuğa başladığı yer: İstanbul";
    const startPos = percentPos(ISTANBUL_POS);
    startPin.style.left = startPos.left;
    startPin.style.top = startPos.top;
    const startAvatar = el("div", "cat-avatar-wrap map-pin-avatar");
    startAvatar.innerHTML = catAvatar(DUMAN, false);
    startPin.appendChild(startAvatar);
    canvas.appendChild(startPin);

    CATS.forEach((cat) => {
      const unlocked = catUnlocked(cat, solved);
      const pin = el("button", "map-pin" + (unlocked ? " unlocked" : " locked"));
      const pos = percentPos(regionPos(cat.region));
      pin.style.left = pos.left;
      pin.style.top = pos.top;
      const avatar = el("div", "cat-avatar-wrap map-pin-avatar");
      avatar.innerHTML = catAvatar(cat, !unlocked);
      pin.appendChild(avatar);
      pin.addEventListener("click", () => {
        if (unlocked) this.showCatDetail(cat);
        else toast(this.root, `${cat.region}: ${cat.unlockAt} bulmaca çözünce açılır`);
      });
      canvas.appendChild(pin);
    });

    wrap.appendChild(canvas);
    this.root.appendChild(wrap);
  }

  private showCatDetail(cat: CatDef): void {
    const overlay = el("div", "overlay");
    const modal = el("div", "modal cat-modal");
    const avatar = el("div", "cat-avatar-wrap cat-avatar-lg cat-idle");
    avatar.innerHTML = catFullBody(cat, false);
    modal.appendChild(avatar);
    modal.appendChild(el("h2", "modal-title", cat.name));
    modal.appendChild(el("div", "cat-modal-region", `${cat.region} · ${cat.breed}`));
    modal.appendChild(el("p", "modal-text", cat.lore));
    const btn = el("button", "modal-btn", "Kapat");
    btn.addEventListener("click", () => overlay.remove());
    modal.appendChild(btn);
    overlay.appendChild(modal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    this.root.appendChild(overlay);
  }

  // ---------- shop ----------

  private renderShop(): void {
    this.screen = "shop";
    this.root.innerHTML = "";
    const wrap = el("div", "home shop-screen");

    const bar = el("div", "topbar");
    bar.appendChild(el("div", "topbar-title", "Mağaza"));
    const balance = el("div", "shop-balance");
    balance.appendChild(el("span", "", "🃏"));
    balance.appendChild(el("span", "", String(jokerBalance())));
    bar.appendChild(balance);
    wrap.appendChild(bar);

    wrap.appendChild(
      el(
        "div",
        "shop-intro",
        "Jokerler, bir soruyu doğrudan açmak için kullanılır — günlük ücretsiz ipucun ve reklam hakkın bittiğinde devreye girer.",
      ),
    );

    const inviteCard = el("div", "invite-card");
    inviteCard.appendChild(el("div", "invite-icon", "🎁"));
    const inviteInfo = el("div", "invite-info");
    inviteInfo.appendChild(el("div", "invite-title", "Arkadaşını Davet Et"));
    inviteInfo.appendChild(
      el(
        "div",
        "invite-sub",
        "Arkadaşın ilk bulmacasını çözünce ikiniz de 3'er joker kazanır.",
      ),
    );
    inviteCard.appendChild(inviteInfo);
    const inviteBtn = el("button", "invite-btn", "Davet Et");
    inviteBtn.addEventListener("click", () => {
      void shareInvite().then((result) => {
        if (result === "shared") return;
        if (result === "copied") toast(this.root, "Davet linki panoya kopyalandı");
        else toast(this.root, "Davet sistemi şu an kullanılamıyor");
      });
    });
    inviteCard.appendChild(inviteBtn);
    wrap.appendChild(inviteCard);

    if (adsRemoved()) {
      const removedCard = el("div", "invite-card remove-ads-card owned");
      removedCard.appendChild(el("div", "invite-icon", "🚫📺"));
      const removedInfo = el("div", "invite-info");
      removedInfo.appendChild(el("div", "invite-title", "Reklamlar Kaldırıldı"));
      removedInfo.appendChild(
        el("div", "invite-sub", "Artık geçiş reklamı görmeyeceksin. Teşekkürler!"),
      );
      removedCard.appendChild(removedInfo);
      wrap.appendChild(removedCard);
    } else {
      const removeAdsCard = el("div", "invite-card remove-ads-card");
      removeAdsCard.appendChild(el("div", "invite-icon", "🚫📺"));
      const removeAdsInfo = el("div", "invite-info");
      removeAdsInfo.appendChild(el("div", "invite-title", "Reklamları Kaldır"));
      removeAdsInfo.appendChild(
        el(
          "div",
          "invite-sub",
          "Bulmaca aralarında çıkan geçiş reklamlarını tek seferlik satın alımla kalıcı olarak kapat.",
        ),
      );
      removeAdsCard.appendChild(removeAdsInfo);
      const removeAdsBtn = el(
        "button",
        "invite-btn",
        priceLabelFor(REMOVE_ADS_PRODUCT_ID, REMOVE_ADS_PRICE_LABEL),
      );
      removeAdsBtn.addEventListener("click", () => void this.buyRemoveAds(removeAdsCard));
      removeAdsCard.appendChild(removeAdsBtn);
      wrap.appendChild(removeAdsCard);
    }

    wrap.appendChild(el("div", "section-title", "Joker Al"));
    const grid = el("div", "shop-pack-grid");
    JOKER_PACKS.forEach((pack) => {
      const card = el("button", "shop-pack-card" + (pack.popular ? " popular" : ""));
      if (pack.popular) card.appendChild(el("div", "shop-pack-badge", "Popüler"));
      card.appendChild(el("div", "shop-pack-icon", "🃏"));
      card.appendChild(el("div", "shop-pack-count", `${pack.count} Joker`));
      card.appendChild(
        el("div", "shop-pack-price", priceLabelFor(pack.id, pack.priceLabel)),
      );
      card.addEventListener("click", () => void this.buyJokerPack(pack.id, card));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    this.root.appendChild(wrap);
    this.root.appendChild(this.renderBottomNav("shop"));

    // Prices should be in the player's own currency. The store response is
    // NOT awaited — the screen opens immediately with fallback labels, and
    // refreshes once when prices arrive if the user is still in the shop.
    if (!this.storePricesLoaded) {
      void loadStorePrices().then(() => {
        this.storePricesLoaded = true;
        if (this.screen === "shop") this.renderShop();
      });
    }
  }

  private async buyJokerPack(packId: string, card: HTMLElement): Promise<void> {
    card.classList.add("shop-pack-pending");
    const granted = await purchaseJokerPack(packId).catch(() => 0);
    if (granted > 0) {
      grantJokers(granted);
      this.renderShop();
      toast(this.root, `+${granted} 🃏 Joker eklendi!`);
    } else {
      card.classList.remove("shop-pack-pending");
      toast(this.root, "Satın alma tamamlanmadı");
    }
  }

  private async buyRemoveAds(card: HTMLElement): Promise<void> {
    card.classList.add("shop-pack-pending");
    const ok = await purchaseRemoveAds().catch(() => false);
    if (ok) {
      this.renderShop();
      toast(this.root, "Reklamlar kaldırıldı!");
    } else {
      card.classList.remove("shop-pack-pending");
      toast(this.root, "Satın alma tamamlanmadı");
    }
  }

  // ---------- settings ----------

  private renderSettings(): void {
    this.screen = "settings";
    this.root.innerHTML = "";
    const wrap = el("div", "home settings-screen");

    const bar = el("div", "topbar");
    bar.appendChild(el("div", "topbar-title", "Ayarlar"));
    wrap.appendChild(bar);

    const list = el("div", "settings-list");
    list.appendChild(
      this.settingsRow("🔊", "Sesler", soundEnabled(), () => {
        toggleSound();
        this.renderSettings();
      }),
    );
    list.appendChild(
      this.settingsRow("🎵", "Müzik", musicEnabled(), () => {
        toggleMusic();
        this.renderSettings();
      }),
    );
    list.appendChild(
      this.settingsRow("🎨", "Gazete teması", currentTheme() === "gazete", () => {
        toggleTheme();
        this.renderSettings();
      }),
    );
    wrap.appendChild(list);

    // Cloud save row; all logic lives in cloud-ui.ts (see the top of that file).
    wrap.appendChild(cloudSettingsRow(this.root));

    const storyBtn = el("button", "puzzle-card");
    const storyInfo = el("div", "puzzle-info");
    storyInfo.appendChild(el("div", "puzzle-title", "Hikayeyi tekrar oku"));
    storyBtn.appendChild(el("div", "puzzle-num", "📖"));
    storyBtn.appendChild(storyInfo);
    storyBtn.appendChild(el("div", "puzzle-badge", "›"));
    storyBtn.addEventListener("click", () => this.renderIntro(() => this.renderSettings()));
    wrap.appendChild(storyBtn);

    const howBtn = el("button", "puzzle-card");
    const howInfo = el("div", "puzzle-info");
    howInfo.appendChild(el("div", "puzzle-title", "Nasıl oynanır?"));
    howBtn.appendChild(el("div", "puzzle-num", "🎓"));
    howBtn.appendChild(howInfo);
    howBtn.appendChild(el("div", "puzzle-badge", "›"));
    howBtn.addEventListener("click", () =>
      this.startTutorial(() => this.renderSettings()),
    );
    wrap.appendChild(howBtn);

    this.root.appendChild(wrap);
    this.root.appendChild(this.renderBottomNav("settings"));
  }

  private settingsRow(icon: string, label: string, on: boolean, onToggle: () => void): HTMLElement {
    const row = el("button", "settings-row");
    row.appendChild(el("span", "settings-icon", icon));
    row.appendChild(el("span", "settings-label", label));
    row.appendChild(el("span", "settings-toggle" + (on ? " on" : ""), on ? "AÇIK" : "KAPALI"));
    row.addEventListener("click", onToggle);
    return row;
  }

  private openPuzzle(p: PuzzleDef): void {
    if (!isLoaded(p)) {
      // Content hasn't been downloaded in the background yet (see
      // puzzles/index.ts warmPuzzles); retries opening the same puzzle once
      // it's downloaded. If it's rejected (network error) the player is
      // notified so the tap doesn't silently do nothing; puzzles/index.ts
      // fill() no longer caches the failed promise, so the next tap retries.
      void ensureLoaded(p)
        .then(() => this.openPuzzle(p))
        .catch(() => toast(this.root, "Bulmaca indirilemedi, bağlantını kontrol edip tekrar dene"));
      return;
    }
    this.state = newGame(p);
    this.tutorialStep = null;
    this.clueFontCache.clear();
    // Keeps the resumed clue/cell if it came from saved progress; otherwise
    // (e.g. first open) selects the first empty clue so the player can start
    // typing right away
    if (!this.state.completed && this.state.activeClue === null) {
      const first = this.findClueWithEmptyCell(0);
      this.activateClue(first ?? 0);
    }
    this.renderGame();
  }

  /** Activates the clue, placing the cursor on the word's first empty cell */
  private activateClue(ci: number): void {
    const s = this.state!;
    s.activeClue = ci;
    const cells = s.grid.cluePlacements[ci];
    const target =
      cells.find(
        (p) => s.entries[p.row * s.grid.cols + p.col] === "",
      ) ?? cells[0];
    s.selRow = target.row;
    s.selCol = target.col;
  }

  /** First clue (starting from and including `from`) that has an empty cell */
  private findClueWithEmptyCell(from: number): number | null {
    const s = this.state!;
    const n = s.puzzle.clues.length;
    for (let i = 0; i < n; i++) {
      const ci = (from + i) % n;
      const hasEmpty = s.grid.cluePlacements[ci].some(
        (p) => s.entries[p.row * s.grid.cols + p.col] === "",
      );
      if (hasEmpty) return ci;
    }
    return null;
  }

  /** Moves from the active clue to the next/previous clue */
  private stepClue(dir: 1 | -1): void {
    const s = this.state!;
    const n = s.puzzle.clues.length;
    const from = s.activeClue ?? 0;
    this.activateClue((from + dir + n) % n);
    this.refresh();
  }

  /** Are all of the word's cells filled with the correct letter? */
  private isWordCorrect(ci: number): boolean {
    return isWordSolved(this.state!, ci);
  }

  /**
   * Runs a move; if the puzzle got completed by this move, triggers the
   * celebration effect and refreshes the screen. If it wasn't completed
   * (e.g. handleType's word-correct flash), calls `onNotCompleted` —
   * the win/no-win branches are kept in ONE place so a future change to
   * this sequence (reward/cat/referral) doesn't get applied to one copy
   * and forgotten in the other.
   */
  private withWinCheck(action: () => void, onNotCompleted?: () => void): void {
    const s = this.state!;
    const wasCompleted = s.completed;
    const alreadySolved = isSolvedPuzzle(s.puzzle.id);
    const wasFirstEverSolve = solvedCount() === 0;
    action();
    if (!wasCompleted && s.completed) {
      playWin();
      hapticWin();
      this.registerCatUnlock(alreadySolved);
      if (wasFirstEverSolve) void claimFirstPuzzleReferralReward();
    } else {
      onNotCompleted?.();
    }
    this.renderGame();
  }

  /**
   * Records the celebration and whether the journey is complete if this
   * completion crossed a new cat threshold. Re-solving an already-solved
   * puzzle doesn't increment the counter, so it doesn't unlock a cat.
   */
  private registerCatUnlock(alreadySolved: boolean): void {
    const solved = solvedCount();
    this.justUnlockedCat = alreadySolved ? null : catUnlockedAt(solved) ?? null;
    if (this.justUnlockedCat !== null) {
      playCatUnlock();
      grantJokers(CAT_UNLOCK_REWARD);
    }
    this.journeyJustCompleted =
      this.justUnlockedCat !== null &&
      !epilogueSeen() &&
      allCatsUnlocked(solved);
  }

  /**
   * Letter input: if this letter completes the word correctly, celebrates
   * with a brief green flash and moves to the next empty clue.
   */
  private handleType(key: string): void {
    const s = this.state!;
    this.markPop();
    const prevClue = s.activeClue;
    if (s.practice) {
      // tutorial: no celebration/cat/reward flow, and the tutorial advances
      // to the next clue through its own step logic
      typeLetter(s, key);
      if (prevClue !== null && this.isWordCorrect(prevClue)) {
        playCorrect();
        this.flashClue = prevClue;
      }
      this.refresh();
      return;
    }
    this.withWinCheck(
      () => typeLetter(s, key),
      () => {
        if (prevClue !== null && this.isWordCorrect(prevClue)) {
          playCorrect();
          this.flashClue = prevClue;
          const next = this.findClueWithEmptyCell(prevClue + 1);
          if (next !== null) this.activateClue(next);
        }
      },
    );
  }

  // ---------- game screen ----------

  private renderGame(): void {
    const s = this.state!;
    this.screen = "game";
    this.root.innerHTML = "";

    const wrap = el("div", "game");

    const bar = el("div", "topbar");
    const back = el("button", "icon-btn");
    back.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 L9 12 L15 6"/></svg>`;
    back.setAttribute("aria-label", "Ana menü");
    back.addEventListener("click", () => {
      this.state = null;
      this.renderHome();
    });
    bar.appendChild(back);
    bar.appendChild(el("div", "topbar-title", s.puzzle.title));
    const actions = el("div", "topbar-actions");
    const checkBtn = el("button", "action-btn", "Kontrol");
    checkBtn.addEventListener("click", () => {
      const wrong = checkEntries(s);
      if (wrong === 0) {
        playCorrect();
      } else {
        playWrong();
        hapticWrong();
      }
      this.renderGame();
      if (wrong === 0) toast(this.root, "Dolu hücrelerin hepsi doğru!");
      else toast(this.root, `${wrong} yanlış harf işaretlendi`);
    });
    const freeHints = freeHintsRemainingToday();
    const jokers = jokerBalance();
    const revealBtn = el(
      "button",
      "action-btn",
      freeHints > 0
        ? `İpucu (${freeHints})`
        : jokers > 0
          ? `🃏 İpucu (${jokers})`
          : "🎬 İpucu",
    );
    revealBtn.title =
      freeHints > 0
        ? "Seçili hücrenin harfini aç"
        : jokers > 0
          ? "Bir joker harcayarak seçili hücrenin harfini aç"
          : "Ücretsiz ipucu ve joker bitti — reklam izleyerek bir ipucu daha aç";
    // a hint is only charged if it actually revealed a letter: if the
    // selected cell is already correct (e.g. a locked intersection letter),
    // no free hint/joker is spent
    const tryReveal = (charge: () => void): void => {
      let revealed = false;
      this.withWinCheck(() => {
        revealed = revealLetter(s);
        if (revealed) charge(); // charge is deducted before the screen refreshes
      });
      if (!revealed) toast(this.root, "Bu soruda açılacak harf kalmadı");
    };
    revealBtn.addEventListener("click", () => {
      if (freeHints > 0) {
        tryReveal(consumeFreeHint);
        return;
      }
      if (jokers > 0) {
        tryReveal(spendJoker);
        return;
      }
      (revealBtn as HTMLButtonElement).disabled = true;
      revealBtn.textContent = "Reklam yükleniyor…";
      showRewardedHintAd()
        .catch(() => false)
        .then((earned) => {
          if (this.state !== s) return; // player navigated away in the meantime
          if (earned) {
            tryReveal(() => {});
          } else {
            this.renderGame();
            toast(this.root, "Reklam tamamlanmadı, ipucu açılmadı");
          }
        });
    });
    actions.appendChild(checkBtn);
    actions.appendChild(revealBtn);
    if (freeHints === 0 && jokers === 0) {
      const shopChip = el("button", "joker-cta-chip", "Joker al");
      shopChip.addEventListener("click", () => this.renderShop());
      actions.appendChild(shopChip);
    }
    bar.appendChild(actions);
    wrap.appendChild(bar);

    const gridWrap = el("div", "grid-wrap");
    gridWrap.appendChild(this.renderGrid());
    wrap.appendChild(gridWrap);
    wrap.appendChild(this.renderPanel());
    wrap.appendChild(this.renderKeyboard());
    this.root.appendChild(wrap);

    this.sizeGrid();
    this.fitClueTexts();

    if (s.completed) this.showCompleted();
  }

  // ---------- tutorial ----------

  /**
   * Starts the tutorial: the mini puzzle is set up in "practice" mode (save
   * data and stats are untouched). There's no exit other than the "Skip"
   * button in the top bar, so the player can't accidentally abandon it
   * halfway.
   */
  private startTutorial(done: () => void): void {
    this.state = newGame(TUTORIAL_PUZZLE, { practice: true });
    this.tutorialDone = done;
    this.tutorialStep = 0;
    this.clueFontCache.clear();
    this.renderTutorial();
  }

  /** Permanently marks the tutorial as finished and returns to the caller. */
  private finishTutorial(): void {
    const done = this.tutorialDone ?? (() => this.renderHome());
    markTutorialSeen();
    this.state = null;
    this.tutorialStep = null;
    this.tutorialDone = null;
    this.clueFontCache.clear();
    done();
  }

  /** Re-renders the active screen (game or tutorial). */
  private refresh(): void {
    if (this.tutorialStep !== null) this.renderTutorial();
    else this.renderGame();
  }

  /** Skips past steps whose condition is met; this is how the tutorial advances. */
  private advanceTutorial(): void {
    const s = this.state!;
    while (this.tutorialStep! < TUTORIAL_STEPS.length) {
      const step = TUTORIAL_STEPS[this.tutorialStep!];
      if (!step.done || !step.done(s)) break;
      this.tutorialStep!++;
    }
  }

  private renderTutorial(): void {
    const s = this.state!;
    this.advanceTutorial();
    const step = TUTORIAL_STEPS[this.tutorialStep!];
    if (!step) {
      this.finishTutorial();
      return;
    }

    this.root.innerHTML = "";
    const wrap = el("div", "game tutorial-game");

    const bar = el("div", "topbar");
    bar.appendChild(el("div", "topbar-title", "Nasıl oynanır?"));
    // The tutorial's exit door. Without it, the tutorial was an
    // impassable wall on first launch: the Android back button kicked the
    // player out of the app, and since the "seen" flag is only written once
    // the tutorial is COMPLETED, a player who left would restart from step 1
    // every time. Skipping is harmless because the tutorial can be replayed
    // anytime via Settings → "How to play?".
    const skipBtn = el("button", "tutorial-skip", "Geç");
    skipBtn.addEventListener("click", () => {
      this.finishTutorial();
      toast(this.root, "Rehberi Ayarlar → Nasıl oynanır? ile tekrar açabilirsin");
    });
    bar.appendChild(skipBtn);
    const actions = el("div", "topbar-actions");
    const checkBtn = el("button", "action-btn", "Kontrol");
    checkBtn.addEventListener("click", () => {
      const wrong = checkEntries(s);
      if (wrong === 0) playCorrect();
      else {
        playWrong();
        hapticWrong();
      }
      this.renderTutorial();
      toast(
        this.root,
        wrong === 0 ? "Dolu hücrelerin hepsi doğru!" : `${wrong} yanlış harf işaretlendi`,
      );
    });
    // hints are free in the tutorial: neither the daily allowance nor a joker is spent
    const revealBtn = el("button", "action-btn", "İpucu");
    revealBtn.addEventListener("click", () => {
      revealLetter(s);
      playCorrect();
      this.renderTutorial();
    });
    actions.appendChild(checkBtn);
    actions.appendChild(revealBtn);
    bar.appendChild(actions);
    wrap.appendChild(bar);

    // in steps waiting for a move, the instruction sits above the board;
    // in narration steps it comes as a blocking modal instead (below)
    if (!step.cta) wrap.appendChild(this.tutorialCoach(step.text));

    const gridWrap = el("div", "grid-wrap");
    gridWrap.appendChild(this.renderGrid());
    wrap.appendChild(gridWrap);
    wrap.appendChild(this.renderPanel());
    wrap.appendChild(this.renderKeyboard());
    this.root.appendChild(wrap);

    this.sizeGrid();
    this.fitClueTexts();

    if (step.cta) this.showTutorialModal(step);
  }

  /** Duman's instruction bubble (above the board, in steps waiting for a move). */
  private tutorialCoach(text: string): HTMLElement {
    const coach = el("div", "tutorial-coach");
    const avatar = el("div", "cat-avatar-wrap cat-avatar-mini");
    avatar.innerHTML = catAvatar(DUMAN, false);
    coach.appendChild(avatar);
    const body = el("div", "tutorial-coach-body");
    body.appendChild(el("p", "tutorial-coach-text", text));
    coach.appendChild(body);
    return coach;
  }

  /**
   * Narration step: a modal that dims the board and blocks all input.
   * The player can't return to the game without pressing the continue
   * button.
   */
  private showTutorialModal(step: TutorialStep): void {
    const overlay = el("div", "overlay tut-overlay");
    const modal = el("div", "modal tut-modal");
    const avatar = el("div", "cat-avatar-wrap cat-avatar-lg");
    avatar.innerHTML = catFullBody(DUMAN, false);
    modal.appendChild(avatar);
    modal.appendChild(
      el(
        "div",
        "tut-modal-progress",
        `Adım ${this.tutorialStep! + 1}/${TUTORIAL_STEPS.length}`,
      ),
    );
    modal.appendChild(el("p", "modal-text", step.text));
    if (step.highlightTools) {
      // the modal dims the board; the two tools being explained are shown
      // here as an example
      const demo = el("div", "tut-tool-demo");
      demo.appendChild(el("span", "action-btn", "Kontrol"));
      demo.appendChild(el("span", "action-btn", "İpucu"));
      modal.appendChild(demo);
    }
    const btn = el("button", "modal-btn", step.cta!);
    btn.addEventListener("click", () => {
      this.tutorialStep!++;
      if (this.tutorialStep! >= TUTORIAL_STEPS.length) this.finishTutorial();
      else this.renderTutorial();
    });
    modal.appendChild(btn);
    overlay.appendChild(modal);
    this.root.appendChild(overlay);
  }

  /**
   * The tutorial's move filter: any input other than what the step
   * requires (switching cells, changing clues…) is ignored, and the player
   * is gently redirected to the target. This is what makes the tutorial
   * "mandatory".
   */
  private tutorialBlocks(kind: "cell" | "key", row?: number, col?: number): boolean {
    if (this.tutorialStep === null) return false;
    const step = TUTORIAL_STEPS[this.tutorialStep];
    if (!step || step.cta) return true; // narration step: board is closed
    if (kind === "key") {
      if (!step.target) return false;
      toast(this.root, "Önce ışıldayan yere dokun 🐾");
      return true;
    }
    if (!step.target) {
      toast(this.root, "Şimdilik klavyeden yazman yeterli 🐾");
      return true;
    }
    if (step.target.row === row && step.target.col === col) return false;
    toast(this.root, "Işıldayan kutuya dokun 🐾");
    return true;
  }

  /**
   * Computes the grid's width based on the actual free space .grid-wrap has
   * (the real width+height left over after the keyboard/panel/topbar).
   * Since every cell has aspect-ratio:1, height derives automatically from
   * width, so the only variable is finding the right width. Using a real
   * measurement instead of estimating a fixed "margin" lets the cells grow
   * as large as possible depending on the device/situation.
   */
  private sizeGrid(): void {
    const s = this.state;
    if (!s) return;
    const wrap = this.root.querySelector<HTMLElement>(".grid-wrap");
    const grid = this.root.querySelector<HTMLElement>(".grid");
    if (!wrap || !grid) return;
    const availW = wrap.clientWidth;
    const availH = wrap.clientHeight;
    if (availW <= 0 || availH <= 0) return;
    const widthForHeight = (availH * s.grid.cols) / s.grid.rows;
    const width = Math.max(0, Math.min(availW, widthForHeight));
    grid.style.width = `${width}px`;
  }

  /**
   * Shrinks clue text until it fits its cell. All clues in a cell use the
   * same font size; since part heights are distributed based on content, a
   * longer clue claims more space for itself. The resulting font sizes are
   * cached, so the measurement isn't repeated on later renders.
   */
  private fitClueTexts(): void {
    const grid = this.root.querySelector<HTMLElement>(".grid");
    if (!grid) return;
    if (grid.clientWidth !== this.clueFontWidth) {
      this.clueFontCache.clear();
      this.clueFontWidth = grid.clientWidth;
    }
    for (const cellEl of grid.querySelectorAll<HTMLElement>(".clue-cell")) {
      const texts: HTMLElement[] = [];
      const keys: string[] = [];
      let allCached = true;
      for (const part of cellEl.querySelectorAll<HTMLElement>(".clue-part")) {
        const text = part.querySelector<HTMLElement>(".clue-text");
        const key = part.dataset.fitKey;
        if (!text || !key) continue;
        texts.push(text);
        keys.push(key);
        if (!this.clueFontCache.has(key)) allCached = false;
      }
      // cached font sizes were already applied during render; skip remeasuring
      if (texts.length === 0 || allCached) continue;

      // reset any leftover fixed font sizes if the screen width changed
      for (const t of texts) {
        t.style.fontSize = "";
        applyClueScale(t, 1);
        t.classList.add("fitting");
      }
      // A word that is too wide to wrap only overflows the line box, which
      // scrollWidth does not report, so the widest word of each clue is
      // measured on its own with an off-screen probe.
      const probe = el("span", "clue-text clue-fit-probe");
      grid.appendChild(probe);
      const overflows = () =>
        texts.some((t) => {
          const part = t.parentElement!;
          const ps = getComputedStyle(part);
          const availH =
            part.clientHeight -
            parseFloat(ps.paddingTop) -
            parseFloat(ps.paddingBottom);
          const availW =
            part.clientWidth -
            parseFloat(ps.paddingLeft) -
            parseFloat(ps.paddingRight);
          probe.style.fontSize = t.style.fontSize;
          probe.textContent = widestWord(t);
          return (
            t.scrollHeight > availH + 0.5 ||
            t.scrollWidth > availW + 0.5 ||
            probe.getBoundingClientRect().width > availW + 0.5
          );
        });
      const apply = (size: number) => {
        for (const t of texts) t.style.fontSize = `${size}px`;
      };
      // If the cell is large, the CSS starting font size (tuned assuming a
      // small screen) could end up needlessly small — so we always start
      // from a fixed, sufficiently large ceiling and shrink until it fits.
      // This way clue text actually grows as the grid grows, and only
      // shrinks on small cells.
      let size = 22;
      apply(size);
      while (size > MIN_CLUE_FONT && overflows()) {
        size -= 0.5;
        apply(size);
      }
      // Android WebView refuses to render text below its minimum font size
      // (8px by default), so on small grids the loop can bottom out while the
      // text still overflows. The remainder is taken out with a transform,
      // which that minimum does not apply to.
      const scale = overflows() ? this.clueTextScale(texts, probe) : 1;
      for (const t of texts) applyClueScale(t, scale);
      probe.remove();
      for (const t of texts) t.classList.remove("fitting");
      for (const key of keys) this.clueFontCache.set(key, `${size}px ${scale}`);
    }
  }

  /**
   * How much the clue text still has to be scaled down after the font size hit
   * the renderer's minimum: the widest ratio between what the text needs and
   * what its cell offers.
   */
  private clueTextScale(texts: HTMLElement[], probe: HTMLElement): number {
    let needed = 1;
    for (const t of texts) {
      const part = t.parentElement!;
      const ps = getComputedStyle(part);
      const availH =
        part.clientHeight - parseFloat(ps.paddingTop) - parseFloat(ps.paddingBottom);
      const availW =
        part.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight);
      probe.style.fontSize = getComputedStyle(t).fontSize;
      probe.textContent = widestWord(t);
      const wordW = probe.getBoundingClientRect().width;
      if (availW > 0) needed = Math.max(needed, t.scrollWidth / availW, wordW / availW);
      if (availH > 0) needed = Math.max(needed, t.scrollHeight / availH);
    }
    return Math.max(0.4, Math.min(1, 1 / needed));
  }

  /** Refreshes the grid width and clue font sizes when the window is resized */
  private refitClueTexts(): void {
    this.sizeGrid();
    this.clueFontCache.clear();
    this.clueFontWidth = 0;
    this.fitClueTexts();
  }

  private renderGrid(): HTMLElement {
    const s = this.state!;
    const grid = el("div", "grid");
    grid.style.setProperty("--cols", String(s.grid.cols));
    grid.style.setProperty("--rows", String(s.grid.rows));

    const activeCells = new Set<number>();
    if (s.activeClue !== null) {
      for (const p of s.grid.cluePlacements[s.activeClue]) {
        activeCells.add(p.row * s.grid.cols + p.col);
      }
    }
    const flashCells = new Set<number>();
    if (this.flashClue !== null) {
      for (const p of s.grid.cluePlacements[this.flashClue]) {
        flashCells.add(p.row * s.grid.cols + p.col);
      }
    }

    // each answer's starting cell: the arrow is drawn there (classic look)
    const starts = new Map<number, number[]>();
    s.puzzle.clues.forEach((_, ci) => {
      const p = s.grid.cluePlacements[ci][0];
      const idx = p.row * s.grid.cols + p.col;
      starts.set(idx, [...(starts.get(idx) ?? []), ci]);
    });

    // the current tutorial step's "tap here" target
    const target =
      this.tutorialStep !== null
        ? TUTORIAL_STEPS[this.tutorialStep]?.target
        : undefined;

    // cells of correctly completed words stay permanently green
    const doneCells = new Set<number>();
    s.puzzle.clues.forEach((_, ci) => {
      if (!this.isWordCorrect(ci)) return;
      for (const p of s.grid.cluePlacements[ci]) {
        doneCells.add(p.row * s.grid.cols + p.col);
      }
    });

    for (const cell of s.grid.cells) {
      const i = cell.row * s.grid.cols + cell.col;
      const isTarget = target?.row === cell.row && target?.col === cell.col;
      if (cell.kind === "clue") {
        const div = el("div", "cell clue-cell");
        if (isTarget) div.classList.add("tut-target");
        if (cell.clueIndexes.length === 0) div.classList.add("block-cell");
        if (
          s.activeClue !== null &&
          cell.clueIndexes.includes(s.activeClue)
        ) {
          div.classList.add("clue-active");
        }
        if (cell.clueIndexes.length > 1) div.classList.add("clue-split");
        for (const ci of cell.clueIndexes) {
          const clue = s.puzzle.clues[ci];
          const part = el("div", "clue-part");
          part.dataset.fitKey = `${i}:${ci}`;
          if (s.activeClue === ci) part.classList.add("clue-part-active");
          const text = el("span", "clue-text", clue.text);
          text.classList.add(sizeClass(clue.text));
          const cached = this.clueFontCache.get(part.dataset.fitKey);
          if (cached) {
            const [size, scale] = cached.split(" ");
            text.style.fontSize = size;
            applyClueScale(text, Number(scale));
          }
          part.appendChild(text);
          const selectClue = () => {
            if (this.tutorialBlocks("cell", cell.row, cell.col)) return;
            this.activateClue(ci);
            this.refresh();
          };
          part.addEventListener("click", selectClue);
          div.appendChild(part);
        }
        grid.appendChild(div);
      } else {
        const div = el("div", "cell letter-cell");
        if (isTarget) div.classList.add("tut-target");
        if (activeCells.has(i)) div.classList.add("in-active-word");
        if (s.selRow === cell.row && s.selCol === cell.col) {
          div.classList.add("selected");
        }
        if (s.wrongCells.has(i)) div.classList.add("wrong");
        if (s.completed) {
          div.classList.add("won");
          // celebration wave spreading from top-left to bottom-right
          div.style.animationDelay = `${(cell.row + cell.col) * 45}ms`;
        }
        if (this.popIdx === i && s.entries[i] !== "") div.classList.add("pop-in");
        if (flashCells.has(i) && !s.completed) div.classList.add("word-flash");
        if (doneCells.has(i) && !s.completed) div.classList.add("word-done");
        div.appendChild(el("span", "cell-letter", s.entries[i]));
        // arrows for answers starting at this cell (in the corner, classic look)
        for (const ci of starts.get(i) ?? []) {
          const arrow = el("span", `cell-arrow arrow-${s.puzzle.clues[ci].arrow}`);
          if (s.activeClue === ci) arrow.classList.add("arrow-active");
          arrow.innerHTML = ARROW_SVG[s.puzzle.clues[ci].arrow];
          div.appendChild(arrow);
        }
        div.addEventListener("click", () => {
          if (this.tutorialBlocks("cell", cell.row, cell.col)) return;
          selectCell(s, cell.row, cell.col);
          this.refresh();
        });
        grid.appendChild(div);
      }
    }
    this.popIdx = null;
    this.flashClue = null;
    return grid;
  }

  /**
   * Answer panel: the active clue's text in large type, with the word's
   * letter boxes below it. Lets the player solve without staring at the
   * small text on the grid.
   */
  private renderPanel(): HTMLElement {
    const s = this.state!;
    const panel = el("div", "panel");

    const top = el("div", "panel-top");
    const prev = el("button", "panel-nav");
    prev.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 L9 12 L15 6"/></svg>`;
    prev.setAttribute("aria-label", "Önceki soru");
    prev.addEventListener("click", () => {
      if (this.tutorialBlocks("cell")) return;
      this.stepClue(-1);
    });
    const next = el("button", "panel-nav");
    next.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18 L15 12 L9 6"/></svg>`;
    next.setAttribute("aria-label", "Sonraki soru");
    next.addEventListener("click", () => {
      if (this.tutorialBlocks("cell")) return;
      this.stepClue(1);
    });

    const mid = el("div", "panel-clue");
    if (s.activeClue !== null) {
      const clue = s.puzzle.clues[s.activeClue];
      const ar = el("span", "panel-arrow");
      ar.innerHTML = ARROW_SVG[clue.arrow];
      mid.appendChild(ar);
      mid.appendChild(el("span", "panel-text", clue.text));
    } else {
      mid.appendChild(el("span", "panel-hint", "Bir soruya dokun"));
    }

    top.appendChild(prev);
    top.appendChild(mid);
    top.appendChild(next);
    panel.appendChild(top);

    if (s.activeClue !== null) {
      const slots = el("div", "panel-slots");
      for (const p of s.grid.cluePlacements[s.activeClue]) {
        const i = p.row * s.grid.cols + p.col;
        const slot = el("div", "slot", s.entries[i]);
        if (s.entries[i] !== "") slot.classList.add("slot-filled");
        if (s.selRow === p.row && s.selCol === p.col) {
          slot.classList.add("slot-current");
        }
        if (s.wrongCells.has(i)) slot.classList.add("slot-wrong");
        // panel slots are always within the active word: tapping moves
        // the cursor, it doesn't change direction
        slot.addEventListener("click", () => {
          moveCursorInActiveClue(s, p.row, p.col);
          this.refresh();
        });
        slots.appendChild(slot);
      }
      panel.appendChild(slots);
    }

    return panel;
  }

  /** Marks the selected cell's grid index for the pop animation */
  private markPop(): void {
    const s = this.state;
    if (s && s.selRow !== null && s.selCol !== null) {
      this.popIdx = s.selRow * s.grid.cols + s.selCol;
    }
  }

  private renderKeyboard(): HTMLElement {
    const s = this.state!;
    const kb = el("div", "keyboard");
    for (const row of KEY_ROWS) {
      const rowEl = el("div", "kb-row");
      for (const key of row) {
        const btn = el("button", "kb-key", key);
        if (key === "⌫") {
          btn.classList.add("kb-backspace");
          btn.addEventListener("click", () => {
            if (this.tutorialBlocks("key")) return;
            playKey();
            hapticKey();
            backspace(s);
            this.refresh();
          });
        } else {
          btn.addEventListener("click", () => {
            if (this.tutorialBlocks("key")) return;
            playKey();
            hapticKey();
            this.handleType(key);
          });
        }
        rowEl.appendChild(btn);
      }
      kb.appendChild(rowEl);
    }
    return kb;
  }

  /**
   * Shared behavior for the exit buttons on the celebration screen
   * (showCompleted): tries an interstitial ad, then navigates to the target
   * screen. The ad is deliberately triggered AFTER the celebration
   * (confetti/reward) has already been FULLY shown to the player, as they're
   * leaving the screen — to follow AdMob's rule of showing ads "at a
   * natural break point, not during or immediately around active gameplay".
   * showCompleted is never called in tutorial (practice) mode anyway, but
   * the guard is kept here deliberately too, so an ad never accidentally
   * shows during the tutorial.
   */
  private leaveCompletedScreen(next: () => void): void {
    if (!this.state?.practice) void maybeShowInterstitial();
    next();
  }

  private showCompleted(): void {
    const cat = this.justUnlockedCat;
    const journeyCompleted = this.journeyJustCompleted;
    this.justUnlockedCat = null;
    this.journeyJustCompleted = false;
    const overlay = el("div", "overlay");
    overlay.appendChild(makeConfetti());
    const modal = el("div", "modal");
    if (cat) {
      const avatar = el("div", "cat-avatar-wrap cat-avatar-lg cat-reveal-pop");
      avatar.innerHTML = catFullBody(cat, false);
      modal.appendChild(avatar);
      modal.appendChild(el("div", "cat-reveal-tag", "Yeni bekçi kedi!"));
      modal.appendChild(el("h2", "modal-title", cat.name));
      modal.appendChild(
        el("div", "cat-modal-region", `${cat.region} · ${cat.breed}`),
      );
      modal.appendChild(el("p", "modal-text", cat.lore));
      modal.appendChild(
        el("div", "cat-reward-line", `+${CAT_UNLOCK_REWARD} 🃏 Joker!`),
      );
    } else {
      modal.appendChild(el("div", "modal-emoji", "🎉"));
      modal.appendChild(el("h2", "modal-title", "Tebrikler!"));
      modal.appendChild(el("p", "modal-text", "Bulmacayı başarıyla tamamladın."));
      const next = nextLockedCat(solvedCount());
      if (next) {
        const left = next.unlockAt - solvedCount();
        const line = el("div", "modal-cat-next");
        const mini = el("span", "cat-avatar-wrap cat-avatar-mini");
        mini.innerHTML = catAvatar(next, true);
        line.appendChild(mini);
        line.appendChild(
          el(
            "span",
            "",
            left === 1
              ? "Sıradaki bekçi kedi bir bulmaca sonra!"
              : `Sıradaki bekçi kediye ${left} bulmaca kaldı`,
          ),
        );
        modal.appendChild(line);
      }
    }
    const streak = currentStreak();
    if (streak > 0) {
      const line = el("div", "modal-streak");
      line.appendChild(el("span", "streak-flame", "🔥"));
      line.appendChild(
        el("span", "", `${streak} günlük seri`),
      );
      modal.appendChild(line);
    }
    if (journeyCompleted) {
      const epilogueBtn = el("button", "modal-btn modal-share", "Hikayenin sonu");
      epilogueBtn.addEventListener("click", () => {
        overlay.remove();
        this.leaveCompletedScreen(() => this.renderEpilogue(() => this.renderHome()));
      });
      modal.appendChild(epilogueBtn);
    } else if (cat) {
      const catsBtn = el("button", "modal-btn modal-share", "Kedi Dostlarım'ı gör");
      catsBtn.addEventListener("click", () =>
        this.leaveCompletedScreen(() => this.renderCollection()),
      );
      modal.appendChild(catsBtn);
    }
    const shareBtn = el("button", "modal-btn modal-share", "Sonucu paylaş");
    shareBtn.addEventListener("click", () => void this.shareResult());
    modal.appendChild(shareBtn);
    const btn = el("button", "modal-btn", "Ana menüye dön");
    btn.addEventListener("click", () => {
      this.leaveCompletedScreen(() => {
        this.state = null;
        this.renderHome();
      });
    });
    modal.appendChild(btn);
    overlay.appendChild(modal);
    this.root.appendChild(overlay);
  }

  /** Shares the result via the system share menu, or copies it to the clipboard as a fallback. */
  private async shareResult(): Promise<void> {
    const s = this.state;
    if (!s) return;
    const streak = currentStreak();
    const diff = s.puzzle.difficulty ? ` · ${capitalizeTr(s.puzzle.difficulty)}` : "";
    const lines = [
      "Çengel Bulmaca 🧩",
      `${s.puzzle.title} (${s.puzzle.cols}×${s.puzzle.rows}${diff}) çözüldü ✅`,
    ];
    if (streak > 1) lines.push(`🔥 ${streak} günlük seri`);
    const text = lines.join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast(this.root, "Sonuç panoya kopyalandı");
    } catch {
      // silently return if the user canceled the share
    }
  }

  /** Physical keyboard support (for desktop testing) */
  attachPhysicalKeyboard(): void {
    window.addEventListener("keydown", (e) => {
      const s = this.state;
      if (!s) return;
      if (e.key === "Backspace") {
        if (this.tutorialBlocks("key")) return;
        backspace(s);
        this.refresh();
        e.preventDefault();
      } else if (/^[a-zA-ZçÇğĞıİöÖşŞüÜ]$/.test(e.key)) {
        if (this.tutorialBlocks("key")) return;
        this.handleType(e.key);
        e.preventDefault();
      }
    });
  }

  /**
   * Android back button/gesture.
   *
   * This behavior didn't exist before: since no plugin was installed to
   * intercept the back button, the player exited the app entirely on back
   * no matter WHERE they were — mid-puzzle, in the shop, in settings.
   *
   * Priority order, from the innermost layer outward:
   *   1. If a modal is open, close only that.
   *   2. If the tutorial is running, do nothing (it has its own "Skip").
   *   3. From any screen other than home, return to home.
   *   4. On the home screen: require pressing twice to prevent accidental exit.
   *
   * @returns true if the app should be exited
   */
  handleBack(): boolean {
    const overlays = this.root.querySelectorAll(".overlay");
    if (overlays.length > 0) {
      const top = overlays[overlays.length - 1];
      // The tutorial's narration modal is deliberately blocking — it can't
      // be closed with the back button either, so a step can't be skipped.
      if (!top.classList.contains("tut-overlay")) top.remove();
      return false;
    }
    if (this.tutorialStep !== null) return false;
    if (this.screen !== "home") {
      this.renderHome();
      return false;
    }
    const now = Date.now();
    if (now < this.exitArmedUntil) return true;
    this.exitArmedUntil = now + 2000;
    toast(this.root, "Çıkmak için tekrar geri tuşuna bas");
    return false;
  }
}

function statCard(icon: string, value: string, label: string): HTMLElement {
  const card = el("div", "stat-card");
  card.appendChild(el("div", "stat-icon", icon));
  const col = el("div", "stat-col");
  col.appendChild(el("div", "stat-value", value));
  col.appendChild(el("div", "stat-label", label));
  card.appendChild(col);
  return card;
}

const CONFETTI_COLORS = [
  "#5f5af0",
  "#a75bdd",
  "#f5b83d",
  "#2fa96e",
  "#e5484d",
  "#4cc3ff",
];

function makeConfetti(count = 42): HTMLElement {
  const box = el("div", "confetti");
  for (let i = 0; i < count; i++) {
    const piece = el("span", "confetti-piece");
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDelay = `${Math.random() * 1.4}s`;
    piece.style.animationDuration = `${2.4 + Math.random() * 1.8}s`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const w = 6 + Math.random() * 6;
    piece.style.width = `${w}px`;
    piece.style.height = `${w * (0.5 + Math.random())}px`;
    box.appendChild(piece);
  }
  return box;
}

function capitalizeTr(s: string): string {
  return s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1);
}

/** Time-of-day greeting, in Turkish (used in Duman's greeting on the home menu). */
function timeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "Günaydın";
  if (h >= 11 && h < 18) return "İyi günler";
  if (h >= 18 && h < 23) return "İyi akşamlar";
  return "İyi geceler";
}

/**
 * Scales a clue text down without letting its own box shrink with it: the box
 * is widened by the same factor first, so the scaled text still gets the full
 * width of the cell to wrap in instead of being clipped by its own edge.
 */
function applyClueScale(text: HTMLElement, scale: number): void {
  if (scale >= 1) {
    text.style.transform = "";
    text.style.width = "";
    text.style.flex = "";
    return;
  }
  text.style.transform = `scale(${scale})`;
  text.style.width = `${(100 / scale).toFixed(2)}%`;
  text.style.flex = "none";
}

/** The longest word of a clue: the part that decides whether it can wrap. */
function widestWord(t: HTMLElement): string {
  let widest = "";
  for (const w of (t.textContent ?? "").split(/\s+/))
    if (w.length > widest.length) widest = w;
  return widest;
}

/**
 * Floor of the font-size search. Android WebView clamps rendered text to a
 * minimum size (8px by default), so shrinking past it changes nothing.
 */
const MIN_CLUE_FONT = 8;

function sizeClass(text: string): string {
  if (text.length <= 12) return "clue-md";
  if (text.length <= 24) return "clue-sm";
  return "clue-xs";
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

let toastTimer: number | undefined;
function toast(root: HTMLElement, msg: string): void {
  root.querySelector(".toast")?.remove();
  const t = el("div", "toast", msg);
  root.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.remove(), 2200);
}
