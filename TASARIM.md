# Tasarım / Görsel Varlık Kontrol Listesi

Kedi temalı içerik güncellemesiyle birlikte eklenen ve ileride
güçlendirilebilecek görsel öğelerin listesi. Açık (unlock edilmiş) kediler
artık Gemini ile üretilip `tools/process-cat-images.mjs` ile temizlenmiş
gerçek portre görselleriyle gösteriliyor (`public/cats/*.png`, bkz.
`cat-avatar.ts`). Kilitli kediler hâlâ elle çizilmiş, jenerik (kedi-bağımsız)
bir parametrik SVG siluetiyle gösteriliyor — kimlik ifşa etmiyor ve harici
görsel/telif riski taşımıyor. Uygulama ikonu/favicon de aynı şekilde Gemini
ile üretilip yerelde işlenmiş bir Duman portresine dayanıyor (bkz. "Uygulama
ikonu / marka varlıkları").

## Karakterler

| Karakter | Bölge | Durum | Not |
|---|---|---|---|
| Duman (rehber) | İstanbul | ✅ Gerçek portre (PNG) | App icon/favicon de Duman'ın Gemini ile üretilip elle işlenmiş bir portresine dayanıyor |
| Pamuk | Van | ✅ Gerçek portre (PNG) | Heterokromik göz uygulandı |
| Bulut | Ankara | ✅ Gerçek portre (PNG) | |
| Fıstık | İzmir | ✅ Gerçek portre (PNG) | |
| Yasemin | Antalya | ✅ Gerçek portre (PNG) | |
| Fındık | Trabzon | ✅ Gerçek portre (PNG) | |
| Gri Dede | Kapadokya | ✅ Gerçek portre (PNG) | |
| Kum | Şanlıurfa | ✅ Gerçek portre (PNG) | |
| Zeytin | Bursa | ✅ Gerçek portre (PNG) | |
| Şeker | Konya | ✅ Gerçek portre (PNG) | |
| Yayla | Rize | ✅ Gerçek portre (PNG) | |
| Nar | Mardin | ✅ Gerçek portre (PNG) | |
| İnci | Çanakkale | ✅ Gerçek portre (PNG) | |
| Baklava | Gaziantep | ✅ Gerçek portre (PNG) | |
| Kar | Erzurum | ✅ Gerçek portre (PNG) | |
| Fener | Sinop | ✅ Gerçek portre (PNG) | Kapanış hikayesi artık burada tetikleniyor (son kedi) |

`CatDef` üzerindeki `furColor`/`patternColor`/`pattern`/`eyeColor` alanları
artık sadece kilitli-siluet SVG'sinin görünümünü değil, hikaye/lore verisini
de besliyor; gerçek görsel artık bu alanlardan bağımsız, elle seçilmiş bir
Gemini portresi (bkz. `src/cats.ts`, `src/cat-avatar.ts`).

### Açılım modeli (2 aylık ilerleme)

Kediler artık belirli bir bulmacaya değil, **toplam çözülen farklı bulmaca
sayısına** bağlı (`CatDef.unlockAt`). Eşikler: 2, 6, 10, 14, 18, 22, 26, 30,
34, 38, 42, 46, 50, 55, 60. Günde bir bulmaca çözen ortalama oyuncu son
kediye (Fener) ~2 ayda ulaşır. Aynı bulmacayı tekrar çözmek sayacı
artırmaz. Kilitli kedi kartı gereken bulmaca sayısını yazar; tamamlama
modalı ve ana menü teaser'ı sıradaki kediye kaç bulmaca kaldığını
gösterir.

**Bulmaca havuzu (2026-07-24, 300'e çıkarıldı):** `src/puzzles/` artık
300 bulmaca içeriyor (`tools/generate.mjs` ile üretildi,
`src/puzzles/index.ts` artık elle 300 import satırı yerine
`import.meta.glob` ile numerik sırayla otomatik yüklüyor). Kedi açılım
eşikleri havuz büyüklüğünden bağımsız — yolculuk hâlâ 60 farklı bulmaca
çözülünce tamamlanıyor; büyümüş havuz sadece günlük bulmaca rotasyonunun
(`dailyIndex`) çok daha uzun süre tekrarsız kalmasını sağlıyor.

**Büyük/detay görünümü (✅ tamamlandı):** `catFullBody` (cat-avatar.ts) açıkken
aynı Gemini portresini (`catAvatar` ile aynı görsel), kilitliyken gövde+kuyruk+
patili siluet SVG'sini döndürüyor. Kullanıldığı yerler: hikaye intro'su,
kapanış hikayesindeki Duman portresi, kedi detay modalı, bulmaca bitince
açılma kutlaması. Koleksiyon ızgarası, harita pimleri ve teaser önizlemesi
`catAvatar` ile aynı portreyi küçük kare çerçevede gösteriyor.

**Idle animasyonu (✅ tamamlandı, sade sürüm):** Kedi detay modalında CSS-only
bir "nefes alma" döngüsü (`cat-idle-breathe` @keyframes, style.css) — hafif
büyüyüp küçülme + minik eğilme, `prefers-reduced-motion`da kapanıyor. Gerçek
göz kırpma/kuyruk sallama denenmedi (portreler tek kare, ayrı göz/kuyruk
katmanı yok); istenirse ikinci "gözleri kapalı" kare üretilip crossfade
yapılabilir — bkz. "Beklemede".

**Beklemede (ileri aşama, isteğe bağlı):**
- Gerçek göz kırpma: her kedi için "gözleri kapalı" ikinci bir Gemini
  portresi üretilip aynı kadraja hizalanarak periyodik crossfade yapılabilir.
- Duman için ayrı, biraz daha büyük/detaylı bir "kahraman" illüstrasyonu.

## Ekranlar

| Ekran | Durum |
|---|---|
| Ana menü + kedi teaser kartı | ✅ |
| Hikaye intro (ilk açılış) | ✅ |
| Kedi Dostlarım koleksiyon ekranı | ✅ |
| Kedi detay modalı | ✅ |
| Bulmaca bitirince kedi açılma kutlaması | ✅ |
| Kapanış hikayesi (tüm kediler toplanınca) | ✅ |
| Bölge haritası (Anadolu üzerinde ilerleme görselleştirmesi) | ✅ "Anadolu Haritası" ekranı (`src/turkey-map.ts` + `renderMap`), Kedi Dostlarım'dan 🗺️ ile açılıyor |

## Kutu / kart bileşenleri (mevcut stil sistemi)

Tüm yeni bileşenler mevcut CSS değişken sistemini (`--surface`, `--radius`,
`--shadow`, `--accent` vb.) kullanıyor; hem modern hem gazete temada otomatik
uyumlu:
- `.cats-teaser` — ana menüde koleksiyon özeti kartı
- `.cat-card` — koleksiyon ızgarasındaki tekil kedi kartı (kilitli/açık)
- `.cat-modal` / `.cat-reveal-tag` — detay ve kutlama modalı
- `.modal-cat-next` — tamamlama modalında "sıradaki kediye N bulmaca" satırı
- `.intro-screen` — hikaye anlatım ekranı
- `.map-canvas` / `.map-outline` / `.map-pin` — Anadolu haritası ekranı;
  ada silüeti gerçek sınır verisi değil, elle çizilmiş stilize bir şekil
  (harici veri/telif riski yok, bkz. `src/turkey-map.ts`). Bölge konumları
  gerçek enlem/boylamdan ölçeklenmiş ama coğrafi olarak kesin değil.

(`.puzzle-cat-badge` kaldırıldı: kediler bulmaca-başına değil, toplam çözüm
sayısına göre açıldığı için bulmaca listesinde kedi rozeti artık yok.)

## Ses / haptik

- Kedi açılma anı: confetti + pop animasyonu + `playWin()` + artık ayrı bir
  "miyav" sesi (`playCatUnlock`, `src/sound.ts`). Ses dosyası yok, oscillator
  + bandpass filtreyle sentezleniyor (paket boyutu artmıyor), mevcut ses
  sistemiyle aynı yaklaşım.

## Uygulama ikonu / marka varlıkları

- ✅ Tamamlandı. Duman'ın Gemini (Google) ile üretilen düz-vektör bir
  portresi kaynak alındı (`tools/icon-src/duman-icon-raw.png`), ardından
  `tools/generate-icons.mjs` (sharp) ile:
  - `public/favicon.png` (tarayıcı sekmesi ikonu, `index.html` güncellendi),
  - Android `ic_launcher` / `ic_launcher_round` (tüm yoğunluklar, kenardan
    kenara, arka planla kaynaşmış),
  - Android adaptive icon foreground (şeffaf, güvenli alan içinde ölçekli) +
    background rengi (görselden otomatik örneklenen turuncu ton)
  üretildi. Yeniden üretmek için: `npm run icons`.

## Öncelik önerisi

Kontrol listesindeki ana maddeler (app icon/favicon, ses efekti, bölge
haritası, gerçek kedi portreleri, sade idle animasyonu) tamamlandı. Kalan
isteğe bağlı fikirler "Beklemede" notlarında (gerçek göz kırpma karesi,
ayrı kahraman illüstrasyonu vb.).
