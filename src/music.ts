// Background music. Unlike sound.ts (short effects synthesized with an
// oscillator), this plays an actual audio file: public/music/anadolu-loop.ogg
// — CC0 licensed, "Feel Good Island Loop" (Brandon Morris, OpenGameArt.org),
// no attribution required.
//
// Due to the browser/WebView autoplay policy, an <audio> element can't
// start playing without a user gesture; see the one-time "start on first
// tap" listener in main.ts. The preference is kept in localStorage.

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

/** Lazily creates the audio element; returns null if the Audio global doesn't exist (e.g. in tests). */
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
    // autoplay was blocked, or the environment doesn't support play()
  }
}

function safePause(a: HTMLAudioElement): void {
  try {
    a.pause();
  } catch {
    // the environment doesn't support pause() (e.g. the test environment)
  }
}

/** Toggles music on/off; returns the new state. If already created, stops/resumes immediately. */
export function toggleMusic(): boolean {
  const on = !musicEnabled();
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // if storage is unavailable, the preference is limited to this session
  }
  const a = ensureAudio();
  if (a) {
    if (on) safePlay(a);
    else safePause(a);
  }
  return on;
}

/**
 * Must be called from within a genuine user gesture (click/tap) — otherwise
 * it's silently rejected due to the browser/WebView autoplay restriction.
 * Does nothing if the music preference is off.
 */
export function ensureMusicStarted(): void {
  if (!musicEnabled()) return;
  const a = ensureAudio();
  if (a) safePlay(a);
}
