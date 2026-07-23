import {
  backspace,
  checkEntries,
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
import { maybeShowInterstitial, shouldShowInterstitial, showRewardedHintAd } from "./ads.ts";
import { consumeFreeHint, freeHintsRemainingToday } from "./hints.ts";
import { CAT_UNLOCK_REWARD, grantJokers, jokerBalance, spendJoker } from "./economy.ts";
import { JOKER_PACKS, purchaseJokerPack } from "./billing.ts";
import { musicEnabled, toggleMusic } from "./music.ts";
import { currentTheme, toggleTheme } from "./theme.ts";
import type { ArrowDir, PuzzleDef } from "./types.ts";
import {
  CATS,
  DUMAN,
  allCatsUnlocked,
  catUnlocked,
  catUnlockedAt,
  nextLockedCat,
  type CatDef,
} from "./cats.ts";
import { catAvatarSvg, catFullBodySvg } from "./cat-avatar.ts";
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
import { tutorialSeen, markTutorialSeen } from "./tutorial.ts";
import { claimFirstPuzzleReferralReward, shareInvite } from "./referral.ts";

// Ok ikonları: klasik çengel bulmaca okları (SVG, currentColor)
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

export interface AppOptions {
  /** Testlerde zaman aşımına dayalı açılış ekranını atlamak için. */
  skipSplash?: boolean;
}

export class App {
  private root: HTMLElement;
  private puzzles: PuzzleDef[];
  private options: AppOptions;
  private state: GameState | null = null;
  /** Son harf girilen hücre; bir sonraki çizimde pop animasyonu alır */
  private popIdx: number | null = null;
  /** Az önce doğru tamamlanan kelime; hücreleri yeşil parlar */
  private flashClue: number | null = null;
  /** Hücreye sığdırılmış soru puntoları; anahtar "hücre:ipucu" */
  private clueFontCache = new Map<string, string>();
  /** Önbelleğin geçerli olduğu ızgara genişliği */
  private clueFontWidth = 0;
  /** Bu hamleyle yeni açılan kedi varsa, kutlama ekranında gösterilir */
  private justUnlockedCat: CatDef | null = null;
  /** Bu hamleyle son bekçi kedi de açılıp yolculuk tamamlandıysa true */
  private journeyJustCompleted = false;

  constructor(root: HTMLElement, puzzles: PuzzleDef[], options: AppOptions = {}) {
    this.root = root;
    this.puzzles = puzzles;
    this.options = options;
  }

  start(): void {
    // web fontu sonradan yüklenince veya pencere boyutu değişince
    // ölçüler kayar; puntoları yeniden sığdır
    document.fonts?.ready.then(() => this.refitClueTexts());
    window.addEventListener("resize", () => this.refitClueTexts());

    const enter = () => {
      if (storySeen()) {
        this.renderHome();
      } else {
        this.renderIntro(() => this.renderHome());
      }
    };
    if (this.options.skipSplash) {
      enter();
    } else {
      this.renderSplash(enter);
    }
  }

  // ---------- açılış ekranı (splash) ----------

  /** Kısa, sabit süreli marka açılışı; gerçek SDK başlatmalarıyla (initAds vb.) paralel gösterilir. */
  private renderSplash(done: () => void): void {
    this.root.innerHTML = "";
    const wrap = el("div", "splash-screen");

    const avatar = el("div", "cat-avatar-wrap cat-avatar-lg splash-avatar");
    avatar.innerHTML = catFullBodySvg(DUMAN);
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

  // ---------- açılış hikayesi ----------

  /** Duman'ın hikayesini tam ekran anlatır; devam edince returnTo çalışır. */
  private renderIntro(returnTo: () => void): void {
    this.root.innerHTML = "";
    const wrap = el("div", "home intro-screen");

    const avatar = el("div", "cat-avatar-wrap cat-avatar-lg intro-avatar");
    avatar.innerHTML = catFullBodySvg(DUMAN);
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

  /** Tüm bekçi kediler toplanınca gösterilen kapanış hikayesi; devam edince returnTo çalışır. */
  private renderEpilogue(returnTo: () => void): void {
    this.root.innerHTML = "";
    const wrap = el("div", "home intro-screen epilogue-screen");

    const family = el("div", "epilogue-family");
    const dumanAvatar = el("div", "cat-avatar-wrap cat-avatar-lg");
    dumanAvatar.innerHTML = catFullBodySvg(DUMAN);
    family.appendChild(dumanAvatar);
    CATS.forEach((cat) => {
      const mini = el("div", "cat-avatar-wrap cat-avatar-mini");
      mini.innerHTML = catAvatarSvg(cat);
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

  // ---------- alt gezinme & joker rozeti ----------

  /** 4 üst-seviye sekme arasında gezinme çubuğu; oyun/harita/hikaye ekranlarında gösterilmez. */
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

  /** Joker bakiyesini gösteren rozet; her üst-seviye ekranda görünür, dokununca Mağaza açılır. */
  private jokerPill(): HTMLElement {
    const pill = el("button", "joker-pill");
    pill.appendChild(el("span", "joker-pill-icon", "🃏"));
    pill.appendChild(el("span", "joker-pill-count", String(jokerBalance())));
    pill.appendChild(el("span", "joker-pill-plus", "＋"));
    pill.setAttribute("aria-label", "Joker bakiyesi, Mağaza'yı aç");
    pill.addEventListener("click", () => this.renderShop());
    return pill;
  }

  // ---------- ana menü ----------

  private renderHome(): void {
    this.root.innerHTML = "";
    const home = el("div", "home");

    // üst bar: logo + joker rozeti + seri rozeti
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

    // günün bulmacası kartı
    const di = dailyIndex(this.puzzles.length);
    const daily = this.puzzles[di];
    const dailyDone = isSolvedPuzzle(daily.id);
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
    hero.appendChild(heroInfo);
    hero.appendChild(
      el("div", "daily-cta" + (dailyDone ? " done" : ""), dailyDone ? "✓" : "Oyna"),
    );
    hero.addEventListener("click", () => this.openPuzzle(daily));
    home.appendChild(hero);

    // istatistik satırı
    const stats = loadStats();
    const statRow = el("div", "stat-row");
    statRow.appendChild(statCard("🔥", String(streak), "Günlük seri"));
    statRow.appendChild(statCard("✅", String(stats.solved.length), "Çözülen"));
    home.appendChild(statRow);

    // kedi koleksiyonu teaser kartı
    const solved = solvedCount();
    const collected = CATS.filter((c) => catUnlocked(c, solved)).length;
    const catsCard = el("button", "cats-teaser");
    const preview = el("div", "cats-teaser-preview");
    CATS.slice(0, 5).forEach((c) => {
      const mini = el("div", "cat-avatar-wrap cat-avatar-mini");
      mini.innerHTML = catAvatarSvg(c, !catUnlocked(c, solved));
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

    // bulmaca listesi
    home.appendChild(el("div", "section-title", "Tüm Bulmacalar"));
    const list = el("div", "puzzle-list");
    this.puzzles.forEach((p, i) => {
      const solved = isSolvedPuzzle(p.id);
      const btn = el("button", "puzzle-card");
      btn.style.setProperty("--i", String(i));
      const num = el("div", "puzzle-num", String(i + 1));
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
        const bar = el("div", "puzzle-progress");
        const fill = el("div", "puzzle-progress-fill");
        fill.style.width = `${Math.max(4, Math.round(prog * 100))}%`;
        bar.appendChild(fill);
        info.appendChild(bar);
      }
      btn.appendChild(info);
      btn.appendChild(
        el("div", "puzzle-badge" + (solved ? " solved" : ""), solved ? "✓" : "›"),
      );
      btn.addEventListener("click", () => this.openPuzzle(p));
      list.appendChild(btn);
    });
    home.appendChild(list);

    this.root.appendChild(home);
    this.root.appendChild(this.renderBottomNav("home"));
  }

  // ---------- kedi koleksiyonu ----------

  private renderCollection(): void {
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
      avatar.innerHTML = catAvatarSvg(cat, !unlocked);
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

  /** Duman'ın Anadolu'daki yolculuğunu bir haritada gösterir: her bölge
   * bekçi kedinin yaklaşık konumunda bir pim olarak durur, açık/kilitli
   * durumu renkle belli olur. Harita stilize edilmiştir, coğrafi olarak
   * kesin değildir; dokununca bölge adı ve durumu görünür. */
  private renderMap(): void {
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
    startAvatar.innerHTML = catAvatarSvg(DUMAN, false);
    startPin.appendChild(startAvatar);
    canvas.appendChild(startPin);

    CATS.forEach((cat) => {
      const unlocked = catUnlocked(cat, solved);
      const pin = el("button", "map-pin" + (unlocked ? " unlocked" : " locked"));
      const pos = percentPos(regionPos(cat.region));
      pin.style.left = pos.left;
      pin.style.top = pos.top;
      const avatar = el("div", "cat-avatar-wrap map-pin-avatar");
      avatar.innerHTML = catAvatarSvg(cat, !unlocked);
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
    const avatar = el("div", "cat-avatar-wrap cat-avatar-lg");
    avatar.innerHTML = catFullBodySvg(cat, false);
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

  // ---------- mağaza ----------

  private renderShop(): void {
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

    wrap.appendChild(el("div", "section-title", "Joker Al"));
    const grid = el("div", "shop-pack-grid");
    JOKER_PACKS.forEach((pack) => {
      const card = el("button", "shop-pack-card" + (pack.popular ? " popular" : ""));
      if (pack.popular) card.appendChild(el("div", "shop-pack-badge", "Popüler"));
      card.appendChild(el("div", "shop-pack-icon", "🃏"));
      card.appendChild(el("div", "shop-pack-count", `${pack.count} Joker`));
      card.appendChild(el("div", "shop-pack-price", pack.priceLabel));
      card.addEventListener("click", () => void this.buyJokerPack(pack.id, card));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    this.root.appendChild(wrap);
    this.root.appendChild(this.renderBottomNav("shop"));
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

  // ---------- ayarlar ----------

  private renderSettings(): void {
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

    const storyBtn = el("button", "puzzle-card");
    const storyInfo = el("div", "puzzle-info");
    storyInfo.appendChild(el("div", "puzzle-title", "Hikayeyi tekrar oku"));
    storyBtn.appendChild(el("div", "puzzle-num", "📖"));
    storyBtn.appendChild(storyInfo);
    storyBtn.appendChild(el("div", "puzzle-badge", "›"));
    storyBtn.addEventListener("click", () => this.renderIntro(() => this.renderSettings()));
    wrap.appendChild(storyBtn);

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
    this.state = newGame(p);
    this.clueFontCache.clear();
    // oyuncu hemen yazmaya başlayabilsin diye ilk boş soruyu seç
    if (!this.state.completed) {
      const first = this.findClueWithEmptyCell(0);
      this.activateClue(first ?? 0);
    }
    this.renderGame();
  }

  /** İpucunu aktifleştirir, imleci kelimenin ilk boş hücresine koyar */
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

  /** from'dan başlayarak (kendisi dahil) boş hücresi olan ilk ipucu */
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

  /** Aktif ipucundan ileri/geri sıradaki ipucuya geçer */
  private stepClue(dir: 1 | -1): void {
    const s = this.state!;
    const n = s.puzzle.clues.length;
    const from = s.activeClue ?? 0;
    this.activateClue((from + dir + n) % n);
    this.renderGame();
  }

  /** Kelimenin tüm hücreleri doğru harfle dolu mu? */
  private isWordCorrect(ci: number): boolean {
    const s = this.state!;
    return s.grid.cluePlacements[ci].every((p) => {
      const cell = s.grid.cells[p.row * s.grid.cols + p.col];
      return (
        cell.kind === "letter" &&
        s.entries[p.row * s.grid.cols + p.col] === cell.solution
      );
    });
  }

  /**
   * Bir hamleyi çalıştırır, bulmaca bu hamleyle tamamlandıysa
   * kutlama efektini tetikler ve ekranı tazeler.
   */
  private withWinCheck(action: () => void): void {
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
    }
    this.renderGame();
  }

  /**
   * Bu tamamlamayla yeni bir kedi eşiği aşıldıysa kutlamayı ve yolculuğun
   * bitip bitmediğini kaydeder. Daha önce çözülmüş bir bulmacayı tekrar
   * çözmek sayacı artırmadığı için kedi açmaz.
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
   * Harf girişi: kelime bu harfle doğru tamamlandıysa kısa bir
   * yeşil parlamayla kutlar ve sıradaki boş soruya geçer.
   */
  private handleType(key: string): void {
    const s = this.state!;
    if (!tutorialSeen()) markTutorialSeen();
    this.markPop();
    const prevClue = s.activeClue;
    const wasCompleted = s.completed;
    const alreadySolved = isSolvedPuzzle(s.puzzle.id);
    const wasFirstEverSolve = solvedCount() === 0;
    typeLetter(s, key);
    if (!wasCompleted && s.completed) {
      playWin();
      hapticWin();
      this.registerCatUnlock(alreadySolved);
      if (wasFirstEverSolve) void claimFirstPuzzleReferralReward();
    } else if (prevClue !== null && this.isWordCorrect(prevClue)) {
      playCorrect();
      this.flashClue = prevClue;
      const next = this.findClueWithEmptyCell(prevClue + 1);
      if (next !== null) this.activateClue(next);
    }
    this.renderGame();
  }

  // ---------- oyun ekranı ----------

  private renderGame(): void {
    const s = this.state!;
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
    revealBtn.addEventListener("click", () => {
      if (freeHints > 0) {
        consumeFreeHint();
        this.withWinCheck(() => revealLetter(s));
        return;
      }
      if (jokers > 0) {
        spendJoker();
        this.withWinCheck(() => revealLetter(s));
        return;
      }
      (revealBtn as HTMLButtonElement).disabled = true;
      revealBtn.textContent = "Reklam yükleniyor…";
      showRewardedHintAd()
        .catch(() => false)
        .then((earned) => {
          if (this.state !== s) return; // oyuncu bu sırada başka yere geçti
          if (earned) {
            this.withWinCheck(() => revealLetter(s));
          } else {
            this.renderGame();
            toast(this.root, "Reklam tamamlanmadı, ipucu açılmadı");
          }
        });
    });
    const soundBtn = el("button", "icon-btn sound-btn", soundEnabled() ? "🔊" : "🔇");
    soundBtn.setAttribute("aria-label", "Sesi aç/kapat");
    soundBtn.addEventListener("click", () => {
      soundBtn.textContent = toggleSound() ? "🔊" : "🔇";
    });
    actions.appendChild(checkBtn);
    actions.appendChild(revealBtn);
    if (freeHints === 0 && jokers === 0) {
      const shopChip = el("button", "joker-cta-chip", "Joker al");
      shopChip.addEventListener("click", () => this.renderShop());
      actions.appendChild(shopChip);
    }
    actions.appendChild(soundBtn);
    bar.appendChild(actions);
    wrap.appendChild(bar);

    if (!tutorialSeen() && !s.completed) wrap.appendChild(this.renderTutorialCoach());

    wrap.appendChild(this.renderGrid());
    wrap.appendChild(this.renderPanel());
    wrap.appendChild(this.renderKeyboard());
    this.root.appendChild(wrap);

    this.fitClueTexts();

    if (s.completed) this.showCompleted();
  }

  /** İlk bulmacada bir kereye mahsus gösterilen basit rehber kartı. */
  private renderTutorialCoach(): HTMLElement {
    const coach = el("div", "tutorial-coach");
    const avatar = el("div", "cat-avatar-wrap cat-avatar-mini");
    avatar.innerHTML = catAvatarSvg(DUMAN, false);
    coach.appendChild(avatar);
    const body = el("div", "tutorial-coach-body");
    body.appendChild(
      el(
        "p",
        "tutorial-coach-text",
        "Merhaba, ben Duman! 🐾 Yukarıdaki soruyu oku, cevabı klavyeden yazmaya başla — her doğru kelime beni bir sonraki şehre yaklaştırır.",
      ),
    );
    const dismiss = el("button", "tutorial-coach-btn", "Anladım, başlıyorum!");
    dismiss.addEventListener("click", () => {
      markTutorialSeen();
      this.renderGame();
    });
    body.appendChild(dismiss);
    coach.appendChild(body);
    return coach;
  }

  /**
   * Soru yazılarını hücrelerine sığana kadar küçültür. Hücredeki tüm
   * sorular aynı puntoyu kullanır; parçaların yüksekliği içeriğe göre
   * dağıldığından uzun soru kendine daha çok yer açar. Sonuç puntolar
   * önbelleğe alınır; sonraki çizimlerde ölçüm tekrarlanmaz.
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
      // önbellekteki puntolar çizim sırasında uygulandı; yeniden ölçme
      if (texts.length === 0 || allCached) continue;

      // ekran genişliği değişmişse kalıntı sabit puntoları sıfırla
      for (const t of texts) t.style.fontSize = "";
      let size = Math.min(
        ...texts.map((t) => parseFloat(getComputedStyle(t).fontSize)),
      );
      const apply = () => {
        for (const t of texts) t.style.fontSize = `${size}px`;
      };
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
          return (
            t.scrollHeight > availH + 0.5 || t.scrollWidth > availW + 0.5
          );
        });
      apply();
      while (size > 5 && overflows()) {
        size -= 0.5;
        apply();
      }
      for (const key of keys) this.clueFontCache.set(key, `${size}px`);
    }
  }

  /** Punto önbelleğini boşaltıp yazıları yeniden sığdırır */
  private refitClueTexts(): void {
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

    // her cevabın başlangıç hücresi: ok oraya çizilir (klasik görünüm)
    const starts = new Map<number, number[]>();
    s.puzzle.clues.forEach((_, ci) => {
      const p = s.grid.cluePlacements[ci][0];
      const idx = p.row * s.grid.cols + p.col;
      starts.set(idx, [...(starts.get(idx) ?? []), ci]);
    });

    // doğru tamamlanmış kelimelerin hücreleri kalıcı yeşil görünür
    const doneCells = new Set<number>();
    s.puzzle.clues.forEach((_, ci) => {
      if (!this.isWordCorrect(ci)) return;
      for (const p of s.grid.cluePlacements[ci]) {
        doneCells.add(p.row * s.grid.cols + p.col);
      }
    });

    for (const cell of s.grid.cells) {
      const i = cell.row * s.grid.cols + cell.col;
      if (cell.kind === "clue") {
        const div = el("div", "cell clue-cell");
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
          if (cached) text.style.fontSize = cached;
          part.appendChild(text);
          const selectClue = () => {
            const start = s.grid.cluePlacements[ci][0];
            s.activeClue = ci;
            s.selRow = start.row;
            s.selCol = start.col;
            this.renderGame();
          };
          part.addEventListener("click", selectClue);
          div.appendChild(part);
        }
        grid.appendChild(div);
      } else {
        const div = el("div", "cell letter-cell");
        if (activeCells.has(i)) div.classList.add("in-active-word");
        if (s.selRow === cell.row && s.selCol === cell.col) {
          div.classList.add("selected");
        }
        if (s.wrongCells.has(i)) div.classList.add("wrong");
        if (s.completed) {
          div.classList.add("won");
          // sol üstten sağ alta yayılan kutlama dalgası
          div.style.animationDelay = `${(cell.row + cell.col) * 45}ms`;
        }
        if (this.popIdx === i && s.entries[i] !== "") div.classList.add("pop-in");
        if (flashCells.has(i) && !s.completed) div.classList.add("word-flash");
        if (doneCells.has(i) && !s.completed) div.classList.add("word-done");
        div.appendChild(el("span", "cell-letter", s.entries[i]));
        // bu hücreden başlayan cevapların okları (köşede, klasik görünüm)
        for (const ci of starts.get(i) ?? []) {
          const arrow = el("span", `cell-arrow arrow-${s.puzzle.clues[ci].arrow}`);
          if (s.activeClue === ci) arrow.classList.add("arrow-active");
          arrow.innerHTML = ARROW_SVG[s.puzzle.clues[ci].arrow];
          div.appendChild(arrow);
        }
        div.addEventListener("click", () => {
          selectCell(s, cell.row, cell.col);
          this.renderGame();
        });
        grid.appendChild(div);
      }
    }
    this.popIdx = null;
    this.flashClue = null;
    return grid;
  }

  /**
   * Cevap paneli: aktif sorunun metni büyük puntoyla, altında kelimenin
   * harf kutuları. Izgaradaki küçük yazıya bakmadan çözmeyi sağlar.
   */
  private renderPanel(): HTMLElement {
    const s = this.state!;
    const panel = el("div", "panel");

    const top = el("div", "panel-top");
    const prev = el("button", "panel-nav");
    prev.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 L9 12 L15 6"/></svg>`;
    prev.setAttribute("aria-label", "Önceki soru");
    prev.addEventListener("click", () => this.stepClue(-1));
    const next = el("button", "panel-nav");
    next.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18 L15 12 L9 6"/></svg>`;
    next.setAttribute("aria-label", "Sonraki soru");
    next.addEventListener("click", () => this.stepClue(1));

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
        slot.addEventListener("click", () => {
          selectCell(s, p.row, p.col);
          this.renderGame();
        });
        slots.appendChild(slot);
      }
      panel.appendChild(slots);
    }

    return panel;
  }

  /** Seçili hücrenin ızgara indeksini pop animasyonu için işaretler */
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
            playKey();
            hapticKey();
            backspace(s);
            this.renderGame();
          });
        } else {
          btn.addEventListener("click", () => {
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
      avatar.innerHTML = catFullBodySvg(cat, false);
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
        mini.innerHTML = catAvatarSvg(next, true);
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
        this.renderEpilogue(() => this.renderHome());
      });
      modal.appendChild(epilogueBtn);
    } else if (cat) {
      const catsBtn = el("button", "modal-btn modal-share", "Kedi Dostlarım'ı gör");
      catsBtn.addEventListener("click", () => this.renderCollection());
      modal.appendChild(catsBtn);
    }
    const shareBtn = el("button", "modal-btn modal-share", "Sonucu paylaş");
    shareBtn.addEventListener("click", () => void this.shareResult());
    modal.appendChild(shareBtn);
    const btn = el("button", "modal-btn", "Ana menüye dön");
    btn.addEventListener("click", () => {
      this.state = null;
      this.renderHome();
    });
    modal.appendChild(btn);
    overlay.appendChild(modal);
    this.root.appendChild(overlay);

    if (shouldShowInterstitial()) void maybeShowInterstitial();
  }

  /** Sonucu sistem paylaşım menüsüyle, yoksa panoya kopyalayarak paylaşır. */
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
      // kullanıcı paylaşımı iptal ettiyse sessizce dön
    }
  }

  /** Fiziksel klavye desteği (masaüstü testleri için) */
  attachPhysicalKeyboard(): void {
    window.addEventListener("keydown", (e) => {
      const s = this.state;
      if (!s) return;
      if (e.key === "Backspace") {
        backspace(s);
        this.renderGame();
        e.preventDefault();
      } else if (/^[a-zA-ZçÇğĞıİöÖşŞüÜ]$/.test(e.key)) {
        this.handleType(e.key);
        e.preventDefault();
      }
    });
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
