// Cloud save (Firestore) — a single document under `saves/{uid}`.
//
// Design decisions and rationale (same approach used in reefy; verified there
// end-to-end with a real account):
//
// * The DEVICE CLOCK IS NOT TRUSTED. A "last writer wins" approach causes
//   permanent data loss on a device whose clock is set ahead (that device
//   would forever look "newer"). Instead a monotonic `rev` counter is used,
//   and going backwards is forbidden at the firestore.rules level;
//   `updatedAt` is only for display to the user and is a server timestamp.
//
// * NO AUTOMATIC MERGING ON CONFLICT. Merging two progress states (add up the
//   jokers? merge the solved puzzles?) breaks the economy and is exploitable.
//   When a conflict is detected the local save is kept, NOTHING is written to
//   the cloud, and the decision is left to the player (see the cloud-ui.ts
//   conflict screen).
//
// * BUT THE SAME GAME IS NEVER ASKED ABOUT TWICE. `rev` counters only know
//   "who wrote later," not "what was written"; while both sides carry the
//   same game forward the counters can drift apart. Showing the player two
//   columns that are identical and making them choose would be a mistake —
//   whichever one they pick, they get the same game, and they stop trusting
//   the dialog afterward (this actually happened on two real devices in
//   reefy). So before asking, we check whether the two saves are equivalent
//   from the player's point of view (see sameProgress).
//
// * ENTITLEMENTS (purchase rights) DO NOT COME FROM THE CLOUD. "cengel-ads-removed"
//   is stripped from the payload on upload, and the local/store value is kept
//   on download (see billing.ts restoreAdsRemoved). Otherwise sharing a save
//   would be equivalent to handing out a free ad-free version.
//
// * Which keys get synced is decided by an ALLOWLIST, not a blocklist. A new
//   "cengel-" key added tomorrow won't silently leak to the cloud; it has to
//   be added to the list deliberately.
//
// * If there's no network, configuration is missing, or something goes wrong,
//   every function silently becomes a no-op; the game flow is never broken
//   (the same convention used in ads.ts/billing.ts).
//
// KNOWN LIMITATION (also accepted in reefy): jokers are a resource that can
// also be bought with real money. Without server-side validation (Cloud
// Functions), a player could spend jokers offline, then pick the "cloud" side
// in a conflict and get those jokers back. There is no server-side validation
// on the Spark plan; this vector was consciously accepted and nothing here
// closes it off.

import { START_JOKERS } from "./economy.ts";
import { ensureUid, firebaseSdk } from "./firebase-app.ts";
import { dayString } from "./stats.ts";

/** Version of the payload format this client writes. */
export const CLOUD_SCHEMA_VERSION = 1;

const REV_KEY = "cengel-cloud-rev";
/** Fingerprint of the last synced payload; used to derive "is there a local change". */
const FINGERPRINT_KEY = "cengel-cloud-fp";

// 5 minutes, not 1. This protects the Firestore daily write quota (Spark:
// 20K/day), and the periodic path is what burns it: the throttle interval is in
// practice the write interval. At 60s the free quota runs out at a few hundred
// daily players; at 300s the same ceiling is roughly five times higher.
// What is given up: if the process is killed hard without firing
// visibilitychange or pagehide, the cloud copy can be this stale. Both of those
// events call flushCloudSave() (cloud-ui.ts), which uploads immediately and
// ignores this throttle, and the local save is untouched either way - so this
// only matters if the device itself is lost.
const UPLOAD_THROTTLE_MS = 300_000;
// ensureUid() performs three dynamic imports on cold start (firebase/app +
// auth + firestore), runs initializeApp, and waits for Auth to restore the
// persisted session from IndexedDB (see firebase-app.ts waitForRestoredUser).
// On an emulator or low-end device this chain can take several seconds.
//
// The duration here must be GENEROUS: the old 3s value was justified by "don't
// block startup on a bad network," but startup is NOT actually blocked —
// initCloudSave is called with `void` at main.ts:27 and the UI never awaits
// it. On the other hand, the cost of timing out is severe: syncCloudSave
// silently returns "disabled," and since the startup sync only runs ONCE PER
// SESSION it is never retried — the player sees neither a conflict screen nor
// a restore.
const AUTH_TIMEOUT_MS = 15_000;
const FETCH_TIMEOUT_MS = 4_000;
// setDoc() does NOT resolve while offline: Firestore queues the write locally
// and keeps the promise pending until the server acknowledges it. Without a
// timeout, the finally block inside upload() would never run, `uploading`
// would stay locked, and cloud save would be completely dead for the rest of
// the session — that's why writes are also bounded.
const WRITE_TIMEOUT_MS = 8_000;
const MAX_PAYLOAD_BYTES = 400_000; // same ceiling as in firestore.rules

/**
 * Fixed set of synced keys (ALLOWLIST).
 * "cengel-ads-removed" is deliberately NOT included — see the ENTITLEMENT
 * note at the top of the file.
 * "cengel-cloud-rev"/"cengel-cloud-fp" aren't either: those are per-device
 * bookkeeping records, not player progress.
 */
const SYNCED_KEYS = [
  "cengel-jokers",
  "cengel-jokers-init",
  "cengel-stats",
  "cengel-story-seen",
  "cengel-epilogue-seen",
  "cengel-tutorial-seen",
  "cengel-theme",
  "cengel-sound",
  "cengel-music",
  // How much of the joker amount accumulated in the cloud from referral
  // rewards has been applied locally. If not synced, the same reward would
  // be granted a second time on a new device (see referral.ts).
  "cengel-referral-synced",
] as const;

/** One key per puzzle: "cengel-progress-<puzzleId>". */
const PROGRESS_PREFIX = "cengel-progress-";
/** One key per day: "cengel-hints-<YYYY-MM-DD>" (see hints.ts). */
const HINTS_PREFIX = "cengel-hints-";

/**
 * How many days' worth of dated hint keys get carried over.
 *
 * hints.ts only ever reads TODAY's key, so old ones are dead weight and, if
 * not pruned, the document would keep growing a little larger every day
 * forever. Carrying just a single day might seem sufficient, but devices can
 * be in different time zones (or the player travels): one device's "today"
 * can be another device's yesterday/tomorrow. A one-week window comfortably
 * covers that drift while keeping the document's contribution pinned to
 * roughly 100 bytes.
 */
const HINTS_HISTORY_DAYS = 7;

export type CloudSyncResult =
  | "disabled" // no configuration / no network / timeout — silently continue locally
  | "in-sync" // local is at least as up to date as the cloud
  | "uploaded" // there was no cloud record yet, local was uploaded
  | "restored" // downloaded from the cloud and applied
  | "conflict" // both sides have progressed — local was kept, cloud untouched
  | "needs-update"; // the cloud schema is newer than this client

/** Summary the conflict screen can show without opening up the payload. */
export interface CloudSummary {
  streak: number;
  solved: number;
  jokers: number;
  /** Server timestamp (ms). Independent of the device clock; 0 = unknown. */
  updatedAtMs: number;
}

/** Portable form of a save: localStorage key → raw value. */
export type SaveMap = Record<string, string>;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

// ---------- collecting the local save ----------

/** The last HINTS_HISTORY_DAYS days (+ one extra day ahead for time zone drift). */
function liveHintKeys(): Set<string> {
  const keys = new Set<string>();
  const d = new Date();
  d.setDate(d.getDate() + 1);
  for (let i = 0; i <= HINTS_HISTORY_DAYS; i++) {
    keys.add(HINTS_PREFIX + dayString(d));
    d.setDate(d.getDate() - 1);
  }
  return keys;
}

/** Does this key get carried to the cloud? Both upload and download go through the same gate. */
function isSyncedKey(key: string, hintKeys: Set<string>): boolean {
  if ((SYNCED_KEYS as readonly string[]).includes(key)) return true;
  if (key.startsWith(HINTS_PREFIX)) return hintKeys.has(key);
  return key.startsWith(PROGRESS_PREFIX);
}

/** Syncable keys present locally; sorted so the fingerprint stays stable. */
function syncedLocalKeys(): string[] {
  const hintKeys = liveHintKeys();
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isSyncedKey(k, hintKeys)) out.push(k);
    }
  } catch {
    return [];
  }
  return out.sort();
}

/**
 * The form of this device's save that goes to the cloud. This is the single
 * definition of the sync boundary (tests also verify this boundary from
 * here): no key outside the allowlist — especially not "cengel-ads-removed" —
 * can ever get in.
 */
export function collectSyncedSave(): SaveMap {
  const map: SaveMap = {};
  for (const k of syncedLocalKeys()) {
    const v = localStorage.getItem(k);
    if (v !== null) map[k] = v;
  }
  return map;
}

/**
 * Has a counter key never progressed at all? An unreadable value (corrupted
 * record) is NEVER treated as "zero": in hasPlayerProgress any doubt is
 * always resolved in favor of there being progress.
 */
function isUntouchedCounter(v: string | undefined): boolean {
  if (v === undefined || v === "") return true;
  return Number(v) === 0; // NaN === 0 is false → a corrupted value counts as progress
}

/**
 * Has the player actually EARNED something on this device? If not (a fresh
 * install, or a player who just linked their account), the cloud save is
 * restored without asking about a conflict — otherwise the player would be
 * shown a meaningless "which one do you want to keep?" screen where one side
 * is completely empty, risking picking the wrong side and losing their real
 * progress (this happened in reefy).
 *
 * WHERE THE CAUTIOUS SIDE LIES: incorrectly saying "there is progress" at
 * worst falls back to today's behavior, i.e. the choice screen — harmless.
 * Incorrectly saying "there is no progress" SILENTLY DELETES the player's
 * game. So the decision is derived from the presence of progress, not from
 * zero-knowledge, and every case of doubt (corrupted/unreadable value,
 * content we don't recognize) counts as progress.
 *
 * The criterion is the CONTENT of the save, NOT a "is it dirty?" fingerprint
 * or a comparison against some default object. Keys that can change on their
 * own without the player doing anything are deliberately excluded:
 *  - "cengel-theme"/"cengel-sound"/"cengel-music": settings preferences, not
 *    an achievement.
 *  - "cengel-jokers-init": written automatically the first time the balance
 *    is read (while the home screen is being drawn); there's no player action
 *    involved.
 *  - "cengel-story-seen"/"cengel-epilogue-seen"/"cengel-tutorial-seen":
 *    "don't show again" stamps for screens shown AUTOMATICALLY on startup.
 *    Opening the game once and getting past the tutorial writes these; they
 *    have no earned counterpart in the player's save (the tutorial is played
 *    in "practice" mode: it writes neither progress nor stats — see
 *    tutorial.ts). If these counted as progress, the exact scenario we're
 *    trying to fix — a player who has only opened the game once linking their
 *    account — would still show a choice screen with one empty side.
 */
export function hasPlayerProgress(save: SaveMap): boolean {
  for (const [k, v] of Object.entries(save)) {
    // Puzzle progress is only saved once the player types a letter (see
    // game.ts saveProgress; the tutorial puzzle is excluded), so its mere
    // presence is a real move on its own.
    if (k.startsWith(PROGRESS_PREFIX)) return true;
    // A hint key is only written once a hint is actually USED.
    if (k.startsWith(HINTS_PREFIX) && !isUntouchedCounter(v)) return true;
  }

  // The stats record is only written once a puzzle is completed (see
  // stats.ts recordCompletion), so its presence means at least one solve.
  if ((save["cengel-stats"] ?? "") !== "") return true;

  // Any DEVIATION from the starting balance is progress: whether spent
  // (hints) or earned (cat reward, ad, referral, purchase).
  const jokers = save["cengel-jokers"];
  if (jokers !== undefined && Number(jokers) !== START_JOKERS) return true;

  // The processed portion of jokers accumulated in the cloud from a referral
  // reward: if it's above zero, a reward was genuinely received.
  if (!isUntouchedCounter(save["cengel-referral-synced"])) return true;

  return false;
}

/**
 * Keys in a save that do NOT correspond to the player. They're excluded when
 * checking whether two saves are "the same game," because they can drift
 * apart without the player doing anything (or for reasons unrelated to the
 * game):
 *  - "cengel-jokers-init": written automatically the first time the balance
 *    is read.
 *  - "*-seen" stamps: "don't show again" markers for screens shown on
 *    startup; having been shown on one device doesn't mean the progress
 *    differs on another.
 *  - theme/sound/music: PER-DEVICE preferences. The player changing the
 *    theme on this device doesn't make the game on two devices different.
 * This list matches the signals hasPlayerProgress deliberately ignores:
 * whatever is said there to be "not progress on its own" is also said here
 * to be "not a difference on its own."
 */
const INCIDENTAL_KEYS: readonly string[] = [
  "cengel-jokers-init",
  "cengel-story-seen",
  "cengel-epilogue-seen",
  "cengel-tutorial-seen",
  "cengel-theme",
  "cengel-sound",
  "cengel-music",
];

/**
 * The player-visible part of a progress record: the letters that were
 * entered. The cursor position (selRow/selCol/activeClue) also changes just
 * from the player NAVIGATING the puzzle, and says nothing about whether two
 * saves are the same game.
 *
 * A record we can't parse falls back to the raw text: rather than calling
 * something we don't understand "the same," we require exact equality (see
 * the cautious side of sameProgress).
 */
function progressLetters(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    // the old record format was a plain array of letters (see game.ts loadProgress)
    const entries = Array.isArray(parsed) ? parsed : parsed?.entries;
    if (Array.isArray(entries)) return JSON.stringify(entries);
  } catch {
    /* corrupted record: fall back to raw text */
  }
  return raw;
}

/** Comparable form of a save: noise dropped, progress normalized. */
function comparable(save: SaveMap): SaveMap {
  const out: SaveMap = {};
  for (const [k, v] of Object.entries(save)) {
    if (INCIDENTAL_KEYS.includes(k)) continue;
    out[k] = k.startsWith(PROGRESS_PREFIX) ? progressLetters(v) : v;
  }
  return out;
}

/**
 * Are two saves the SAME game from the player's point of view?
 *
 * WHY THIS IS NEEDED: `rev` is purely ordering information. If one device
 * restores from the cloud and continues carrying the same game forward while
 * the other device keeps writing, the counters diverge and we fall into the
 * conflict branch — even though there aren't actually two progress states to
 * choose between. Also, the fingerprint that answers "is it dirty?" is a
 * PER-DEVICE bookkeeping record: resetForNewAccount clears it, and an upload
 * that times out (but still lands on the server) leaves it stale. In both
 * cases the save looks "dirty" even though it's byte-for-byte identical to
 * the cloud.
 *
 * WHERE THE CAUTIOUS SIDE LIES: incorrectly saying "different" at worst falls
 * back to today's behavior, i.e. the choice screen — harmless. Incorrectly
 * saying "same" discards one side's progress without asking. So equality is
 * REQUIRED to be proven: anything we don't recognize or can't parse requires
 * exact text equality, and doubt resolves to false.
 */
export function sameProgress(a: SaveMap, b: SaveMap): boolean {
  const left = comparable(a);
  const right = comparable(b);
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  for (const k of keys) {
    if (left[k] !== right[k]) return false;
  }
  return true;
}

function summarize(map: SaveMap, updatedAtMs = 0): CloudSummary {
  let streak = 0;
  let solved = 0;
  try {
    const s = JSON.parse(map["cengel-stats"] ?? "null");
    if (s && typeof s === "object") {
      if (typeof s.streak === "number") streak = s.streak;
      if (Array.isArray(s.solved)) solved = s.solved.length;
    }
  } catch {
    /* corrupted stats: show 0 */
  }
  const jokers = Number(map["cengel-jokers"] ?? "0");
  return {
    streak,
    solved,
    jokers: Number.isFinite(jokers) ? Math.max(0, Math.floor(jokers)) : 0,
    updatedAtMs,
  };
}

/** Summary of this device's save — the "This device" side of the conflict screen. */
export function localSummary(): CloudSummary {
  return summarize(collectSyncedSave());
}

// ---------- bookkeeping records (rev / fingerprint) ----------

function readRev(): number {
  try {
    const n = Number(localStorage.getItem(REV_KEY) ?? "0");
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writeRev(v: number): void {
  try {
    localStorage.setItem(REV_KEY, String(v));
  } catch {
    /* storage blocked — cloud save is disabled, the game is unaffected */
  }
}

/**
 * Fingerprint of the payload. This is how we tell whether there's a local
 * change, letting us answer "is it dirty?" without touching any of the ~8
 * modules that write to the save (game/stats/economy/theme/…). Length + djb2
 * are used together: relying on a 32-bit digest alone could collide and skip
 * an upload.
 */
function fingerprint(payload: string): string {
  let h = 5381;
  for (let i = 0; i < payload.length; i++) h = ((h * 33) ^ payload.charCodeAt(i)) >>> 0;
  return `${payload.length}:${h.toString(36)}`;
}

function markSynced(payload: string): void {
  try {
    localStorage.setItem(FINGERPRINT_KEY, fingerprint(payload));
  } catch {
    /* ignored */
  }
}

function isDirty(payload: string): boolean {
  try {
    return localStorage.getItem(FINGERPRINT_KEY) !== fingerprint(payload);
  } catch {
    return true;
  }
}

// ---------- sync state ----------

let lastUpload = 0;
let uploading = false;
/** Writes stop until the conflict is resolved; the cloud version is preserved as a backup. */
let blocked = false;
/**
 * Stays true from when a cloud record is applied UNTIL the page reloads
 * (see applyCloud, cloud-ui.ts reloadAfterRestore).
 *
 * WHY THIS EXISTS: applyCloud modifies localStorage in place, but the screen
 * and MEMORY still hold the pre-restore game state. During this window, the
 * only place that writes from stale in-memory state to disk is game.ts's
 * progress save: GameState.entries was read when the puzzle was opened
 * (i.e. BEFORE the restore), and pressing a single key overwrites the ENTIRE
 * array on top of the newly arrived progress. The remaining writers
 * (stats/economy/theme/stamps) do a read-modify-write against disk, so they
 * work with fresh data and don't carry a stale snapshot.
 *
 * The real risk isn't even local: location.reload() triggers "pagehide,"
 * flushCloudSave() runs, and this hybrid save would get uploaded on top of
 * the OTHER DEVICE's cloud save. That's why both stale local writes (see
 * isSaveFrozen) and cloud writes are frozen. After the reload, module state
 * starts fresh.
 */
let frozen = false;
let pendingCloud: { rev: number; map: SaveMap; summary: CloudSummary } | null = null;

/**
 * Is writing from the (stale) in-memory state to disk currently forbidden?
 * game.ts's progress save checks this; see the `frozen` note above.
 */
export function isSaveFrozen(): boolean {
  return frozen;
}

/** Summary of the cloud save if there's an unresolved conflict. */
export function conflictSummary(): CloudSummary | null {
  return blocked ? (pendingCloud?.summary ?? null) : null;
}

/**
 * Called when the session switches to a different account. The rev counter
 * is kept PER DEVICE and belonged to the old account; it's meaningless for
 * the new one. If not reset, the local counter could look larger than the
 * cloud's and be mistaken for "local is up to date," silently overwriting the
 * other account's progress. Resetting it and clearing the fingerprint means
 * the next sync() sees both sides and lets the user choose if needed.
 */
export function resetForNewAccount(): void {
  writeRev(0);
  try {
    localStorage.removeItem(FINGERPRINT_KEY);
  } catch {
    /* ignored */
  }
  blocked = false;
  frozen = false;
  pendingCloud = null;
  lastUpload = 0;
}

async function saveDoc() {
  const uid = await withTimeout(ensureUid(), AUTH_TIMEOUT_MS);
  if (!uid) return null;
  const sdk = await firebaseSdk();
  if (!sdk) return null;
  return { sdk, ref: sdk.fs.doc(sdk.db, "saves", uid) };
}

/**
 * Keys expected to hold numbers: economy.ts/hints.ts/referral.ts pass these
 * values straight into Number(...). If a corrupted/tampered document leaks a
 * NaN, Math.max(0, NaN) also returns NaN — the `n <= 0` guard in
 * spendJoker() (where NaN <= 0 is false) silently stops working and the
 * balance can be spent without limit. That's why cloud-sourced values are
 * validated BEFORE being written to localStorage.
 */
function isValidNumericValue(v: string): boolean {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0;
}

function isNumericKey(key: string): boolean {
  return key === "cengel-jokers" || key === "cengel-referral-synced" || key.startsWith(HINTS_PREFIX);
}

/**
 * Validates a payload coming from the cloud. It goes through the same gate as
 * the local save: only allowlisted keys, only string values. This way a
 * tampered document can neither write "cengel-ads-removed" nor smuggle an
 * unrecognized key into localStorage. For numeric keys it additionally
 * verifies that the value is genuinely a valid, non-negative number (see
 * isNumericKey) — otherwise that key is skipped entirely while the rest of
 * the payload is still applied.
 */
export function parseCloudPayload(payload: string): SaveMap | null {
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const hintKeys = liveHintKeys();
  const map: SaveMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "string") continue;
    if (!isSyncedKey(k, hintKeys)) continue;
    if (isNumericKey(k) && !isValidNumericValue(v)) continue;
    map[k] = v;
  }
  return map;
}

/**
 * Applies the cloud save to local. "Cloud wins" means NOT merging: first the
 * synced local keys are deleted, then the cloud ones are written. Otherwise a
 * puzzle progress left over locally would produce a hybrid of the two saves.
 */
function applyCloud(rev: number, map: SaveMap): boolean {
  try {
    for (const k of syncedLocalKeys()) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(map)) localStorage.setItem(k, v);
  } catch {
    return false;
  }
  writeRev(rev);
  markSynced(serialize(collectSyncedSave()));
  blocked = false;
  // Both stale local writes and cloud writes stop until the reload; see the
  // `frozen` declaration for the rationale.
  frozen = true;
  pendingCloud = null;
  return true;
}

function serialize(map: SaveMap): string {
  return JSON.stringify(map);
}

/** Actual UTF-8 byte length (see above — `.length` doesn't give this). */
function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

async function upload(): Promise<boolean> {
  if (blocked || frozen || uploading) return false;
  uploading = true;
  // Update the throttle at the START of the attempt: otherwise, while
  // offline, every failed attempt would leave the throttle at zero and the
  // periodic check would turn into a retry storm.
  lastUpload = Date.now();

  try {
    const target = await saveDoc();
    if (!target) return false;

    const map = collectSyncedSave();
    const payload = serialize(map);
    // A save exceeding the document ceiling (shouldn't happen: even 300
    // fully completed puzzles is ~200 KB) is silently skipped; the local save
    // stays intact. `payload.length` counts UTF-16 CODE UNITS, while the
    // ceiling in firestore.rules counts UTF-8 BYTES — Turkish characters
    // (ç/ğ/ı/ö/ş/ü) are 2 bytes in UTF-8 but 1 unit here; a length-based check
    // would keep thinking a write near the ceiling was "safe" and send one
    // the server would actually reject.
    if (utf8ByteLength(payload) > MAX_PAYLOAD_BYTES) return false;

    const nextRev = readRev() + 1;
    const { sdk, ref } = target;
    const written = await withTimeout(
      sdk.fs
        .setDoc(ref, {
          payload,
          schemaVersion: CLOUD_SCHEMA_VERSION,
          rev: nextRev,
          updatedAt: sdk.fs.serverTimestamp(),
          // Only so the record can be visually distinguished in the Firestore
          // console; the app always computes summaries from the payload (see
          // summarize).
          summary: summarize(map),
        })
        .then(
          () => "ok" as const,
          // The server SAW the request and rejected it (rule denial or
          // network error): must be kept separate from a timeout, see below.
          () => "rejected" as const,
        ),
      WRITE_TIMEOUT_MS,
    );

    // A timeout (null) is NOT the same thing as a REJECTION ("rejected"):
    //
    //  - Timeout: Firestore may have queued the write and it could still land
    //    on the server later. Retrying the same rev would then be rejected by
    //    the rule (rev must increase) and sync would get permanently stuck —
    //    that's why the counter is advanced anyway. The counter is cheap;
    //    advancing it is safe.
    //
    //  - Rejection: the write DEFINITELY did not land on the server.
    //    Advancing the counter here would be fatal: every failed attempt
    //    would bump the local rev by one, the counter would SURPASS the
    //    cloud's within a few attempts, and syncCloudSave would forever fall
    //    into the `cloudRev <= readRev()` branch and say "in-sync." The
    //    device would never download the other device's save again, and
    //    worse, would overwrite it with its own stale save at the first
    //    opportunity — silent data loss. That's why a rejected write does NOT
    //    touch the counter; the next attempt retries the same rev.
    if (written !== "rejected") writeRev(nextRev);
    if (written !== "ok") return false; // fingerprint not updated → retried later

    markSynced(payload);
    return true;
  } catch {
    // Rule denial (stale rev) or network error: fingerprint is preserved, retried later.
    return false;
  } finally {
    uploading = false;
  }
}

/**
 * Called once on startup: compares the cloud save with the local one and, if
 * needed, updates localStorage in place.
 */
export async function syncCloudSave(): Promise<CloudSyncResult> {
  const target = await saveDoc();
  if (!target) return "disabled";
  const { sdk, ref } = target;

  const snap = await withTimeout(sdk.fs.getDoc(ref), FETCH_TIMEOUT_MS);
  if (!snap) return "disabled";

  if (!snap.exists()) {
    return (await upload()) ? "uploaded" : "disabled";
  }

  const data = snap.data() as {
    payload?: unknown;
    rev?: unknown;
    schemaVersion?: unknown;
    updatedAt?: { toMillis?: () => number };
  };
  const cloudRev = typeof data.rev === "number" ? data.rev : 0;
  const cloudSchema = typeof data.schemaVersion === "number" ? data.schemaVersion : 0;

  // A record written by a newer client: don't touch it at all, since we'd
  // strip fields we don't recognize and corrupt the data.
  if (cloudSchema > CLOUD_SCHEMA_VERSION) return "needs-update";
  if (typeof data.payload !== "string") return "disabled";

  const cloudMap = parseCloudPayload(data.payload);
  if (!cloudMap) return "disabled";

  const localSave = collectSyncedSave();
  const dirty = isDirty(serialize(localSave));

  // Local is at least as up to date as the cloud — the normal case.
  if (cloudRev <= readRev()) {
    if (dirty) void upload();
    return "in-sync";
  }

  const updatedAtMs =
    typeof data.updatedAt?.toMillis === "function" ? data.updatedAt.toMillis() : 0;

  // Cloud is ahead and local also has unsent changes: a genuine conflict —
  // the decision belongs to the player, don't write to the cloud. The one
  // exception is when there's NO earned progress that would be lost locally
  // (a fresh install, or a player who opened the game and immediately linked
  // their account): being "dirty" alone isn't progress, so instead of showing
  // a choice screen with one empty side, the cloud is fetched directly.
  if (dirty && hasPlayerProgress(localSave)) {
    // If both sides are carrying the SAME game from the player's point of
    // view, asking would be wrong: whichever one is picked, the result is the
    // same, but the player stops trusting this dialog afterward. Resolve it
    // silently — adopting the cloud's `rev` breaks the loop, otherwise the
    // same screen would come back every time the other device writes.
    //
    // The cloud is NOT applied on top of local (applyCloud isn't called):
    // since both sides are already equivalent, downloading gains nothing,
    // while there's a risk of overwriting something genuinely newer left
    // locally. Local stays as-is and takes the normal "dirty" path to the
    // cloud.
    if (sameProgress(localSave, cloudMap)) {
      writeRev(cloudRev);
      void upload(); // rev becomes cloudRev+1: satisfies the rule (rev must increase)
      return "in-sync";
    }

    blocked = true;
    pendingCloud = {
      rev: cloudRev,
      map: cloudMap,
      summary: summarize(cloudMap, updatedAtMs),
    };
    return "conflict";
  }

  return applyCloud(cloudRev, cloudMap) ? "restored" : "disabled";
}

/** Resolves the conflict in favor of "this device wins." */
export async function resolveKeepLocal(): Promise<void> {
  if (pendingCloud) writeRev(pendingCloud.rev);
  blocked = false;
  pendingCloud = null;
  await upload();
}

/** Resolves the conflict in favor of "the cloud wins." */
export function resolveKeepCloud(): boolean {
  if (!pendingCloud) return false;
  return applyCloud(pendingCloud.rev, pendingCloud.map);
}

/** Throttled upload — won't burn through the quota on frequent calls. */
export function maybeUploadCloudSave(): void {
  if (Date.now() - lastUpload < UPLOAD_THROTTLE_MS) return;
  if (!isDirty(serialize(collectSyncedSave()))) return;
  void upload();
}

/** Immediate upload — used when the app is backgrounded / at critical moments. */
export function flushCloudSave(): void {
  if (!isDirty(serialize(collectSyncedSave()))) return;
  void upload();
}
