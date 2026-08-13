// AdMob ad integration (@capacitor-community/admob).
//
// Real AdMob account: yilkgamesstudio@gmail.com (app: Çengel Bulmaca,
// App ID ca-app-pub-9709993577664180~3994312791). Remaining step before
// launch: create a GDPR message (UMP) campaign in the AdMob account's
// "Privacy & messaging" section — the requestConsentInfo/showConsentForm
// calls below render that campaign; without a campaign it returns
// NOT_REQUIRED and shows nothing, same as for users outside the EU/EEA.
//
// Only runs on native platforms (Android/iOS); on web/dev all functions
// silently no-op and never break the game flow.

import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { AdMob, AdmobConsentStatus, RewardAdPluginEvents } from "@capacitor-community/admob";
import { adsRemoved } from "./billing.ts";

const REWARDED_AD_ID = "ca-app-pub-9709993577664180/1978523543";
const INTERSTITIAL_AD_ID = "ca-app-pub-9709993577664180/6923728460";

// showRewardedHintAd()'s promise is resolved ONLY by one of the
// Rewarded/Dismissed/FailedToShow plugin events; none of them is guaranteed
// (if the app is backgrounded mid-ad, or the plugin never emits an event,
// the promise would hang forever). The caller (ui.ts) disables the button
// until this promise resolves — without a timeout the button would stay
// locked for the rest of the session.
const REWARD_AD_TIMEOUT_MS = 60_000;

// Two interstitial ads can't be shown back-to-back (AdMob's "disallowed
// interstitial implementations" rule). Written to localStorage so a cold
// start (closing and reopening the app) doesn't reset this guard — if it
// were kept only in memory, the player would get a "clean" ad slot on
// every relaunch.
const INTERSTITIAL_COOLDOWN_MS = 5 * 60 * 1000;
const LAST_INTERSTITIAL_KEY = "cengeBulmaca.ads.lastInterstitial";

let initialized = false;

/**
 * Epoch ms of the last shown interstitial ad. Returns 0 if the stored value
 * is corrupt or the device clock was set back (the value appears to be in
 * the future): treat the cooldown as "never shown" instead of locking the
 * ad out forever — the safe side here is preserving the rule's intent (no
 * back-to-back shows), not permanently denying the player ads.
 */
function lastInterstitialAt(): number {
  const raw = Number(localStorage.getItem(LAST_INTERSTITIAL_KEY) ?? "0");
  if (!Number.isFinite(raw) || raw < 0 || raw > Date.now()) return 0;
  return raw;
}

/**
 * Runs Google's actual UMP (User Messaging Platform) flow: shows the
 * Google-rendered GDPR consent form when required, for users in the
 * EU/EEA region. This is NOT a hand-rolled "I agree" screen — it produces
 * the real consent signal (IAB TCF) that ad SDKs actually honor; a custom
 * screen would not produce that and would not provide real compliance.
 * For users outside the region, or when no campaign is configured, it
 * silently shows nothing (NOT_REQUIRED). Order matters: this must run
 * BEFORE AdMob.initialize() — the ad SDK must not be initialized and
 * request ads before consent is known. The return value (canRequestAds)
 * is the single source of truth for whether ad requests are actually
 * allowed.
 */
async function ensureConsent(): Promise<boolean> {
  try {
    let info = await AdMob.requestConsentInfo();
    if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) {
      info = await AdMob.showConsentForm();
    }
    return info.canRequestAds;
  } catch {
    // If consent info can't be obtained (no network, campaign not
    // configured, etc.), the safe side is not to request ads — the game
    // itself is never affected by this, it just continues without ads
    return false;
  }
}

async function ensureInitialized(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (initialized) return true;
  const canRequestAds = await ensureConsent();
  if (!canRequestAds) return false;
  try {
    await AdMob.initialize({});
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

/** Called once on app startup; silently does nothing on web. */
export async function initAds(): Promise<void> {
  await ensureInitialized();
}

/**
 * Prepares and shows the rewarded ad. Returns true if the user watches the
 * ad to completion and earns the reward; returns false if they close it
 * early, the ad fails to load, or we're on web/dev. The "Dismissed" event
 * fires in both cases (rewarded or not), so we resolve the result through
 * that event — showRewardVideoAd()'s own promise only resolves when the
 * reward is actually earned, and would never resolve (leaving the flow
 * hanging) on an early close.
 */
export async function showRewardedHintAd(): Promise<boolean> {
  try {
    if (!(await ensureInitialized())) return false;
    await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_ID });
  } catch {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let rewarded = false;
    let settled = false;
    const handles: PluginListenerHandle[] = [];

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
      Promise.all(handles.map((h) => h.remove())).catch(() => {});
    };

    const timer = setTimeout(() => finish(false), REWARD_AD_TIMEOUT_MS);

    Promise.all([
      AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        rewarded = true;
      }),
      AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish(rewarded)),
      AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish(false)),
    ]).then((added) => handles.push(...added));

    AdMob.showRewardVideoAd().catch(() => {
      // The Dismissed/FailedToShow event will already resolve the result.
    });
  });
}

/**
 * Prepares and shows the interstitial ad. Does not return a reward; it's a
 * purely optional revenue channel called AFTER the puzzle is COMPLETED and
 * the celebration screen has been shown to the player, as they leave that
 * screen (see ui.ts: leaveCompletedScreen). Deliberately not shown IN THE
 * MIDDLE of a puzzle: AdMob's "disallowed interstitial implementations"
 * rule forbids showing interstitials while the player is actively playing,
 * or on app open/close; the only permitted moment is a natural break point
 * where a task/level has just ended. Silently ignored on error/web. Never
 * shown if the user purchased the "remove ads" product — the rewarded ad
 * (earning a hint) is not affected by this restriction, since it's an ad
 * the user chooses to watch in exchange for something.
 */
export async function maybeShowInterstitial(): Promise<void> {
  if (adsRemoved()) return;
  // Two interstitial ads can't be shown back-to-back (see INTERSTITIAL_COOLDOWN_MS).
  if (Date.now() - lastInterstitialAt() < INTERSTITIAL_COOLDOWN_MS) return;
  if (!(await ensureInitialized())) return;
  try {
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_AD_ID });
    await AdMob.showInterstitial();
    localStorage.setItem(LAST_INTERSTITIAL_KEY, String(Date.now()));
  } catch {
    // If the ad fails to load, continue without breaking the game flow
  }
}
