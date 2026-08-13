// Only the preference (on/off) logic is tested — as with sound.ts, actual
// audio playback can't be meaningfully tested in the node/jsdom environment.

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
