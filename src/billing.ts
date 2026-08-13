// Real-money joker pack and "remove ads" purchases via Google Play
// Billing. Uses RevenueCat (@revenuecat/purchases-capacitor) — RevenueCat
// handles version tracking for the native Play Billing library, this file
// is a thin wrapper around it.
//
// Release infrastructure is complete: the RevenueCat project + Android app
// configuration + Public SDK Key are set up below, the exact same products
// as the JOKER_PACKS and REMOVE_ADS_PRODUCT_ID ids are defined in Play
// Console, connected to the Play Store app in the RevenueCat dashboard,
// and a service account for purchase verification has been set up. The
// only remaining step: uploading a signed build to at least the Internal
// Testing track — Play Billing sandbox purchases don't work in
// unsigned/debug builds.
//
// When the API key is empty, or on web/dev (Capacitor.isNativePlatform()
// is false), a purchase is instantly simulated without taking real
// payment — the same convention as ads.ts making the rewarded ad
// native-only and a no-op on web; this lets the Store screen be tested
// end-to-end without a store connection.

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
 * FALLBACK price labels shown when the store can't be reached. The real
 * price is fetched from the store via loadStorePrices() and comes in the
 * player's country/currency (₺, €, ₹ — whatever Play says). The values
 * here are only shown on web/dev, and when the store doesn't respond.
 */
export const JOKER_PACKS: JokerPack[] = [
  { id: "jokers_5", count: 5, priceLabel: "$1.99" },
  { id: "jokers_10", count: 10, priceLabel: "$3.99" },
  { id: "jokers_20", count: 20, priceLabel: "$6.99", popular: true },
  { id: "jokers_50", count: 50, priceLabel: "$12.99" },
];

/** productId -> localized price text supplied by the store */
const storePrices: Record<string, string> = {};

/**
 * The price to display for a product: the one from the store if available,
 * otherwise the fallback label. This way the price field is never left blank.
 */
export function priceLabelFor(productId: string, fallback: string): string {
  return storePrices[productId] ?? fallback;
}

/**
 * Fetches localized prices from the store. Fails silently — if prices
 * can't be fetched, the fallback labels remain and the store still opens.
 * Safe to call again for the same products.
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
    /* the fallback labels remain */
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
 * Purchases a joker pack. Returns the number of jokers in the pack on
 * success, or 0 on cancel/error. When the store isn't connected (web/dev
 * environment or a missing API key), the purchase is instantly simulated
 * without taking real payment.
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

// ---------- remove ads (one-time, non-consumable product) ----------

export const REMOVE_ADS_PRODUCT_ID = "remove_ads";
/** Fallback label — see loadStorePrices / priceLabelFor for the real price. */
export const REMOVE_ADS_PRICE_LABEL = "$2.99";

const ADS_REMOVED_KEY = "cengel-ads-removed";

/** Has the user already purchased the "remove ads" product? */
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
    // if storage is unavailable, the preference is limited to this session
  }
}

/**
 * Purchases the "remove ads" product. Returns true on success and the
 * state is stored persistently (see adsRemoved). When the store isn't
 * connected (web/dev environment or a missing API key), the purchase is
 * instantly simulated without taking real payment.
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
 * Called once on app startup. Checks the store purchase history for a
 * previous "remove ads" purchase and syncs the local state — needed
 * because the local flag can end up reset, e.g. after a reinstall or when
 * RevenueCat's anonymous user identity changes. Silently does nothing on
 * web/dev or when there's no connection.
 */
export async function restoreAdsRemoved(): Promise<void> {
  if (!(await ensureConfigured())) return;
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    if (customerInfo.allPurchasedProductIdentifiers.includes(REMOVE_ADS_PRODUCT_ID)) {
      setAdsRemoved(true);
    }
  } catch {
    // if there's no connection, the local state is preserved and retried on the next launch
  }
}
