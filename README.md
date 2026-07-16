# Çengel Bulmaca

Türkçe klasik çengel bulmaca (İsveç tipi) mobil oyunu. Sorular ızgaranın
içindeki koyu hücrelerde yazar; ok, cevabın hangi hücreden başlayıp hangi
yöne yazılacağını gösterir.

Web teknolojisiyle (Vite + TypeScript, framework'süz) geliştirildi,
Capacitor ile Android uygulamasına paketlenir.

## Özellikler

- Klasik çengel formatı: hücre içi sorular, 4 tip yön oku, çift soruluk hücreler
- 10 bulmaca, üç zorluk seviyesi (kolay / orta / zor)
- Günün bulmacası (tarihe göre deterministik seçim) ve 🔥 günlük seri (streak)
- Türkçe ekran klavyesi (Ğ Ü Ş İ Ö Ç), kontrol ve ipucu (harf açma)
- Ses efektleri (Web Audio, açılıp kapanabilir) ve haptik geri bildirim
- Sonucu paylaşma (Web Share API, desteklenmezse panoya kopyalama)
- İlerleme kaydı (localStorage) — kaldığın yerden devam
- Açık/koyu tema (sistem tercihine göre)

## Geliştirme

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # birim testleri (vitest)
```

## Yeni bulmaca üretme

Bulmacalar `tools/generate.mjs` ile üretilir: rastgele maske üretilir,
onarılır, soru hücreleri atanır ve `tools/dictionary.mjs` sözlüğünden
geriye izlemeli (backtracking) algoritmayla doldurulur. Çıktı hem araç
içinde hem oyun motorunda (kesişim/taşma/boş hücre) doğrulanır.

```bash
npm run gen -- <id> <başlık> [seed] [sütun] [satır] [zorluk]
npm run gen -- bulmaca-11 "Bulmaca 11" 1234 8 11 orta
```

Üretilen JSON `src/puzzles/` altına yazılır; oyuna eklemek için
`src/puzzles/index.ts` listesine ekleyin.

Sözlüğü zenginleştirmek için `tools/dictionary.mjs` dosyasına
`{ a: "CEVAP", c: ["soru metni"] }` girişleri ekleyin.

## Android (APK)

Gereksinimler: Android SDK, JDK 17+.

```bash
npm run android
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

### Release (imzalı)

`android/keystore.properties.example` dosyasını `keystore.properties`
olarak kopyalayıp anahtar bilgilerinizi girin (dosya git'e girmez), sonra:

```bash
npm run android:release
# APK: android/app/build/outputs/apk/release/app-release.apk
```

Play Store yayın hazırlığı için `docs/store-listing.md` ve `PRIVACY.md`
dosyalarına bakın.

## Mimari

- `src/types.ts` — bulmaca veri modeli (ipucu hücresi + 4 ok türü + zorluk)
- `src/puzzle.ts` — tanımdan ızgara kurma ve tutarlılık doğrulama
- `src/game.ts` — oyun durumu: seçim, harf girme, kontrol, kayıt (localStorage)
- `src/stats.ts` — günlük seri, çözüm istatistikleri, günün bulmacası seçimi
- `src/ui.ts` — ızgara, aktif soru çubuğu, Türkçe ekran klavyesi, paylaşım
- `src/sound.ts` — Web Audio ses efektleri (dosyasız, sentezlenmiş)
- `src/haptics.ts` — titreşim geri bildirimi
- `src/*.test.ts` — vitest birim testleri
- `tools/` — bulmaca üretici ve sözlük (646 giriş)
