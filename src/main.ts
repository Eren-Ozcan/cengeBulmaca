import "./style.css";
import { App } from "./ui.ts";
import { puzzles } from "./puzzles/index.ts";

const root = document.querySelector<HTMLDivElement>("#app")!;
const app = new App(root, puzzles);
app.attachPhysicalKeyboard();
app.start();
