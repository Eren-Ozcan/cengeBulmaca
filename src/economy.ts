// Joker (support hint) economy. A persistent balance layered ON TOP OF the
// daily free hint (see hints.ts) and the hint earned by watching an ad (see
// ads.ts): the player starts with a few jokers, earns more as a reward for
// unlocking guardian cats, and can optionally buy joker packs with real
// money from the Shop (see billing.ts).

const BALANCE_KEY = "cengel-jokers";
const INIT_KEY = "cengel-jokers-init";

/** Balance the player has before playing at all (see cloud-save.ts hasPlayerProgress). */
export const START_JOKERS = 5;
/** Reward granted each time a new guardian cat is unlocked. */
export const CAT_UNLOCK_REWARD = 2;

function readBalance(): number {
  try {
    return Math.max(0, Number(localStorage.getItem(BALANCE_KEY) ?? "0"));
  } catch {
    return 0;
  }
}

function writeBalance(n: number): void {
  try {
    localStorage.setItem(BALANCE_KEY, String(Math.max(0, n)));
  } catch {
    // if storage is unavailable, the balance stays limited to this session
  }
}

/** Current joker balance. Grants the player their starting jokers on first call. */
export function jokerBalance(): number {
  try {
    if (localStorage.getItem(INIT_KEY) !== "1") {
      localStorage.setItem(INIT_KEY, "1");
      writeBalance(START_JOKERS);
      return START_JOKERS;
    }
  } catch {
    return START_JOKERS;
  }
  return readBalance();
}

/** Spends one joker; returns false and leaves the balance unchanged if insufficient. */
export function spendJoker(): boolean {
  const n = jokerBalance();
  if (n <= 0) return false;
  writeBalance(n - 1);
  return true;
}

/** Adds jokers to the balance (reward or purchase); returns the new balance. */
export function grantJokers(amount: number): number {
  const n = jokerBalance() + Math.max(0, Math.floor(amount));
  writeBalance(n);
  return n;
}
