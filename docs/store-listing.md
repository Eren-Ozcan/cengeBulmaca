# Google Play Store Listing

Text to be entered into Play Console. Mind the character limits: title 30,
short description 80, long description 4000.

> **Note:** the listing copy in the code blocks below is intentionally kept in
> Turkish. The shipped app is a Turkish-language word game and this text is
> pasted as-is into the Turkish Play Store listing. Only the surrounding
> documentation is in English.

## App name (30 characters)

```
Çengel Bulmaca
```

## Short description (80 characters)

```
Türkçe çengel bulmaca: günün bulmacası, günlük seri ve üç zorluk seviyesi.
```

## Long description

```
Klasik Türk bulmacacılığının sevilen türü çengel bulmaca (İsveç tipi kare
bulmaca) artık cebinizde! Sorular ızgaranın içindeki koyu hücrelerde yazar;
ok, cevabın hangi hücreden başlayıp hangi yöne yazılacağını gösterir.

ÖZELLİKLER

🧩 Klasik çengel formatı — hücre içi sorular, 4 tip yön oku, çift soruluk
hücreler

🐱 Duman'ın Anadolu yolculuğu — bulmaca çözdükçe Anadolu'nun bekçi
kedilerini topla, "Kedi Dostlarım" albümünü tamamla, haritada ilerlemeni
gör

📅 Günün bulmacası — her gün sizi bekleyen yeni bir hedef

🔥 Günlük seri — her gün en az bir bulmaca çözerek serinizi büyütün

🎯 Üç zorluk seviyesi — kolaydan zora, herkese uygun bulmacalar

⌨️ Türkçe ekran klavyesi — Ğ, Ü, Ş, İ, Ö, Ç dahil tam Türkçe destek

💡 Günlük ücretsiz ipucu — takıldığınızda harf açın; hakkınız biterse kısa
bir reklam izleyerek bir ipucu daha kazanın

💾 Otomatik kayıt — kaldığınız yerden devam edin

🌙 Açık/koyu tema — sistem tercihinize uyum sağlar

🔌 Hesap gerekmez — kayıt olmadan, kişisel bilgi vermeden oynayın

Türkçe kelime dağarcığınızı geliştirmek, zihninizi zinde tutmak ve keyifli
vakit geçirmek için ideal.
```

## Category

Games > Word (`Oyunlar > Kelime`)

## Tags

Kept in Turkish — these are the Play Store search keywords for the Turkish
listing:

```
bulmaca, çengel bulmaca, kare bulmaca, kelime oyunu, Türkçe
```

## Graphic requirements

- [x] App icon 512×512 PNG — `docs/store-assets/icon-512.png`
- [x] Feature graphic 1024×500 PNG (24-bit, no alpha) —
  `docs/store-assets/feature-graphic.png`
- [x] Screenshots (3 of them, around 545×777, no alpha) —
  `docs/store-assets/screenshot-1-home.png`,
  `screenshot-2-gameplay.png`, `screenshot-3-cats.png`. Optional: these can be
  replaced with higher-resolution / real-device screenshots; the current ones
  are within Play Console's min/max size and aspect ratio limits.
- All of these can be regenerated from `tools/generate-icons.mjs` with
  `npm run icons` (icon / feature graphic); the screenshots were taken in a
  separate browser session and are not part of the script.

## Ads / Data Safety notes (Play Console)

The app shows ads via Google AdMob (an interstitial after some puzzle
completions, a rewarded ad for an optional extra hint). Completed in Play
Console:

- **App content → Ads**: "My app contains ads" = Yes. ✅
- **Data safety form**: Location (approximate) and Device or other IDs,
  purpose = Advertising or marketing; marked as collected + shared, transfer
  encrypted. ✅
- **Content rating questionnaire**: completed, came out as General/All ages
  (PEGI 3 / Everyone) across all authorities. ✅
- **Target audience**: set to ages 13-15, 16-17, and 18+. ✅
- The AdMob IDs in `src/ads.ts` and `strings.xml` belong to the real account
  (yilkgamesstudio@gmail.com, App ID
  `ca-app-pub-9709993577664180~3994312791`); the account is approved. ✅
- GDPR/UMP (Privacy & messaging) consent campaign published. ✅

## In-app purchases (IAP) and infrastructure — as of 2026-07-28

- **Merchant / payments profile**: set up. Bank account (Yapı Kredi IBAN)
  added, Google's test-deposit verification completed. ✅
- **IAP products**: 4 consumable joker packs (jokers_5/10/20/50) + 1
  non-consumable product (remove_ads) created in Play Console and Active. ✅
- **RevenueCat integration**: Android app config + service account + Product
  catalog completed, "Valid credentials" verified. ✅
- **`src/billing.ts` code side**: joker packs + `remove_ads`
  (purchase/restore/suppressing ad display) completed, shown as a card on the
  store screen. ✅
- **Google developer notifications (Pub/Sub RTDN)**: optional, the real-time
  purchase notification channel recommended by RevenueCat. Set up and
  connected ("Connected to Google"). ✅
- The GCP/Firebase project (`cengel-bulmaca-c504d`) is now managed collectively
  under a single account (`yilkgamesstudio@gmail.com`, Owner); no billing
  account is attached to the project, it runs on free quotas. ✅

## Remaining

- ⏳ Publishing to the Production track — bank verification is done, this is
  the next step (currently only on the Internal testing channel).
- ⏳ The Play Console "Payments profile" page shows an **enroll in the 15%
  service fee program** notice (it appears optional but should be reviewed —
  it requires creating an account group and accepting the service fee terms).
- Tablet screenshots (7"/10") and a YouTube video URL have not been added (not
  mandatory, can stay optional).
- ⏳ **GitHub secret scanning alert (Google API Key, `src/referral.ts` —
  Firebase `apiKey`)**: closed as `wont_fix` on GitHub (this key is the
  client-side, non-secret identifier of the Firebase web SDK — security is
  enforced by Firestore rules). Permanent fix: restrict this key in the Google
  Cloud Console with API restrictions (Identity Toolkit + Cloud Firestore API)
  and, if possible, application restrictions. Not done yet due to an access
  problem with the `yilkgamesstudio@gmail.com` account — to be completed once
  the account issue is resolved.

## Other

- Privacy policy: `PRIVACY.md` in the repo must be published at a URL (e.g.
  GitHub Pages) and that address entered into Play Console.
