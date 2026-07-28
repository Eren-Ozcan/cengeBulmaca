# Bilinen Sorunlar

Playtest sırasında görülüp henüz düzeltilmemiş sorunlar. Her madde bulundukça
buraya eklenir, düzeltilince kaldırılır veya "✅ düzeltildi" olarak işaretlenir.

## 2026-07-28 playtest

1. **"Haftanın üçüncü günü" ipucunun cevabı yanlış (Amerikan hafta
   başlangıcına göre hesaplanmış)**
   Cevap "SALI" olarak girilmiş; bu yalnızca haftanın Pazar günüyle
   başladığı Amerikan sistemine göre doğru (Pazar=1, Pazartesi=2, Salı=3).
   Türkiye'de hafta Pazartesi ile başlar, bu yüzden üçüncü gün "ÇARŞAMBA"
   olmalı. Aynı bulmaca setinde "Haftanın son günü" → "PAZAR" cevabı zaten
   doğru (Türk sistemine göre hafta Pazar ile bitiyor), yani sorun sadece
   "üçüncü gün" ipucunda.
   Etkilenen dosyalar: `src/puzzles/bulmaca-104.json`,
   `bulmaca-117.json`, `bulmaca-12.json`, `bulmaca-174.json`,
   `bulmaca-46.json`, `bulmaca-87.json` (6 bulmaca, hepsinde
   "Haftanın üçüncü günü" → "SALI").
   Not: "ÇARŞAMBA" 8 harf olduğu için mevcut bulmaca ızgaralarına
   muhtemelen sığmıyor — düzeltme, cevabı değiştirmek değil ipucu metnini
   ("Haftanın üçüncü günü" yerine "SALI"ya uyan başka bir ipucu) değiştirmeyi
   gerektirebilir.

2. **Yazı boyutu hâlâ çok küçük, kutular tam ekran değil**
   Bulmaca ızgarası/kutuları ve metinler ekranı tam kullanmıyor; klavye
   açıkken tam ekran olması beklenmez ama klavye kapalıyken kutular ve
   yazılar ekranın tamamına yakın büyümeli. `src/style.css` ve `src/ui.ts`
   içindeki ızgara/font boyutlandırma mantığına bakılmalı.

3. **Yarım kalan bulmacaya devam edilemiyor**
   Oyundan çıkıp tekrar girildiğinde, yarıda bırakılan bulmacanın kaldığı
   yerden devam etmesi bekleniyor; şu an bu çalışmıyor. `src/game.ts`
   içindeki ilerleme kaydetme/yükleme mantığına bakılmalı.

4. **Ana menüdeki ses kısma tuşu işe yaramıyor**
   Ana menüden sesi kısma/kapatma kontrolü tıklandığında etkisi olmuyor
   gibi görünüyor. `src/music.ts` içindeki mute/volume kontrolüne
   bakılmalı.
