# Tasarım / Görsel Varlık Kontrol Listesi

Kedi temalı içerik güncellemesiyle birlikte eklenen ve ileride
güçlendirilebilecek görsel öğelerin listesi. Oyun içi tüm kedi çizimleri
(avatar, tam gövde, harita pimleri) hâlâ elle çizilmiş, parametrik SVG'dir
(harici görsel/telif riski yok, bkz. `cat-avatar.ts`). Tek istisna: uygulama
ikonu/favicon, Gemini ile üretilip yerelde işlenmiş tek bir Duman portresine
dayanıyor (bkz. "Uygulama ikonu / marka varlıkları").

## Karakterler

| Karakter | Bölge | Durum | Not |
|---|---|---|---|
| Duman (rehber) | İstanbul | ✅ SVG avatar + tam gövde | App icon/favicon de Duman'ın Gemini ile üretilip elle işlenmiş bir portresine dayanıyor |
| Pamuk | Van | ✅ SVG avatar | Heterokromik göz uygulandı |
| Bulut | Ankara | ✅ SVG avatar | |
| Fıstık | İzmir | ✅ SVG avatar | |
| Yasemin | Antalya | ✅ SVG avatar | |
| Fındık | Trabzon | ✅ SVG avatar | |
| Gri Dede | Kapadokya | ✅ SVG avatar | |
| Kum | Şanlıurfa | ✅ SVG avatar | |
| Zeytin | Bursa | ✅ SVG avatar | |
| Şeker | Konya | ✅ SVG avatar | |
| Yayla | Rize | ✅ SVG avatar | |
| Nar | Mardin | ✅ SVG avatar | |
| İnci | Çanakkale | ✅ SVG avatar | |
| Baklava | Gaziantep | ✅ SVG avatar | |
| Kar | Erzurum | ✅ SVG avatar | |
| Fener | Sinop | ✅ SVG avatar | Kapanış hikayesi artık burada tetikleniyor (son kedi) |

Mevcut sistem: tek bir parametrik "kedi kafası" iskeleti (kulak + kafa + göz +
burun + ağız + bıyık), kediye göre değişen tüy rengi / desen (solid, tabby,
patch, tuxedo) / göz rengi. Tutarlı bir "aile" gibi görünmesi için bilinçli
tercih — bkz. `src/cats.ts`, `src/cat-avatar.ts`.

### Açılım modeli (2 aylık ilerleme)

Kediler artık belirli bir bulmacaya değil, **toplam çözülen farklı bulmaca
sayısına** bağlı (`CatDef.unlockAt`). Eşikler: 2, 6, 10, 14, 18, 22, 26, 30,
34, 38, 42, 46, 50, 55, 60. Toplam 60 bulmaca var; günde bir bulmaca çözen
ortalama oyuncu son kediye (Fener) ~2 ayda ulaşır. Aynı bulmacayı tekrar
çözmek sayacı artırmaz. Kilitli kedi kartı gereken bulmaca sayısını yazar;
tamamlama modalı ve ana menü teaser'ı sıradaki kediye kaç bulmaca kaldığını
gösterir.

**Tam gövde illüstrasyon (✅ tamamlandı):** `catFullBodySvg` (cat-avatar.ts),
aynı baş çizimini (headMarkup, artık paylaşımlı) oturan gövde + kuyruk + ön
patilerle birleştiriyor; desen (tabby/patch/tuxedo) gövdeye de yansıyor.
Kullanıldığı yerler: hikaye intro'su, kapanış hikayesindeki Duman portresi,
kedi detay modalı, bulmaca bitince açılma kutlaması. Koleksiyon ızgarası,
harita pimleri ve teaser önizlemesi küçük boyut nedeniyle hâlâ baş/büst
kullanıyor (bilinçli tercih, karmaşayı önlemek için).

**Beklemede (ileri aşama, isteğe bağlı):**
- Basit "idle" animasyonu (göz kırpma, kuyruk sallama) — kedi detay modalında.
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

Kontrol listesindeki dört ana madde (app icon/favicon, ses efekti, bölge
haritası, tam gövde illüstrasyon) tamamlandı. Kalan isteğe bağlı fikirler
"Beklemede" notlarında (idle animasyon, ayrı kahraman illüstrasyonu vb.).
