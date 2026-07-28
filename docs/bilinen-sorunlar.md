# Bilinen Sorunlar

Playtest sırasında görülüp henüz düzeltilmemiş sorunlar. Her madde bulundukça
buraya eklenir, düzeltilince kaldırılır veya "✅ düzeltildi" olarak işaretlenir.

## 2026-07-28 playtest

1. **✅ düzeltildi** — "Haftanın üçüncü günü" ipucunun cevabı yanlıştı
   (Amerikan hafta başlangıcına göre hesaplanmış: Pazar=1, Pazartesi=2,
   Salı=3). İpucu metni "Haftanın ikinci günü" olarak değiştirildi (Türk
   sisteminde Pazartesi=1, Salı=2 — cevap SALI olarak kaldı, sadece soru
   metni düzeltildi). Değişiklik hem `tools/dictionary.mjs`'teki SALI
   girdisine hem zaten üretilmiş 6 bulmaca dosyasına
   (`bulmaca-104/117/12/174/46/87.json`) uygulandı.

2. **✅ düzeltildi** — Yazı/kutu boyutu, ızgaranın gerçek boş dikey+yatay
   alanına göre değil sabit bir "390px" tahminine göre hesaplanıyordu.
   `App.sizeGrid()` (ui.ts) artık `.grid-wrap`'in gerçek ölçülen alanına göre
   genişliği hesaplıyor (yükseklik hücrelerin aspect-ratio:1 özelliğinden
   otomatik türüyor); harf punto'su `cqw` birimine geçirildi; soru
   yazılarının punto sığdırma mantığı (`fitClueTexts`) artık sadece
   küçültmüyor, büyük kutularda gerçekten büyüyor da.

3. **✅ düzeltildi** — Harf girişleri zaten kaydediliyordu ama uygulamaya
   her dönüşte imleç "ilk boş hücre"ye sıçrıyordu; kullanıcı kaldığı yeri
   kaybetmiş gibi hissediyordu. `game.ts`'teki kayıt biçimi artık
   `{entries, selRow, selCol, activeClue}` içeriyor (eski düz-dizi
   kayıtlarla geriye dönük uyumlu), `ui.ts`'teki `openPuzzle` kaydedilmiş
   imleç varsa onu koruyor. Ayrıca "Günün Bulmacası" kartına da yarım kalan
   ilerleme çubuğu ve "Devam et" etiketi eklendi (önceden sadece bulmaca
   listesinde vardı).

4. **✅ düzeltildi (asıl hata yoktu)** — `music.ts`/`sound.ts`'teki aç/kapat
   mantığı test edildi (`play()`/`pause()` doğru tetikleniyor, localStorage
   doğru güncelleniyor); gerçek bir bozukluk bulunamadı. Kontrol sadece
   Ayarlar ekranındaki "Müzik" satırından yapılabiliyor — bilinçli tercih
   bu şekilde kalması (ana sayfaya ayrıca bir ses butonu eklenmedi).
