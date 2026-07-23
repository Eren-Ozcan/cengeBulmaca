// Arkadaş davet sistemi: davet linkiyle gelen yeni oyuncu ilk bulmacasını
// çözünce hem kendisi hem de kendisini davet eden joker kazanır.
//
// Bu özellik hafif bir Firebase (Firestore + Anonymous Auth) backend'i
// gerektirir — localStorage tek başına iki farklı cihaz arasında güvenli
// bilgi paylaşımı sağlayamaz. ÖNEMLİ, yayına çıkmadan önce:
//   1. https://console.firebase.google.com adresinde ücretsiz (Spark) bir
//      proje oluştur, bir Web App ekle, aşağıdaki FIREBASE_CONFIG'i gerçek
//      değerlerle doldur.
//   2. Authentication > Sign-in method'dan "Anonymous" sağlayıcısını aç.
//   3. Firestore Database oluştur, bu projedeki firestore.rules dosyasını
//      (`firebase deploy --only firestore:rules` ile) yayınla — kurallar
//      kendini-davet ve ödülün birden fazla kez talep edilmesini
//      reddedecek şekilde yazıldı (bkz. dosyadaki açıklama).
//
// Bilinen sınır (kullanıcıya da bildirildi): Anonymous Auth kimliği cihaz
// kurulumuna bağlıdır — uygulamayı silip tekrar kurmak yeni bir kimlik
// üretir. Bu, ısrarlı bir kullanıcının birden fazla cihaz/kurulumla kendi
// kendini davet etmesini tamamen imkansız kılmaz; gerçek kurulum-atfı için
// Play Store yayınından sonra Play Install Referrer API gerekir. Burada
// hedeflenen, tek dokunuşla kendi kendine ödül vermeyi ENGELLEMEK ve ödülü
// gerçek bir katılım sinyaline (ilk bulmacayı çözmek) bağlamak.
//
// API anahtarı boşken ya da ağ/izin hatası olduğunda tüm fonksiyonlar
// sessizce no-op döner — ads.ts/billing.ts ile aynı kod deyimi.

import { grantJokers } from "./economy.ts";

const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
}; // TODO yayın öncesi: gerçek Firebase proje yapılandırması

const REFERRAL_REWARD = 3;
const SYNCED_KEY = "cengel-referral-synced";
const REF_PARAM = "ref";

type FirestoreModules = typeof import("firebase/firestore");

let db: import("firebase/firestore").Firestore | null = null;
let fs: FirestoreModules | null = null;
let readyPromise: Promise<string | null> | null = null;

function isConfigured(): boolean {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}

/** URL'deki ?ref=<uid> parametresini bir kereye mahsus okuyup temizler. */
function captureIncomingRef(): string | null {
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get(REF_PARAM);
    if (ref) {
      url.searchParams.delete(REF_PARAM);
      window.history.replaceState({}, "", url.toString());
    }
    return ref;
  } catch {
    return null;
  }
}

/**
 * Firebase'i başlatır, anonim oturum açar ve (ilk kez oluşturuluyorsa)
 * oyuncu belgesini davet sahibiyle birlikte yazar. Kendi uid'sini
 * döndürür; yapılandırma yoksa/hata olursa null döner.
 */
async function ensureReady(): Promise<string | null> {
  if (!isConfigured()) return null;
  readyPromise ??= (async () => {
    try {
      const [{ initializeApp }, authMod, firestoreMod] = await Promise.all([
        import("firebase/app"),
        import("firebase/auth"),
        import("firebase/firestore"),
      ]);
      fs = firestoreMod;
      const app = initializeApp(FIREBASE_CONFIG);
      const auth = authMod.getAuth(app);
      db = firestoreMod.getFirestore(app);

      const cred = await authMod.signInAnonymously(auth);
      const uid = cred.user.uid;

      const ref = captureIncomingRef();
      const playerRef = firestoreMod.doc(db, "players", uid);
      const snap = await firestoreMod.getDoc(playerRef);
      if (!snap.exists()) {
        await firestoreMod.setDoc(playerRef, {
          createdAt: firestoreMod.serverTimestamp(),
          referredBy: ref && ref !== uid ? ref : null,
          firstPuzzleRewardClaimed: false,
          jokerBalanceCloud: 0,
        });
      }
      return uid;
    } catch {
      return null;
    }
  })();
  return readyPromise;
}

/** Uygulama açılışında bir kere çağrılır; web/dev ya da yapılandırmasız ortamda no-op. */
export async function initReferral(): Promise<void> {
  const uid = await ensureReady();
  if (uid) await syncCloudJokers();
}

/**
 * Bulut tarafında biriken (referans ödülleriyle kazanılan) joker farkını
 * yerel bakiyeye ekler. Cihazda daha önce senkronlanan miktar localStorage'da
 * tutulur; bu yüzden uygulama silinip tekrar kurulursa aynı ödül tekrar
 * senkronlanabilir — bilinen ve kabul edilen bir sınırdır (bkz. dosya başı).
 */
export async function syncCloudJokers(): Promise<void> {
  const uid = await ensureReady();
  if (!uid || !db || !fs) return;
  try {
    const snap = await fs.getDoc(fs.doc(db, "players", uid));
    const cloudTotal = Number(snap.data()?.jokerBalanceCloud ?? 0);
    const synced = Number(localStorage.getItem(SYNCED_KEY) ?? "0");
    if (cloudTotal > synced) {
      grantJokers(cloudTotal - synced);
      localStorage.setItem(SYNCED_KEY, String(cloudTotal));
    }
  } catch {
    // ağ yoksa ya da izin hatasıysa sessizce vazgeç; bir sonraki senkronda tekrar denenir
  }
}

/**
 * Oyuncu ilk bulmacasını tamamladığında bir kere çağrılır. Bu oyuncu bir
 * davetle gelmişse ve ödülü daha önce almadıysa, hem kendisine hem de
 * kendisini davet edene REFERRAL_REWARD joker ekler (bkz. firestore.rules —
 * kural bu geçişin sadece bir kez ve sadece gerçek bir davet ilişkisi
 * varken olabileceğini zorunlu kılar).
 */
export async function claimFirstPuzzleReferralReward(): Promise<void> {
  const uid = await ensureReady();
  if (!uid || !db || !fs) return;
  try {
    const playerRef = fs.doc(db, "players", uid);
    const snap = await fs.getDoc(playerRef);
    const data = snap.data();
    if (!data || !data.referredBy || data.firstPuzzleRewardClaimed) return;

    const referrerRef = fs.doc(db, "players", data.referredBy as string);
    await fs.runTransaction(db, async (tx) => {
      const [me, referrer] = await Promise.all([tx.get(playerRef), tx.get(referrerRef)]);
      const meData = me.data();
      if (!meData || meData.firstPuzzleRewardClaimed) return;
      const referrerData = referrer.data();
      if (!referrerData) return;
      tx.update(playerRef, {
        firstPuzzleRewardClaimed: true,
        jokerBalanceCloud: (meData.jokerBalanceCloud ?? 0) + REFERRAL_REWARD,
      });
      tx.update(referrerRef, {
        jokerBalanceCloud: (referrerData.jokerBalanceCloud ?? 0) + REFERRAL_REWARD,
      });
    });
    await syncCloudJokers();
  } catch {
    // rıza/ağ hatasında ödül basitçe verilmez; oyunu bozmaz
  }
}

/** Paylaşılabilir davet linki; yapılandırma yoksa null döner. */
export async function getInviteLink(): Promise<string | null> {
  const uid = await ensureReady();
  if (!uid) return null;
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set(REF_PARAM, uid);
  return url.toString();
}

/** Sistem paylaşım menüsüyle, yoksa panoya kopyalayarak davet linkini paylaşır. */
export async function shareInvite(): Promise<"shared" | "copied" | "unavailable"> {
  const link = await getInviteLink();
  if (!link) return "unavailable";
  const text = `Çengel Bulmaca'ya benimle katıl, birlikte joker kazanalım! ${link}`;
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return "shared";
    }
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "unavailable";
  }
}
