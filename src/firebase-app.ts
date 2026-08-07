// Paylaşılan Firebase uygulaması ve oyuncu kimliği — "kimlik dikişi".
//
// Hem davet sistemi (referral.ts) hem bulut kaydı (cloud-save.ts) aynı
// Firebase projesini ve AYNI oyuncu kimliğini kullanır. initializeApp() aynı
// config ile ikinci kez çağrılırsa Firebase "app/duplicate-app" hatası verir;
// bu yüzden tek örnek burada tutulur ve iki özellik onu paylaşır.
//
// Firebase modülleri BİLEREK dinamik import ile yükleniyor (referral.ts'in
// özgün deyimi korundu): SDK ana bundle'a girmesin, ilk açılış yükü büyümesin.
//
// KİMLİK DİKİŞİ — iOS yolunu açık tutan yer: oyunun geri kalanı bir oyuncuyu
// YALNIZCA ensureUid() üzerinden görür. Bu kimliğin anonim mi, Google ile mi
// elde edildiği burada kapsüllenir. İleride Sign in with Apple eklenirken
// sadece bu dosya değişir; cloud-save.ts ve oyun kodu aynen kalır.
//
// Kimlik bilerek platforma özgü bir kimliğe (Play Games player_id) BAĞLANMAZ:
// Firebase UID'si Android ve iOS'ta aynı çalışır, böylece aynı oyuncu iki
// platformda tek kayda ulaşabilir.
//
// Yapılandırma yoksa ya da ağ/izin hatası olursa her fonksiyon sessizce
// null/no-op döner — ads.ts/billing.ts ile aynı kod deyimi.

import { Capacitor } from "@capacitor/core";
import type { Auth, User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

type AuthModules = typeof import("firebase/auth");
type FirestoreModules = typeof import("firebase/firestore");

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDAYdtc5t_-rUgLFg-_Y30cvFpwqWSuC8c",
  authDomain: "cengel-bulmaca-c504d.firebaseapp.com",
  projectId: "cengel-bulmaca-c504d",
  storageBucket: "cengel-bulmaca-c504d.firebasestorage.app",
  messagingSenderId: "211808649907",
  appId: "1:211808649907:web:f75b8c07a446d8e8c4e6c6",
};

export function isFirebaseConfigured(): boolean {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}

export interface FirebaseSdk {
  auth: Auth;
  db: Firestore;
  authMod: AuthModules;
  fs: FirestoreModules;
}

let sdkPromise: Promise<FirebaseSdk | null> | null = null;

/**
 * Firebase SDK'sını (tek sefer) yükler ve uygulamayı başlatır.
 * Hata durumunda söz önbellekten düşürülür: ilk deneme çevrimdışı yapıldıysa
 * özellik o oturum boyunca ölü kalmasın, sonraki çağrı yeniden denesin.
 */
export function firebaseSdk(): Promise<FirebaseSdk | null> {
  if (!isFirebaseConfigured()) return Promise.resolve(null);
  sdkPromise ??= (async () => {
    const [{ initializeApp }, authMod, fs] = await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
      import("firebase/firestore"),
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    return { authMod, fs, auth: authMod.getAuth(app), db: fs.getFirestore(app) };
  })().catch(() => {
    sdkPromise = null;
    return null;
  });
  return sdkPromise;
}

/**
 * Firebase'in diskteki kalıcı oturumu geri yüklemesini bekler.
 *
 * onAuthStateChanged ilk bildirimini ancak bu geri yükleme bittikten sonra
 * yapar; o ana kadar `auth.currentUser` null'dur ve "oturum yok" sanılır.
 */
function waitForRestoredUser(authMod: AuthModules, auth: Auth): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = authMod.onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      () => {
        unsubscribe();
        resolve(null);
      },
    );
  });
}

let uidPromise: Promise<string | null> | null = null;

/**
 * Oturumu açar ve oyuncunun kalıcı kimliğini döndürür; yapılandırma yoksa ya
 * da bağlantı kurulamazsa null döner.
 *
 * KRİTİK: signInAnonymously() doğrudan çağrılMAZ. Kalıcı oturum diskten geri
 * yüklenmeden önce çalıştığı için HER AÇILIŞTA YENİ bir anonim kullanıcı
 * yaratır; bağlanmış Google hesabı öksüz kalır ve bulut kaydı geri dönen
 * oyuncuda hiç çalışmaz (reefy'de gerçek bir hesapla yakalandı). Önce mevcut
 * oturumun geri yüklenmesi beklenir.
 */
export function ensureUid(): Promise<string | null> {
  if (!isFirebaseConfigured()) return Promise.resolve(null);
  uidPromise ??= (async () => {
    const sdk = await firebaseSdk();
    if (!sdk) return null;
    const restored = await waitForRestoredUser(sdk.authMod, sdk.auth);
    if (restored) return restored.uid;
    const cred = await sdk.authMod.signInAnonymously(sdk.auth);
    return cred.user.uid;
  })().catch(() => {
    uidPromise = null;
    return null;
  });
  return uidPromise;
}

// ---------- kalıcı kimlik (hesap bağlama) ----------

/** Hesap bağlama yalnızca native pakette anlamlı (Google hesap seçicisi orada). */
export function isAccountLinkingAvailable(): boolean {
  return isFirebaseConfigured() && Capacitor.isNativePlatform();
}

/**
 * Oturum kalıcı bir hesaba bağlıysa gösterilecek etiket (ad ya da e-posta),
 * anonimse/oturum yoksa null. Oturumun geri yüklenmesini beklediği için
 * asenkron.
 */
export async function linkedAccountLabel(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  await ensureUid();
  const sdk = await firebaseSdk();
  const u = sdk?.auth.currentUser;
  if (!u || u.isAnonymous) return null;
  return u.displayName || u.email || "Google hesabı";
}

export type LinkResult =
  | { ok: true; switched: false; msg: string }
  /** Bu Google hesabı BAŞKA bir kayda bağlıymış: o hesaba geçildi, buluttaki
   *  ilerleme indirilmeli (çağıran bulut senkronunu yeniden çalıştırmalı). */
  | { ok: true; switched: true; uid: string; msg: string }
  | { ok: false; msg: string };

/**
 * Google kimlik bilgisini alır.
 *
 * Android'de eklenti öntanımlı olarak Credential Manager'ı kullanır; bu API
 * yalnızca cihazda BU UYGULAMAYA daha önce yetki vermiş hesapları döndürür.
 * Dolayısıyla ilk girişte hesap cihazda ekli olsa bile boş döner ve hesap
 * seçici hiç açılmaz. Bu yüzden modern akış önce denenir, boş dönerse klasik
 * seçiciye düşülür — aksi halde hiçbir oyuncu hesabını İLK KEZ bağlayamazdı
 * (reefy'de gerçek cihazda yakalandı).
 */
async function requestGoogleIdToken(): Promise<string | null> {
  const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
  try {
    const res = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    if (res.credential?.idToken) return res.credential.idToken;
  } catch {
    /* yedek akışa düş */
  }
  try {
    const res = await FirebaseAuthentication.signInWithGoogle({
      skipNativeAuth: true,
      useCredentialManager: false,
    });
    return res.credential?.idToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Anonim oturumu kalıcı bir Google hesabına bağlar.
 *
 * Kritik dal — `auth/credential-already-in-use`: seçilen Google hesabı zaten
 * BAŞKA bir Firebase kullanıcısına bağlıysa (oyuncu daha önce başka bir
 * cihazda bağlamışsa) bağlama başarısız olur. Doğru davranış hatayı yutmak
 * değil, o hesaba GEÇMEK ve buluttaki kaydı indirmektir; aksi halde oyuncunun
 * eski ilerlemesi erişilemez kalır.
 *
 * Buradaki anonim kullanıcı yetim kalır (silinmez) — üzerindeki yerel kayıt
 * zaten cihazda duruyor ve çakışma akışı devreye girerse kullanıcıya sorulur.
 */
export async function linkWithGoogle(): Promise<LinkResult> {
  if (!isAccountLinkingAvailable()) {
    return { ok: false, msg: "Hesap bağlama mobil sürümde kullanılabilir." };
  }
  try {
    await ensureUid(); // anonim oturumun açık olduğundan emin ol
    const sdk = await firebaseSdk();
    if (!sdk) return { ok: false, msg: "Bağlantı kurulamadı, daha sonra tekrar dene." };

    // skipNativeAuth: yalnızca hesap seçici + kimlik bilgisi; oturumu JS SDK
    // açar (bkz. capacitor.config.ts'teki gerekçe).
    const idToken = await requestGoogleIdToken();
    if (!idToken) return { ok: false, msg: "Google girişi tamamlanmadı." };

    const { GoogleAuthProvider, linkWithCredential, signInWithCredential } = sdk.authMod;
    const credential = GoogleAuthProvider.credential(idToken);
    const current = sdk.auth.currentUser;

    if (current && current.isAnonymous) {
      try {
        await linkWithCredential(current, credential);
        return {
          ok: true,
          switched: false,
          msg: "Hesabın bağlandı — ilerlemen artık diğer cihazlarında da açılabilir. ☁️",
        };
      } catch (e) {
        const code = (e as { code?: string } | null)?.code;
        if (code !== "auth/credential-already-in-use") throw e;
        // Bu Google hesabının zaten bir kaydı var: ona geç.
        const signedIn = await signInWithCredential(sdk.auth, credential);
        uidPromise = Promise.resolve(signedIn.user.uid);
        return {
          ok: true,
          switched: true,
          uid: signedIn.user.uid,
          msg: "Bu hesabın kayıtlı bir ilerlemesi var, ona geçildi.",
        };
      }
    }

    // Zaten kalıcı bir hesapta (ya da anonim oturum yok): doğrudan giriş yap.
    const signedIn = await signInWithCredential(sdk.auth, credential);
    uidPromise = Promise.resolve(signedIn.user.uid);
    return { ok: true, switched: true, uid: signedIn.user.uid, msg: "Giriş yapıldı." };
  } catch {
    return { ok: false, msg: "Google girişi başarısız oldu, daha sonra tekrar dene." };
  }
}
