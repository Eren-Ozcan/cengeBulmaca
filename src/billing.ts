// Google Play Billing üzerinden gerçek para karşılığı joker paketi ve
// "reklamları kaldır" satın alma işlemleri. RevenueCat
// (@revenuecat/purchases-capacitor) kullanılıyor — native Play Billing
// kütüphanesinin versiyon takibini RevenueCat üstlenir, bu dosya ince bir
// sarmalayıcıdır.
//
// Yayın altyapısı tamamlandı: RevenueCat projesi + Android app
// configuration + Public SDK Key aşağıda, Play Console'da JOKER_PACKS ve
// REMOVE_ADS_PRODUCT_ID id'leriyle birebir aynı ürünler tanımlandı,
// RevenueCat dashboard'unda Play Store app'ine bağlandı, satın alma
// doğrulaması için servis hesabı kuruldu. Kalan tek adım: imzalı bir
// build'i en az Internal Testing track'ine yüklemek — Play Billing sandbox
// satın alımları imzasız/debug build'lerde çalışmaz.
//
// API anahtarı boşken ya da web/dev ortamındayken (Capacitor.isNativePlatform()
// false) satın alma gerçek ödeme almadan anında simüle edilir — ads.ts'in
// rewarded reklamı native-only yapıp web'de no-op etmesiyle aynı kod deyimi;
// bu sayede Mağaza ekranı mağaza bağlantısı olmadan da uçtan uca test edilebilir.

import { Capacitor } from "@capacitor/core";
import { PRODUCT_CATEGORY, Purchases } from "@revenuecat/purchases-capacitor";

const REVENUECAT_API_KEY = "goog_pEpVzHkRehqKRtGyRQhitYByoJD";

export interface JokerPack {
  id: string;
  count: number;
  priceLabel: string;
  popular?: boolean;
}

/**
 * Mağazaya ulaşılamadığında gösterilecek YEDEK fiyat etiketleri. Gerçek fiyat
 * loadStorePrices() ile mağazadan çekilir ve oyuncunun ülkesine/para birimine
 * göre gelir (₺, €, ₹ — Play ne diyorsa). Buradaki değerler yalnızca web/dev
 * ortamında ve mağaza cevap vermediğinde görünür.
 */
export const JOKER_PACKS: JokerPack[] = [
  { id: "jokers_5", count: 5, priceLabel: "$1.99" },
  { id: "jokers_10", count: 10, priceLabel: "$3.99" },
  { id: "jokers_20", count: 20, priceLabel: "$6.99", popular: true },
  { id: "jokers_50", count: 50, priceLabel: "$12.99" },
];

/** productId -> mağazanın verdiği yerelleştirilmiş fiyat metni */
const storePrices: Record<string, string> = {};

/**
 * Bir ürünün gösterilecek fiyatı: mağazadan geldiyse o, yoksa yedek etiket.
 * Böylece fiyat alanı hiçbir zaman boş kalmaz.
 */
export function priceLabelFor(productId: string, fallback: string): string {
  return storePrices[productId] ?? fallback;
}

/**
 * Mağazadan yerelleştirilmiş fiyatları çeker. Sessizce başarısız olur —
 * fiyat çekilemezse yedek etiketler kalır ve mağaza yine de açılır.
 * Aynı ürünler için tekrar çağrılması zararsızdır.
 */
export async function loadStorePrices(): Promise<void> {
  if (!(await ensureConfigured())) return;
  try {
    const ids = [...JOKER_PACKS.map((p) => p.id), REMOVE_ADS_PRODUCT_ID];
    const { products } = await Purchases.getProducts({
      productIdentifiers: ids,
      type: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
    });
    for (const p of products) {
      if (p.priceString) storePrices[p.identifier] = p.priceString;
    }
  } catch {
    /* yedek etiketler kalır */
  }
}

let configured = false;

async function ensureConfigured(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !REVENUECAT_API_KEY) return false;
  if (configured) return true;
  try {
    await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    configured = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Bir joker paketi satın alır. Başarılıysa paketteki joker sayısını,
 * iptal/hata durumunda 0 döner. Mağaza bağlı değilken (web/dev ortamı ya da
 * API anahtarı eksikken) satın alma gerçek ödeme almadan anında simüle
 * edilir.
 */
export async function purchaseJokerPack(packId: string): Promise<number> {
  const pack = JOKER_PACKS.find((p) => p.id === packId);
  if (!pack) return 0;

  if (!(await ensureConfigured())) return pack.count;

  try {
    const { products } = await Purchases.getProducts({
      productIdentifiers: [packId],
      type: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
    });
    const product = products[0];
    if (!product) return 0;
    await Purchases.purchaseStoreProduct({ product });
    return pack.count;
  } catch {
    return 0;
  }
}

// ---------- reklamları kaldır (tek seferlik, tüketilmeyen ürün) ----------

export const REMOVE_ADS_PRODUCT_ID = "remove_ads";
/** Yedek etiket — gerçek fiyat için bkz. loadStorePrices / priceLabelFor. */
export const REMOVE_ADS_PRICE_LABEL = "$2.99";

const ADS_REMOVED_KEY = "cengel-ads-removed";

/** Kullanıcı "reklamları kaldır" ürününü daha önce satın aldı mı? */
export function adsRemoved(): boolean {
  try {
    return localStorage.getItem(ADS_REMOVED_KEY) === "1";
  } catch {
    return false;
  }
}

function setAdsRemoved(removed: boolean): void {
  try {
    localStorage.setItem(ADS_REMOVED_KEY, removed ? "1" : "0");
  } catch {
    // depolama yoksa tercih oturumla sınırlı kalır
  }
}

/**
 * "Reklamları kaldır" ürününü satın alır. Başarılıysa true döner ve durum
 * kalıcı olarak saklanır (bkz. adsRemoved). Mağaza bağlı değilken (web/dev
 * ortamı ya da API anahtarı eksikken) satın alma gerçek ödeme almadan
 * anında simüle edilir.
 */
export async function purchaseRemoveAds(): Promise<boolean> {
  if (!(await ensureConfigured())) {
    setAdsRemoved(true);
    return true;
  }

  try {
    const { products } = await Purchases.getProducts({
      productIdentifiers: [REMOVE_ADS_PRODUCT_ID],
      type: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
    });
    const product = products[0];
    if (!product) return false;
    await Purchases.purchaseStoreProduct({ product });
    setAdsRemoved(true);
    return true;
  } catch {
    return false;
  }
}

/**
 * Uygulama açılışında bir kere çağrılır. Daha önce yapılmış "reklamları
 * kaldır" satın almasını mağaza geçmişinden kontrol edip yerel durumu
 * senkronize eder — yeniden yükleme sonrası ya da RevenueCat'in anonim
 * kullanıcı kimliği değiştiğinde yerel bayrak sıfırlanmış olabileceği için
 * gerekli. Web/dev ortamında ya da bağlantı yoksa sessizce hiçbir şey
 * yapmaz.
 */
export async function restoreAdsRemoved(): Promise<void> {
  if (!(await ensureConfigured())) return;
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    if (customerInfo.allPurchasedProductIdentifiers.includes(REMOVE_ADS_PRODUCT_ID)) {
      setAdsRemoved(true);
    }
  } catch {
    // bağlantı yoksa yerel durum korunur, bir sonraki açılışta tekrar denenir
  }
}
