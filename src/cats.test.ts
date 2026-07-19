import { describe, expect, it } from "vitest";
import {
  CATS,
  allCatsUnlocked,
  catUnlocked,
  catUnlockedAt,
  nextLockedCat,
} from "./cats.ts";
import { puzzles } from "./puzzles/index.ts";

describe("kedi açılım eşikleri", () => {
  it("eşikler kesin artan sırada", () => {
    for (let i = 1; i < CATS.length; i++) {
      expect(CATS[i].unlockAt).toBeGreaterThan(CATS[i - 1].unlockAt);
    }
  });

  it("her eşik pozitif ve mevcut bulmaca sayısıyla ulaşılabilir", () => {
    for (const cat of CATS) {
      expect(cat.unlockAt).toBeGreaterThan(0);
      expect(cat.unlockAt).toBeLessThanOrEqual(puzzles.length);
    }
  });

  it("son kedi ancak tüm bulmacalar çözülünce açılır (2 aylık hedef)", () => {
    expect(CATS[CATS.length - 1].unlockAt).toBe(puzzles.length);
  });

  it("catUnlocked eşiğin altında kapalı, eşikte ve üstünde açık", () => {
    const cat = CATS[3];
    expect(catUnlocked(cat, cat.unlockAt - 1)).toBe(false);
    expect(catUnlocked(cat, cat.unlockAt)).toBe(true);
    expect(catUnlocked(cat, cat.unlockAt + 1)).toBe(true);
  });

  it("catUnlockedAt tam eşikte kediyi verir, ara değerlerde vermez", () => {
    for (const cat of CATS) {
      expect(catUnlockedAt(cat.unlockAt)).toBe(cat);
    }
    expect(catUnlockedAt(CATS[0].unlockAt + 1)).toBeUndefined();
    expect(catUnlockedAt(0)).toBeUndefined();
  });

  it("nextLockedCat sıradaki kilitli kediyi bulur", () => {
    expect(nextLockedCat(0)).toBe(CATS[0]);
    expect(nextLockedCat(CATS[0].unlockAt)).toBe(CATS[1]);
    expect(nextLockedCat(CATS[CATS.length - 1].unlockAt)).toBeUndefined();
  });

  it("allCatsUnlocked yalnızca son eşikten itibaren doğru", () => {
    const last = CATS[CATS.length - 1].unlockAt;
    expect(allCatsUnlocked(last - 1)).toBe(false);
    expect(allCatsUnlocked(last)).toBe(true);
  });
});
