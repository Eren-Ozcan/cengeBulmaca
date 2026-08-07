// Bulut kaydının senkron SINIRI: hangi localStorage anahtarı buluta gider,
// buluttan gelen bir doküman yerele neyi yazabilir.
//
// Ağa hiç çıkılmaz: yalnızca collectSyncedSave/parseCloudPayload/localSummary
// sınanır, Firestore çağrıları (syncCloudSave, upload) bu testin dışında.
// Buradaki iddiaların ikisi güvenlik iddiasıdır ve sessizce bozulabilirler:
// entitlement'ın buluta sızmaması ve buluttan gelen verinin allowlist dışına
// yazamaması.

import { beforeEach, describe, expect, it } from "vitest";
import { collectSyncedSave, localSummary, parseCloudPayload } from "./cloud-save.ts";
import { dayString } from "./stats.ts";
import { installMemoryStorage, type MemoryStorage } from "./test-helpers.ts";

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

  it("bozuk ya da beklenmedik biçimdeki payload'da null döner (yerel kayıt korunur)", () => {
    expect(parseCloudPayload("{bozuk json")).toBeNull();
    expect(parseCloudPayload("[1,2,3]")).toBeNull();
    expect(parseCloudPayload("null")).toBeNull();
    expect(parseCloudPayload('"düz metin"')).toBeNull();
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
