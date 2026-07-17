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
} from "./stats.ts";
import {
  playCorrect,
  playKey,
  playWin,
  playWrong,
  soundEnabled,
  toggleSound,
} from "./sound.ts";
import { hapticKey, hapticWin, hapticWrong } from "./haptics.ts";
import { currentTheme, toggleTheme } from "./theme.ts";
import type { ArrowDir, PuzzleDef } from "./types.ts";

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

export class App {
  private root: HTMLElement;
  private puzzles: PuzzleDef[];
  private state: GameState | null = null;
  /** Son harf girilen hücre; bir sonraki çizimde pop animasyonu alır */
  private popIdx: number | null = null;
  /** Az önce doğru tamamlanan kelime; hücreleri yeşil parlar */
  private flashClue: number | null = null;
  /** Hücreye sığdırılmış soru puntoları; anahtar "hücre:ipucu" */
  private clueFontCache = new Map<string, string>();
  /** Önbelleğin geçerli olduğu ızgara genişliği */
  private clueFontWidth = 0;

  constructor(root: HTMLElement, puzzles: PuzzleDef[]) {
    this.root = root;
    this.puzzles = puzzles;
  }

  start(): void {
    this.renderHome();
  }

  // ---------- ana menü ----------

  private renderHome(): void {
    this.root.innerHTML = "";
    const home = el("div", "home");

    // üst bar: logo + seri rozeti
    const top = el("div", "home-top");
    const brand = el("div", "brand");
    brand.appendChild(el("span", "brand-mark", "Ç"));
    brand.appendChild(el("span", "brand-name", "Çengel"));
    top.appendChild(brand);
    const right = el("div", "home-top-right");
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
    action();
    if (!wasCompleted && s.completed) {
      playWin();
      hapticWin();
    }
    this.renderGame();
  }

  /**
   * Harf girişi: kelime bu harfle doğru tamamlandıysa kısa bir
   * yeşil parlamayla kutlar ve sıradaki boş soruya geçer.
   */
  private handleType(key: string): void {
    const s = this.state!;
    this.markPop();
    const prevClue = s.activeClue;
    const wasCompleted = s.completed;
    typeLetter(s, key);
    if (!wasCompleted && s.completed) {
      playWin();
      hapticWin();
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
    const revealBtn = el("button", "action-btn", "İpucu");
    revealBtn.title = "Seçili hücrenin harfini aç";
    revealBtn.addEventListener("click", () => {
      this.withWinCheck(() => revealLetter(s));
    });
    const soundBtn = el("button", "icon-btn sound-btn", soundEnabled() ? "🔊" : "🔇");
    soundBtn.setAttribute("aria-label", "Sesi aç/kapat");
    soundBtn.addEventListener("click", () => {
      soundBtn.textContent = toggleSound() ? "🔊" : "🔇";
    });
    actions.appendChild(checkBtn);
    actions.appendChild(revealBtn);
    actions.appendChild(soundBtn);
    bar.appendChild(actions);
    wrap.appendChild(bar);

    wrap.appendChild(this.renderGrid());
    wrap.appendChild(this.renderPanel());
    wrap.appendChild(this.renderKeyboard());
    this.root.appendChild(wrap);

    this.fitClueTexts();

    if (s.completed) this.showCompleted();
  }

  /**
   * Soru yazılarını hücrelerine sığana kadar küçültür. Sonuç puntolar
   * önbelleğe alınır; sonraki çizimlerde ölçüm tekrarlanmaz.
   */
  private fitClueTexts(): void {
    const grid = this.root.querySelector<HTMLElement>(".grid");
    if (!grid) return;
    if (grid.clientWidth !== this.clueFontWidth) {
      this.clueFontCache.clear();
      this.clueFontWidth = grid.clientWidth;
    }
    for (const part of grid.querySelectorAll<HTMLElement>(".clue-part")) {
      const text = part.querySelector<HTMLElement>(".clue-text");
      const key = part.dataset.fitKey;
      if (!text || !key) continue;
      // önbellekteki punto çizim sırasında uygulandı; yeniden ölçme
      if (this.clueFontCache.has(key)) continue;
      // ekran genişliği değişmişse eski sabit punto kalmış olabilir
      text.style.fontSize = "";
      const ps = getComputedStyle(part);
      const availH =
        part.clientHeight -
        parseFloat(ps.paddingTop) -
        parseFloat(ps.paddingBottom);
      const availW =
        part.clientWidth -
        parseFloat(ps.paddingLeft) -
        parseFloat(ps.paddingRight);
      let size = parseFloat(getComputedStyle(text).fontSize);
      while (
        size > 6 &&
        (text.scrollHeight > availH || text.scrollWidth > availW + 0.5)
      ) {
        size -= 0.5;
        text.style.fontSize = `${size}px`;
      }
      this.clueFontCache.set(key, `${size}px`);
    }
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
    const overlay = el("div", "overlay");
    overlay.appendChild(makeConfetti());
    const modal = el("div", "modal");
    modal.appendChild(el("div", "modal-emoji", "🎉"));
    modal.appendChild(el("h2", "modal-title", "Tebrikler!"));
    modal.appendChild(el("p", "modal-text", "Bulmacayı başarıyla tamamladın."));
    const streak = currentStreak();
    if (streak > 0) {
      const line = el("div", "modal-streak");
      line.appendChild(el("span", "streak-flame", "🔥"));
      line.appendChild(
        el("span", "", `${streak} günlük seri`),
      );
      modal.appendChild(line);
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
