import { beforeEach, describe, expect, it } from "vitest";
import { consumeFreeHint, freeHintsRemainingToday } from "./hints.ts";
import { installMemoryStorage } from "./test-helpers.ts";

const storage = installMemoryStorage();

beforeEach(() => storage.clear());

describe("günlük ücretsiz ipucu hakkı", () => {
  it("gün başında 3 hak vardır", () => {
    expect(freeHintsRemainingToday()).toBe(3);
  });

  it("her kullanım hakkı bir azaltır", () => {
    consumeFreeHint();
    expect(freeHintsRemainingToday()).toBe(2);
    consumeFreeHint();
    expect(freeHintsRemainingToday()).toBe(1);
  });

  it("hak sıfırın altına inmez", () => {
    consumeFreeHint();
    consumeFreeHint();
    consumeFreeHint();
    consumeFreeHint();
    expect(freeHintsRemainingToday()).toBe(0);
  });
});
