// Sadece tercih (açık/kapalı) mantığı test edilir — sound.ts'te olduğu gibi
// gerçek ses çalma node/jsdom ortamında anlamlı şekilde test edilemez.

import { beforeEach, describe, expect, it } from "vitest";
import { musicEnabled, toggleMusic } from "./music.ts";
import { installMemoryStorage } from "./test-helpers.ts";

const storage = installMemoryStorage();

beforeEach(() => storage.clear());

describe("müzik tercihi", () => {
  it("varsayılan olarak açıktır", () => {
    expect(musicEnabled()).toBe(true);
  });

  it("değiştirilince kalıcı olarak saklanır", () => {
    expect(toggleMusic()).toBe(false);
    expect(musicEnabled()).toBe(false);
    expect(storage.getItem("cengel-music")).toBe("off");

    expect(toggleMusic()).toBe(true);
    expect(musicEnabled()).toBe(true);
  });
});
