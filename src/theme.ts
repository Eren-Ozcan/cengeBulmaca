// Visual theme selection.
//  - "modern": the default look — colorful, gradients, rounded edges
//  - "gazete": classic printed newspaper puzzle look (white cells, thin dark
//    lines, serif typography)
// The preference is kept in localStorage; the theme is applied via <html data-theme="...">.

export type Theme = "modern" | "gazete";

const KEY = "cengel-theme";

export function currentTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "gazete" ? "gazete" : "modern";
  } catch {
    return "modern";
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // if storage is unavailable, the preference stays limited to this session
  }
}

/** Switches between themes; returns the new theme. */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "gazete" ? "modern" : "gazete";
  applyTheme(next);
  return next;
}

/** Applies the saved theme at app startup (without persisting it). */
export function initTheme(): void {
  document.documentElement.dataset.theme = currentTheme();
}
