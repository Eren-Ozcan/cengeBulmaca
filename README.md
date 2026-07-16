# Çengel Bulmaca

Türkçe klasik çengel bulmaca (İsveç tipi) mobil oyunu. Sorular ızgaranın
içindeki koyu hücrelerde yazar; ok, cevabın hangi hücreden başlayıp hangi
yöne yazılacağını gösterir.

Web teknolojisiyle (Vite + TypeScript, framework'süz) geliştirildi,
Capacitor ile Android uygulamasına paketlenir.

## Geliştirme

```bash
npm install
npm run dev        # http://localhost:5173
```

## Yeni bulmaca üretme

Bulmacalar `tools/generate.mjs` ile üretilir: rastgele maske üretilir,
onarılır, soru hücreleri atanır ve `tools/dictionary.mjs` sözlüğünden
geriye izlemeli (backtracking) algoritmayla doldurulur. Çıktı hem araç
içinde hem oyun motorunda (kesişim/taşma/boş hücre) doğrulanır.

```bash
npm run gen -- <id> <başlık> [seed] [sütun] [satır]
npm run gen -- bulmaca-4 "Bulmaca 4" 1234 7 10
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

## Mimari

- `src/types.ts` — bulmaca veri modeli (ipucu hücresi + 4 ok türü)
- `src/puzzle.ts` — tanımdan ızgara kurma ve tutarlılık doğrulama
- `src/game.ts` — oyun durumu: seçim, harf girme, kontrol, kayıt (localStorage)
- `src/ui.ts` — ızgara, aktif soru çubuğu, Türkçe ekran klavyesi
- `tools/` — bulmaca üretici ve sözlük
