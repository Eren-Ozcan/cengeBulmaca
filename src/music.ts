// Arka plan müziği. sound.ts'in aksine (osilatörle sentezlenen kısa efektler)
// gerçek bir ses dosyası çalar: public/music/anadolu-loop.ogg — CC0 lisanslı,
// "Feel Good Island Loop" (Brandon Morris, OpenGameArt.org), atıf gerekmez.
//
// Tarayıcı/WebView autoplay politikası gereği bir <audio> öğesi kullanıcı
// jesti olmadan çalmaya başlayamaz; bkz. main.ts'teki tek seferlik
// "ilk dokunuşta başlat" dinleyicisi. Tercih localStorage'da tutulur.

const KEY = "cengel-music";
const TRACK_URL = "/music/anadolu-loop.ogg";
const VOLUME = 0.35;

let audio: HTMLAudioElement | null = null;
let audioTried = false;

export function musicEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

/** Audio öğesini tembel oluşturur; Audio global'i yoksa (ör. testte) null döner. */
function ensureAudio(): HTMLAudioElement | null {
  if (audio || audioTried) return audio;
  audioTried = true;
  try {
    const a = new Audio(TRACK_URL);
    a.loop = true;
    a.volume = VOLUME;
    audio = a;
  } catch {
    audio = null;
  }
  return audio;
}

function safePlay(a: HTMLAudioElement): void {
  try {
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {
    // autoplay engellendi ya da ortam play()'i desteklemiyor
  }
}

function safePause(a: HTMLAudioElement): void {
  try {
    a.pause();
  } catch {
    // ortam pause()'ı desteklemiyor (ör. test ortamı)
  }
}

/** Müziği açıp kapatır; yeni durumu döndürür. Zaten oluşturulmuşsa anında durur/devam eder. */
export function toggleMusic(): boolean {
  const on = !musicEnabled();
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // depolama yoksa tercih oturumla sınırlı kalır
  }
  const a = ensureAudio();
  if (a) {
    if (on) safePlay(a);
    else safePause(a);
  }
  return on;
}

/**
 * Gerçek bir kullanıcı jestinin (tıklama/dokunma) içinden çağrılmalı —
 * tarayıcı/WebView autoplay kısıtlaması yüzünden aksi halde sessizce
 * reddedilir. Müzik tercihi kapalıysa hiçbir şey yapmaz.
 */
export function ensureMusicStarted(): void {
  if (!musicEnabled()) return;
  const a = ensureAudio();
  if (a) safePlay(a);
}
