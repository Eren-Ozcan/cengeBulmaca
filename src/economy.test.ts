import { beforeEach, describe, expect, it } from "vitest";
import { CAT_UNLOCK_REWARD, grantJokers, jokerBalance, spendJoker } from "./economy.ts";
import { installMemoryStorage } from "./test-helpers.ts";

const storage = installMemoryStorage();

beforeEach(() => storage.clear());

describe("joker bakiyesi", () => {
  it("ilk okumada başlangıç jokeri verir", () => {
    expect(jokerBalance()).toBe(5);
  });

  it("başlangıç jokeri sadece bir kez verilir", () => {
    jokerBalance();
    spendJoker();
    expect(jokerBalance()).toBe(4);
  });

  it("harcama bakiyeyi bir azaltır ve kalıcıdır", () => {
    expect(spendJoker()).toBe(true);
    expect(jokerBalance()).toBe(4);
    expect(spendJoker()).toBe(true);
    expect(jokerBalance()).toBe(3);
  });

  it("bakiye sıfırdayken harcama başarısız olur ve bakiye değişmez", () => {
    for (let i = 0; i < 5; i++) spendJoker();
    expect(jokerBalance()).toBe(0);
    expect(spendJoker()).toBe(false);
    expect(jokerBalance()).toBe(0);
  });

  it("grantJokers bakiyeyi artırır ve kalıcıdır", () => {
    grantJokers(CAT_UNLOCK_REWARD);
    expect(jokerBalance()).toBe(5 + CAT_UNLOCK_REWARD);
    grantJokers(3);
    expect(jokerBalance()).toBe(5 + CAT_UNLOCK_REWARD + 3);
  });
});
