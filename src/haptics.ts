// Haptic (vibration) feedback.
// On platforms that don't support navigator.vibrate (iOS Safari, desktop)
// this silently does nothing; it never disrupts the game flow.

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // ignored if not permitted/supported
  }
}

/** Keyboard key press: a noticeable but unobtrusive tick */
export function hapticKey(): void {
  vibrate(10);
}

/** Wrong letter on check: double buzz */
export function hapticWrong(): void {
  vibrate([35, 45, 35]);
}

/** Puzzle completed: celebration pattern */
export function hapticWin(): void {
  vibrate([45, 60, 45, 60, 130]);
}
