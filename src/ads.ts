// AdMob reklam entegrasyonu (@capacitor-community/admob).
//
// Gerçek AdMob hesabı: yilkgamesstudio@gmail.com (uygulama: Çengel Bulmaca,
// App ID ca-app-pub-9709993577664180~3994312791). Yayına çıkmadan önce
// kalan adım: AdMob hesabında "Privacy & messaging" bölümünden bir GDPR
// mesaj (UMP) kampanyası oluştur — aşağıdaki requestConsentInfo/showConsentForm
// çağrıları o kampanyayı render eder; kampanya yoksa AB/AEA dışı
// kullanıcılarda olduğu gibi NOT_REQUIRED döner ve hiçbir şey göstermez.
//
// Sadece native platformda (Android/iOS) çalışır; web/dev ortamında tüm
// fonksiyonlar sessizce no-op döner, oyun akışını asla bozmaz.

import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { AdMob, AdmobConsentStatus, RewardAdPluginEvents } from "@capacitor-community/admob";
import { adsRemoved } from "./billing.ts";

const REWARDED_AD_ID = "ca-app-pub-9709993577664180/1978523543";
const INTERSTITIAL_AD_ID = "ca-app-pub-9709993577664180/6923728460";

// showRewardedHintAd()'ın sözü YALNIZCA Rewarded/Dismissed/FailedToShow
// eklenti olaylarından biriyle çözülür; hiçbiri garanti değildir (uygulama
// reklam ortasında arka plana alınırsa ya da eklenti olayı hiç yayınlamazsa
// söz sonsuza dek asılı kalır). Çağıran taraf (ui.ts) düğmeyi bu söz
// çözülene kadar devre dışı bırakır — zaman aşımı olmadan düğme oturum
// boyunca kilitli kalırdı.
const REWARD_AD_TIMEOUT_MS = 60_000;

// İki geçiş reklamı arka arkaya gösterilemez (AdMob "disallowed interstitial
// implementations" kuralı). localStorage'a yazılır ki soğuk başlatma (uygulamayı
// kapatıp açma) bu korumayı sıfırlamasın — yalnızca bellekte tutulsaydı oyuncu
// her yeniden açılışta "temiz" bir reklam hakkı kazanmış olurdu.
const INTERSTITIAL_COOLDOWN_MS = 5 * 60 * 1000;
const LAST_INTERSTITIAL_KEY = "cengeBulmaca.ads.lastInterstitial";

let initialized = false;

/**
 * Son gösterilen geçiş reklamının epoch ms'i. Kayıt bozuksa ya da cihaz saati
 * geriye alındıysa (değer şu andan ileride görünüyorsa) 0 döner: reklamı
 * sonsuza dek kilitlemek yerine cooldown'u "hiç gösterilmemiş" say — güvenli
 * taraf, oyuncuyu süresiz reklamsız bırakmak değil, kuralın amacını (arka
 * arkaya gösterim yok) korumaktır.
 */
function lastInterstitialAt(): number {
  const raw = Number(localStorage.getItem(LAST_INTERSTITIAL_KEY) ?? "0");
  if (!Number.isFinite(raw) || raw < 0 || raw > Date.now()) return 0;
  return raw;
}

/**
 * Google'ın gerçek UMP (User Messaging Platform) akışını çalıştırır: AB/AEA
 * bölgesindeki kullanıcılar için gerekiyorsa Google'ın kendi render ettiği
 * GDPR rıza formunu gösterir. Kendi elle yazdığımız bir "kabul ediyorum"
 * ekranı DEĞİL — reklam SDK'larının fiilen uyacağı gerçek rıza sinyalini
 * (IAB TCF) bu üretir; özel bir ekran bunu üretmez ve gerçek uyum sağlamaz.
 * Bölge dışı kullanıcıda ya da kampanya tanımlı değilse sessizce hiçbir şey
 * göstermez (NOT_REQUIRED). Sıra önemli: AdMob.initialize()'dan ÖNCE
 * çalışmalı — reklam SDK'sı rıza belli olmadan başlatılıp reklam isteyemez.
 * Dönüş değeri (canRequestAds), reklam isteğinin gerçekten yapılabilir
 * olup olmadığının tek doğru kaynağıdır.
 */
async function ensureConsent(): Promise<boolean> {
  try {
    let info = await AdMob.requestConsentInfo();
    if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) {
      info = await AdMob.showConsentForm();
    }
    return info.canRequestAds;
  } catch {
    // rıza bilgisi alınamazsa (ağ yok, kampanya tanımsız vb.) güvenli taraf:
    // reklam isteme — oyunun kendisi bundan asla etkilenmez, sadece reklamsız
    // devam eder
    return false;
  }
}

async function ensureInitialized(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (initialized) return true;
  const canRequestAds = await ensureConsent();
  if (!canRequestAds) return false;
  try {
    await AdMob.initialize({});
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

/** Uygulama açılışında bir kere çağrılır; web'de sessizce hiçbir şey yapmaz. */
export async function initAds(): Promise<void> {
  await ensureInitialized();
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
      clearTimeout(timer);
      resolve(value);
      Promise.all(handles.map((h) => h.remove())).catch(() => {});
    };

    const timer = setTimeout(() => finish(false), REWARD_AD_TIMEOUT_MS);

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
 * Geçiş reklamını hazırlayıp gösterir. Ödül döndürmez; bulmaca TAMAMLANIP
 * kutlama ekranı oyuncuya gösterildikten SONRA, oyuncu o ekrandan çıkarken
 * çağrılan tamamen isteğe bağlı bir gelir kanalıdır (bkz. ui.ts:
 * leaveCompletedScreen). Bilerek bulmaca ORTASINDA değil: AdMob'un "disallowed
 * interstitial implementations" kuralı, oyuncu aktif oynarken ya da
 * uygulama açılış/kapanışında geçiş reklamı göstermeyi yasaklıyor; tek izinli
 * an, bir görevin/bölümün bittiği doğal mola noktasıdır. Hata/web ortamında
 * sessizce yok sayılır. Kullanıcı "reklamları kaldır" ürününü satın aldıysa
 * hiç gösterilmez — ödüllü reklam (joker kazanma) bu kısıtlamadan
 * etkilenmez, çünkü kullanıcının kendi isteğiyle bir karşılık için izlediği
 * bir reklamdır.
 */
export async function maybeShowInterstitial(): Promise<void> {
  if (adsRemoved()) return;
  // İki geçiş reklamı arka arkaya gösterilemez (bkz. INTERSTITIAL_COOLDOWN_MS).
  if (Date.now() - lastInterstitialAt() < INTERSTITIAL_COOLDOWN_MS) return;
  if (!(await ensureInitialized())) return;
  try {
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_AD_ID });
    await AdMob.showInterstitial();
    localStorage.setItem(LAST_INTERSTITIAL_KEY, String(Date.now()));
  } catch {
    // reklam yüklenemediyse oyun akışını bozmadan devam
  }
}
