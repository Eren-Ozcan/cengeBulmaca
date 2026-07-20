// Web Audio ile üretilen kısa ses efektleri.
// Ses dosyası kullanılmaz: osilatörle sentezlenir, paket boyutu artmaz.
// Tercih localStorage'da saklanır; ses kapalıyken AudioContext hiç açılmaz.

const KEY = "cengel-sound";

let ctx: AudioContext | null = null;

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

/** Sesi açıp kapatır; yeni durumu döndürür. */
export function toggleSound(): boolean {
  const on = !soundEnabled();
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // depolama yoksa tercih oturumla sınırlı kalır
  }
  return on;
}

function audio(): AudioContext | null {
  if (!soundEnabled()) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.06,
  delay = 0,
): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur);
}

/** Klavye tuşuna basış */
export function playKey(): void {
  tone(640, 0.05, "square", 0.03);
}

/** Kontrolde yanlış harf bulundu */
export function playWrong(): void {
  tone(190, 0.18, "sawtooth", 0.05);
}

/** Kontrolde her şey doğru */
export function playCorrect(): void {
  tone(760, 0.1, "sine", 0.05);
  tone(1010, 0.12, "sine", 0.05, 0.09);
}

/** Bulmaca tamamlandı: kısa zafer arpeji */
export function playWin(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => tone(f, 0.2, "sine", 0.06, i * 0.11));
}

/** Yeni bekçi kedi açıldı: kısa, yükselip alçalan bir "miyav" */
export function playCatUnlock(): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.12;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.09);
  osc.frequency.exponentialRampToValueAtTime(360, t + 0.32);
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1200, t);
  filter.Q.value = 2.2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.08, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  osc.connect(filter).connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.36);
}
