// AdMob reklam entegrasyonu (@capacitor-community/admob).
//
// ÖNEMLİ: Aşağıdaki reklam birimi ID'leri Google'ın herkese açık TEST
// ID'leridir (gerçek gelir üretmez, hesap gerektirmez). Yayına çıkmadan
// önce kendi AdMob hesabından üretilen gerçek App ID ve reklam birimi
// ID'leriyle değiştirilmeli:
//   1. https://apps.admob.com adresinde bir uygulama oluştur.
//   2. Ödüllü (rewarded) ve geçiş (interstitial) reklam birimleri oluştur.
//   3. android/app/src/main/res/values/strings.xml'deki admob_app_id'yi
//      ve aşağıdaki REWARDED_AD_ID / INTERSTITIAL_AD_ID sabitlerini
//      güncelle.
//   4. AdMob hesabında "Privacy & messaging" bölümünden bir GDPR mesaj
//      (UMP) kampanyası oluştur — aşağıdaki requestConsentInfo/showConsentForm
//      çağrıları o kampanyayı render eder; kampanya yoksa AB/AEA dışı
//      kullanıcılarda olduğu gibi NOT_REQUIRED döner ve hiçbir şey göstermez.
//
// Sadece native platformda (Android/iOS) çalışır; web/dev ortamında tüm
// fonksiyonlar sessizce no-op döner, oyun akışını asla bozmaz.

import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { AdMob, AdmobConsentStatus, RewardAdPluginEvents } from "@capacitor-community/admob";

const REWARDED_AD_ID = "ca-app-pub-3940256099942544/5224354917"; // Google test ID
const INTERSTITIAL_AD_ID = "ca-app-pub-3940256099942544/1033173712"; // Google test ID

let initialized = false;

async function ensureInitialized(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (initialized) return true;
  try {
    await AdMob.initialize();
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Google'ın gerçek UMP (User Messaging Platform) akışını çalıştırır: AB/AEA
 * bölgesindeki kullanıcılar için gerekiyorsa Google'ın kendi render ettiği
 * GDPR rıza formunu gösterir. Kendi elle yazdığımız bir "kabul ediyorum"
 * ekranı DEĞİL — reklam SDK'larının fiilen uyacağı gerçek rıza sinyalini
 * (IAB TCF) bu üretir; özel bir ekran bunu üretmez ve gerçek uyum sağlamaz.
 * Bölge dışı kullanıcıda ya da kampanya tanımlı değilse sessizce hiçbir şey
 * göstermez (NOT_REQUIRED).
 */
async function ensureConsent(): Promise<void> {
  try {
    const info = await AdMob.requestConsentInfo();
    if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) {
      await AdMob.showConsentForm();
    }
  } catch {
    // rıza bilgisi alınamazsa (ağ yok, kampanya tanımsız vb.) reklamlar
    // yine de kişiselleştirilmemiş modda çalışmaya devam edebilir
  }
}

/** Uygulama açılışında bir kere çağrılır; web'de sessizce hiçbir şey yapmaz. */
export async function initAds(): Promise<void> {
  if (!(await ensureInitialized())) return;
  await ensureConsent();
}

/**
 * Ödüllü reklamı hazırlayıp gösterir. Kullanıcı reklamı sonuna kadar
 * izleyip ödülü kazanırsa true döner; erken kapatırsa, reklam
 * yüklenemezse ya da web/dev ortamındaysak false döner. "Dismissed"
 * olayı her iki durumda da (ödüllü/ödülsüz kapanış) tetiklendiği için
 * sonucu o olay üzerinden çözüyoruz — showRewardVideoAd()'ın kendi
 * promise'i yalnızca ödül kazanılırsa çözülür, erken kapanışta hiç
 * çözülmeyip akışı asılı bırakabilir.
 */
export async function showRewardedHintAd(): Promise<boolean> {
  try {
    if (!(await ensureInitialized())) return false;
    await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_ID });
  } catch {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let rewarded = false;
    let settled = false;
    const handles: PluginListenerHandle[] = [];

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
      Promise.all(handles.map((h) => h.remove())).catch(() => {});
    };

    Promise.all([
      AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        rewarded = true;
      }),
      AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish(rewarded)),
      AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish(false)),
    ]).then((added) => handles.push(...added));

    AdMob.showRewardVideoAd().catch(() => {
      // Dismissed/FailedToShow olayı sonucu zaten çözecek.
    });
  });
}

/**
 * Geçiş reklamını hazırlayıp gösterir. Ödül döndürmez; bulmaca bitince
 * ara sıra (frekans sınırlamasıyla) çağrılan tamamen isteğe bağlı bir
 * gelir kanalıdır. Hata/web ortamında sessizce yok sayılır.
 */
export async function maybeShowInterstitial(): Promise<void> {
  if (!(await ensureInitialized())) return;
  try {
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_AD_ID });
    await AdMob.showInterstitial();
  } catch {
    // reklam yüklenemediyse oyun akışını bozmadan devam
  }
}

const COMPLETIONS_KEY = "cengel-completions-count";
const INTERSTITIAL_EVERY = 3;

/**
 * Her bulmaca tamamlanışında bir kez çağrılır. İlk kazanımı atlayıp
 * her INTERSTITIAL_EVERY tamamlanışta bir geçiş reklamı gösterilmesi
 * gerekip gerekmediğini söyler (kullanıcıyı yormamak için frekans
 * sınırlaması).
 */
export function shouldShowInterstitial(): boolean {
  try {
    const n = Number(localStorage.getItem(COMPLETIONS_KEY) ?? "0") + 1;
    localStorage.setItem(COMPLETIONS_KEY, String(n));
    return n % INTERSTITIAL_EVERY === 0;
  } catch {
    return false;
  }
}
