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

initTheme();
void initAds();
void initReferral();
void restoreAdsRemoved();
// Tarayıcı/WebView autoplay politikası gereği müzik ancak gerçek bir
// kullanıcı jestinden sonra başlayabilir; ilk dokunuşta bir kez tetiklenir.
document.addEventListener("pointerdown", () => ensureMusicStarted(), { once: true });
// İlk ekran anlık açılsın diye ilk bulmacaları (+ günün bulmacasını) hemen
// yükler; geri kalanı arka planda (bkz. warmPuzzles) indirilir.
await warmPuzzles(dailyIndex(puzzles.length));
const root = document.querySelector<HTMLDivElement>("#app")!;
const app = new App(root, puzzles);
app.attachPhysicalKeyboard();
app.start();
