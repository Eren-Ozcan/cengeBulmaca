// GÜVENLİK TESTİ — firestore.rules'daki bulut kaydı (saves/{uid}) kurallarına
// karşı saldırı senaryoları. Gerçek Firebase projesine DOKUNMAZ; sadece
// Firestore emulator üzerinde çalışır (bkz. security-tests/README.md).
//
// Buradaki asıl iddia: ilerlemeyi koruyan garanti İSTEMCİ MANTIĞINDA DEĞİL,
// kuralda. src/cloud-save.ts monotonik bir `rev` sayacı yazar, ama istemci
// kodu her zaman eski (uzun süredir güncellenmemiş bir cihaz) ya da doğrudan
// Firebase SDK'sıyla konuşan biri tarafından değiştirilmiş olabilir. Bayat bir
// istemcinin başka bir cihazın yazdığı daha yeni kaydı EZEMEYECEĞİNİ kural
// düzeyinde doğruluyoruz.

import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

let testEnv: RulesTestEnvironment;

const OWNER = "owner-uid";
const OTHER = "other-uid";

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "cengel-bulmaca-rules-test",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

function saveDoc(rev: number, payload = '{"cengel-jokers":"5"}') {
  return { payload, rev, schemaVersion: 1, updatedAt: new Date() };
}

async function seedSave(uid: string, rev: number) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("saves").doc(uid).set(saveDoc(rev));
  });
}

function ownerDoc(uid = OWNER) {
  return testEnv.authenticatedContext(uid).firestore().collection("saves").doc(uid);
}

describe("SALDIRI: bayat istemci daha yeni ilerlemeyi eziyor", () => {
  it("rev geriye gidemez", async () => {
    // Cihaz B kaydı rev=9'a taşıdı. Uzun süre çevrimdışı kalmış cihaz A hâlâ
    // rev=3'te; kendi kaydını yazabilseydi B'nin ilerlemesi yok olurdu.
    await seedSave(OWNER, 9);
    await assertFails(ownerDoc().set(saveDoc(3)));
  });

  it("aynı rev ile üzerine yazamaz", async () => {
    await seedSave(OWNER, 9);
    await assertFails(ownerDoc().set(saveDoc(9)));
  });

  it("meşru ilerleme (rev artıyor) geçer", async () => {
    await seedSave(OWNER, 9);
    await assertSucceeds(ownerDoc().set(saveDoc(10)));
  });

  it("rev alanını silerek kuralı atlayamaz", async () => {
    await seedSave(OWNER, 9);
    await assertFails(ownerDoc().set({ payload: "{}", schemaVersion: 1 }));
    await assertFails(ownerDoc().set({ payload: "{}", schemaVersion: 1, rev: "999" }));
  });
});

describe("SALDIRI: başkasının kaydına erişim", () => {
  it("başka bir oyuncunun kaydını okuyamaz", async () => {
    await seedSave(OTHER, 1);
    const db = testEnv.authenticatedContext(OWNER).firestore();
    await assertFails(db.collection("saves").doc(OTHER).get());
  });

  it("başka bir oyuncunun kaydının üstüne yazamaz", async () => {
    await seedSave(OTHER, 1);
    const db = testEnv.authenticatedContext(OWNER).firestore();
    await assertFails(db.collection("saves").doc(OTHER).set(saveDoc(2)));
  });

  it("oturum açmamış istemci ne okuyabilir ne yazabilir", async () => {
    await seedSave(OWNER, 1);
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection("saves").doc(OWNER).get());
    await assertFails(db.collection("saves").doc(OWNER).set(saveDoc(2)));
  });
});

describe("kayıt silme ve boyut sınırı", () => {
  it("kayıt silinemez — tek istekle bir oyuncunun ilerlemesi yok edilemesin", async () => {
    await seedSave(OWNER, 1);
    await assertFails(ownerDoc().delete());
  });

  it("doküman tavanını aşan payload reddedilir", async () => {
    // 400 KB tavanı src/cloud-save.ts'teki MAX_PAYLOAD_BYTES ile aynı; 300
    // bulmaca tamamen dolu bile ~200 KB ettiği için meşru kayıt asla çarpmaz.
    await assertFails(ownerDoc().set(saveDoc(1, "x".repeat(400_001))));
  });

  it("ilk kayıt rev=0 ile oluşturulamaz", async () => {
    await assertFails(ownerDoc().set(saveDoc(0)));
    await assertSucceeds(ownerDoc().set(saveDoc(1)));
  });

  it("kendi kaydını okuyabilir", async () => {
    await seedSave(OWNER, 1);
    await assertSucceeds(ownerDoc().get());
  });
});
