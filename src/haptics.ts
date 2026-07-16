// Haptik (titreşim) geri bildirimi.
// navigator.vibrate desteklenmeyen platformlarda (iOS Safari, masaüstü)
// sessizce hiçbir şey yapmaz; oyun akışını asla bozmaz.

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // izin/destek yoksa yok sayılır
  }
}

/** Klavye tuşuna basış: hissedilir ama rahatsız etmeyen tık */
export function hapticKey(): void {
  vibrate(10);
}

/** Kontrolde yanlış harf: çift uyarı */
export function hapticWrong(): void {
  vibrate([35, 45, 35]);
}

/** Bulmaca tamamlandı: kutlama deseni */
export function hapticWin(): void {
  vibrate([45, 60, 45, 60, 130]);
}
