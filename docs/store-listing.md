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

Uygulama artık Google AdMob ile reklam gösteriyor (geçiş reklamı bazı
bulmaca bitişlerinde, ödüllü reklam isteğe bağlı ekstra ipucu için).
Play Console'da doldurulması gerekenler:

- **App content → Ads**: "Uygulamam reklam içeriyor" = Evet.
- **Data safety formu**: "Reklam Kimliği / Cihaz kimlikleri" toplanıyor,
  amaç = Reklamcılık; AdMob SDK'sı üzerinden Google ile paylaşılıyor.
  Kullanıcı verisi şifrelenmiş iletimle gönderiliyor, silme talebi AdMob/
  Google hesabı üzerinden yönetiliyor (uygulamanın kendi sunucusu yok).
- **İçerik derecelendirmesi anketi**: reklam SDK'sı eklendiği için anket
  yeniden doldurulmalı; oyunun kendisi hâlâ şiddet içermeyen bir kelime
  oyunu (PEGI 3 / Herkes beklenir), reklamlar nedeniyle "reklam içerir"
  notu eklenecek.
- `src/ads.ts` ve `strings.xml`'deki AdMob ID'leri şu an Google'ın TEST
  ID'leri — yayına almadan önce gerçek AdMob hesabından üretilen App ID
  ve reklam birimi ID'leriyle değiştirilmeli (bkz. `src/ads.ts` başındaki
  not).

## Diğer

- Gizlilik politikası: depodaki `PRIVACY.md` bir URL'de yayınlanmalı
  (örn. GitHub Pages) ve Play Console'a o adres girilmeli.
