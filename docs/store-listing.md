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

☁️ Bulut yedeği — ilerlemeniz otomatik yedeklenir, telefonunuzu değiştirseniz
bile kaybolmaz

🌙 Açık/koyu tema — sistem tercihinize uyum sağlar

🔌 Kayıt gerekmez — hesap açmadan, şifre belirlemeden oynayın; yedeğinizi yeni
cihaza taşımak isterseniz Google hesabınızı bağlamak size kalmış

Türkçe kelime dağarcığınızı geliştirmek, zihninizi zinde tutmak ve keyifli
vakit geçirmek için ideal.
```

> ⚠️ **This text was corrected on 2026-08-08 and the Play Console listing must be
> updated to match — the copy in the console is still the old one.** The removed
> line claimed *"Hesap gerekmez — kayıt olmadan, **kişisel bilgi vermeden**
> oynayın"* ("no account needed — play without registering, without giving any
> personal information"). Cloud save creates an anonymous player ID on first launch
> and optional Google linking hands us an email address and display name, so that
> claim became misleading the moment cloud save shipped. A store listing that
> contradicts the Data Safety form is a policy problem, not just a wording one.
> The replacement keeps the true part (no registration, no password) and states the
> linking as the player's choice, plus a cloud-backup bullet that is now a genuine
> selling point.

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
- [x] Phone screenshots, 8 of them at 1080×1920 with a caption band —
  `docs/store-assets-originals/play/`. The tracked copies under
  `docs/store-assets/` are the same renders without the band, downscaled to
  540×960 for the repo (home, gameplay, cats, map, newspaper theme).
- [ ] Tablet screenshots (7"/10", 1600×2560) — `play-tablet/`, optional, but
  without them Play shows a "not optimized for large screens" notice.
- [ ] Promo video: `promo-1280x720.mp4` is cut and ready, but Play only accepts
  a YouTube URL, so it has to be uploaded to the studio's channel first.
- The icon and the feature graphic come from `npm run icons` and
  `python scripts/make_feature_graphic.py`; the screenshots and the video are
  rendered from the running app by `node scripts/showcase.mjs` plus
  `scripts/make_store_shots.py` / `scripts/make_promo_video.py` (see README).

## Ads / Data Safety notes (Play Console)

The app shows ads via Google AdMob (an interstitial after some puzzle
completions, a rewarded ad for an optional extra hint). Completed in Play
Console:

- **App content → Ads**: "My app contains ads" = Yes. ✅
- **Data safety form**: Location (approximate) and Device or other IDs,
  purpose = Advertising or marketing; marked as collected + shared, transfer
  encrypted. ✅ — **but this answers the ad half only.** It was filled in before
  cloud save existed and does not declare it yet; see below. ⚠️
- **Privacy policy**: `PRIVACY.md` (published copy: `docs/index.md` on GitHub
  Pages) rewritten on 2026-08-08 to cover the anonymous player ID, cloud save,
  optional Google linking, invite records and purchases. The studio-wide policy
  at <https://yilkgames.com/privacy-policy/> was updated to match. ✅

### Cloud save additions to Data safety — ✅ declared 2026-08-08

The form had claimed the app collects advertising data only, which cloud save made
wrong. Everything below is now entered in Play Console. Two notes from doing it:

- Declaring `OAuth` under account creation makes Play require a **mandatory account
  deletion URL** on the store listing, and the privacy policy does not qualify — it must
  name the app, show the steps prominently, and state what is deleted, what is kept and
  for how long. <https://yilkgames.com/account-deletion/> was written for exactly this;
  `#data-only` is the second URL, for deleting data without deleting the account.
- The anonymous player ID belongs under **Personal info → User IDs**, not Device IDs:
  Play scopes device identifiers to a device or browser, and a Firebase auth UID is an
  account identifier. Only the advertising ID goes under Device or other IDs.

What was declared:

- **App activity → Other user-generated content or App info and performance**:
  the save payload (puzzle progress, statistics, jokers, cat collection,
  settings). Collected = Yes, shared = No, transfer encrypted, **not** required
  to use the app? — it is not optional today, so answer "Data collection is
  required".
- **Personal info → Email address and Name**: only when the player links a
  Google account. Collected = Yes, optional (a player who never links is never
  asked), purpose = Account management, shared = No.
- **Device or other IDs**: already declared for ads; the anonymous Firebase UID
  falls under the same category, purpose = App functionality (in addition to
  the existing Advertising purpose).
- **Data deletion**: the form asks whether users can request deletion. Answer
  Yes and give the contact address from `PRIVACY.md` — there is no in-app
  delete button today.
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
- Tablet screenshots and the promo video are rendered locally (see above); what
  is left is uploading the video to YouTube and pasting its URL into the
  listing.
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
