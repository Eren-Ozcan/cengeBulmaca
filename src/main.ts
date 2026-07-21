import "@fontsource-variable/nunito/index.css";
import "./style.css";
import { App } from "./ui.ts";
import { puzzles } from "./puzzles/index.ts";
import { initTheme } from "./theme.ts";
import { initAds } from "./ads.ts";

initTheme();
void initAds();
const root = document.querySelector<HTMLDivElement>("#app")!;
const app = new App(root, puzzles);
app.attachPhysicalKeyboard();
app.start();
