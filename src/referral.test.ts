// @vitest-environment jsdom
//
// FIREBASE_CONFIG artık gerçek proje bilgilerini içeriyor (bkz. referral.ts),
// bu yüzden Firebase modülleri burada mock'lanır — testler gerçek ağa hiç
// gitmez ve prod Firestore'da veri oluşturmaz. signInAnonymously başarısız
// olacak şekilde mock'landığı için ensureReady() her durumda null döner ve
// tüm dışa açık fonksiyonların bu hata karşısında sessizce no-op kaldığı
// doğrulanır.

import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
}));
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
  signInAnonymously: vi.fn(() => Promise.reject(new Error("network unavailable in test"))),
}));
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  runTransaction: vi.fn(),
}));

import { claimFirstPuzzleReferralReward, getInviteLink, shareInvite, syncCloudJokers } from "./referral.ts";

describe("davet sistemi (Firebase bağlantısı başarısızken)", () => {
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
