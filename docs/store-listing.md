# Google Play Mağaza Metni

Play Console'a girilecek metinler. Karakter sınırlarına dikkat:
başlık 30, kısa açıklama 80, uzun açıklama 4000.

## Uygulama adı (30 karakter)

```
Çengel Bulmaca
```

## Kısa açıklama (80 karakter)

```
Türkçe çengel bulmaca: günün bulmacası, günlük seri ve üç zorluk seviyesi.
```

## Uzun açıklama

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

## Kategori

Oyunlar > Kelime

## Etiketler

bulmaca, çengel bulmaca, kare bulmaca, kelime oyunu, Türkçe

## Grafik gereksinimleri

- [x] Uygulama simgesi 512×512 PNG — `docs/store-assets/icon-512.png`
- [x] Öne çıkan görsel (feature graphic) 1024×500 PNG (24-bit, alfasız) —
  `docs/store-assets/feature-graphic.png`
- [x] Ekran görüntüleri (3 adet, 545×777 civarı, alfasız) —
  `docs/store-assets/screenshot-1-home.png`,
  `screenshot-2-gameplay.png`, `screenshot-3-cats.png`. İsteğe bağlı:
  daha yüksek çözünürlüklü/gerçek cihaz ekran görüntüleriyle
  değiştirilebilir, mevcut olanlar Play Console'un min/maks boyut ve
  en-boy oranı sınırları içinde.
- Tümü `npm run icons` ile `tools/generate-icons.mjs`'den yeniden
  üretilebilir (icon/feature graphic); ekran görüntüleri ayrı bir
  tarayıcı oturumuyla alındı, script'e dahil değil.

## Reklam / Data Safety notları (Play Console)

Uygulama Google AdMob ile reklam gösteriyor (geçiş reklamı bazı bulmaca
bitişlerinde, ödüllü reklam isteğe bağlı ekstra ipucu için). Play
Console'da tamamlananlar:

- **App content → Ads**: "Uygulamam reklam içeriyor" = Evet. ✅
- **Data safety formu**: Konum (yaklaşık) ve Cihaz veya diğer kimlikler,
  amaç = Reklam veya pazarlama; toplanıyor + paylaşılıyor olarak
  işaretlendi, aktarım şifreli. ✅
- **İçerik derecelendirmesi anketi**: tamamlandı, tüm otoritelerde
  Genel/Tüm yaşlar (PEGI 3 / Herkes) çıktı. ✅
- **Hedef kitle**: 13-15, 16-17, 18 yaş ve üstü olarak ayarlandı. ✅
- `src/ads.ts` ve `strings.xml`'deki AdMob ID'leri gerçek hesaba
  (yilkgamesstudio@gmail.com, App ID
  `ca-app-pub-9709993577664180~3994312791`) ait, hesap onaylandı. ✅
- GDPR/UMP (Privacy & messaging) rıza kampanyası yayınlandı. ✅

## Satın alma (IAP) ve altyapı — 2026-07-26 itibarıyla

- **Satıcı hesabı (merchant/payments profile)**: kurulu. Banka hesabı
  (Yapı Kredi IBAN) eklendi, Google'ın deneme ödemesiyle doğrulaması
  bekleniyor (otomatik, ~3 iş günü). ⏳
- **IAP ürünleri**: 4 tüketilebilir joker paketi (jokers_5/10/20/50) +
  1 tüketilmeyen ürün (remove_ads) Play Console'da oluşturuldu ve
  Etkin. ✅
- **RevenueCat entegrasyonu**: Android app config + servis hesabı +
  Product catalog tamamlandı, "Valid credentials" doğrulandı. ✅
- **`src/billing.ts` kod tarafı**: joker paketleri + `remove_ads`
  (satın alma/restore/reklam gösterimini engelleme) tamamlandı,
  mağaza ekranında kart olarak gösteriliyor. ✅
- **Google developer notifications (Pub/Sub RTDN)**: opsiyonel,
  RevenueCat'in önerdiği gerçek zamanlı satın alma bildirimi kanalı.
  Kuruldu ve bağlandı ("Connected to Google"). ✅
- GCP/Firebase projesi (`cengel-bulmaca-c504d`) artık tek hesapta
  (`yilkgamesstudio@gmail.com`, Owner) topluca yönetiliyor; projeye
  hiç faturalandırma (billing) hesabı bağlı değil, ücretsiz kotalarla
  çalışıyor. ✅

## Kalanlar

- ⏳ Banka hesabı doğrulaması (Google tarafında, otomatik).
- ⏳ Production track'e yayınlama — banka doğrulaması bitince yapılacak
  son adım (şu an sadece Dahili test kanalında).
- Tablet ekran görüntüleri (7"/10") ve YouTube video URL'si eklenmedi
  (zorunlu değil, isteğe bağlı kalabilir).
- ⏳ **GitHub secret scanning uyarısı (Google API Key, `src/referral.ts`
  — Firebase `apiKey`)**: GitHub'da `wont_fix` olarak kapatıldı (bu
  anahtar Firebase web SDK'sının istemci tarafı, gizli olmayan
  tanımlayıcısı — güvenlik Firestore rules ile sağlanıyor). Kalıcı
  düzeltme: Google Cloud Console'da bu anahtarı API kısıtlamasıyla
  (Identity Toolkit + Cloud Firestore API) ve mümkünse uygulama
  kısıtlamasıyla sınırlamak. `yilkgamesstudio@gmail.com` hesabına erişim
  sorunu nedeniyle henüz yapılmadı — hesap sorunu çözülünce tamamlanacak.

## Diğer

- Gizlilik politikası: depodaki `PRIVACY.md` bir URL'de yayınlanmalı
  (örn. GitHub Pages) ve Play Console'a o adres girilmeli.
