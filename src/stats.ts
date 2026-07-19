// Günlük seri (streak) ve çözüm istatistikleri.
// Kural: her gün en az bir bulmaca tamamlanırsa seri devam eder;
// bir gün atlanırsa sıfırlanır. Popüler günlük bulmaca oyunlarındaki
// (Wordle vb.) alışkanlık modeli.

export interface Stats {
  /** Son tamamlama günü, "YYYY-MM-DD" (yerel saat) */
  lastDay: string | null;
  /** Ardışık gün sayısı */
  streak: number;
  /** Tamamlanan bulmaca id'leri */
  solved: string[];
}

const KEY = "cengel-stats";

export function dayString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${g}`;
}

function yesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayString(d);
}

export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s === "object") {
        return {
          lastDay: typeof s.lastDay === "string" ? s.lastDay : null,
          streak: typeof s.streak === "number" ? s.streak : 0,
          solved: Array.isArray(s.solved) ? s.solved.filter((x: unknown) => typeof x === "string") : [],
        };
      }
    }
  } catch {
    // bozuk kayıt yok sayılır
  }
  return { lastDay: null, streak: 0, solved: [] };
}

function saveStats(s: Stats): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // depolama yoksa sessizce geç
  }
}

/** Bulmaca tamamlandığında çağrılır; güncel seriyi döndürür. */
export function recordCompletion(puzzleId: string): Stats {
  const s = loadStats();
  const today = dayString();
  if (s.lastDay === today) {
    // bugün zaten oynandı, seri değişmez
  } else if (s.lastDay === yesterdayString()) {
    s.streak += 1;
    s.lastDay = today;
  } else {
    s.streak = 1;
    s.lastDay = today;
  }
  if (!s.solved.includes(puzzleId)) s.solved.push(puzzleId);
  saveStats(s);
  return s;
}

/** Gösterilecek seri: dün ya da bugün oynanmadıysa seri kopmuştur. */
export function currentStreak(): number {
  const s = loadStats();
  if (s.lastDay === dayString() || s.lastDay === yesterdayString()) {
    return s.streak;
  }
  return 0;
}

/** Bugün en az bir bulmaca tamamlandı mı? */
export function playedToday(): boolean {
  return loadStats().lastDay === dayString();
}

export function isSolvedPuzzle(id: string): boolean {
  return loadStats().solved.includes(id);
}

/** Tamamlanan farklı bulmaca sayısı (kedi açılım eşikleri buna bakar). */
export function solvedCount(): number {
  return loadStats().solved.length;
}

/** Günün bulmacası: tarihe göre deterministik seçim. */
export function dailyIndex(count: number, d: Date = new Date()): number {
  const s = dayString(d);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return count > 0 ? h % count : 0;
}
