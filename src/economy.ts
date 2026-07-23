// Joker (destek ipucu) ekonomisi. Günlük ücretsiz ipucu (bkz. hints.ts) ve
// reklam izleyerek kazanılan ipucunun (bkz. ads.ts) ÜSTÜNE eklenen kalıcı
// bir bakiye: oyuncu birkaç joker ile başlar, bekçi kedi açtıkça ödül
// olarak joker kazanır, isterse Mağaza'dan gerçek parayla joker paketi
// satın alır (bkz. billing.ts).

const BALANCE_KEY = "cengel-jokers";
const INIT_KEY = "cengel-jokers-init";

const START_JOKERS = 5;
/** Her yeni bekçi kedi açıldığında verilen ödül. */
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
    // depolama yoksa bakiye oturumla sınırlı kalır
  }
}

/** Güncel joker bakiyesi. İlk çağrıda oyuncuya başlangıç jokerini verir. */
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

/** Bir joker harcar; bakiye yetersizse false döner ve bakiye değişmez. */
export function spendJoker(): boolean {
  const n = jokerBalance();
  if (n <= 0) return false;
  writeBalance(n - 1);
  return true;
}

/** Bakiyeye joker ekler (ödül veya satın alma); yeni bakiyeyi döndürür. */
export function grantJokers(amount: number): number {
  const n = jokerBalance() + Math.max(0, Math.floor(amount));
  writeBalance(n);
  return n;
}
