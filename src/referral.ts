// Friend referral system: when a new player who arrived via an invite link
// solves their first puzzle, both they and whoever invited them earn a
// joker.
//
// This feature uses a lightweight Firebase (Firestore + Anonymous Auth)
// backend — localStorage alone can't securely share information between
// two different devices. The Firebase project (cengel-bulmaca-c504d,
// yilkgamesstudio@gmail.com account, free Spark plan) has been set up:
// Anonymous Auth is enabled, Firestore has been created, and this
// project's firestore.rules have been published via the Firebase Console
// — the rules are written to reject self-referral and claiming the reward
// more than once (see the explanation in that file).
//
// Known limitation (also disclosed to the user): the Anonymous Auth
// identity is tied to the device install — uninstalling and reinstalling
// the app produces a new identity. This doesn't make it fully impossible
// for a determined user to self-refer with multiple devices/installs;
// true install attribution requires the Play Install Referrer API after
// the Play Store launch. What's targeted here is PREVENTING one-tap
// self-rewarding and tying the reward to a genuine engagement signal
// (solving the first puzzle).
//
// When the API key is empty, or on a network/permission error, all
// functions silently no-op — same convention as ads.ts/billing.ts.

import { grantJokers } from "./economy.ts";
import { ensureUid, firebaseSdk, isFirebaseConfigured } from "./firebase-app.ts";

const REFERRAL_REWARD = 3;
const SYNCED_KEY = "cengel-referral-synced";
const REF_PARAM = "ref";

type FirestoreModules = typeof import("firebase/firestore");

let db: import("firebase/firestore").Firestore | null = null;
let fs: FirestoreModules | null = null;
let readyPromise: Promise<string | null> | null = null;

/** Reads and clears the URL's ?ref=<uid> parameter, once. */
function captureIncomingRef(): string | null {
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get(REF_PARAM);
    if (ref) {
      url.searchParams.delete(REF_PARAM);
      window.history.replaceState({}, "", url.toString());
    }
    return ref;
  } catch {
    return null;
  }
}

/**
 * Gets the player identity and (if being created for the first time)
 * writes the player document along with the referrer. Returns the player's
 * own uid; returns null if not configured or on error.
 *
 * The Firebase app and anonymous session are now shared via
 * firebase-app.ts: cloud save (cloud-save.ts) uses the same identity, and
 * calling initializeApp() a second time would throw Firebase's
 * "app/duplicate-app" error.
 */
async function ensureReady(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  readyPromise ??= (async () => {
    try {
      const uid = await ensureUid();
      const sdk = await firebaseSdk();
      if (!uid || !sdk) return null;
      fs = sdk.fs;
      db = sdk.db;

      const ref = captureIncomingRef();
      const playerRef = sdk.fs.doc(db, "players", uid);
      const snap = await sdk.fs.getDoc(playerRef);
      if (!snap.exists()) {
        await sdk.fs.setDoc(playerRef, {
          createdAt: sdk.fs.serverTimestamp(),
          referredBy: ref && ref !== uid ? ref : null,
          firstPuzzleRewardClaimed: false,
          jokerBalanceCloud: 0,
        });
      }
      return uid;
    } catch {
      return null;
    }
  })();
  return readyPromise;
}

/**
 * Called when the session switches to a different account (see
 * cloud-save.ts resetForNewAccount — same event, separate cache per
 * module). `readyPromise` is memoized once at module scope (ensureReady
 * above); if it isn't reset, it would keep returning the old account's uid
 * even after the account changes: getInviteLink/syncCloudJokers/
 * claimFirstPuzzleReferralReward would silently keep reading and writing
 * the old account's `players/{oldUid}` document for the rest of the
 * session, and the newly linked account would never see its referral
 * rewards.
 */
export function resetForNewAccount(): void {
  readyPromise = null;
  db = null;
  fs = null;
}

/** Called once on app startup; no-ops on web/dev or when unconfigured. */
export async function initReferral(): Promise<void> {
  const uid = await ensureReady();
  if (uid) await syncCloudJokers();
}

/**
 * Adds the joker difference accumulated on the cloud side (earned via
 * referral rewards) to the local balance. The amount already synced on
 * this device is kept in localStorage; so if the app is uninstalled and
 * reinstalled, the same reward could be synced again — a known and
 * accepted limitation (see the top of this file).
 */
export async function syncCloudJokers(): Promise<void> {
  const uid = await ensureReady();
  if (!uid || !db || !fs) return;
  try {
    const snap = await fs.getDoc(fs.doc(db, "players", uid));
    const cloudTotal = Number(snap.data()?.jokerBalanceCloud ?? 0);
    const synced = Number(localStorage.getItem(SYNCED_KEY) ?? "0");
    if (cloudTotal > synced) {
      grantJokers(cloudTotal - synced);
      localStorage.setItem(SYNCED_KEY, String(cloudTotal));
    }
  } catch {
    // if there's no network or a permission error, give up silently; retried on the next sync
  }
}

/**
 * Called once when the player completes their first puzzle. If this player
 * arrived via a referral and hasn't already claimed the reward, adds
 * REFERRAL_REWARD jokers to both themselves and whoever invited them (see
 * firestore.rules — the rule enforces that this can happen only once and
 * only when a genuine referral relationship exists).
 */
export async function claimFirstPuzzleReferralReward(): Promise<void> {
  const uid = await ensureReady();
  if (!uid || !db || !fs) return;
  try {
    const playerRef = fs.doc(db, "players", uid);
    const snap = await fs.getDoc(playerRef);
    const data = snap.data();
    if (!data || !data.referredBy || data.firstPuzzleRewardClaimed) return;

    const referrerRef = fs.doc(db, "players", data.referredBy as string);
    await fs.runTransaction(db, async (tx) => {
      const [me, referrer] = await Promise.all([tx.get(playerRef), tx.get(referrerRef)]);
      const meData = me.data();
      if (!meData || meData.firstPuzzleRewardClaimed) return;
      const referrerData = referrer.data();
      if (!referrerData) return;
      tx.update(playerRef, {
        firstPuzzleRewardClaimed: true,
        jokerBalanceCloud: (meData.jokerBalanceCloud ?? 0) + REFERRAL_REWARD,
      });
      tx.update(referrerRef, {
        jokerBalanceCloud: (referrerData.jokerBalanceCloud ?? 0) + REFERRAL_REWARD,
      });
    });
    await syncCloudJokers();
  } catch {
    // on a consent/network error, the reward simply isn't granted; doesn't break the game
  }
}

/** Shareable invite link; returns null if not configured. */
export async function getInviteLink(): Promise<string | null> {
  const uid = await ensureReady();
  if (!uid) return null;
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set(REF_PARAM, uid);
  return url.toString();
}

/** Shares the invite link via the system share menu, or copies it to the clipboard otherwise. */
export async function shareInvite(): Promise<"shared" | "copied" | "unavailable"> {
  const link = await getInviteLink();
  if (!link) return "unavailable";
  const text = `Çengel Bulmaca'ya benimle katıl, birlikte joker kazanalım! ${link}`;
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return "shared";
    }
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "unavailable";
  }
}
