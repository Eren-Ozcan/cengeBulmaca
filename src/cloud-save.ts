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
// * AMA AYNI OYUN İKİ KEZ SORULMAZ. `rev` sayaçları yalnızca "kim daha sonra
//   yazdı"yı bilir, "ne yazdı"yı bilmez; iki taraf da aynı oyunu taşırken
//   sayaçlar ayrışabilir. Oyuncuya birbirinin aynı iki sütun gösterip seçim
//   yaptırmak hata olur — hangisini seçerse seçsin aynı oyunu alır, üstelik
//   bir daha diyaloğa güvenmez (reefy'de gerçek iki cihazda yaşandı). Bu yüzden
//   sormadan önce iki kaydın oyuncu açısından eşdeğer olup olmadığına bakılır
//   (bkz. sameProgress).
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

import { START_JOKERS } from "./economy.ts";
import { ensureUid, firebaseSdk } from "./firebase-app.ts";
import { dayString } from "./stats.ts";

/** Bu istemcinin yazdığı payload biçiminin sürümü. */
export const CLOUD_SCHEMA_VERSION = 1;

const REV_KEY = "cengel-cloud-rev";
/** Son senkronlanan payload'ın parmak izi; "yerelde değişiklik var mı"yı bundan türetiriz. */
const FINGERPRINT_KEY = "cengel-cloud-fp";

const UPLOAD_THROTTLE_MS = 60_000; // Firestore günlük yazma kotasını koru (Spark: 20K/gün)
// ensureUid() soğuk açılışta üç dinamik import (firebase/app + auth + firestore)
// yapar, initializeApp'i çalıştırır ve Auth'un kalıcı oturumu IndexedDB'den geri
// yüklemesini bekler (bkz. firebase-app.ts waitForRestoredUser). Emülatör/düşük
// donanımlı cihazda bu zincir birkaç saniye sürebilir.
//
// Buradaki süre CÖMERT tutulmalı: eski 3 sn'lik değerin gerekçesi "kötü ağda
// açılışı kilitleme"ydi, ama açılış zaten kilitlenMİYOR — initCloudSave
// main.ts:27'de `void` ile çağrılıyor ve arayüz onu hiç beklemiyor. Buna
// karşılık zaman aşımının bedeli ağır: syncCloudSave sessizce "disabled"
// döner, açılış senkronu OTURUM BOYUNCA BİR KEZ çalıştığı için de bir daha
// denenmez — oyuncu ne çakışma ekranı ne de geri yükleme görür.
const AUTH_TIMEOUT_MS = 15_000;
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
 * Sayaç anahtarı hiç ilerlememiş mi? Okunamayan bir değer (bozuk kayıt) ASLA
 * "sıfır" sayılmaz: hasPlayerProgress'te şüphe her zaman ilerleme lehine
 * yorumlanır.
 */
function isUntouchedCounter(v: string | undefined): boolean {
  if (v === undefined || v === "") return true;
  return Number(v) === 0; // NaN === 0 yanlış → bozuk değer ilerleme sayılır
}

/**
 * Oyuncu bu cihazda gerçekten bir şey KAZANMIŞ mı? Kazanmamışsa (yeni kurulum,
 * ya da hesabı yeni bağlamış bir oyuncu) çakışma sorulmadan bulut geri yüklenir
 * — aksi halde oyuncuya bir tarafı bomboş olan anlamsız bir "hangisini
 * tutayım?" ekranı çıkar ve yanlış tarafı seçip gerçek ilerlemesini kaybetme
 * riskiyle baş başa kalır (reefy'de yaşandı).
 *
 * TEMKİNLİ TARAF NERESİ: yanlışlıkla "ilerleme var" demek en fazla bugünkü
 * davranışa, yani seçim ekranına düşürür — zararsız. Yanlışlıkla "ilerleme
 * yok" demek oyuncunun oyununu SESSİZCE siler. Bu yüzden karar SIFIR
 * bilgisinden değil, ilerlemenin varlığından türetilir ve şüphede olan her
 * durum (bozuk/okunamayan değer, tanımadığımız içerik) ilerleme sayılır.
 *
 * Ölçüt, "kirli mi?" parmak izi ya da varsayılan bir nesneyle karşılaştırma
 * DEĞİL, kaydın İÇERİĞİDİR. Oyuncu hiçbir şey yapmadan da kendiliğinden
 * değişen anahtarlar bilerek dışarıda bırakıldı:
 *  - "cengel-theme"/"cengel-sound"/"cengel-music": ayar tercihleri, kazanım değil.
 *  - "cengel-jokers-init": bakiye ilk okunduğunda (ana ekran çizilirken)
 *    kendiliğinden yazılır; oyuncunun hiçbir hamlesi yoktur.
 *  - "cengel-story-seen"/"cengel-epilogue-seen"/"cengel-tutorial-seen": açılışta
 *    KENDİLİĞİNDEN gösterilen ekranların "bir daha gösterme" damgaları. Oyunu
 *    bir kez açıp rehberi geçmek bunları yazar; oyuncunun kaydında kazanılmış
 *    bir karşılığı yoktur (rehber "practice" modunda oynanır: ne ilerleme ne
 *    istatistik yazar — bkz. tutorial.ts). Bunlar ilerleme sayılsaydı düzeltmek
 *    istediğimiz senaryo — oyunu bir kez açmış oyuncunun hesabını bağlaması —
 *    hâlâ boş taraflı seçim ekranı gösterirdi.
 */
export function hasPlayerProgress(save: SaveMap): boolean {
  for (const [k, v] of Object.entries(save)) {
    // Bulmaca ilerlemesi yalnızca oyuncu harf yazınca kaydedilir (bkz. game.ts
    // saveProgress; rehber bulmacası hariç tutulur), yani varlığı tek başına
    // gerçek bir hamledir.
    if (k.startsWith(PROGRESS_PREFIX)) return true;
    // İpucu anahtarı yalnızca hak KULLANILINCA yazılır.
    if (k.startsWith(HINTS_PREFIX) && !isUntouchedCounter(v)) return true;
  }

  // İstatistik kaydı yalnızca bir bulmaca tamamlanınca yazılır (bkz. stats.ts
  // recordCompletion), dolayısıyla varlığı en az bir çözüm demektir.
  if ((save["cengel-stats"] ?? "") !== "") return true;

  // Başlangıç bakiyesinden SAPMA ilerlemedir: harcandıysa da (ipucu),
  // kazanıldıysa da (kedi ödülü, reklam, davet, satın alma).
  const jokers = save["cengel-jokers"];
  if (jokers !== undefined && Number(jokers) !== START_JOKERS) return true;

  // Davet ödülünden bulutta biriken jokerin işlenmiş kısmı: sıfırdan büyükse
  // gerçekten bir ödül alınmış demektir.
  if (!isUntouchedCounter(save["cengel-referral-synced"])) return true;

  return false;
}

/**
 * Kaydın oyuncuya karşılık GELMEYEN anahtarları. İki kaydın "aynı oyun" olup
 * olmadığına bakarken dışarıda bırakılırlar, çünkü oyuncu hiçbir şey yapmadan
 * da (ya da oyunla ilgisi olmayan bir sebeple) ayrışabilirler:
 *  - "cengel-jokers-init": bakiye ilk okunduğunda kendiliğinden yazılır.
 *  - "*-seen" damgaları: açılışta gösterilen ekranların "bir daha gösterme"
 *    işaretleri; bir cihazda basılmış olması diğerinde ilerleme farkı demek
 *    değildir.
 *  - tema/ses/müzik: CİHAZA ait tercihler. Oyuncunun bu cihazda temayı
 *    değiştirmiş olması, iki cihazdaki oyunu farklı yapmaz.
 * Liste hasPlayerProgress'in bilerek yok saydığı sinyallerle aynıdır: orada
 * "bu tek başına ilerleme değil" denen şey, burada da "bu tek başına fark
 * değil"dir.
 */
const INCIDENTAL_KEYS: readonly string[] = [
  "cengel-jokers-init",
  "cengel-story-seen",
  "cengel-epilogue-seen",
  "cengel-tutorial-seen",
  "cengel-theme",
  "cengel-sound",
  "cengel-music",
];

/**
 * İlerleme kaydının oyuncuya görünen kısmı: yazılmış harfler. İmleç konumu
 * (selRow/selCol/activeClue) oyuncu sadece bulmacada GEZİNİRKEN de değişir ve
 * iki kaydın aynı oyun olup olmadığı sorusunda hiçbir şey ifade etmez.
 *
 * Çözemediğimiz bir kayıtta ham metne düşülür: anlamadığımız bir şeye "aynı"
 * demek yerine tam eşitlik ararız (bkz. sameProgress'in temkin yönü).
 */
function progressLetters(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    // eski kayıt biçimi düz harf dizisiydi (bkz. game.ts loadProgress)
    const entries = Array.isArray(parsed) ? parsed : parsed?.entries;
    if (Array.isArray(entries)) return JSON.stringify(entries);
  } catch {
    /* bozuk kayıt: ham metne düş */
  }
  return raw;
}

/** Kaydın karşılaştırılabilir hali: gürültü atılır, ilerleme sadeleştirilir. */
function comparable(save: SaveMap): SaveMap {
  const out: SaveMap = {};
  for (const [k, v] of Object.entries(save)) {
    if (INCIDENTAL_KEYS.includes(k)) continue;
    out[k] = k.startsWith(PROGRESS_PREFIX) ? progressLetters(v) : v;
  }
  return out;
}

/**
 * İki kayıt oyuncu açısından AYNI oyun mu?
 *
 * NEDEN GEREKLİ: `rev` yalnızca sıra bilgisidir. Bir cihaz buluttan geri
 * yükleyip aynı oyunu taşımaya başladıktan sonra diğer cihaz yazmaya devam
 * ederse sayaçlar ayrışır ve çakışma dalına düşülür — oysa ortada seçilecek iki
 * ilerleme yoktur. Ayrıca "kirli mi?" sorusunun cevabı olan parmak izi CİHAZA
 * ait bir defter kaydıdır: resetForNewAccount onu siler, zaman aşımına uğrayan
 * (ama sunucuya düşen) bir yükleme onu bayat bırakır. Her iki durumda da kayıt
 * bulutla birebir aynıyken "kirli" görünür.
 *
 * TEMKİNLİ TARAF NERESİ: yanlışlıkla "farklı" demek en fazla bugünkü davranışa,
 * yani seçim ekranına düşürür — zararsız. Yanlışlıkla "aynı" demek bir tarafın
 * ilerlemesini sorulmadan gözden çıkarır. Bu yüzden eşitlik ARANIR: tanımadığımız
 * ya da çözemediğimiz her şeyde tam metin eşitliği istenir, şüphede false döner.
 */
export function sameProgress(a: SaveMap, b: SaveMap): boolean {
  const left = comparable(a);
  const right = comparable(b);
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  for (const k of keys) {
    if (left[k] !== right[k]) return false;
  }
  return true;
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
/**
 * Buluttan gelen kayıt uygulandıktan SONRA sayfa yenilenene kadar sürer
 * (bkz. applyCloud, cloud-ui.ts reloadAfterRestore).
 *
 * NEDEN VAR: applyCloud localStorage'ı yerinde değiştirir, ama ekranda ve
 * BELLEKTE hâlâ geri yüklemeden önceki oyun duruyor. Bu aralıkta bellekteki
 * bayat durumdan diske yazan tek yer game.ts'in ilerleme kaydıdır:
 * GameState.entries bulmaca açılırken (yani geri yüklemeden ÖNCE) okunmuştu ve
 * tek bir tuşa basmak o dizinin TAMAMINI yeni gelen ilerlemenin üstüne yazar.
 * Kalan yazarlar (stats/economy/tema/damgalar) diski oku-değiştir-yaz yaptığı
 * için taze veriyle çalışır, bayat bir anlık görüntü taşımaz.
 *
 * Asıl kayıp yerelde de değil: location.reload() "pagehide" tetikler,
 * flushCloudSave() çalışır ve bu melez kayıt DİĞER CİHAZIN bulut kaydının
 * üstüne yüklenir. Bu yüzden bayat yerel yazma da (bkz. isSaveFrozen) buluta
 * yazma da donduruluyor. Yenilemeden sonra modül durumu sıfırdan başlar.
 */
let frozen = false;
let pendingCloud: { rev: number; map: SaveMap; summary: CloudSummary } | null = null;

/**
 * Bellekteki (bayat) durumdan diske yazmak şu an yasak mı? game.ts'in ilerleme
 * kaydı buna bakar; yukarıdaki `frozen` notuna bak.
 */
export function isSaveFrozen(): boolean {
  return frozen;
}

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
  frozen = false;
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
 * Sayısal olması beklenen anahtarlar: economy.ts/hints.ts/referral.ts bu
 * değerleri doğrudan Number(...)'a verir. Bozuk/kurcalanmış bir doküman
 * NaN sızdırırsa Math.max(0, NaN) da NaN döner — spendJoker()'daki
 * `n <= 0` koruması (NaN <= 0 === false) sessizce devre dışı kalır ve
 * bakiye sınırsız harcanabilir hale gelir. Bu yüzden bulut kaynaklı
 * değerler localStorage'a yazılmadan ÖNCE doğrulanır.
 */
function isValidNumericValue(v: string): boolean {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0;
}

function isNumericKey(key: string): boolean {
  return key === "cengel-jokers" || key === "cengel-referral-synced" || key.startsWith(HINTS_PREFIX);
}

/**
 * Buluttan gelen payload'ı doğrular. Yerel kaydın geçtiği kapıdan geçer:
 * yalnızca allowlist'teki anahtarlar, yalnızca string değerler. Böylece
 * kurcalanmış bir doküman ne "cengel-ads-removed" yazabilir ne de tanımadığımız
 * bir anahtarı localStorage'a sokabilir. Sayısal anahtarlarda ayrıca değerin
 * gerçekten geçerli, negatif olmayan bir sayı olduğu doğrulanır (bkz.
 * isNumericKey) — aksi halde anahtar tümden atlanır, payload'ın geri kalanı
 * yine de uygulanır.
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
    if (isNumericKey(k) && !isValidNumericValue(v)) continue;
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
  // Yenilemeye kadar hem bayat yerel yazma hem bulut yazması durur; gerekçe
  // `frozen` bildiriminde.
  frozen = true;
  pendingCloud = null;
  return true;
}

function serialize(map: SaveMap): string {
  return JSON.stringify(map);
}

async function upload(): Promise<boolean> {
  if (blocked || frozen || uploading) return false;
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
        .then(
          () => "ok" as const,
          // Sunucu isteği GÖRDÜ ve geri çevirdi (kural reddi ya da ağ hatası):
          // zaman aşımından ayrı tutulmalı, bkz. aşağısı.
          () => "rejected" as const,
        ),
      WRITE_TIMEOUT_MS,
    );

    // Zaman aşımı (null) ile REDDEDİLME ("rejected") aynı şey DEĞİLDİR:
    //
    //  - Zaman aşımı: Firestore yazmayı kuyruğa almış olabilir ve sonradan
    //    sunucuya düşebilir. O halde aynı rev'i tekrar denemek kural tarafından
    //    reddedilir (rev artmalı) ve senkron kalıcı olarak takılırdı — bu yüzden
    //    sayaç ilerletilir. Sayaç ucuz, ilerletmek güvenli.
    //
    //  - Reddedilme: yazma sunucuya KESİNLİKLE düşmedi. Burada sayacı
    //    ilerletmek ölümcüldür: başarısız her deneme yerel rev'i bir artırır,
    //    sayaç birkaç denemede buluttakini GEÇER ve syncCloudSave bir daha
    //    `cloudRev <= readRev()` dalına düşerek "in-sync" der. Cihaz diğer
    //    cihazın kaydını bir daha hiç indirmez, üstelik ilk fırsatta bayat
    //    kaydını onun üstüne yazar — sessiz veri kaybı. Bu yüzden reddedilen
    //    yazmada sayaca DOKUNULMAZ; bir sonraki deneme aynı rev'i tekrar dener.
    if (written !== "rejected") writeRev(nextRev);
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

  const localSave = collectSyncedSave();
  const dirty = isDirty(serialize(localSave));

  // Yerel en az bulut kadar güncel — normal durum.
  if (cloudRev <= readRev()) {
    if (dirty) void upload();
    return "in-sync";
  }

  const updatedAtMs =
    typeof data.updatedAt?.toMillis === "function" ? data.updatedAt.toMillis() : 0;

  // Bulut ilerideyken yerelde de gönderilmemiş değişiklik varsa gerçek çakışma:
  // karar oyuncunundur, buluta yazma. Tek istisna, yerelde kaybedilecek bir
  // kazanım OLMAMASI (yeni kurulum, ya da oyunu açıp hemen hesabını bağlamış
  // oyuncu): "kirli" olmak tek başına ilerleme demek değildir, o yüzden bir
  // tarafı boş bir seçim ekranı göstermek yerine bulut doğrudan getirilir.
  if (dirty && hasPlayerProgress(localSave)) {
    // İki taraf oyuncu açısından AYNI oyunu taşıyorsa sormak yanlış olur:
    // hangisi seçilirse seçilsin sonuç aynı, ama oyuncu bir daha bu diyaloğa
    // güvenmez. Sessizce çözülür — ve buluttaki `rev` benimsenerek döngü
    // kırılır, yoksa diğer cihaz her yazdığında aynı ekran geri gelirdi.
    //
    // Bulut YEREL ÜZERİNE UYGULANMAZ (applyCloud çağrılmaz): iki taraf zaten
    // eşdeğer olduğu için indirmenin bir kazancı yok, buna karşılık yerelde
    // gerçekten daha yeni bir şey kalmışsa onu ezme riski var. Yerel olduğu
    // gibi durur ve normal "kirli" yolundan buluta taşınır.
    if (sameProgress(localSave, cloudMap)) {
      writeRev(cloudRev);
      void upload(); // rev cloudRev+1 olur: kural (rev artmalı) sağlanır
      return "in-sync";
    }

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
