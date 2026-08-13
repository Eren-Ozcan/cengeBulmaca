// The sync BOUNDARY of cloud save: which localStorage key goes to the cloud,
// what an incoming cloud document is allowed to write locally, and whether
// the player gets asked on conflict or not.
//
// No real network call is ever made. Pure functions (collectSyncedSave /
// parseCloudPayload / localSummary / hasPlayerProgress) are tested directly;
// for syncCloudSave the Firebase modules are mocked and an in-memory fake
// "cloud document" is used (same pattern as referral.test.ts).
//
// Three of the assertions here are security/data-loss assertions that can
// break silently: entitlements must not leak into the cloud, data coming
// from the cloud must not write outside the allowlist, and hasPlayerProgress
// must NEVER treat a save with real progress as "untouched" — if the last one
// goes wrong, the player's game gets wiped without asking.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Fake cloud document; set up with vi.hoisted since mock factories are
// hoisted. `doc` being null means "no save in the cloud".
const cloud = vi.hoisted(() => ({ doc: null as Record<string, unknown> | null }));

/** Server timestamp: a fixed value is enough since it's independent of device clock. */
const CLOUD_STAMP_MS = 1_700_000_000_000;

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
}));
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
  // firebase-app.ts first waits for the persistent session to be restored;
  // unlike referral.test.ts, here the session is made to behave as if it
  // EXISTS, because what's under test is the sync flow itself.
  //
  // The notification must be ASYNCHRONOUS: the real Firebase observer never
  // calls onAuthStateChanged synchronously, and firebase-app.ts relies on
  // that by touching `unsubscribe` inside the callback. A mock that calls
  // synchronously catches that variable in the TDZ, throws a ReferenceError,
  // and ensureUid silently returns null — meaning the mock itself turns into
  // the "no connection" scenario and the flow never actually gets tested.
  onAuthStateChanged: vi.fn((_auth: unknown, next: (u: unknown) => void) => {
    queueMicrotask(() => next({ uid: "test-uid" }));
    return () => {};
  }),
  signInAnonymously: vi.fn(() => Promise.reject(new Error("network unavailable in test"))),
}));
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join("/") })),
  getDoc: vi.fn(() =>
    Promise.resolve({
      exists: () => cloud.doc !== null,
      data: () => cloud.doc,
    }),
  ),
  setDoc: vi.fn((_ref: unknown, data: Record<string, unknown>) => {
    // Like real Firestore: the serverTimestamp() sentinel is resolved server-side.
    cloud.doc = { ...data, updatedAt: { toMillis: () => CLOUD_STAMP_MS } };
    return Promise.resolve();
  }),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
}));

import {
  CLOUD_SCHEMA_VERSION,
  collectSyncedSave,
  conflictSummary,
  flushCloudSave,
  hasPlayerProgress,
  isSaveFrozen,
  localSummary,
  maybeUploadCloudSave,
  parseCloudPayload,
  resetForNewAccount,
  resolveKeepCloud,
  sameProgress,
  syncCloudSave,
  type SaveMap,
} from "./cloud-save.ts";
import { START_JOKERS } from "./economy.ts";
import { newGame, selectCell, typeLetter } from "./game.ts";
import { dayString } from "./stats.ts";
import { installMemoryStorage, type MemoryStorage } from "./test-helpers.ts";
import type { PuzzleDef } from "./types.ts";

let storage: MemoryStorage;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayString(d);
}

beforeEach(() => {
  storage = installMemoryStorage();
});

describe("buluta gönderilen kayıt (allowlist)", () => {
  it("satın alma hakkını (reklamsız sürüm) ASLA taşımaz", () => {
    storage.setItem("cengel-ads-removed", "1");
    storage.setItem("cengel-jokers", "12");

    const map = collectSyncedSave();

    // If this were carried over, sharing one save would hand out a free ad-free version.
    expect(map["cengel-ads-removed"]).toBeUndefined();
    expect(map["cengel-jokers"]).toBe("12");
  });

  it("listede olmayan yeni bir 'cengel-' anahtarını sessizce taşımaz", () => {
    storage.setItem("cengel-gizli-deney", "42");
    expect(collectSyncedSave()["cengel-gizli-deney"]).toBeUndefined();
  });

  it("cihaza ait defter kayıtlarını (rev/parmak izi) taşımaz", () => {
    storage.setItem("cengel-cloud-rev", "7");
    storage.setItem("cengel-cloud-fp", "123:abc");
    const map = collectSyncedSave();
    expect(map["cengel-cloud-rev"]).toBeUndefined();
    expect(map["cengel-cloud-fp"]).toBeUndefined();
  });

  it("bulmaca ilerlemelerini ve oyuncu tercihlerini taşır", () => {
    storage.setItem("cengel-progress-puzzle-1", '{"entries":["A"]}');
    storage.setItem("cengel-progress-puzzle-2", '{"entries":["B"]}');
    storage.setItem("cengel-stats", '{"streak":4,"solved":["puzzle-1"],"lastDay":null}');
    storage.setItem("cengel-theme", "gazete");

    const map = collectSyncedSave();

    expect(map["cengel-progress-puzzle-1"]).toBe('{"entries":["A"]}');
    expect(map["cengel-progress-puzzle-2"]).toBe('{"entries":["B"]}');
    expect(map["cengel-theme"]).toBe("gazete");
  });

  it("tarihli ipucu anahtarlarını budar: yalnızca son bir haftalık pencere taşınır", () => {
    storage.setItem(`cengel-hints-${dayString()}`, "2");
    storage.setItem(`cengel-hints-${daysAgo(3)}`, "3");
    storage.setItem(`cengel-hints-${daysAgo(30)}`, "3");
    storage.setItem("cengel-hints-2024-01-01", "3");

    const map = collectSyncedSave();

    expect(map[`cengel-hints-${dayString()}`]).toBe("2");
    expect(map[`cengel-hints-${daysAgo(3)}`]).toBe("3");
    // If not pruned, the document would grow slightly every day, forever.
    expect(map[`cengel-hints-${daysAgo(30)}`]).toBeUndefined();
    expect(map["cengel-hints-2024-01-01"]).toBeUndefined();
  });

  it("anahtar sırası deterministik — aynı içerik hep aynı payload'ı üretir", () => {
    storage.setItem("cengel-theme", "modern");
    storage.setItem("cengel-jokers", "5");
    storage.setItem("cengel-progress-b", "2");
    storage.setItem("cengel-progress-a", "1");
    const first = JSON.stringify(collectSyncedSave());

    // Set up the same data with a different insertion order: the fingerprint
    // (and thus "is there a local change") must not be order-sensitive.
    storage = installMemoryStorage();
    storage.setItem("cengel-progress-a", "1");
    storage.setItem("cengel-jokers", "5");
    storage.setItem("cengel-progress-b", "2");
    storage.setItem("cengel-theme", "modern");

    expect(JSON.stringify(collectSyncedSave())).toBe(first);
  });
});

describe("buluttan gelen payload'ın doğrulanması", () => {
  it("kurcalanmış bir doküman reklamsız sürümü açamaz", () => {
    const map = parseCloudPayload(
      JSON.stringify({ "cengel-ads-removed": "1", "cengel-jokers": "3" }),
    );
    expect(map).not.toBeNull();
    expect(map!["cengel-ads-removed"]).toBeUndefined();
    expect(map!["cengel-jokers"]).toBe("3");
  });

  it("tanımadığımız anahtarları ve string olmayan değerleri eler", () => {
    const map = parseCloudPayload(
      JSON.stringify({
        "cengel-jokers": "3",
        "baska-uygulama-anahtari": "x",
        "cengel-stats": { streak: 99 },
      }),
    );
    expect(Object.keys(map!)).toEqual(["cengel-jokers"]);
  });

  it("buluttaki bayat ipucu anahtarlarını da eler", () => {
    const map = parseCloudPayload(
      JSON.stringify({
        [`cengel-hints-${dayString()}`]: "1",
        [`cengel-hints-${daysAgo(90)}`]: "3",
      }),
    );
    expect(Object.keys(map!)).toEqual([`cengel-hints-${dayString()}`]);
  });

  it("cengel-jokers sayısal değilse NaN sızmaz, anahtar tümden elenir", () => {
    const map = parseCloudPayload(
      JSON.stringify({ "cengel-jokers": "yamuk-deger", "cengel-theme": "modern" }),
    );
    expect(map!["cengel-jokers"]).toBeUndefined();
    expect(map!["cengel-theme"]).toBe("modern");
  });

  it("cengel-jokers negatifse elenir, geçerliyse kalır", () => {
    expect(parseCloudPayload(JSON.stringify({ "cengel-jokers": "-5" }))!["cengel-jokers"]).toBeUndefined();
    expect(parseCloudPayload(JSON.stringify({ "cengel-jokers": "5" }))!["cengel-jokers"]).toBe("5");
  });

  it("bozuk ya da beklenmedik biçimdeki payload'da null döner (yerel kayıt korunur)", () => {
    expect(parseCloudPayload("{bozuk json")).toBeNull();
    expect(parseCloudPayload("[1,2,3]")).toBeNull();
    expect(parseCloudPayload("null")).toBeNull();
    expect(parseCloudPayload('"düz metin"')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// hasPlayerProgress — the GUARD for the fast path that skips the conflict screen.
//
// Each branch is tested separately. If a "true" branch is missing, a player
// with real progress gets their save wiped without being asked; if a "false"
// branch (deliberately ignored signals) isn't tested, someone might later add
// a setting/flag to the list with good intentions, and the bug that was fixed
// — a conflict screen with one blank side — comes back.
// ---------------------------------------------------------------------------

/** The save state that forms for EVERY player who opens the game once, without making a single move. */
function untouchedInstall(): void {
  storage.setItem("cengel-jokers-init", "1");
  storage.setItem("cengel-jokers", String(START_JOKERS));
  storage.setItem("cengel-story-seen", "1");
  storage.setItem("cengel-tutorial-seen", "1");
  storage.setItem("cengel-theme", "modern");
  storage.setItem("cengel-sound", "1");
  storage.setItem("cengel-music", "1");
}

describe("ilerleme sayılan sinyaller (çakışmada oyuncuya sorulur)", () => {
  it("tamamlanmış bulmaca — istatistik kaydı", () => {
    untouchedInstall();
    storage.setItem(
      "cengel-stats",
      JSON.stringify({ streak: 1, solved: ["p1"], lastDay: dayString() }),
    );
    expect(hasPlayerProgress(collectSyncedSave())).toBe(true);
  });

  it("günlük seri (streak) — tek başına, çözülen listesi boş olsa bile", () => {
    untouchedInstall();
    storage.setItem("cengel-stats", JSON.stringify({ streak: 7, solved: [], lastDay: null }));
    expect(hasPlayerProgress(collectSyncedSave())).toBe(true);
  });

  it("yarım kalmış bulmaca — ilerleme anahtarının VARLIĞI yeter", () => {
    untouchedInstall();
    // game.ts only writes this key when the player types/deletes a letter
    // (the tutorial puzzle never writes it, since it runs in "practice" mode),
    // so its mere presence is itself a real move — we don't interpret its content further.
    storage.setItem("cengel-progress-p1", '{"entries":["K","E"]}');
    expect(hasPlayerProgress(collectSyncedSave())).toBe(true);
  });

  it("harcanmış joker — bakiye başlangıcın ALTINDA", () => {
    untouchedInstall();
    storage.setItem("cengel-jokers", String(START_JOKERS - 1));
    expect(hasPlayerProgress(collectSyncedSave())).toBe(true);
  });

  it("kazanılmış/satın alınmış joker — bakiye başlangıcın ÜSTÜNDE", () => {
    untouchedInstall();
    storage.setItem("cengel-jokers", String(START_JOKERS + 40));
    expect(hasPlayerProgress(collectSyncedSave())).toBe(true);
  });

  it("kullanılmış günlük ipucu hakkı", () => {
    untouchedInstall();
    storage.setItem(`cengel-hints-${dayString()}`, "2");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(true);
  });

  it("birkaç gün önce kullanılmış ipucu hakkı (pencere içindeyse)", () => {
    untouchedInstall();
    storage.setItem(`cengel-hints-${daysAgo(2)}`, "1");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(true);
  });

  it("alınmış davet ödülü", () => {
    untouchedInstall();
    storage.setItem("cengel-referral-synced", "3");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(true);
  });
});

describe("bilerek yok sayılan sinyaller (tek başına ilerleme DEĞİL)", () => {
  it("hiç kayıt yokken ilerleme yoktur", () => {
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("el değmemiş kurulum — oyunu açıp hiç oynamamak", () => {
    untouchedInstall();
    // Even a single "true" here would show the player a conflict screen with
    // one blank side; that is exactly the bug that was fixed.
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("tema tercihi", () => {
    untouchedInstall();
    storage.setItem("cengel-theme", "gazete");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("ses ayarı", () => {
    untouchedInstall();
    storage.setItem("cengel-sound", "0");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("müzik ayarı", () => {
    untouchedInstall();
    storage.setItem("cengel-music", "0");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("başlangıç jokerinin verildiğini işaretleyen 'jokers-init' damgası", () => {
    // Written automatically the first time the balance is read (while the
    // home screen renders); the player made no move at all.
    storage.setItem("cengel-jokers-init", "1");
    storage.setItem("cengel-jokers", String(START_JOKERS));
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("dokunulmamış başlangıç joker bakiyesi", () => {
    storage.setItem("cengel-jokers", String(START_JOKERS));
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("açılış hikayesinin 'görüldü' damgası", () => {
    // The story intro is shown AUTOMATICALLY at launch; dismissing it isn't an achievement.
    storage.setItem("cengel-story-seen", "1");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("kapanış hikayesinin 'görüldü' damgası", () => {
    storage.setItem("cengel-epilogue-seen", "1");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("rehberin 'görüldü' damgası", () => {
    // The tutorial is played in "practice" mode: it writes neither progress
    // nor stats, and the flag is also set when pressing "Skip". If this
    // counted as progress, a player who just opened the game once would still
    // get a conflict screen with a blank side when linking an account.
    storage.setItem("cengel-tutorial-seen", "1");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("hiç hak kullanılmamış (sıfır) günlük ipucu sayacı", () => {
    untouchedInstall();
    storage.setItem(`cengel-hints-${dayString()}`, "0");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("sıfır davet ödülü sayacı", () => {
    untouchedInstall();
    storage.setItem("cengel-referral-synced", "0");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("reklamsız sürüm hakkı — kayıtta değil, mağazadan gelir", () => {
    // Entitlements aren't synced (see allowlist tests): on a CLEAN install for
    // a player who purchased, this right comes back from the store, not from
    // the save. If it counted as progress, that player would unnecessarily
    // hit a conflict screen on every new device.
    storage.setItem("cengel-ads-removed", "1");
    untouchedInstall();
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("pencere dışında kalmış bayat ipucu anahtarı (kayda hiç girmez)", () => {
    untouchedInstall();
    storage.setItem(`cengel-hints-${daysAgo(30)}`, "3");
    // collectSyncedSave already prunes it; the predicate never sees it either.
    expect(collectSyncedSave()[`cengel-hints-${daysAgo(30)}`]).toBeUndefined();
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });
});

describe("hasPlayerProgress sınır durumları", () => {
  it("boş SaveMap'te ilerleme yoktur", () => {
    expect(hasPlayerProgress({})).toBe(false);
  });

  it("allowlist dışı anahtarlar hiç dikkate alınmaz", () => {
    // Manually constructed map: these keys could never arrive here in the
    // real flow, but the predicate on its own must still not look at them.
    const map: SaveMap = {
      "cengel-ads-removed": "1",
      "cengel-cloud-rev": "42",
      "cengel-cloud-fp": "10:abc",
      "baska-uygulama-anahtari": "x",
    };
    expect(hasPlayerProgress(map)).toBe(false);
  });

  it("eksik anahtarlarda patlamaz", () => {
    expect(hasPlayerProgress({ "cengel-theme": "modern" })).toBe(false);
  });

  it("bozuk istatistik kaydı ilerleme SAYILIR — şüphede oyuncunun oyunu silinmez", () => {
    untouchedInstall();
    storage.setItem("cengel-stats", "{bozuk json");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(true);
  });

  it("okunamayan joker bakiyesi ilerleme sayılır", () => {
    untouchedInstall();
    storage.setItem("cengel-jokers", "abc");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(true);
  });

  it("boş string joker bakiyesi ilerleme sayılır (başlangıç değeri değil)", () => {
    untouchedInstall();
    storage.setItem("cengel-jokers", "");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(true);
  });

  it("okunamayan ipucu/davet sayaçları ilerleme sayılır", () => {
    untouchedInstall();
    storage.setItem(`cengel-hints-${dayString()}`, "abc");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(true);

    storage.setItem(`cengel-hints-${dayString()}`, "0");
    storage.setItem("cengel-referral-synced", "abc");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(true);
  });

  it("boş string istatistik kaydı ilerleme sayılmaz", () => {
    untouchedInstall();
    storage.setItem("cengel-stats", "");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sync flow — end-to-end through a fake Firestore document.
// ---------------------------------------------------------------------------

/** Puts a ready-made document in the cloud (as if written by another device). */
function seedCloud(save: SaveMap, rev: number, schemaVersion = CLOUD_SCHEMA_VERSION): void {
  cloud.doc = {
    payload: JSON.stringify(save),
    rev,
    schemaVersion,
    updatedAt: { toMillis: () => CLOUD_STAMP_MS },
    summary: {},
  };
}

/** Wait one macrotask so fire-and-forget uploads (void upload()) can settle. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const OTHER_DEVICE_SAVE: SaveMap = {
  "cengel-jokers": "11",
  "cengel-stats": JSON.stringify({ streak: 9, solved: ["p1", "p2", "p3"], lastDay: null }),
  "cengel-progress-p4": '{"entries":["Z"]}',
};

describe("senkron akışı (sahte Firestore)", () => {
  beforeEach(() => {
    cloud.doc = null;
    // Prevent internal module state (blocked/pendingCloud/rev) from carrying over between tests.
    resetForNewAccount();
  });

  it("bulutta kayıt yokken yereli yükler", async () => {
    untouchedInstall();
    storage.setItem("cengel-progress-p1", '{"entries":["A"]}');

    expect(await syncCloudSave()).toBe("uploaded");
    expect(cloud.doc).not.toBeNull();
    expect(cloud.doc!.rev).toBe(1);
    expect(cloud.doc!.schemaVersion).toBe(CLOUD_SCHEMA_VERSION);
  });

  it("bulut GERİDEYKEN indirme yapmaz, yereli yükler", async () => {
    untouchedInstall();
    storage.setItem("cengel-progress-p1", '{"entries":["A"]}');
    storage.setItem("cengel-cloud-rev", "9");
    seedCloud(OTHER_DEVICE_SAVE, 4);

    expect(await syncCloudSave()).toBe("in-sync");
    // The local save must stay as-is: a stale cloud must NOT overwrite the local one.
    expect(storage.getItem("cengel-progress-p1")).toBe('{"entries":["A"]}');
    expect(storage.getItem("cengel-progress-p4")).toBeNull();

    await settle();
    expect(cloud.doc!.rev).toBe(10); // local change was pushed to the cloud
  });

  it("bulut ilerideyken YEREL BAKİRSE sormadan geri yükler (hızlı yol)", async () => {
    untouchedInstall();
    seedCloud(OTHER_DEVICE_SAVE, 9);

    expect(await syncCloudSave()).toBe("restored");
    expect(storage.getItem("cengel-progress-p4")).toBe('{"entries":["Z"]}');
    expect(storage.getItem("cengel-jokers")).toBe("11");
    expect(storage.getItem("cengel-cloud-rev")).toBe("9");
    // Since nothing was asked, no conflict state should ever be opened.
    expect(conflictSummary()).toBeNull();
  });

  it("bulut ilerideyken YERELDE İLERLEME VARSA çakışma sorar (hızlı yol DEVREYE GİRMEZ)", async () => {
    untouchedInstall();
    storage.setItem("cengel-progress-p1", '{"entries":["A"]}');
    seedCloud(OTHER_DEVICE_SAVE, 9);

    expect(await syncCloudSave()).toBe("conflict");
    // The local save is preserved, the cloud one is never applied: the decision belongs to the player.
    expect(storage.getItem("cengel-progress-p1")).toBe('{"entries":["A"]}');
    expect(storage.getItem("cengel-progress-p4")).toBeNull();
    expect(storage.getItem("cengel-cloud-rev")).toBe("0");

    // The summary that the conflict screen shows comes from the cloud.
    expect(conflictSummary()).toEqual({
      streak: 9,
      solved: 3,
      jokers: 11,
      updatedAtMs: CLOUD_STAMP_MS,
    });

    await settle();
    expect(cloud.doc!.rev).toBe(9); // NOTHING was ever written to the cloud
  });

  it("yerelde ilerleme olsa da GÖNDERİLMEMİŞ değişiklik yoksa çakışma sorulmaz", async () => {
    // Two conditions are needed together: cloud ahead AND local dirty progress.
    // Here the local save is in sync with the cloud; another device wrote later.
    untouchedInstall();
    storage.setItem("cengel-progress-p1", '{"entries":["A"]}');
    expect(await syncCloudSave()).toBe("uploaded");

    seedCloud(OTHER_DEVICE_SAVE, 9);

    expect(await syncCloudSave()).toBe("restored");
    expect(storage.getItem("cengel-progress-p1")).toBeNull();
    expect(storage.getItem("cengel-progress-p4")).toBe('{"entries":["Z"]}');
  });

  it("buluttaki şema daha yeniyse hiçbir şeye dokunmaz", async () => {
    untouchedInstall();
    storage.setItem("cengel-progress-p1", '{"entries":["A"]}');
    seedCloud(OTHER_DEVICE_SAVE, 9, CLOUD_SCHEMA_VERSION + 1);

    expect(await syncCloudSave()).toBe("needs-update");
    expect(storage.getItem("cengel-progress-p1")).toBe('{"entries":["A"]}');
    expect(storage.getItem("cengel-progress-p4")).toBeNull();

    await settle();
    expect(cloud.doc!.rev).toBe(9); // we don't overwrite a format we don't recognize
  });

  it("hızlı yolda da kurcalanmış bir doküman reklamsız sürümü AÇAMAZ", async () => {
    untouchedInstall(); // local is untouched → fast path will run
    seedCloud({ ...OTHER_DEVICE_SAVE, "cengel-ads-removed": "1" }, 9);

    expect(await syncCloudSave()).toBe("restored");
    expect(storage.getItem("cengel-ads-removed")).toBeNull();
  });

  it("hızlı yolda geri yükleme, cihazdaki satın alma hakkını SİLMEZ", async () => {
    storage.setItem("cengel-ads-removed", "1"); // real entitlement coming from the store
    untouchedInstall();
    seedCloud(OTHER_DEVICE_SAVE, 9);

    expect(await syncCloudSave()).toBe("restored");
    expect(storage.getItem("cengel-ads-removed")).toBe("1");
  });

  it("buluttaki payload bozuksa yerel kayıt korunur", async () => {
    untouchedInstall();
    storage.setItem("cengel-progress-p1", '{"entries":["A"]}');
    cloud.doc = {
      payload: "{bozuk json",
      rev: 9,
      schemaVersion: CLOUD_SCHEMA_VERSION,
      updatedAt: { toMillis: () => CLOUD_STAMP_MS },
    };

    expect(await syncCloudSave()).toBe("disabled");
    expect(storage.getItem("cengel-progress-p1")).toBe('{"entries":["A"]}');
  });
});

// ---------------------------------------------------------------------------
// sameProgress — the guard for "are both sides the same game?".
//
// This predicate BYPASSES the conflict screen: when it says "true", the
// player is never asked. A false "true" silently discards one side's
// progress, while a false "false" at worst falls back to today's conflict
// screen — the tests are written to preserve this asymmetry.
// ---------------------------------------------------------------------------

/** Two progress saves with identical content but different cursor position (see game.ts saveProgress). */
function progressAt(entries: string[], selRow: number, selCol: number): string {
  return JSON.stringify({ entries, selRow, selCol, activeClue: 0 });
}

describe("sameProgress — iki kayıt aynı oyunu mu taşıyor", () => {
  const base: SaveMap = {
    "cengel-jokers": "11",
    "cengel-stats": JSON.stringify({ streak: 9, solved: ["p1"], lastDay: null }),
    "cengel-progress-p4": progressAt(["A", "B", ""], 0, 1),
  };

  it("birebir aynı kayıtlar aynıdır", () => {
    expect(sameProgress({ ...base }, { ...base })).toBe(true);
  });

  it("yalnızca imleç konumu farklıysa aynıdır", () => {
    // These fields also change when the player merely NAVIGATES in the
    // puzzle; they're unrelated to whether two devices carry the same game.
    const moved = { ...base, "cengel-progress-p4": progressAt(["A", "B", ""], 2, 2) };
    expect(sameProgress(base, moved)).toBe(true);
  });

  it("yazılmış bir harf farklıysa AYNI DEĞİLDİR", () => {
    const typed = { ...base, "cengel-progress-p4": progressAt(["A", "B", "C"], 0, 1) };
    expect(sameProgress(base, typed)).toBe(false);
  });

  it("kendiliğinden yazılan damgalar ve cihaz tercihleri farkı bozmaz", () => {
    const other: SaveMap = {
      ...base,
      "cengel-jokers-init": "1",
      "cengel-story-seen": "1",
      "cengel-epilogue-seen": "1",
      "cengel-tutorial-seen": "1",
      "cengel-theme": "gazete",
      "cengel-sound": "off",
      "cengel-music": "off",
    };
    expect(sameProgress(base, other)).toBe(true);
  });

  it("joker bakiyesi farkı AYNI DEĞİLDİR", () => {
    expect(sameProgress(base, { ...base, "cengel-jokers": "12" })).toBe(false);
  });

  it("istatistik farkı AYNI DEĞİLDİR", () => {
    const other = {
      ...base,
      "cengel-stats": JSON.stringify({ streak: 9, solved: ["p1", "p2"], lastDay: null }),
    };
    expect(sameProgress(base, other)).toBe(false);
  });

  it("bir tarafta olmayan ilerleme anahtarı AYNI DEĞİLDİR", () => {
    expect(sameProgress(base, { ...base, "cengel-progress-p7": "{}" })).toBe(false);
    const missing: SaveMap = { ...base };
    delete missing["cengel-progress-p4"];
    expect(sameProgress(base, missing)).toBe(false);
  });

  it("ipucu ve davet sayaçları farkı AYNI DEĞİLDİR", () => {
    const hintKey = `cengel-hints-${dayString()}`;
    expect(sameProgress({ ...base, [hintKey]: "1" }, { ...base, [hintKey]: "2" })).toBe(false);
    expect(
      sameProgress(
        { ...base, "cengel-referral-synced": "3" },
        { ...base, "cengel-referral-synced": "6" },
      ),
    ).toBe(false);
  });

  it("çözemediğimiz bir ilerleme kaydında TAM metin eşitliği aranır", () => {
    // When in doubt, fall back to asking instead of saying "same".
    const a = { ...base, "cengel-progress-p4": "{bozuk json" };
    const b = { ...base, "cengel-progress-p4": "{bozuk json " };
    expect(sameProgress(a, a)).toBe(true);
    expect(sameProgress(a, b)).toBe(false);
  });

  it("eski (düz dizi) ilerleme biçimini de çözer", () => {
    const legacy = { ...base, "cengel-progress-p4": JSON.stringify(["A", "B", ""]) };
    expect(sameProgress(base, legacy)).toBe(true);
  });
});

describe("aynı oyunu taşıyan iki taraf (çakışma ekranı gösterilmez)", () => {
  /** A device carrying the same game as OTHER_DEVICE_SAVE, but with its own preferences. */
  function sameGameLocally(): void {
    untouchedInstall(); // theme/sound/flags + jokers-init: all "noise"
    storage.setItem("cengel-jokers", "11");
    storage.setItem("cengel-stats", OTHER_DEVICE_SAVE["cengel-stats"]);
    storage.setItem("cengel-progress-p4", OTHER_DEVICE_SAVE["cengel-progress-p4"]);
    storage.setItem("cengel-theme", "gazete"); // theme was changed on this device
  }

  beforeEach(() => {
    cloud.doc = null;
    resetForNewAccount();
  });

  it("bulut ilerideyken bile SORMADAN çözülür ve yerel kayda dokunulmaz", async () => {
    sameGameLocally();
    seedCloud(OTHER_DEVICE_SAVE, 9);
    // Precondition: the old code would definitely ask about a conflict here.
    expect(hasPlayerProgress(collectSyncedSave())).toBe(true);

    expect(await syncCloudSave()).toBe("in-sync");
    expect(conflictSummary()).toBeNull();
    // The cloud is NOT applied: if something genuinely newer remains locally, it must not be overwritten.
    expect(storage.getItem("cengel-theme")).toBe("gazete");
    expect(storage.getItem("cengel-progress-p4")).toBe(OTHER_DEVICE_SAVE["cengel-progress-p4"]);
  });

  it("buluttaki rev benimsenir — aynı ekran bir daha gelmez", async () => {
    sameGameLocally();
    seedCloud(OTHER_DEVICE_SAVE, 9);

    await syncCloudSave();
    await settle();
    // rev 9 was overwritten: on the next sync the cloud is no longer ahead.
    expect(storage.getItem("cengel-cloud-rev")).toBe("10");
    expect(cloud.doc!.rev).toBe(10);

    expect(await syncCloudSave()).toBe("in-sync");
    expect(conflictSummary()).toBeNull();
  });

  it("imleç bulmacada gezinince oluşan fark seçim ekranı ÇIKARMAZ", async () => {
    sameGameLocally();
    const moved = {
      ...OTHER_DEVICE_SAVE,
      "cengel-progress-p4": progressAt(["Z"], 0, 0),
    };
    storage.setItem("cengel-progress-p4", progressAt(["Z"], 1, 2));
    storage.setItem("cengel-jokers", "11");
    seedCloud(moved, 9);

    expect(await syncCloudSave()).toBe("in-sync");
    expect(conflictSummary()).toBeNull();
  });

  it("GERÇEK bir fark varsa yine oyuncuya sorulur (hızlı çıkış kaçış deliği değil)", async () => {
    sameGameLocally();
    storage.setItem("cengel-progress-p9", '{"entries":["Q"]}'); // extra progress on this device
    seedCloud(OTHER_DEVICE_SAVE, 9);

    expect(await syncCloudSave()).toBe("conflict");
    expect(conflictSummary()).not.toBeNull();

    await settle();
    expect(cloud.doc!.rev).toBe(9); // still nothing written to the cloud
  });

  it("yalnızca joker bakiyesi farklıysa da sorulur", async () => {
    sameGameLocally();
    storage.setItem("cengel-jokers", "12"); // 11 in the cloud
    seedCloud(OTHER_DEVICE_SAVE, 9);

    expect(await syncCloudSave()).toBe("conflict");
  });
});

// ---------------------------------------------------------------------------
// FREEZE after restore.
//
// applyCloud modifies localStorage in place, but the in-memory game still
// belongs to the old save, and the page only reloads after ~1.4s. In that
// window the only thing written from memory is game.ts's progress save; if it
// could write, it would overwrite the newly arrived progress, and the
// "pagehide" triggered by the reload → flushCloudSave would then upload over
// the OTHER DEVICE's cloud save.
// ---------------------------------------------------------------------------

/** Same 3x3 fixture as in game.test.ts; kept here so the test is self-contained. */
const tinyPuzzle: PuzzleDef = {
  id: "test-game",
  title: "Test",
  rows: 3,
  cols: 3,
  clues: [
    { text: "Arıların ürünü", answer: "BAL", row: 0, col: 0, arrow: "down-right" },
    { text: "Binek hayvanı", answer: "AT", row: 0, col: 1, arrow: "down" },
  ],
  blocks: [
    { row: 0, col: 2 },
    { row: 2, col: 0 },
    { row: 2, col: 2 },
  ],
};

const CLOUD_PROGRESS = '{"entries":["","","","L","","","","",""]}';

describe("geri yükleme sonrası dondurma", () => {
  beforeEach(() => {
    cloud.doc = null;
    resetForNewAccount();
  });

  it("geri yükleme kaydı dondurur, resetForNewAccount çözer", async () => {
    expect(isSaveFrozen()).toBe(false);
    untouchedInstall();
    seedCloud(OTHER_DEVICE_SAVE, 9);

    expect(await syncCloudSave()).toBe("restored");
    expect(isSaveFrozen()).toBe(true);

    resetForNewAccount();
    expect(isSaveFrozen()).toBe(false);
  });

  it("çakışmada 'buluttaki gelsin' seçeneği de dondurur", async () => {
    untouchedInstall();
    storage.setItem("cengel-progress-p1", '{"entries":["A"]}');
    seedCloud(OTHER_DEVICE_SAVE, 9);
    expect(await syncCloudSave()).toBe("conflict");

    expect(resolveKeepCloud()).toBe(true);
    expect(isSaveFrozen()).toBe(true);
  });

  it("dondurulmuşken bellekteki BAYAT oyun yeni ilerlemenin üstüne yazamaz", async () => {
    // Real flow: the startup sync does NOT block the screen, and the player
    // opens a puzzle during that time. s.entries belongs to the save from
    // BEFORE the restore (here: empty).
    untouchedInstall();
    const s = newGame(tinyPuzzle);
    seedCloud({ ...OTHER_DEVICE_SAVE, "cengel-progress-test-game": CLOUD_PROGRESS }, 9);

    expect(await syncCloudSave()).toBe("restored");
    expect(storage.getItem("cengel-progress-test-game")).toBe(CLOUD_PROGRESS);

    // A single keystroke: this used to write the ENTIRE `s.entries` array to
    // disk, wiping out the progress that just arrived from the cloud.
    selectCell(s, 1, 0);
    typeLetter(s, "K");
    expect(storage.getItem("cengel-progress-test-game")).toBe(CLOUD_PROGRESS);
  });

  it("dondurulmamışken aynı tuş ilerlemeyi normal şekilde kaydeder", () => {
    // Proof that the test above is meaningful: the write path really does work.
    untouchedInstall();
    const s = newGame(tinyPuzzle);
    selectCell(s, 1, 0);
    typeLetter(s, "K");
    expect(storage.getItem("cengel-progress-test-game")).toContain('"K"');
  });

  it("dondurulmuşken buluta HİÇBİR yazma yapılmaz (yenilemedeki pagehide dahil)", async () => {
    untouchedInstall();
    seedCloud(OTHER_DEVICE_SAVE, 9);
    expect(await syncCloudSave()).toBe("restored");

    // If the save gets dirtied during the time before the reload (e.g. the
    // player changes a setting), it must not be pushed to the cloud: the
    // cloud save belongs to the OTHER device, and this device's screen still
    // shows the old game.
    storage.setItem("cengel-theme", "gazete");
    flushCloudSave();
    maybeUploadCloudSave();
    await settle();

    expect(cloud.doc!.rev).toBe(9);
    expect(JSON.parse(cloud.doc!.payload as string)["cengel-theme"]).toBeUndefined();
  });
});

describe("çakışma ekranının özeti", () => {
  it("seri, çözülen sayısı ve joker bakiyesini kayıttan okur", () => {
    storage.setItem("cengel-jokers", "9");
    storage.setItem(
      "cengel-stats",
      JSON.stringify({ streak: 5, solved: ["p1", "p2", "p3"], lastDay: dayString() }),
    );

    expect(localSummary()).toEqual({ streak: 5, solved: 3, jokers: 9, updatedAtMs: 0 });
  });

  it("kayıt yokken ya da bozukken sıfırlarla döner, patlamaz", () => {
    expect(localSummary()).toEqual({ streak: 0, solved: 0, jokers: 0, updatedAtMs: 0 });
    storage.setItem("cengel-stats", "{bozuk");
    storage.setItem("cengel-jokers", "abc");
    expect(localSummary()).toEqual({ streak: 0, solved: 0, jokers: 0, updatedAtMs: 0 });
  });
});
