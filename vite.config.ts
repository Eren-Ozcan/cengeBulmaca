import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the build works both at the site root (Capacitor's
  // file:// load) and under a GitHub Pages subpath (/cengeBulmaca/).
  base: "./",
});
