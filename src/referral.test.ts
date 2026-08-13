// @vitest-environment jsdom
//
// FIREBASE_CONFIG now contains real project info (see firebase-app.ts), so
// the Firebase modules are mocked here — tests never hit the real network and
// never create data in prod Firestore. The mocks behave as if there is no
// persistent session (onAuthStateChanged gives null) and as if
// signInAnonymously fails; this way ensureReady() always returns null, and
// it's verified that every exported function silently no-ops in the face of this failure.

import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
}));
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
  // firebase-app.ts first waits for the persistent session to be restored;
  // the mock says "no session" and the flow falls through to anonymous sign-in.
  onAuthStateChanged: vi.fn((_auth: unknown, next: (u: unknown) => void) => {
    next(null);
    return () => {};
  }),
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
