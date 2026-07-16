import {
  backspace,
  checkEntries,
  newGame,
  revealLetter,
  selectCell,
  typeLetter,
  type GameState,
} from "./game.ts";
import type { ArrowDir, PuzzleDef } from "./types.ts";

const ARROW_GLYPH: Record<ArrowDir, string> = {
  right: "▸",
  down: "▾",
  "right-down": "↴",
  "down-right": "↳",
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

  constructor(root: HTMLElement, puzzles: PuzzleDef[]) {
    this.root = root;
    this.puzzles = puzzles;
  }

  start(): void {
    this.renderHome();
  }

  private renderHome(): void {
    this.root.innerHTML = "";
    const home = el("div", "home");
    home.appendChild(el("h1", "home-title", "Çengel Bulmaca"));
    home.appendChild(
      el("p", "home-sub", "Bir bulmaca seç ve çözmeye başla"),
    );
    const list = el("div", "puzzle-list");
    for (const p of this.puzzles) {
      const btn = el("button", "puzzle-btn");
      btn.appendChild(el("span", "puzzle-btn-title", p.title));
      btn.appendChild(
        el("span", "puzzle-btn-size", `${p.cols}×${p.rows}`),
      );
      btn.addEventListener("click", () => this.openPuzzle(p));
      list.appendChild(btn);
    }
    home.appendChild(list);
    this.root.appendChild(home);
  }

  private openPuzzle(p: PuzzleDef): void {
    this.state = newGame(p);
    this.renderGame();
  }

  private renderGame(): void {
    const s = this.state!;
    this.root.innerHTML = "";

    const wrap = el("div", "game");

    // --- üst çubuk ---
    const bar = el("div", "topbar");
    const back = el("button", "icon-btn", "‹");
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
      this.renderGame();
      if (wrong === 0) toast(this.root, "Dolu hücrelerin hepsi doğru!");
      else toast(this.root, `${wrong} yanlış harf işaretlendi`);
    });
    const revealBtn = el("button", "action-btn", "Harf");
    revealBtn.title = "Seçili hücrenin harfini aç";
    revealBtn.addEventListener("click", () => {
      revealLetter(s);
      this.renderGame();
    });
    actions.appendChild(checkBtn);
    actions.appendChild(revealBtn);
    bar.appendChild(actions);
    wrap.appendChild(bar);

    // --- aktif soru çubuğu ---
    const clueBar = el("div", "cluebar");
    if (s.activeClue !== null) {
      const clue = s.puzzle.clues[s.activeClue];
      clueBar.appendChild(
        el("span", "cluebar-arrow", ARROW_GLYPH[clue.arrow]),
      );
      clueBar.appendChild(el("span", "cluebar-text", clue.text));
    } else {
      clueBar.appendChild(
        el("span", "cluebar-hint", "Bir hücreye dokun"),
      );
    }
    wrap.appendChild(clueBar);

    // --- ızgara ---
    wrap.appendChild(this.renderGrid());

    // --- klavye ---
    wrap.appendChild(this.renderKeyboard());

    this.root.appendChild(wrap);

    if (s.completed) this.showCompleted();
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

    for (const cell of s.grid.cells) {
      const i = cell.row * s.grid.cols + cell.col;
      if (cell.kind === "clue") {
        const div = el("div", "cell clue-cell");
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
          if (s.activeClue === ci) part.classList.add("clue-part-active");
          const text = el("span", "clue-text", clue.text);
          text.classList.add(sizeClass(clue.text));
          part.appendChild(text);
          const arrow = el(
            "span",
            `clue-arrow arrow-${clue.arrow}`,
            ARROW_GLYPH[clue.arrow],
          );
          part.appendChild(arrow);
          part.addEventListener("click", () => {
            const start = s.grid.cluePlacements[ci][0];
            s.activeClue = ci;
            s.selRow = start.row;
            s.selCol = start.col;
            this.renderGame();
          });
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
        div.textContent = s.entries[i];
        div.addEventListener("click", () => {
          selectCell(s, cell.row, cell.col);
          this.renderGame();
        });
        grid.appendChild(div);
      }
    }
    return grid;
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
            backspace(s);
            this.renderGame();
          });
        } else {
          btn.addEventListener("click", () => {
            typeLetter(s, key);
            this.renderGame();
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
    const modal = el("div", "modal");
    modal.appendChild(el("div", "modal-emoji", "🎉"));
    modal.appendChild(el("h2", "modal-title", "Tebrikler!"));
    modal.appendChild(
      el("p", "modal-text", "Bulmacayı başarıyla tamamladın."),
    );
    const btn = el("button", "modal-btn", "Ana menüye dön");
    btn.addEventListener("click", () => {
      this.state = null;
      this.renderHome();
    });
    modal.appendChild(btn);
    overlay.appendChild(modal);
    this.root.appendChild(overlay);
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
        typeLetter(s, e.key);
        this.renderGame();
        e.preventDefault();
      }
    });
  }
}

function sizeClass(text: string): string {
  if (text.length <= 12) return "clue-md";
  if (text.length <= 24) return "clue-sm";
  return "clue-xs";
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
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
