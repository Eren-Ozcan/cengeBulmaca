// Bulut kaydı (Firestore) — `saves/{uid}` altında tek doküman.
//
// Tasarım kararları ve gerekçeleri (reefy'deki uygulamayla aynı; orada gerçek
// bir hesapla uçtan uca doğrulandı):
//
// * Cihaz saatine GÜVENİLMEZ. "Son yazan kazanır" mantığı, saati ileri alınmış
//   bir cihazda kalıcı veri kaybına yol açar (o cihaz sonsuza dek "daha yeni"
//   görünür). Bunun yerine monotonik `rev` sayacı kullanılır ve geriye gitmesi
//   firestore.rules düzeyinde yasaklanır; `updatedAt` yalnızca kullanıcıya
//   gösterilmek içindir ve sunucu damgasıdır.
//
// * ÇAKIŞMADA OTOMATİK BİRLEŞTİRME YAPILMAZ. İki ilerlemeyi birleştirmek
//   (jokerleri topla? çözülenleri birleştir?) ekonomiyi bozar ve istismara
//   açıktır. Çakışma tespit edilince yerel kayıt korunur, buluta HİÇ YAZILMAZ
//   ve karar oyuncuya bırakılır (bkz. cloud-ui.ts çakışma ekranı).
//
// * ENTITLEMENT (satın alma hakkı) BULUTTAN GELMEZ. "cengel-ads-removed"
//   yüklenirken payload'dan çıkarılır, indirilirken yerel/mağaza değeri
//   korunur (bkz. billing.ts restoreAdsRemoved). Aksi halde bir kaydı
//   paylaşmak bedava reklamsız sürüm dağıtmak olurdu.
//
// * Hangi anahtarların senkronlanacağı ALLOWLIST ile belirlenir, blocklist ile
//   değil. Yarın eklenecek yeni bir "cengel-" anahtarı sessizce buluta sızmaz;
//   bilinçli olarak listeye eklenmesi gerekir.
//
// * Ağ yoksa, yapılandırma eksikse veya bir şey ters giderse her fonksiyon
//   sessizce no-op olur; oyun akışı asla bozulmaz (ads.ts/billing.ts deyimi).
//
// BİLİNEN SINIR (reefy'de de kabul edildi): jokerler gerçek parayla da
// alınabilen bir kaynak. Sunucu tarafı doğrulama (Cloud Functions) olmadan,
// çevrimdışı harcayıp çakışmada "bulut" tarafını seçen bir oyuncu jokerlerini
// geri alabilir. Spark planında sunucu tarafı doğrulama yok; bu vektör
// bilinçli olarak kabul edildi ve buradaki hiçbir kontrol onu kapatmaz.

import { ensureUid, firebaseSdk } from "./firebase-app.ts";
import { dayString } from "./stats.ts";

/** Bu istemcinin yazdığı payload biçiminin sürümü. */
export const CLOUD_SCHEMA_VERSION = 1;

const REV_KEY = "cengel-cloud-rev";
/** Son senkronlanan payload'ın parmak izi; "yerelde değişiklik var mı"yı bundan türetiriz. */
const FINGERPRINT_KEY = "cengel-cloud-fp";

const UPLOAD_THROTTLE_MS = 60_000; // Firestore günlük yazma kotasını koru (Spark: 20K/gün)
const AUTH_TIMEOUT_MS = 3_000; // kötü ağda açılışı kilitleme
const FETCH_TIMEOUT_MS = 4_000;
// setDoc() çevrimdışıyken ÇÖZÜLMEZ: Firestore yazmayı yerel kuyruğa alır ve
// sözü sunucu onaylayana kadar askıda tutar. Zaman aşımı olmadan upload()
// içindeki finally hiç çalışmaz, `uploading` kilitli kalır ve bulut kaydı
// oturum boyunca tamamen ölür — bu yüzden yazma da sınırlandırılıyor.
const WRITE_TIMEOUT_MS = 8_000;
const MAX_PAYLOAD_BYTES = 400_000; // firestore.rules'daki tavanla aynı

/**
 * Senkronlanan sabit anahtarlar (ALLOWLIST).
 * "cengel-ads-removed" bilerek YOK — bkz. dosya başındaki ENTITLEMENT notu.
 * "cengel-cloud-rev"/"cengel-cloud-fp" de yok: onlar cihaza ait defter
 * kayıtları, oyuncu ilerlemesi değil.
 */
const SYNCED_KEYS = [
  "cengel-jokers",
  "cengel-jokers-init",
  "cengel-stats",
  "cengel-story-seen",
  "cengel-epilogue-seen",
  "cengel-tutorial-seen",
  "cengel-theme",
  "cengel-sound",
  "cengel-music",
  // Davet ödüllerinden bulutta biriken jokerin ne kadarının yerele işlendiği.
  // Senkronlanmazsa yeni cihazda aynı ödül ikinci kez verilirdi (bkz. referral.ts).
  "cengel-referral-synced",
] as const;

/** Bulmaca başına bir anahtar: "cengel-progress-<puzzleId>". */
const PROGRESS_PREFIX = "cengel-progress-";
/** Gün başına bir anahtar: "cengel-hints-<YYYY-MM-DD>" (bkz. hints.ts). */
const HINTS_PREFIX = "cengel-hints-";

/**
 * Tarihli ipucu anahtarlarından kaç günlüğü taşınır.
 *
 * hints.ts yalnızca BUGÜNÜN anahtarını okur, eskiler ölü yüktür ve budanmazsa
 * doküman her gün biraz daha şişerek sonsuza kadar büyür. Tek gün taşımak
 * yeterli görünse de cihazlar farklı saat dilimlerinde olabilir (ya da oyuncu
 * seyahat eder): bir cihazın "bugün"ü diğerinde dün/yarın olabilir. Bir
 * haftalık pencere bu kaymayı fazlasıyla karşılar ve doküman katkısını ~100
 * bayta sabitler.
 */
const HINTS_HISTORY_DAYS = 7;

export type CloudSyncResult =
  | "disabled" // yapılandırma yok / ağ yok / zaman aşımı — sessizce yerel devam
  | "in-sync" // yerel en az bulut kadar güncel
  | "uploaded" // bulutta kayıt yoktu, yerel yüklendi
  | "restored" // buluttan indirildi ve uygulandı
  | "conflict" // iki taraf da ilerlemiş — yerel korundu, bulut dokunulmadı
  | "needs-update"; // buluttaki şema bu istemciden yeni

/** Çakışma ekranının payload'ı açmadan gösterebildiği özet. */
export interface CloudSummary {
  streak: number;
  solved: number;
  jokers: number;
  /** Sunucu damgası (ms). Cihaz saatinden bağımsızdır; 0 = bilinmiyor. */
  updatedAtMs: number;
}

/** Kaydın taşınabilir hali: localStorage anahtarı → ham değer. */
export type SaveMap = Record<string, string>;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

// ---------- yerel kaydın toplanması ----------

/** Son HINTS_HISTORY_DAYS gün (+ saat dilimi kayması için bir gün ileri). */
function liveHintKeys(): Set<string> {
  const keys = new Set<string>();
  const d = new Date();
  d.setDate(d.getDate() + 1);
  for (let i = 0; i <= HINTS_HISTORY_DAYS; i++) {
    keys.add(HINTS_PREFIX + dayString(d));
    d.setDate(d.getDate() - 1);
  }
  return keys;
}

/** Bu anahtar buluta taşınır mı? Hem yükleme hem indirme aynı kapıdan geçer. */
function isSyncedKey(key: string, hintKeys: Set<string>): boolean {
  if ((SYNCED_KEYS as readonly string[]).includes(key)) return true;
  if (key.startsWith(HINTS_PREFIX)) return hintKeys.has(key);
  return key.startsWith(PROGRESS_PREFIX);
}

/** Yereldeki senkronlanabilir anahtarlar; parmak izi sabit kalsın diye sıralı. */
function syncedLocalKeys(): string[] {
  const hintKeys = liveHintKeys();
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isSyncedKey(k, hintKeys)) out.push(k);
    }
  } catch {
    return [];
  }
  return out.sort();
}

/**
 * Bu cihazdaki kaydın buluta gidecek hali. Senkron sınırının tek tanımı
 * burasıdır (testler de bu sınırı buradan doğrular): allowlist dışındaki hiçbir
 * anahtar — özellikle "cengel-ads-removed" — asla içine giremez.
 */
export function collectSyncedSave(): SaveMap {
  const map: SaveMap = {};
  for (const k of syncedLocalKeys()) {
    const v = localStorage.getItem(k);
    if (v !== null) map[k] = v;
  }
  return map;
}

/**
 * Oyuncu bu cihazda gerçekten oynamış mı? Hiç bulmaca ilerlemesi ve hiç
 * istatistik yoksa yerel kayıt "el değmemiş" sayılır ve çakışma sorulmadan
 * bulut geri yüklenir — aksi halde yeni kurulumda oyuncuya anlamsız bir
 * "hangisini tutayım?" ekranı gösterilirdi (reefy'de yaşandı).
 */
function isLocalPristine(): boolean {
  try {
    if (localStorage.getItem("cengel-stats")) return false;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PROGRESS_PREFIX)) return false;
    }
    return true;
  } catch {
    return true;
  }
}

function summarize(map: SaveMap, updatedAtMs = 0): CloudSummary {
  let streak = 0;
  let solved = 0;
  try {
    const s = JSON.parse(map["cengel-stats"] ?? "null");
    if (s && typeof s === "object") {
      if (typeof s.streak === "number") streak = s.streak;
      if (Array.isArray(s.solved)) solved = s.solved.length;
    }
  } catch {
    /* bozuk istatistik: 0 göster */
  }
  const jokers = Number(map["cengel-jokers"] ?? "0");
  return {
    streak,
    solved,
    jokers: Number.isFinite(jokers) ? Math.max(0, Math.floor(jokers)) : 0,
    updatedAtMs,
  };
}

/** Bu cihazdaki kaydın özeti — çakışma ekranının "Bu cihaz" tarafı. */
export function localSummary(): CloudSummary {
  return summarize(collectSyncedSave());
}

// ---------- defter kayıtları (rev / parmak izi) ----------

function readRev(): number {
  try {
    const n = Number(localStorage.getItem(REV_KEY) ?? "0");
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writeRev(v: number): void {
  try {
    localStorage.setItem(REV_KEY, String(v));
  } catch {
    /* depolama engelli — bulut kaydı devre dışı kalır, oyun etkilenmez */
  }
}

/**
 * Payload'ın parmak izi. Yerelde değişiklik olup olmadığını buradan anlıyoruz;
 * böylece kaydı yazan ~8 modülün (game/stats/economy/theme/…) hiçbirine
 * dokunmadan "kirli mi?" sorusuna cevap verebiliyoruz. Uzunluk + djb2 birlikte
 * kullanılır: tek başına 32 bitlik özet çakışırsa bir yükleme atlanabilirdi.
 */
function fingerprint(payload: string): string {
  let h = 5381;
  for (let i = 0; i < payload.length; i++) h = ((h * 33) ^ payload.charCodeAt(i)) >>> 0;
  return `${payload.length}:${h.toString(36)}`;
}

function markSynced(payload: string): void {
  try {
    localStorage.setItem(FINGERPRINT_KEY, fingerprint(payload));
  } catch {
    /* yok sayılır */
  }
}

function isDirty(payload: string): boolean {
  try {
    return localStorage.getItem(FINGERPRINT_KEY) !== fingerprint(payload);
  } catch {
    return true;
  }
}

// ---------- senkron durumu ----------

let lastUpload = 0;
let uploading = false;
/** Çakışma çözülene dek yazmalar durur; buluttaki sürüm yedek olarak korunur. */
let blocked = false;
let pendingCloud: { rev: number; map: SaveMap; summary: CloudSummary } | null = null;

/** Çözülmemiş bir çakışma varsa buluttaki kaydın özeti. */
export function conflictSummary(): CloudSummary | null {
  return blocked ? (pendingCloud?.summary ?? null) : null;
}

/**
 * Oturum başka bir hesaba geçtiğinde çağrılır. rev sayacı CİHAZDA tutulur ve
 * eski hesaba aitti; yeni hesap için anlamsızdır. Sıfırlanmazsa yerel sayaç
 * buluttakinden büyük görünüp "yerel güncel" sanılabilir ve diğer hesabın
 * ilerlemesi sessizce ezilirdi. Sıfırlayıp parmak izini silince bir sonraki
 * sync() iki tarafı da görür ve gerekirse kullanıcıya seçtirir.
 */
export function resetForNewAccount(): void {
  writeRev(0);
  try {
    localStorage.removeItem(FINGERPRINT_KEY);
  } catch {
    /* yok sayılır */
  }
  blocked = false;
  pendingCloud = null;
  lastUpload = 0;
}

async function saveDoc() {
  const uid = await withTimeout(ensureUid(), AUTH_TIMEOUT_MS);
  if (!uid) return null;
  const sdk = await firebaseSdk();
  if (!sdk) return null;
  return { sdk, ref: sdk.fs.doc(sdk.db, "saves", uid) };
}

/**
 * Buluttan gelen payload'ı doğrular. Yerel kaydın geçtiği kapıdan geçer:
 * yalnızca allowlist'teki anahtarlar, yalnızca string değerler. Böylece
 * kurcalanmış bir doküman ne "cengel-ads-removed" yazabilir ne de tanımadığımız
 * bir anahtarı localStorage'a sokabilir.
 */
export function parseCloudPayload(payload: string): SaveMap | null {
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const hintKeys = liveHintKeys();
  const map: SaveMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "string") continue;
    if (!isSyncedKey(k, hintKeys)) continue;
    map[k] = v;
  }
  return map;
}

/**
 * Buluttaki kaydı yerele uygular. "Bulut kazanır" demek birleştirme YAPMAMAK
 * demektir: önce senkronlanan yerel anahtarlar silinir, sonra buluttakiler
 * yazılır. Aksi halde yerelde kalan bir bulmaca ilerlemesi iki kaydın melezi
 * bir duruma yol açardı.
 */
function applyCloud(rev: number, map: SaveMap): boolean {
  try {
    for (const k of syncedLocalKeys()) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(map)) localStorage.setItem(k, v);
  } catch {
    return false;
  }
  writeRev(rev);
  markSynced(serialize(collectSyncedSave()));
  blocked = false;
  pendingCloud = null;
  return true;
}

function serialize(map: SaveMap): string {
  return JSON.stringify(map);
}

async function upload(): Promise<boolean> {
  if (blocked || uploading) return false;
  uploading = true;
  // Kısıtlamayı denemenin BAŞINDA güncelle: aksi halde çevrimdışıyken her
  // başarısız deneme kısıtlamayı sıfır bırakır ve periyodik kontrol bir
  // yeniden deneme fırtınasına dönüşür.
  lastUpload = Date.now();

  try {
    const target = await saveDoc();
    if (!target) return false;

    const map = collectSyncedSave();
    const payload = serialize(map);
    // Doküman tavanını aşan kayıt (olmamalı: 300 bulmaca tamamen dolu bile
    // ~200 KB) sessizce atlanır; yerel kayıt sağlam kalır.
    if (payload.length > MAX_PAYLOAD_BYTES) return false;

    const nextRev = readRev() + 1;
    const { sdk, ref } = target;
    const written = await withTimeout(
      sdk.fs
        .setDoc(ref, {
          payload,
          schemaVersion: CLOUD_SCHEMA_VERSION,
          rev: nextRev,
          updatedAt: sdk.fs.serverTimestamp(),
          // Yalnızca Firestore konsolunda kaydı gözle ayırt edebilmek için;
          // uygulama özetleri her zaman payload'dan hesaplar (bkz. summarize).
          summary: summarize(map),
        })
        .then(() => "ok" as const),
      WRITE_TIMEOUT_MS,
    );

    // Zaman aşımına uğrasa bile rev ilerletilir: Firestore yazmayı kuyruğa
    // almış olabilir ve sonradan sunucuya düşebilir. Aynı rev'i tekrar denemek
    // kural tarafından reddedilirdi (rev > mevcut olmalı) ve senkron kalıcı
    // olarak takılırdı. Sayaç ucuz, ilerletmek güvenli.
    writeRev(nextRev);
    if (written !== "ok") return false; // parmak izi güncellenmez → sonra tekrar denenir

    markSynced(payload);
    return true;
  } catch {
    // Kural reddi (bayat rev) ya da ağ hatası: parmak izi korunur, tekrar denenir.
    return false;
  } finally {
    uploading = false;
  }
}

/**
 * Açılışta bir kez çağrılır: buluttaki kaydı yerelle karşılaştırır ve gerekirse
 * localStorage'ı yerinde günceller.
 */
export async function syncCloudSave(): Promise<CloudSyncResult> {
  const target = await saveDoc();
  if (!target) return "disabled";
  const { sdk, ref } = target;

  const snap = await withTimeout(sdk.fs.getDoc(ref), FETCH_TIMEOUT_MS);
  if (!snap) return "disabled";

  if (!snap.exists()) {
    return (await upload()) ? "uploaded" : "disabled";
  }

  const data = snap.data() as {
    payload?: unknown;
    rev?: unknown;
    schemaVersion?: unknown;
    updatedAt?: { toMillis?: () => number };
  };
  const cloudRev = typeof data.rev === "number" ? data.rev : 0;
  const cloudSchema = typeof data.schemaVersion === "number" ? data.schemaVersion : 0;

  // Daha yeni bir istemcinin yazdığı kayıt: tanımadığımız alanları eleyip
  // veriyi bozacağımız için hiç dokunma.
  if (cloudSchema > CLOUD_SCHEMA_VERSION) return "needs-update";
  if (typeof data.payload !== "string") return "disabled";

  const cloudMap = parseCloudPayload(data.payload);
  if (!cloudMap) return "disabled";

  const localPayload = serialize(collectSyncedSave());
  const dirty = isDirty(localPayload);

  // Yerel en az bulut kadar güncel — normal durum.
  if (cloudRev <= readRev()) {
    if (dirty) void upload();
    return "in-sync";
  }

  const updatedAtMs =
    typeof data.updatedAt?.toMillis === "function" ? data.updatedAt.toMillis() : 0;

  // Bulut ilerideyken yerelde de gönderilmemiş değişiklik varsa gerçek çakışma:
  // karar oyuncunundur, buluta yazma. Tek istisna, oyuncunun bu cihazda hiç
  // oynamamış olması (yeni kurulum) — o zaman sormaya değer bir şey yok.
  if (dirty && !isLocalPristine()) {
    blocked = true;
    pendingCloud = {
      rev: cloudRev,
      map: cloudMap,
      summary: summarize(cloudMap, updatedAtMs),
    };
    return "conflict";
  }

  return applyCloud(cloudRev, cloudMap) ? "restored" : "disabled";
}

/** Çakışmayı "bu cihaz kazansın" diye çözer. */
export async function resolveKeepLocal(): Promise<void> {
  if (pendingCloud) writeRev(pendingCloud.rev);
  blocked = false;
  pendingCloud = null;
  await upload();
}

/** Çakışmayı "buluttaki kazansın" diye çözer. */
export function resolveKeepCloud(): boolean {
  if (!pendingCloud) return false;
  return applyCloud(pendingCloud.rev, pendingCloud.map);
}

/** Kısıtlı (throttle'lı) yükleme — sık çağrılarda kota yakmaz. */
export function maybeUploadCloudSave(): void {
  if (Date.now() - lastUpload < UPLOAD_THROTTLE_MS) return;
  if (!isDirty(serialize(collectSyncedSave()))) return;
  void upload();
}

/** Anında yükleme — uygulama arka plana alınırken/kritik anlarda. */
export function flushCloudSave(): void {
  if (!isDirty(serialize(collectSyncedSave()))) return;
  void upload();
}
