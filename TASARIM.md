# Tasarım / Görsel Varlık Kontrol Listesi

Kedi temalı içerik güncellemesiyle birlikte eklenen ve ileride
güçlendirilebilecek görsel öğelerin listesi. "Yapıldı" olanlar kod içinde
elle çizilmiş SVG olarak mevcut (harici görsel/telif riski yok); "Beklemede"
olanlar gerçek illüstrasyon/asset gerektirir ve şu an yer tutucu ya da eksik.

## Karakterler

| Karakter | Bölge | Durum | Not |
|---|---|---|---|
| Duman (rehber) | İstanbul | ✅ SVG avatar (cat-avatar.ts) | İsteğe bağlı: tam gövde illüstrasyon (intro ekranı için) |
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

**Beklemede (ileri aşama, isteğe bağlı):**
- Kediler için tam gövde / oturan poz illüstrasyonu (şu an sadece baş/büst).
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
| Bölge haritası (Anadolu üzerinde ilerleme görselleştirmesi) | ⏳ Beklemede — [[cengel-content-strategy]]'deki "harita üzerinde açılma" fikri henüz uygulanmadı |

## Kutu / kart bileşenleri (mevcut stil sistemi)

Tüm yeni bileşenler mevcut CSS değişken sistemini (`--surface`, `--radius`,
`--shadow`, `--accent` vb.) kullanıyor; hem modern hem gazete temada otomatik
uyumlu:
- `.cats-teaser` — ana menüde koleksiyon özeti kartı
- `.cat-card` — koleksiyon ızgarasındaki tekil kedi kartı (kilitli/açık)
- `.cat-modal` / `.cat-reveal-tag` — detay ve kutlama modalı
- `.puzzle-cat-badge` — bulmaca listesindeki mini kedi rozeti
- `.intro-screen` — hikaye anlatım ekranı

## Ses / haptik

- Kedi açılma anı şu an sadece görsel (confetti + pop animasyonu) +
  mevcut `playWin()` sesini kullanıyor. **Beklemede:** ayrı bir "miyav" sesi
  (`src/sound.ts`'e eklenebilir) kedi açılma anına özel bir dokunuş katar.

## Uygulama ikonu / marka varlıkları

- `public/favicon.svg` ve Android `ic_launcher*` dosyaları hâlâ Capacitor
  varsayılanı — **Beklemede.** Duman temalı bir app icon / favicon / splash
  screen tasarımı henüz yapılmadı, bu görsel kimlik güncellemesinin kapsamı
  dışında bırakıldı (Android kaynak dosyalarını değiştirmek ayrı bir adım).

## Öncelik önerisi (isteğe bağlı sonraki adımlar)

1. Duman temalı app icon + favicon (marka kimliği için en görünür eksik).
2. Kedi açılma anına özel ses efekti.
3. Bölge haritası ekranı (uzun vadeli, puzzle sayısı arttıkça daha anlamlı).
4. Kedilerin tam gövde illüstrasyonu (yalnızca kozmetik zenginleştirme).
