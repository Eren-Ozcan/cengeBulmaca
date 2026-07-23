// Firebase yapılandırması boşken (FIREBASE_CONFIG.apiKey ayarlanmadan) tüm
// fonksiyonların güvenle no-op dönmesini doğrular — gerçek Firebase
// entegrasyonu ancak yayın öncesi gerçek proje bilgileri girilince test
// edilebilir (bkz. referral.ts başındaki kurulum notları).

import { describe, expect, it } from "vitest";
import { claimFirstPuzzleReferralReward, getInviteLink, shareInvite, syncCloudJokers } from "./referral.ts";

describe("davet sistemi (yapılandırılmamışken)", () => {
  it("davet linki üretmez", async () => {
    expect(await getInviteLink()).toBeNull();
  });

  it("paylaşım 'unavailable' döner", async () => {
    expect(await shareInvite()).toBe("unavailable");
  });

  it("senkronizasyon ve ödül talebi sessizce hiçbir şey yapmaz", async () => {
    await expect(syncCloudJokers()).resolves.toBeUndefined();
    await expect(claimFirstPuzzleReferralReward()).resolves.toBeUndefined();
  });
});
