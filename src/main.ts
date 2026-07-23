import "@fontsource-variable/nunito/index.css";
import "./style.css";
import { App } from "./ui.ts";
import { puzzles } from "./puzzles/index.ts";
import { initTheme } from "./theme.ts";
import { initAds } from "./ads.ts";
import { initReferral } from "./referral.ts";
import { ensureMusicStarted } from "./music.ts";

initTheme();
void initAds();
void initReferral();
// Tarayıcı/WebView autoplay politikası gereği müzik ancak gerçek bir
// kullanıcı jestinden sonra başlayabilir; ilk dokunuşta bir kez tetiklenir.
document.addEventListener("pointerdown", () => ensureMusicStarted(), { once: true });
const root = document.querySelector<HTMLDivElement>("#app")!;
const app = new App(root, puzzles);
app.attachPhysicalKeyboard();
app.start();
