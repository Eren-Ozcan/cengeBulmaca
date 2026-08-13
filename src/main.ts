import "@fontsource-variable/nunito/index.css";
import "./style.css";
import { App } from "./ui.ts";
import { puzzles, warmPuzzles } from "./puzzles/index.ts";
import { dailyIndex } from "./stats.ts";
import { initTheme } from "./theme.ts";
import { initAds } from "./ads.ts";
import { initReferral } from "./referral.ts";
import { ensureMusicStarted } from "./music.ts";
import { restoreAdsRemoved } from "./billing.ts";
import { initCloudSave } from "./cloud-ui.ts";

initTheme();
void initAds();
void initReferral();
void restoreAdsRemoved();
// Due to the browser/WebView autoplay policy, music can only start after a
// genuine user gesture; triggered once on the first tap.
document.addEventListener("pointerdown", () => ensureMusicStarted(), { once: true });
// Loads the first puzzles (+ the puzzle of the day) right away so the
// initial screen appears instantly; the rest is downloaded in the
// background (see warmPuzzles). A network error here must NOT swallow the
// whole app: a top-level await that rejects without a try/catch crashes
// the module and App never gets set up (see ensureLoaded — opening an
// individual puzzle already has its own error handling).
try {
  await warmPuzzles(dailyIndex(puzzles.length));
} catch {
  /* eager load failed: continue with placeholders, ensureLoaded retries individually */
}
const root = document.querySelector<HTMLDivElement>("#app")!;
// Cloud save sync does NOT block startup (can take up to 7 seconds on a
// bad network); the splash and game proceed on their normal flow, and it
// steps in afterward if needed once the response arrives (see cloud-ui.ts).
void initCloudSave(root);
const app = new App(root, puzzles);
app.attachPhysicalKeyboard();
attachAndroidBackButton(app);
app.start();

/**
 * Wires the Android back button to in-app navigation.
 *
 * As long as no listener is REGISTERED, Capacitor turns the back button
 * directly into closing the app — even while the player is mid-puzzle. The
 * decision logic lives in App.handleBack(); this only wires up the plugin.
 *
 * If the plugin isn't available (running in a browser), the import fails
 * and is silently skipped — the same "no plugin, no-op" convention used in
 * ads.ts/billing.ts.
 */
function attachAndroidBackButton(instance: App): void {
  void import("@capacitor/app")
    .then(({ App: CapApp }) => {
      void CapApp.addListener("backButton", () => {
        if (instance.handleBack()) void CapApp.exitApp();
      });
    })
    .catch(() => {
      /* there's no such thing as a back button in a browser */
    });
}
