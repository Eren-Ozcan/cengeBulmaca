import { beforeEach, describe, expect, it } from "vitest";
import {
  currentStreak,
  dailyIndex,
  dayString,
  isSolvedPuzzle,
  loadStats,
  playedToday,
  recordCompletion,
} from "./stats.ts";
import { installMemoryStorage } from "./test-helpers.ts";

const storage = installMemoryStorage();

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayString(d);
}

function seedStats(lastDay: string | null, streak: number): void {
  storage.setItem(
    "cengel-stats",
    JSON.stringify({ lastDay, streak, solved: [] }),
  );
}

beforeEach(() => storage.clear());

describe("dayString", () => {
  it("YYYY-MM-DD biçiminde üretir", () => {
    expect(dayString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("dailyIndex", () => {
  it("aynı gün için deterministiktir", () => {
    const d = new Date(2026, 6, 16);
    expect(dailyIndex(10, d)).toBe(dailyIndex(10, d));
  });

  it("sonuç her zaman aralık içindedir", () => {
    for (let i = 0; i < 60; i++) {
      const d = new Date(2026, 0, 1 + i);
      const idx = dailyIndex(7, d);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(7);
    }
  });

  it("bulmaca yokken 0 döndürür", () => {
    expect(dailyIndex(0)).toBe(0);
  });
});

describe("recordCompletion / seri", () => {
  it("ilk tamamlamada seriyi 1 yapar", () => {
    const s = recordCompletion("p1");
    expect(s.streak).toBe(1);
    expect(s.lastDay).toBe(dayString());
  });

  it("dün oynandıysa seriyi artırır", () => {
    seedStats(daysAgo(1), 4);
    expect(recordCompletion("p1").streak).toBe(5);
  });

  it("aynı gün ikinci tamamlama seriyi değiştirmez", () => {
    seedStats(dayString(), 3);
    expect(recordCompletion("p2").streak).toBe(3);
  });

  it("gün atlanınca seri 1'den başlar", () => {
    seedStats(daysAgo(3), 9);
    expect(recordCompletion("p1").streak).toBe(1);
  });

  it("çözülen bulmacayı bir kez listeler", () => {
    recordCompletion("p1");
    recordCompletion("p1");
    expect(loadStats().solved).toEqual(["p1"]);
    expect(isSolvedPuzzle("p1")).toBe(true);
    expect(isSolvedPuzzle("p2")).toBe(false);
  });
});

describe("currentStreak", () => {
  it("bugün oynandıysa seriyi gösterir", () => {
    seedStats(dayString(), 6);
    expect(currentStreak()).toBe(6);
    expect(playedToday()).toBe(true);
  });

  it("dün oynandıysa seri hâlâ canlıdır", () => {
    seedStats(daysAgo(1), 6);
    expect(currentStreak()).toBe(6);
    expect(playedToday()).toBe(false);
  });

  it("iki gün geçtiyse seri kopmuştur", () => {
    seedStats(daysAgo(2), 6);
    expect(currentStreak()).toBe(0);
  });

  it("bozuk kayıt sıfırdan başlatır", () => {
    storage.setItem("cengel-stats", "{bozuk json");
    expect(currentStreak()).toBe(0);
    expect(loadStats().solved).toEqual([]);
  });
});
