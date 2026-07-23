// İlk bulmaca ekranında bir kereye mahsus gösterilen basit rehber
// (coachmark). Oyuncu ilk harfi yazınca ya da "Anladım" deyince kalıcı
// olarak kapanır.

const KEY = "cengel-tutorial-seen";

export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // depolama yoksa bir sonraki açılışta tekrar gösterilir
  }
}
