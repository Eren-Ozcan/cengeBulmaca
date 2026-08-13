// The player-facing side of cloud save: startup sync, conflict resolution,
// and the "Link account" row in Settings.
//
// This is a separate module to touch ui.ts (1800+ lines) as little as
// possible: ui.ts makes a single call, all the logic lives here.
//
// THE PAGE RELOADS AFTER A RESTORE. Çengel Bulmaca's state doesn't live in a
// single in-memory object — it lives across ~13 localStorage keys, LAZILY
// read by eight separate modules (stats/economy/theme/sound/music/story/
// tutorial/game). Changing these keys after the screen has already rendered
// would leave the UI showing stale values; reloading is the one cheap way to
// guarantee every module re-reads its save data from scratch. After the
// reload the save matches the cloud, so it doesn't loop.
//
// Sync does NOT block startup: the splash/game proceed through their normal
// flow, and the cloud response steps in afterward if needed. A deliberate
// choice so the player isn't staring at a blank screen for 7 seconds on a
// bad network.

import {
  isAccountLinkingAvailable,
  isFirebaseConfigured,
  linkWithGoogle,
  linkedAccountLabel,
} from "./firebase-app.ts";
import {
  conflictSummary,
  flushCloudSave,
  localSummary,
  maybeUploadCloudSave,
  resetForNewAccount as resetCloudSaveForNewAccount,
  resolveKeepCloud,
  resolveKeepLocal,
  syncCloudSave,
  type CloudSummary,
  type CloudSyncResult,
} from "./cloud-save.ts";
import { resetForNewAccount as resetReferralForNewAccount } from "./referral.ts";

/** Dirty-save check interval; the actual write is subject to the throttling in cloud-save.ts. */
const UPLOAD_CHECK_MS = 30_000;

let autoUploadInstalled = false;

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
  toastTimer = window.setTimeout(() => t.remove(), 2600);
}

/**
 * Called once at startup (see main.ts). Does nothing if not configured;
 * on error, also silently falls back to the local game.
 */
export async function initCloudSave(root: HTMLElement): Promise<void> {
  if (!isFirebaseConfigured()) return;
  installAutoUpload();
  handleSyncResult(root, await syncCloudSave());
}

function handleSyncResult(root: HTMLElement, result: CloudSyncResult): void {
  if (result === "conflict") {
    showConflict(root);
  } else if (result === "restored") {
    // At both call sites the restore resolves AFTER the screen has already
    // rendered (startup sync deliberately doesn't block, and linking an
    // account happens mid-game anyway). An unannounced reload would look
    // like a crash to the player: tell them what happened first, then
    // reload.
    reloadAfterRestore(root);
  } else if (result === "needs-update") {
    toast(root, "Bulut kaydın daha yeni bir sürümle oluşturulmuş. Uygulamayı güncelle.");
  }
}

/** Long enough for the toast to be read; see the reload note at the top of the file. */
const RESTORE_RELOAD_MS = 1_400;

/**
 * Reloads the page after the save fetched from the cloud has been applied.
 * The save is already written to localStorage; the reload is only to
 * refresh the stale values still shown on screen.
 *
 * During this delay the player could keep playing, and the puzzle's
 * in-memory state on screen would STILL belong to the old save. If writes
 * were allowed, they'd overwrite the newly arrived progress, and then (since
 * the reload this function triggers fires "pagehide") get uploaded on top of
 * the other device's cloud save. That's why, from the moment of restore
 * onward, both the stale local write and the cloud write are frozen — see
 * `frozen` in cloud-save.ts.
 */
function reloadAfterRestore(root: HTMLElement): void {
  toast(root, "Buluttaki ilerlemen getirildi, oyun yenileniyor…");
  window.setTimeout(() => window.location.reload(), RESTORE_RELOAD_MS);
}

/**
 * Two triggers that push local changes to the cloud:
 *  - a periodic check: keeps progress in the cloud too while the player is
 *    on a long session
 *  - a FORCED write when the app is backgrounded: on mobile the WebView may
 *    be frozen or the process killed right after this, so bypassing the
 *    throttle is required.
 */
function installAutoUpload(): void {
  if (autoUploadInstalled) return;
  autoUploadInstalled = true;
  window.setInterval(() => maybeUploadCloudSave(), UPLOAD_CHECK_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushCloudSave();
  });
  // On iOS/WebView, visibilitychange doesn't always fire when the tab closes.
  window.addEventListener("pagehide", () => flushCloudSave());
}

// ---------- conflict screen ----------

function relativeTime(ms: number): string {
  if (!ms) return "zamanı bilinmiyor";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "az önce";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} dakika önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}

function summaryLine(s: CloudSummary): string {
  return `${s.solved} bulmaca · ${s.streak} günlük seri · ${s.jokers} joker`;
}

/**
 * Lets the player choose between two sets of progress. The code does NOT
 * decide on its own and does not auto-merge (see the rationale at the top of
 * cloud-save.ts); whichever side isn't chosen stays exactly where it is,
 * nothing is deleted.
 */
function showConflict(root: HTMLElement): void {
  const cloud = conflictSummary();
  if (!cloud) return;
  const local = localSummary();

  const overlay = el("div", "overlay");
  const modal = el("div", "modal");
  modal.appendChild(el("div", "modal-emoji", "☁️"));
  modal.appendChild(el("h2", "modal-title", "İki ilerleme bulundu"));
  modal.appendChild(
    el(
      "p",
      "modal-text",
      "Bu hesabın bulutta kayıtlı bir ilerlemesi var ve bu cihazdaki ilerlemeyle aynı değil. Hangisiyle devam etmek istersin?",
    ),
  );

  const cloudInfo = el("div", "modal-streak", `Bulut: ${summaryLine(cloud)}`);
  modal.appendChild(cloudInfo);
  modal.appendChild(el("div", "modal-cat-next", `Son güncelleme: ${relativeTime(cloud.updatedAtMs)}`));
  modal.appendChild(el("div", "modal-streak", `Bu cihaz: ${summaryLine(local)}`));

  const cloudBtn = el("button", "modal-btn", "Buluttaki ilerlemeyi getir");
  cloudBtn.addEventListener("click", () => {
    overlay.remove();
    if (resolveKeepCloud()) window.location.reload();
    else toast(root, "Bulut kaydı getirilemedi, bu cihazdaki ilerleme korundu.");
  });
  modal.appendChild(cloudBtn);

  const localBtn = el("button", "modal-btn modal-share", "Bu cihazdakiyle devam et");
  localBtn.addEventListener("click", () => {
    overlay.remove();
    void resolveKeepLocal().then(() => toast(root, "Bu cihazdaki ilerlemeyle devam ediliyor."));
  });
  modal.appendChild(localBtn);

  overlay.appendChild(modal);
  // Can't be dismissed by tapping the backdrop: writes stay locked until a
  // choice is made.
  //
  // Appended to `document.body`, NOT to `root`: every screen transition in
  // ui.ts (renderHome/renderCollection/...) does `root.innerHTML = ""` (App's
  // full re-render model). The sync response can arrive AFTER the player has
  // already started navigating (startup sync deliberately doesn't block); if
  // the overlay were appended to root, the next screen render would silently
  // wipe it out while the `blocked` flag in cloud-save.ts stayed uncleared —
  // locking cloud sync for the rest of the session before the player ever
  // got a chance to choose. Staying at the body level guarantees the overlay
  // is independent of App's render loop and only closes when its button is
  // pressed.
  document.body.appendChild(overlay);
}

// ---------- settings row ----------

/**
 * The "Link account" row added to the Settings screen. All ui.ts needs to
 * do is add this to the list.
 */
export function cloudSettingsRow(root: HTMLElement): HTMLElement {
  const card = el("button", "puzzle-card");
  const info = el("div", "puzzle-info");
  const title = el("div", "puzzle-title", "Hesabı bağla");
  const sub = el("div", "puzzle-sub", "İlerlemen diğer cihazlarında da açılsın");
  info.appendChild(title);
  info.appendChild(sub);
  card.appendChild(el("div", "puzzle-num", "☁️"));
  card.appendChild(info);
  card.appendChild(el("div", "puzzle-badge", "›"));

  const refresh = () =>
    void linkedAccountLabel().then((label) => {
      if (!label) return;
      title.textContent = "Hesap bağlı";
      sub.textContent = label;
    });
  refresh();

  card.addEventListener("click", () => void onLinkClick(root, refresh));
  return card;
}

async function onLinkClick(root: HTMLElement, refresh: () => void): Promise<void> {
  if (await linkedAccountLabel()) {
    toast(root, "Hesabın zaten bağlı, ilerlemen buluta kaydediliyor.");
    return;
  }
  if (!isAccountLinkingAvailable()) {
    toast(root, "Hesap bağlama mobil sürümde kullanılabilir.");
    return;
  }

  toast(root, "Google hesabı seçiliyor…");
  const res = await linkWithGoogle();
  toast(root, res.msg);
  if (!res.ok) return;
  refresh();

  if (res.switched) {
    // Switched to a different account: the device's rev counter and
    // fingerprint belonged to the old account and are now meaningless.
    // Resetting them and re-running sync either brings in the cloud
    // progress directly or lets the player choose. referral.ts's own uid
    // cache must be reset for the same reason, otherwise referral rewards
    // keep getting written to the old account for the rest of the session.
    resetCloudSaveForNewAccount();
    resetReferralForNewAccount();
  }
  handleSyncResult(root, await syncCloudSave());
}
