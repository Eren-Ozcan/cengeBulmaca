/**
 * Renders the store material from the real app, so it can be rebuilt after any
 * UI change instead of being hand-recorded from someone's phone.
 *
 * A headless Chrome is pointed at the production build at a phone viewport, a
 * showcase save is seeded before the app boots (a player 31 puzzles in, a
 * 12-day streak, 9 of 16 cats collected), and every screen is driven with real
 * clicks and real typing before it is captured.
 *
 *   node scripts/showcase.mjs shots    # 1080x1920 stills into docs/store-assets-originals/raw
 *   node scripts/showcase.mjs video    # numbered PNG sequence into .../frames
 *
 * The stills are the input of scripts/make_store_shots.py, which adds the
 * caption band. The frame sequence is encoded with ffmpeg (see README).
 * Everything lands in docs/store-assets-originals/, which is gitignored.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "docs", "store-assets-originals");
const PUZZLES = join(ROOT, "src", "puzzles");
const PORT = 4180;
const CDP_PORT = 9333;
const CHROME =
  process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// 540x960 at dpr 2 gives exactly the 1080x1920 Play wants, and matches the
// aspect ratio of the phone the layout was tuned on. --tablet renders the same
// scenes at 1600x2560 for Play's (optional) 7"/10" tablet slots.
const PHONE = { width: 540, height: 960, deviceScaleFactor: 2, mobile: true };
const TABLET = { width: 800, height: 1280, deviceScaleFactor: 2, mobile: true };
const TABLET_MODE = process.argv.includes("--tablet");
const VIEW = TABLET_MODE ? TABLET : PHONE;
const SUFFIX = TABLET_MODE ? "-tablet" : "";

/** A player far enough in to have a streak and half the cat album. */
const SOLVED_COUNT = 31;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- the save

const ARROW = {
  right: { sr: 0, sc: 1, dRow: 0, dCol: 1 },
  down: { sr: 1, sc: 0, dRow: 1, dCol: 0 },
  "right-down": { sr: 0, sc: 1, dRow: 1, dCol: 0 },
  "down-right": { sr: 1, sc: 0, dRow: 0, dCol: 1 },
};

const manifest = () =>
  JSON.parse(readFileSync(join(PUZZLES, "manifest.json"), "utf8")).sort((a, b) => a.order - b.order);

const dayString = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The same puzzle the home screen offers today (mirrors stats.ts dailyIndex). */
function dailyPuzzle() {
  const list = manifest();
  const s = dayString();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const entry = list[h % list.length];
  return { entry, data: JSON.parse(readFileSync(join(PUZZLES, entry.file.replace("./", "")), "utf8")) };
}

/** Every letter of the puzzle, laid out the way game.ts stores its entries. */
function filledEntries(puzzle) {
  const entries = new Array(puzzle.rows * puzzle.cols).fill("");
  for (const clue of puzzle.clues) {
    const a = ARROW[clue.arrow];
    const chars = [...clue.answer];
    for (let i = 0; i < chars.length; i++) {
      const row = clue.row + a.sr + a.dRow * i;
      const col = clue.col + a.sc + a.dCol * i;
      entries[row * puzzle.cols + col] = chars[i];
    }
  }
  return entries;
}

/** Where the last letter of a clue sits, so the shot can end on filling it in. */
function lastCell(puzzle, clue) {
  const a = ARROW[clue.arrow];
  const i = [...clue.answer].length - 1;
  return { row: clue.row + a.sr + a.dRow * i, col: clue.col + a.sc + a.dCol * i };
}

function seedScript({ nearlyDone } = {}) {
  const list = manifest();
  const stats = {
    lastDay: dayString(),
    streak: 12,
    solved: list.slice(0, SOLVED_COUNT).map((e) => e.id),
  };
  const lines = [
    `localStorage.setItem("cengel-tutorial-seen", "1");`,
    `localStorage.setItem("cengel-story-seen", "1");`,
    `localStorage.setItem("cengel-stats", ${JSON.stringify(JSON.stringify(stats))});`,
    `localStorage.setItem("cengel-jokers", "24");`,
    `localStorage.setItem("cengel-jokers-init", "1");`,
    `localStorage.setItem("cengel-sound", "off");`,
    `localStorage.setItem("cengel-music", "off");`,
  ];
  if (nearlyDone) {
    // One letter short of a finished puzzle, so the last keystroke of the run
    // triggers the real completion screen instead of a mocked one.
    const { entry, data } = dailyPuzzle();
    const entries = filledEntries(data);
    const clue = data.clues[data.clues.length - 1];
    const cell = lastCell(data, clue);
    entries[cell.row * data.cols + cell.col] = "";
    const progress = { entries, selRow: cell.row, selCol: cell.col, activeClue: data.clues.length - 1 };
    lines.push(
      `localStorage.setItem("cengel-progress-${entry.id}", ${JSON.stringify(JSON.stringify(progress))});`,
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------- chrome / CDP

async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const target = list.find((t) => t.type === "page");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) pending.get(m.id)(m);
    else if (m.method && listeners.has(m.method)) listeners.get(m.method)(m.params);
  };
  const on = (method, fn) => listeners.set(method, fn);
  const send = (method, params = {}) =>
    new Promise((res) => {
      const mid = ++id;
      pending.set(mid, res);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  return { ws, send, on };
}

function api(send) {
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails)
      throw new Error(r.result.exceptionDetails.exception?.description ?? "page threw");
    return r.result?.result?.value;
  };
  return {
    evaluate,
    /** Clicks the first element that matches, and says whether it found one. */
    click: (selector, pattern) =>
      evaluate(`(() => {
        const list = [...document.querySelectorAll(${JSON.stringify(selector)})];
        const hit = ${pattern ? `list.find((el) => ${pattern}.test(el.textContent ?? ""))` : "list[0]"};
        if (!hit) return false;
        hit.click();
        return true;
      })()`),
    shot: async (file) => {
      const r = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(file, Buffer.from(r.result.data, "base64"));
    },
  };
}

// ---------------------------------------------------------------- scenes

async function typeAnswer(page, letters, perKey, onFrame) {
  for (const letter of letters) {
    await page.click(".kb-key", `/^${letter}$/`);
    await sleep(perKey);
    if (onFrame) await onFrame();
  }
}

async function boot(send, page, opts = {}) {
  await send("Page.addScriptToEvaluateOnNewDocument", { source: seedScript(opts) });
  await send("Page.navigate", { url: `http://localhost:${PORT}/` });
  await sleep(1500);
  await waitForSelector(page, ".daily-card, .bottom-nav", 20000);
  await sleep(900);
}

/** Waits for an element to show up, so slow first loads do not race the shot. */
async function waitForSelector(page, selector, timeout = 15000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await page.evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) return true;
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${selector}`);
}

/**
 * Walks back to the home screen from wherever the run is. The screens do not
 * all carry the bottom navigation (the puzzle, the album and the map each have
 * their own back arrow), so this just presses back until home shows up.
 */
async function backHome(page) {
  for (let i = 0; i < 4; i++) {
    if (await page.evaluate(`!!document.querySelector(".daily-card")`)) {
      await sleep(500);
      return;
    }
    if (!(await page.click("button", "/Ana Sayfa/"))) await page.click(".topbar .icon-btn");
    await sleep(800);
  }
  throw new Error("could not get back to the home screen");
}

const openDaily = async (page) => {
  await waitForSelector(page, ".daily-card");
  await page.click("button", "/GÜNÜN BULMACASI|Oyna/");
  // The clue panel only has text once the puzzle chunk has been fetched.
  await waitForSelector(page, ".panel-text");
  await sleep(700);
};

/**
 * The answer the app is currently asking for, looked up by its clue text.
 * The lookup spans the whole set rather than today's puzzle, so it still works
 * when the served build is a step behind the puzzle files on disk. Clue texts
 * are unique across the set (check-puzzles.mjs enforces that), so the text is
 * enough to identify the answer.
 */
let answerByClue = null;
async function activeAnswer(page) {
  const text = (
    await page.evaluate(
      `document.querySelector(".panel-text")?.textContent
       ?? document.querySelector(".clue-part-active .clue-text")?.textContent ?? ""`,
    )
  ).trim();
  // Read fresh every time: a puzzle-growing run rewrites these files while it
  // works, and a cached map would hand back the answer of a puzzle the app is
  // no longer serving.
  answerByClue = new Map();
  for (const entry of manifest()) {
    const data = JSON.parse(readFileSync(join(PUZZLES, entry.file.replace("./", "")), "utf8"));
    for (const c of data.clues) answerByClue.set(c.text, c.answer);
  }
  const answer = answerByClue.get(text);
  if (!answer) throw new Error(`clue not found for panel text: "${text}"`);
  return [...answer];
}

async function shots(send, page) {
  const outDir = join(ASSETS, `raw${SUFFIX}`);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const take = (name) => page.shot(join(outDir, `${name}.png`));

  await boot(send, page);
  await take("01_home");

  await openDaily(page);
  const answer = await activeAnswer(page);
  await typeAnswer(page, answer.slice(0, -1), 90);
  await take("02_grid");

  await typeAnswer(page, answer.slice(-1), 90);
  await sleep(1000);
  await take("03_word_solved");

  await backHome(page);
  await page.click("button", "/Kediler/");
  await waitForSelector(page, ".cats-grid");
  await sleep(900);
  await take("04_cats");

  await page.click('[aria-label="Anadolu haritası"]');
  await waitForSelector(page, ".map-canvas");
  await sleep(900);
  await take("05_map");

  await backHome(page);
  await page.evaluate(
    `[...document.querySelectorAll("h2,h3")].find((h) => /Bulmacalar/.test(h.textContent))?.scrollIntoView({ block: "start" })`,
  );
  await sleep(700);
  await take("06_puzzle_list");

  // The newspaper theme is the one thing no other Turkish crossword app has, so
  // it gets its own frame instead of hiding inside the settings screen.
  await page.evaluate(`localStorage.setItem("cengel-theme","gazete")`);
  await boot(send, page);
  await openDaily(page);
  await sleep(800);
  await take("07_newspaper_theme");

  // Completion is the payoff of the whole loop, so it is played for real: the
  // save is one letter short and that letter is typed on camera.
  await page.evaluate(`localStorage.setItem("cengel-theme","modern")`);
  await boot(send, page, { nearlyDone: true });
  await openDaily(page);
  const last = await activeAnswer(page);
  await typeAnswer(page, last.slice(-1), 120);
  await sleep(2200);
  await take("08_completed");

  console.log(`raw${SUFFIX}/ 01..08`);
}

async function video(send, on, page) {
  const outDir = join(ASSETS, `frames${SUFFIX}`);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // A screencast is used instead of repeated captureScreenshot calls: the
  // latter costs ~150 ms a frame, which makes the clip choppy no matter how
  // slowly the scenes are played.
  // The screencast only emits a frame when something actually changes, so the
  // arrival times are recorded as well: they become the durations of an ffmpeg
  // concat list, which turns the sparse frames back into real-time playback.
  let n = 0;
  const stamps = [];
  on("Page.screencastFrame", (params) => {
    writeFileSync(
      join(outDir, `frame_${String(++n).padStart(4, "0")}.jpg`),
      Buffer.from(params.data, "base64"),
    );
    stamps.push(Date.now());
    void send("Page.screencastFrameAck", { sessionId: params.sessionId });
  });

  await boot(send, page);
  const started = Date.now();
  await send("Page.startScreencast", { format: "jpeg", quality: 90, everyNthFrame: 1 });
  await sleep(1800);                    // home: daily card and streak
  await openDaily(page);
  await sleep(1500);                    // the grid
  const answer = await activeAnswer(page);
  await typeAnswer(page, answer, 260);
  await sleep(1600);                    // the word locks in
  await backHome(page);
  await page.click("button", "/Kediler/");
  await waitForSelector(page, ".cats-grid");
  await sleep(2200);                    // cat album
  await page.click('[aria-label="Anadolu haritası"]');
  await waitForSelector(page, ".map-canvas");
  await sleep(2400);                    // the journey map
  await send("Page.stopScreencast");
  await sleep(300);

  stamps.push(Date.now());
  const lines = ["ffconcat version 1.0"];
  for (let i = 0; i < n; i++) {
    lines.push(`file 'frame_${String(i + 1).padStart(4, "0")}.jpg'`);
    lines.push(`duration ${Math.max(0.04, (stamps[i + 1] - stamps[i]) / 1000).toFixed(3)}`);
  }
  // ffmpeg drops the last entry's duration unless the file is repeated.
  lines.push(`file 'frame_${String(n).padStart(4, "0")}.jpg'`);
  writeFileSync(join(outDir, "frames.txt"), lines.join("\n"));
  console.log(`${n} frame, ${((Date.now() - started) / 1000).toFixed(1)} sn`);
}

// ---------------------------------------------------------------- entry point

/** Kills whatever is listening on a port (Windows: npx leaves orphans). */
function killPort(port) {
  if (process.platform !== "win32") return;
  spawnSync("powershell", [
    "-NoProfile",
    "-Command",
    `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue |` +
      " Select-Object -Expand OwningProcess | Sort-Object -Unique |" +
      " ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }",
  ], { stdio: "ignore" });
}

/** Refuses to reuse someone else's server: it may be serving a stale build. */
async function portInUse(port) {
  try {
    await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(800) });
    return true;
  } catch {
    return false;
  }
}

async function waitFor(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      await fetch(url);
      return true;
    } catch {
      await sleep(500);
    }
  }
  return false;
}

async function main() {
  const mode = process.argv[2] === "video" ? "video" : "shots";
  // The dev server is used on purpose: it serves the puzzle files as they are
  // on disk, so a capture cannot disagree with the set the answers are looked
  // up from (a build would freeze an older set into dist/).
  // The port is this script's own; anything still sitting on it is a leftover
  // server from an interrupted run and would serve a stale build.
  if (await portInUse(PORT)) {
    killPort(PORT);
    await sleep(1500);
    if (await portInUse(PORT)) throw new Error(`port ${PORT} is stuck`);
  }

  const preview = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--remote-debugging-port=${CDP_PORT}`,
      // Kept out of the repo: a profile directory inside docs/ ends up full of
      // extension files, which the test runner then tries to run.
      `--user-data-dir=${join(tmpdir(), "cengel-showcase-chrome")}`,
      "--no-first-run",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    if (!(await waitFor(`http://localhost:${PORT}/`))) throw new Error("preview server did not start");
    if (!(await waitFor(`http://127.0.0.1:${CDP_PORT}/json/version`))) throw new Error("chrome did not start");
    const { ws, send, on } = await connect();
    const page = api(send);
    await send("Page.enable");
    await send("Runtime.enable");
    // The browser profile is reused between runs, so without this the app can
    // be served puzzle chunks that were cached before the set was regenerated.
    await send("Network.enable");
    await send("Network.setCacheDisabled", { cacheDisabled: true });
    // Cloud save is cut off for the run: the showcase profile is local, and a
    // leftover cloud save would otherwise open the "two saves found" dialog
    // over the first screenshot.
    await send("Network.setBlockedURLs", {
      // Hosts only: a broad "*firebase*" would also match the dev server's own
      // module URLs and stop the app from booting.
      urls: [
        "*://*.googleapis.com/*",
        "*://*.firebaseio.com/*",
        "*://*.firebaseapp.com/*",
        "*://*.doubleclick.net/*",
      ],
    });
    await send("Emulation.setDeviceMetricsOverride", VIEW);
    // Headless Chrome reports a dark system theme; the store material shows the
    // light one, which is what the listing screenshots have always used.
    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: "light" }],
    });
    try {
      if (mode === "video") await video(send, on, page);
      else await shots(send, page);
    } catch (err) {
      // A failed run is much easier to read as a picture than as a selector name.
      await page.shot(join(ASSETS, "debug-last-screen.png"));
      throw err;
    }
    ws.close();
  } finally {
    chrome.kill();
    // npx spawns vite as a grandchild, so killing the shell is not enough.
    preview.kill();
    killPort(PORT);
  }
}

await main();
