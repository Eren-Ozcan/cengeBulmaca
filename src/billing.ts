// Google Play Billing üzerinden gerçek para karşılığı joker paketi satın
// alma. RevenueCat (@revenuecat/purchases-capacitor) kullanılıyor — native
// Play Billing kütüphanesinin versiyon takibini RevenueCat üstlenir, bu
// dosya ince bir sarmalayıcıdır.
//
// ÖNEMLİ: Yayına çıkmadan önce yapılması gerekenler:
//   1. https://app.revenuecat.com adresinde bir proje oluştur, Android
//      uygulamasını bağla, aşağıdaki REVENUECAT_API_KEY'i gerçek Public
//      SDK Key ile değiştir.
//   2. Google Play Console'da JOKER_PACKS'teki id'lerle BİREBİR aynı
//      tüketilebilir (consumable) uygulama içi ürünleri tanımla, fiyat
//      belirle.
//   3. Bu ürünleri RevenueCat dashboard'unda eşleştir.
//   4. İmzalı bir build'i en az Internal Testing track'ine yükle — Play
//      Billing sandbox satın alımları imzasız/debug build'lerde çalışmaz.
//
// API anahtarı boşken ya da web/dev ortamındayken (Capacitor.isNativePlatform()
// false) satın alma gerçek ödeme almadan anında simüle edilir — ads.ts'in
// rewarded reklamı native-only yapıp web'de no-op etmesiyle aynı kod deyimi;
// bu sayede Mağaza ekranı mağaza bağlantısı olmadan da uçtan uca test edilebilir.

import { Capacitor } from "@capacitor/core";
import { PRODUCT_CATEGORY, Purchases } from "@revenuecat/purchases-capacitor";

const REVENUECAT_API_KEY = ""; // TODO yayın öncesi: gerçek Public SDK Key

export interface JokerPack {
  id: string;
  count: number;
  priceLabel: string;
  popular?: boolean;
}

/** Placeholder fiyatlar — Play Console ürünleri tanımlanıp RevenueCat API
 * anahtarı girilene kadar kullanılır. */
export const JOKER_PACKS: JokerPack[] = [
  { id: "jokers_5", count: 5, priceLabel: "₺19,99" },
  { id: "jokers_10", count: 10, priceLabel: "₺34,99" },
  { id: "jokers_20", count: 20, priceLabel: "₺59,99", popular: true },
  { id: "jokers_50", count: 50, priceLabel: "₺119,99" },
];

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
