// Görsel tema seçimi.
//  - "modern": renkli, degrade, yuvarlak hatlı varsayılan görünüm
//  - "gazete": klasik basılı gazete bulmacası görünümü (beyaz hücreler,
//    ince koyu çizgiler, serif tipografi)
// Tercih localStorage'da tutulur; tema <html data-theme="..."> ile uygulanır.

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
    // depolama yoksa tercih oturumla sınırlı kalır
  }
}

/** Temalar arasında geçiş yapar; yeni temayı döndürür. */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "gazete" ? "modern" : "gazete";
  applyTheme(next);
  return next;
}

/** Uygulama açılışında kayıtlı temayı uygular (kaydetmeden). */
export function initTheme(): void {
  document.documentElement.dataset.theme = currentTheme();
}
