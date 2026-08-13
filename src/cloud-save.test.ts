// Bulut kaydının senkron SINIRI: hangi localStorage anahtarı buluta gider,
// buluttan gelen bir doküman yerele neyi yazabilir, ve çakışmada oyuncuya
// sorulur mu sorulmaz mı.
//
// Gerçek ağa hiç çıkılmaz. Saf fonksiyonlar (collectSyncedSave /
// parseCloudPayload / localSummary / hasPlayerProgress) doğrudan sınanır;
// syncCloudSave için Firebase modülleri mock'lanır ve bellek içi sahte bir
// "bulut dokümanı" kullanılır (referral.test.ts ile aynı deyim).
//
// Buradaki iddiaların üçü güvenlik/veri kaybı iddiasıdır ve sessizce
// bozulabilirler: entitlement'ın buluta sızmaması, buluttan gelen verinin
// allowlist dışına yazamaması, ve hasPlayerProgress'in ilerlemesi olan bir
// kaydı asla "bakir" sayMAMASI — sonuncusu yanlış giderse oyuncunun oyunu
// sorulmadan silinir.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Sahte bulut dokümanı; mock fabrikaları hoist edildiği için vi.hoisted ile
// kurulur. `doc` null ise "bulutta kayıt yok" demektir.
const cloud = vi.hoisted(() => ({ doc: null as Record<string, unknown> | null }));

/** Sunucu damgası: cihaz saatinden bağımsız olduğu için sabit bir değer yeter. */
const CLOUD_STAMP_MS = 1_700_000_000_000;

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
}));
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
  // firebase-app.ts önce kalıcı oturumun geri yüklenmesini bekler; burada
  // referral.test.ts'in aksine oturum VARMIŞ gibi davranılır, çünkü sınanan
  // şey senkron akışının kendisi.
  //
  // Bildirim ASENKRON verilmeli: gerçek Firebase gözlemciyi hiçbir zaman
  // onAuthStateChanged'in içinden senkron çağırmaz ve firebase-app.ts buna
  // güvenerek geri çağrının içinde `unsubscribe`a dokunur. Senkron çağıran bir
  // mock o değişkeni TDZ'de yakalar, ReferenceError fırlatır ve ensureUid
  // sessizce null döner — yani mock'un kendisi "bağlantı yok" senaryosuna
  // dönüşür ve akış hiç sınanmamış olur.
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
    // Gerçek Firestore gibi: serverTimestamp() sentinel'i sunucuda çözülür.
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

    // Taşınsaydı bir kaydı paylaşmak bedava reklamsız sürüm dağıtmak olurdu.
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
    // Budanmasaydı doküman her gün biraz daha şişerek sonsuza kadar büyürdü.
    expect(map[`cengel-hints-${daysAgo(30)}`]).toBeUndefined();
    expect(map["cengel-hints-2024-01-01"]).toBeUndefined();
  });

  it("anahtar sırası deterministik — aynı içerik hep aynı payload'ı üretir", () => {
    storage.setItem("cengel-theme", "modern");
    storage.setItem("cengel-jokers", "5");
    storage.setItem("cengel-progress-b", "2");
    storage.setItem("cengel-progress-a", "1");
    const first = JSON.stringify(collectSyncedSave());

    // Aynı veriyi farklı ekleme sırasıyla kur: parmak izi (dolayısıyla
    // "yerelde değişiklik var mı") sıralamaya duyarlı olmamalı.
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
// hasPlayerProgress — çakışma ekranını atlayan hızlı yolun BEKÇİSİ.
//
// Her dal ayrı ayrı sınanır. "true" dalları eksikse gerçek ilerlemesi olan bir
// oyuncunun kaydı sorulmadan silinir; "false" dalları (bilerek yok sayılan
// sinyaller) sınanmazsa biri sonradan iyi niyetle listeye bir ayar/damga ekler
// ve düzeltilen hata — bir tarafı bomboş seçim ekranı — geri gelir.
// ---------------------------------------------------------------------------

/** Oyunu bir kez açan HER oyuncuda, hiçbir hamle yapılmadan oluşan kayıt. */
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
    // game.ts bu anahtarı yalnızca oyuncu harf yazınca/silince yazar (rehber
    // bulmacası "practice" modunda olduğu için hiç yazmaz), dolayısıyla
    // varlığı tek başına gerçek bir hamledir — içeriğini ayrıca yorumlamayız.
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
    // Buradaki tek bir "true" bile oyuncuya bir tarafı bomboş seçim ekranı
    // gösterirdi; düzeltilen hata tam olarak budur.
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
    // Bakiye ilk okunduğunda (ana ekran çizilirken) kendiliğinden yazılır;
    // oyuncunun hiçbir hamlesi yoktur.
    storage.setItem("cengel-jokers-init", "1");
    storage.setItem("cengel-jokers", String(START_JOKERS));
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("dokunulmamış başlangıç joker bakiyesi", () => {
    storage.setItem("cengel-jokers", String(START_JOKERS));
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("açılış hikayesinin 'görüldü' damgası", () => {
    // Hikaye açılışta KENDİLİĞİNDEN gösterilir; kapatmak bir kazanım değildir.
    storage.setItem("cengel-story-seen", "1");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("kapanış hikayesinin 'görüldü' damgası", () => {
    storage.setItem("cengel-epilogue-seen", "1");
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("rehberin 'görüldü' damgası", () => {
    // Rehber "practice" modunda oynanır: ne ilerleme ne istatistik yazar, ve
    // damga "Geç"e basınca da düşer. İlerleme sayılsaydı oyunu bir kez açmış
    // oyuncunun hesap bağlaması hâlâ boş taraflı seçim ekranı gösterirdi.
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
    // Entitlement senkronlanmaz (bkz. allowlist testleri): satın alma yapmış
    // bir oyuncunun TEMİZ kurulumunda bu hak mağazadan geri gelir, kaydından
    // değil. İlerleme sayılsaydı, o oyuncu her yeni cihazda gereksiz yere
    // seçim ekranıyla karşılaşırdı.
    storage.setItem("cengel-ads-removed", "1");
    untouchedInstall();
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });

  it("pencere dışında kalmış bayat ipucu anahtarı (kayda hiç girmez)", () => {
    untouchedInstall();
    storage.setItem(`cengel-hints-${daysAgo(30)}`, "3");
    // collectSyncedSave onu zaten budar; predicate de görmez.
    expect(collectSyncedSave()[`cengel-hints-${daysAgo(30)}`]).toBeUndefined();
    expect(hasPlayerProgress(collectSyncedSave())).toBe(false);
  });
});

describe("hasPlayerProgress sınır durumları", () => {
  it("boş SaveMap'te ilerleme yoktur", () => {
    expect(hasPlayerProgress({})).toBe(false);
  });

  it("allowlist dışı anahtarlar hiç dikkate alınmaz", () => {
    // Elle kurulmuş map: gerçek akışta buraya asla gelemezler, ama predicate
    // tek başına da bu anahtarlara bakmamalı.
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
// Senkron akışı — sahte Firestore dokümanı üzerinden uçtan uca.
// ---------------------------------------------------------------------------

/** Buluta hazır bir doküman koyar (başka bir cihazın yazdığı kayıt gibi). */
function seedCloud(save: SaveMap, rev: number, schemaVersion = CLOUD_SCHEMA_VERSION): void {
  cloud.doc = {
    payload: JSON.stringify(save),
    rev,
    schemaVersion,
    updatedAt: { toMillis: () => CLOUD_STAMP_MS },
    summary: {},
  };
}

/** Ateşle-unut yüklemelerin (void upload()) oturması için bir makro-görev bekle. */
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
    // Modül içi durum (blocked/pendingCloud/rev) testler arasında taşınmasın.
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
    // Yerel kayıt olduğu gibi durmalı: bayat bulut yereli EZEMEZ.
    expect(storage.getItem("cengel-progress-p1")).toBe('{"entries":["A"]}');
    expect(storage.getItem("cengel-progress-p4")).toBeNull();

    await settle();
    expect(cloud.doc!.rev).toBe(10); // yerel değişiklik buluta taşındı
  });

  it("bulut ilerideyken YEREL BAKİRSE sormadan geri yükler (hızlı yol)", async () => {
    untouchedInstall();
    seedCloud(OTHER_DEVICE_SAVE, 9);

    expect(await syncCloudSave()).toBe("restored");
    expect(storage.getItem("cengel-progress-p4")).toBe('{"entries":["Z"]}');
    expect(storage.getItem("cengel-jokers")).toBe("11");
    expect(storage.getItem("cengel-cloud-rev")).toBe("9");
    // Sorulmadığı için çakışma durumu hiç açılmamalı.
    expect(conflictSummary()).toBeNull();
  });

  it("bulut ilerideyken YERELDE İLERLEME VARSA çakışma sorar (hızlı yol DEVREYE GİRMEZ)", async () => {
    untouchedInstall();
    storage.setItem("cengel-progress-p1", '{"entries":["A"]}');
    seedCloud(OTHER_DEVICE_SAVE, 9);

    expect(await syncCloudSave()).toBe("conflict");
    // Yerel kayıt korunur, buluttaki hiç uygulanmaz: karar oyuncunun.
    expect(storage.getItem("cengel-progress-p1")).toBe('{"entries":["A"]}');
    expect(storage.getItem("cengel-progress-p4")).toBeNull();
    expect(storage.getItem("cengel-cloud-rev")).toBe("0");

    // Çakışma ekranının göstereceği özet buluttan gelir.
    expect(conflictSummary()).toEqual({
      streak: 9,
      solved: 3,
      jokers: 11,
      updatedAtMs: CLOUD_STAMP_MS,
    });

    await settle();
    expect(cloud.doc!.rev).toBe(9); // buluta HİÇ yazılmadı
  });

  it("yerelde ilerleme olsa da GÖNDERİLMEMİŞ değişiklik yoksa çakışma sorulmaz", async () => {
    // İki koşul birlikte gerekir: bulut ileride VE yerelde kirli ilerleme.
    // Burada yerel kayıt bulutla senkron; başka bir cihaz sonra yazmış.
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
    expect(cloud.doc!.rev).toBe(9); // tanımadığımız biçimin üstüne yazılmaz
  });

  it("hızlı yolda da kurcalanmış bir doküman reklamsız sürümü AÇAMAZ", async () => {
    untouchedInstall(); // yerel bakir → hızlı yol çalışacak
    seedCloud({ ...OTHER_DEVICE_SAVE, "cengel-ads-removed": "1" }, 9);

    expect(await syncCloudSave()).toBe("restored");
    expect(storage.getItem("cengel-ads-removed")).toBeNull();
  });

  it("hızlı yolda geri yükleme, cihazdaki satın alma hakkını SİLMEZ", async () => {
    storage.setItem("cengel-ads-removed", "1"); // mağazadan gelen gerçek hak
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
// sameProgress — "iki taraf aynı oyun mu?" sorusunun bekçisi.
//
// Bu predicate çakışma ekranını ATLATIR: "true" dediğinde oyuncuya hiç
// sorulmaz. Yanlış "true" bir tarafın ilerlemesini sessizce gözden çıkarır,
// yanlış "false" ise en fazla bugünkü seçim ekranına düşürür — testler bu
// asimetriyi korumak için yazıldı.
// ---------------------------------------------------------------------------

/** İçeriği aynı, imleci farklı iki ilerleme kaydı (bkz. game.ts saveProgress). */
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
    // Oyuncu bulmacada sadece GEZİNİRSE de bu alanlar değişir; iki cihazın
    // aynı oyunu taşıyıp taşımadığıyla ilgisi yoktur.
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
    // Şüphede "aynı" demek yerine sormaya düşülür.
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
  /** OTHER_DEVICE_SAVE ile aynı oyunu taşıyan, ama kendi tercihleri olan cihaz. */
  function sameGameLocally(): void {
    untouchedInstall(); // tema/ses/damgalar + jokers-init: hepsi "gürültü"
    storage.setItem("cengel-jokers", "11");
    storage.setItem("cengel-stats", OTHER_DEVICE_SAVE["cengel-stats"]);
    storage.setItem("cengel-progress-p4", OTHER_DEVICE_SAVE["cengel-progress-p4"]);
    storage.setItem("cengel-theme", "gazete"); // bu cihazda tema değiştirilmiş
  }

  beforeEach(() => {
    cloud.doc = null;
    resetForNewAccount();
  });

  it("bulut ilerideyken bile SORMADAN çözülür ve yerel kayda dokunulmaz", async () => {
    sameGameLocally();
    seedCloud(OTHER_DEVICE_SAVE, 9);
    // Ön koşullar: eski kod burada mutlaka çakışma sorardı.
    expect(hasPlayerProgress(collectSyncedSave())).toBe(true);

    expect(await syncCloudSave()).toBe("in-sync");
    expect(conflictSummary()).toBeNull();
    // Bulut UYGULANMAZ: yerelde gerçekten daha yeni bir şey kalmışsa ezilmesin.
    expect(storage.getItem("cengel-theme")).toBe("gazete");
    expect(storage.getItem("cengel-progress-p4")).toBe(OTHER_DEVICE_SAVE["cengel-progress-p4"]);
  });

  it("buluttaki rev benimsenir — aynı ekran bir daha gelmez", async () => {
    sameGameLocally();
    seedCloud(OTHER_DEVICE_SAVE, 9);

    await syncCloudSave();
    await settle();
    // rev 9'un üstüne yazıldı: bir sonraki senkronda bulut artık ileride değil.
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
    storage.setItem("cengel-progress-p9", '{"entries":["Q"]}'); // bu cihazda fazladan ilerleme
    seedCloud(OTHER_DEVICE_SAVE, 9);

    expect(await syncCloudSave()).toBe("conflict");
    expect(conflictSummary()).not.toBeNull();

    await settle();
    expect(cloud.doc!.rev).toBe(9); // buluta hâlâ hiç yazılmadı
  });

  it("yalnızca joker bakiyesi farklıysa da sorulur", async () => {
    sameGameLocally();
    storage.setItem("cengel-jokers", "12"); // bulutta 11
    seedCloud(OTHER_DEVICE_SAVE, 9);

    expect(await syncCloudSave()).toBe("conflict");
  });
});

// ---------------------------------------------------------------------------
// Geri yükleme sonrası DONDURMA.
//
// applyCloud localStorage'ı yerinde değiştirir ama bellekteki oyun hâlâ eski
// kayda aittir ve sayfa ancak ~1,4 sn sonra yenilenir. O aralıkta bellekten
// yazılan tek şey game.ts'in ilerleme kaydıdır; yazabilseydi yeni gelen
// ilerlemeyi ezer ve yenilemenin tetiklediği "pagehide" → flushCloudSave ile
// DİĞER CİHAZIN bulut kaydının üstüne yüklenirdi.
// ---------------------------------------------------------------------------

/** game.test.ts'teki 3x3 fikstürün aynısı; test kendi kendine yetsin diye burada. */
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
    // Gerçek akış: açılış senkronu ekranı BEKLETMEZ, oyuncu bu sırada bir
    // bulmaca açar. s.entries geri yüklemeden ÖNCEKİ kayda (burada: boş) ait.
    untouchedInstall();
    const s = newGame(tinyPuzzle);
    seedCloud({ ...OTHER_DEVICE_SAVE, "cengel-progress-test-game": CLOUD_PROGRESS }, 9);

    expect(await syncCloudSave()).toBe("restored");
    expect(storage.getItem("cengel-progress-test-game")).toBe(CLOUD_PROGRESS);

    // Tek bir tuş: eskiden `s.entries` dizisinin TAMAMINI diske yazar, buluttan
    // yeni gelen ilerlemeyi silerdi.
    selectCell(s, 1, 0);
    typeLetter(s, "K");
    expect(storage.getItem("cengel-progress-test-game")).toBe(CLOUD_PROGRESS);
  });

  it("dondurulmamışken aynı tuş ilerlemeyi normal şekilde kaydeder", () => {
    // Yukarıdaki testin anlamlı olduğunun kanıtı: yazma yolu gerçekten çalışıyor.
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

    // Yenilemeye kadar geçen sürede kayıt yine de kirlenirse (ör. oyuncunun
    // bir ayarı değiştirmesi) buluta taşınmamalı: buluttaki, DİĞER cihazın
    // kaydıdır ve bu cihazın ekranı hâlâ eski oyunu gösteriyor.
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
