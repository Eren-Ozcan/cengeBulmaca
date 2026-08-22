# Dictionary source data

Working files for expanding `tools/dictionary.mjs` (zero-duplicate-clue
project, started 2026-08-15). Not used at runtime — reference material for
hand-reviewing new dictionary entries across sessions.

## 5letter-tdk-candidates.tsv — DONE (2026-08-17)

All 3696 lines have been hand-reviewed; 1557 new 5-letter words were
added to `dictionary.mjs` (751 -> 2308 total). No further action needed
on this file for the 5-letter category — it's kept only as a provenance
record. The next dictionary-expansion work should pull a fresh candidate
list for a different word length (2/3/4/6/7 letters) using the same
`extract5.mjs`-style script pattern (see git history for the extraction
scripts if they're needed again — they were run from the scratchpad and
not committed, only the output TSV was).

## 6letter-tdk-candidates.tsv — DONE (2026-08-19)

All 6015 candidates have been hand-reviewed; 1402 new 6-letter words were
added to `dictionary.mjs` (54 -> 1456 total). Kept only as a provenance
record. Extraction script: `tools/dict-sources/extract6-detail.mjs`.

## 7letter-tdk-candidates.tsv — DONE (2026-08-19)

7917 candidates extracted with `tools/dict-sources/extract7-detail.mjs`
(same source/filter as the 6-letter file, just `len === 7`) and fully
hand-reviewed; 1239 new 7-letter words were added to `dictionary.mjs`
(33 -> 1272 total).

Both passes used the same pre-filter before hand review: drop entries
tagged `esk.`, `ağz.`, `argo`, `tkz.`, `hlk.`, plus verbal nouns whose
definition is just "…mak işi/durumu". After every batch the whole
dictionary is re-checked for duplicate answers, clue texts longer than
3 words and clue-text collisions between different answers (all zero).

**Clue style going forward: write clues at ≤4 words from the start**
(prefer 1-3 words, synonym-pairs or short noun-phrases) — matching the
real çengel bulmaca style confirmed in a prior session by sampling
hurriyet/haberturk/posta bulmaca pages. Do NOT write long descriptive
clues and shorten them in a second pass — that's what happened with
lengths 2-5 and required a large separate compression pass afterward.

General format/process notes below (written for the 5-letter pass, same
rules apply to 6 and future lengths):

Tab-separated `WORD\tözellik-kısaltmaları\tTDK-tanımı`, one line per
candidate. Sourced from TDK's *Güncel Türkçe Sözlük* (12th edition,
~99,236 madde) via the [ogun/guncel-turkce-sozluk](https://github.com/ogun/guncel-turkce-sozluk)
GitHub dataset (`sozluk/v12/v12.gts.json.tar.gz`, fetched via
`gh api repos/ogun/guncel-turkce-sozluk/git/blobs/<blob-sha> -H "Accept: application/vnd.github.raw"`
— the plain raw.githubusercontent.com URL 429'd during this session),
filtered to:
- single-word entries (no spaces/hyphens/apostrophes)
- exact target length
- not a proper noun (`ozel_mi != "1"`)
- not already present as an answer of that length in `tools/dictionary.mjs`
  at extraction time

Review process: skip dialectal (`ağz.`), archaic (`esk.`), slang (`argo`/`tkz.`),
sensitive/dark topics (profanity, slurs, drugs, violence, religious-sensitive),
and overly narrow technical/regional entries unless the word is still commonly
known; keep common, unambiguous, puzzle-appropriate words. When TDK's captured
sense is an obscure secondary meaning for a very well-known word, write the
word's actual well-known meaning instead of parroting TDK's pick. Write a
short (≤4 words) clue derived from the definition — not a copy-paste of the
full TDK text. Check for duplicate answers and duplicate clue text against
the rest of `dictionary.mjs` before committing (read WORDS, group by `c[]`
text, flag any answer collision — see git history of `dictionary.mjs` for
the exact node one-liners used throughout this project).

This file is a static snapshot — words added to `dictionary.mjs` are **not**
removed from it. To find what's left to review for a given range, diff
against the current answer set in `tools/dictionary.mjs`.

## Sıfır tekrar projesi — 2026-08-19 durumu

Amaç: 300 bulmacada aynı ipucu metninin tekrarlanmaması. Bu oturumda yapılanlar:

- `tools/generate.mjs` küresel ipucu takibi kazandı (`createTracker` /
  `commitToTracker`): 300 bulmacalık üretim boyunca hangi metnin kaç kez
  kullanıldığı izleniyor, doldurucu az kullanılmış kelimeleri önceliyor ve aynı
  maske için birkaç doldurma denenip en az tekrar üreteni seçiliyor.
- Doldurucu bit maskesi dizinine taşındı; 6600 kelimelik sözlükle bulmaca başına
  süre ~0,2 sn.
- Yeni `shortenShortRuns` geçişi 2 harfli blokları seyreltiyor (soruların
  %31'inden %5'ine). 2 harfli Türkçe kelime sayısı çok az olduğu için tekrarın
  asıl kaynağı buydu.
- `tools/regenerate-all.mjs` ile 300 bulmaca tek seferde, ortak takipçiyle
  yeniden üretiliyor (id/başlık/satır/sütun/zorluk/sıra korunur).
- Sözlük: 2 harfli katman elden geçti (kimya simgesi girdileri çıkarıldı,
  81 kelime / 260 ipucu). 3 harfli katmanda 128 kelime çoklu ipucuya çevrildi.

Ölçüm (300 bulmaca, 8087 soru): 4304 farklı ipucu metni. Uzunluğa göre en çok
tekrar: len2 6, len3 14, len4 6, len5 7, len6 7, len7 7. Başlangıçta tek bir
metin 50 kez tekrarlanıyordu.

## 2026-08-20 — 3 harfli katman tamamlandı

3 harfli 434 kelimenin tümü artık en az 3 (çoğu 4) ipuçlu; 305 kelimeye elden
ipucu yazıldı. Kontroller için `node tools/check-dictionary.mjs` eklendi: farklı
cevaplarda aynı ipucu metni, 4 kelimeden uzun ipucu ve tekrar eden cevap sayar,
üçü de 0 değilse sıfırdan farklı çıkışla biter.

Yeniden üretim sonrası ölçüm (300 bulmaca, 8100 soru): 5021 farklı ipucu metni
(önce 4304). Uzunluğa göre en çok tekrar: len2 4, len3 7, len4 8, len5 7,
len6 7, len7 7.

## 2026-08-20 — sıfır tekrar kuralı ve 83 bulmacalık set

Kural değişti: artık aynı **cevap** tüm sette yalnızca bir kez çıkabiliyor, yani
aynı soru iki bulmacada görünmüyor. Bunun sonuçları:

- `tools/generate.mjs` strict modu (`createTracker({ strict: true })`,
  `node tools/regenerate-all.mjs --strict`): kullanılmış cevap doldurucuya bir
  daha aday verilmiyor, maske takipçide tutulduğu için doldurma başına maliyeti
  yok.
- `MIN_WORD_LEN` 4 oldu — 2 ve 3 harfli cevaplar kalktı. Türkçede ~400 kullanışlı
  3 harfli kelimeye karşılık ~1700 slot gerekiyordu, benzersizlik matematiksel
  olarak imkânsızdı. `thinThreeRuns` kalan en kısa blokların yarısını da
  uzatarak talebi 5-7 harfli katmanlara kaydırıyor.
- 4 harfli katman elden geçti: 1065 kelimenin tamamı 4 ipuçlu yapıldı, sonra
  116 yeni kelime eklendi (şu an 1181). Benzersiz cevap rejiminde kelime başına
  tek ipucu yettiği için fazladan ipuçları yalnızca çeşitlilik sağlıyor.
- 3 harfli katmandan 40 zorlama kelime (İKA, İTA, ATU, CIS...) tamamen silindi.

Kapasite: bulmaca başına ~7,5 dört-harfli cevap tükeniyor, yani üretilebilecek
bulmaca sayısı ≈ (4 harfli kelime sayısı) / 7,5. Bulmaca sayısı 300'den önce
150'ye indirildi, strict koşu 83 bulmacada elle durduruldu (havuz daraldıkça
bulmaca başına süre dakikalara çıkıyor).

**Şu anki set:** 83 bulmaca, 1684 soru, 1684 farklı cevap, 1684 farklı ipucu —
`node tools/check-puzzles.mjs` ile doğrulanıyor, tekrar sayısı sıfır.

**Kaldığımız yer:** bulmaca sayısını artırmanın tek yolu sözlüğe gerçekten
bilinen 4 harfli kelime eklemek (her ~7,5 kelime = 1 bulmaca). Ekledikçe
`node tools/regenerate-all.mjs --strict` yeniden çalıştırılmalı; koşu uzun
sürüyor, arka planda bırakmak gerekiyor. Her partiden sonra
`node tools/check-dictionary.mjs`, üretim sonrası `node tools/check-puzzles.mjs`,
ardından `npm run puzzles:manifest` ve `npx vitest run`.

## 4letter-tdk-candidates.tsv — 2026-08-21 çıkarıldı, inceleme bekliyor

`extract4-detail.mjs` ile çıkarıldı. 5/6/7 harfli geçişlerden iki farkı var:

- Özel isimler atılmıyor, ayrı `4letter-tdk-proper.tsv` dosyasına yazılıyor (70
  madde). Çengel bulmacada il/ilçe adları da cevap oluyor, kendi başına
  değerlendirilecek bir havuz.
- `bak!` gibi ünlem maddeleri eleniyor.

Çıktı: 938 yeni aday (sözlükte 1181 dört harfli cevap varken). Aynı ön filtre
(`esk.` / `ağz.` / `argo` / `tkz.` / `hlk.` + "…mak işi/durumu") 333 tanesini
eliyor, geriye 607 kalıyor.

**Not:** 6 ve 7 harfli çıkarma scriptlerindeki `existing` regex'i
`[A-ZÇĞİIÖŞÜ]+` idi ve düzeltme işaretli harfleri kaçırıyordu (DÜKKÂN, MAHKÛM,
HAKÎ dahil 21 cevap sözlükte görünmüyordu). Üçünde de `[^"]+` ile düzeltildi.

## 4letter-review-worklist.tsv — elden inceleme sırası

607 ön-filtreli adayın, gerçek çengel bulmacalarda ne sıklıkta cevap olduğuna
göre sıralanmış hâli. Format: `KELİME\tsıklık\tözellik\tTDK-tanımı`.

Sıklık verisi Hürriyet'in günlük çengel bulmaca arşivinden geliyor. Arşiv dört
dizine yayılmış, tarih sayfası üzerinden değil doğrudan numarayla taranıyor:

```
s.hurriyet.com.tr/dinamik/bulmaca/bulmaca1509202/cengel/Çengel (1..303).html
s.hurriyet.com.tr/dinamik/bulmaca/cengel06052020/cengel-(11..20).html
s.hurriyet.com.tr/dinamik/bulmaca/cengel12052020/cengel-(021..200).html
s.hurriyet.com.tr/dinamik/bulmaca/cengel/(1..100).html
```

Her sayfada `_PUZZLE_DATA` adlı base64 değişken var; çözülünce
`{size, puzzleData:[{clue:{text,x,y}, answer:{text,x,y}, direction}]}` çıkıyor.
593 benzersiz bulmaca, 22.361 soru, 5409 farklı cevap toplandı (2026-08-21).

Tarih sayfaları (`/bulmaca/gunluk-cengel-bulmaca-<gün>-agustos-2026/`) bu
dosyalara yönlendiriyor ama haftalık döngüyle tekrar ediyor — ağustosun 40
sayfası yalnızca 20 farklı bulmaca veriyordu, o yüzden doğrudan arşiv taranıyor.

Sıklığın anlamı: 607 adayın 203'ü gerçek bulmacalarda cevap olarak geçmiş, yani
"gerçekten kullanılan kelime" olduğu kanıtlı — inceleme bunlardan başlamalı.
Kalan 404'ü hiç geçmemiş, daha dikkatli değerlendirilmeli.

Sıklık listesindeki kelimelerin 206'sı TDK'da hiç yok (ABAR, İARE, EKAL, UKBA
gibi klasik "bulmaca jargonu" ve EİRE/AARE/LENA gibi coğrafya adları). Bunlar
bilerek alınmadı — proje kuralı yaygın ve bilinen kelime; 3 harfli katmandan da
aynı gerekçeyle 40 zorlama kelime silinmişti.

**Hürriyet'in ipucu metinleri kopyalanmaz.** Sıklık verisi kelime seçimi için
bir sinyal; ipuçları her zaman kendimiz yazılır.

### Tur 10, parça 1 — worklist'in ilk 100 satırı (2026-08-21)

78 kelime `dictionary.mjs`'e eklendi, 4 harfli katman 1181 → 1259
(tavan 151 → 161). `check-dictionary.mjs` temiz: paylaşılan ipucu 0, 4
kelimeden uzun ipucu 0, tekrar eden cevap 0.

Eklerken altı ipucu çakışması çıktı ve yeniden yazıldı: SABA/NEVA, OKEY/REMİ,
İKAZ/İHTAR, VAZO/SAKSI, ELİT/GÜZİDE, sonra VAZO/TARH.

Elenen 22 kelime — bir daha değerlendirilmesin diye:

- Fazla dar teknik/bölgesel: OKAR, ÇUKA, AKAK, RAMİ, RİNA, SKİF, LUTR, REYE,
  AGEL, BREŞ, BUAT, FOŞA, JİPS, AKSE, STEN
- Zayıf/gramer kalıbı ya da yaygın biçimi başka: KALA, YUMA, ANCA, DANE, EMAY
- Argoya yakın ünlem: KEKA
- Özel ada çok yakın: İNAL

Sıradaki parti worklist'in 101. satırından başlar. Sözlük her partide
büyüdüğü için bir sonraki turdan önce `regenerate-all.mjs --strict` koşmaya
gerek yok — birkaç parti biriktikten sonra tek seferde koşmak daha verimli.

### Tur 10, parça 2 — worklist'in 101-200. satırları (2026-08-21)

65 kelime eklendi, 4 harfli katman 1259 → 1324 (tavan 161 → 169).
`check-dictionary.mjs` temiz. Beş ipucu çakışması yeniden yazıldı:
ÜLEŞ/HAK, FONT/PİK, ULAK/PEYK, TIPA/TAPA, AMİL/FAKTÖR.

Bu partide sıklık 3'ten 1'e düşüyor, yani kanıt zayıflıyor ve eleme oranı
belirgin şekilde artıyor — ilk 100'de 22 elenmişti, burada 35.

Elenen 35 kelime:

- Fazla dar teknik/bölgesel: FUTA, KOSA, MARN, SAGU, BRİK, GALİ, GETR, HASA,
  ÖNEL, ACUR, ÇAÇA, EKRU, KOFA, RODA, ROZA, SİLİ, ŞASE
- Genel dilde tanınmayacak kadar seyrek: ASAN, ÇIKI, DİYA, EBET, İMİK, ÜREM,
  ÜRKÜ, BÖKE, TROK, ARAZ
- Yaygın biçimi başka yazılıyor: MASK (maske), HAMT (hamd)
- Gramer kalıbı/zamir: ÜZRE, NESİ
- Kumar terimi: MİZA, VİDO, TAPİ
- Dinî hassas içerik: GAZA

Sıradaki parti 201. satırdan başlar.

### Tur 10, parça 3 — worklist'in 201-300. satırları (2026-08-21)

29 kelime eklendi, 4 harfli katman 1324 → 1353 (tavan 169 → 173). 71 eleme.

Bu aralıkta sıklık sıfırlanıyor (204. satırdan itibaren hiçbiri gerçek
bulmacada geçmemiş) ve liste alfabetik sıraya düşüyor; eleme oranı %71'e
çıktı. Kabul edilenler ağırlıkla sıklık verisinden bağımsız olarak zaten
yaygın bilinen kelimeler: BORU, DEVE, BÜYÜ, AĞRI, ÇIPA, DART, DEMO, AMİP.

Elenenlerin ana grupları: dar teknik/denizcilik/kimya terimleri (ABLİ, AŞOZ,
AZİT, AZOL, BARA, APEL, ACYO), yalnızca sözlükte kalmış türemiş sıfatlar
(ADLI, AKLI, AĞLI, AYLI, ALLI, AĞSI), ses yansımaları (CART, CIRT) ve
anatomik/hassas maddeler (ANAL, ANÜS, APIŞ).

**Düzeltme işaretli adaylar alınmadı.** Oyunun ekran klavyesinde (`KEY_ROWS`,
`src/ui.ts`) Â/Î/Û tuşu yok, dolayısıyla bu harfleri taşıyan bir cevap
çözülemiyor. ÂCİZ/ÂDET/ÂLEM/ÂLİM/ÂMİN/DÂHİ'nin düz yazımları zaten sözlükte
var; ÂKİT ile ÂŞIK düz yazımla (AKİT, AŞIK) eklendi.

Sıradaki parti 301. satırdan başlar.

### Tur 10, parça 4 — worklist'in 301-400. satırları (2026-08-21)

29 kelime eklendi, 4 harfli katman 1352 → 1381 (tavan 173 → 177). 71 eleme.

Kabul edilenler yine sıklıktan bağımsız olarak tanınan kelimeler: GIDA, GREV,
GRİP, FÜZE, FOTO, FRAK, İYON, İGLU, HOBİ, HİBE, DİVA, EDAT.

Elenenlerin ana grupları: ses yansımaları ve ünlemler (FIRT, GIRT, HART, HINK,
HÖST, GİDİ, GIGI), yalnızca sözlükte kalmış türemiş biçimler (EKLİ, EŞLİ,
İĞSİ, İPSİ, İSLİ, EVCE, ERCE, İTÇE), dar teknik maddeler (EPER, GREN, GALE,
GANG, FİŞE, DREÇ, DROG, İKSA), oyun/zar terimleri (DÜSE, GELE).

Hassas içerik nedeniyle elenenler: İBNE (TDK'da `kaba` etiketli hakaret),
FERÇ ve EROS.

Düzeltme işaretli adaylar yine alınmadı: EHLÎ, EMÎR, FÂNİ, HÂKÎ, HÂLÂ, HAYÂ,
İLMÎ. Gerekçe için bir önceki parçaya bakın.

Sıradaki parti 401. satırdan başlar.

### Tur 10, parça 5 — worklist'in 401-607. satırları (2026-08-21, liste bitti)

85 kelime eklendi, 4 harfli katman 1381 → 1466 (tavan 177 → 187).
607 satırlık worklist tamamen incelendi.

Kabul edilenler arasında beklenmedik biçimde çok sayıda gündelik kelime çıktı;
sıklık verisinin sıfır olması bunların bilinmediği anlamına gelmiyor, yalnızca
taranan 593 bulmacada cevap olarak seçilmemiş olduklarını gösteriyor:
UÇAK, MAAŞ, SENE, VEYA, ŞARJ, SODA, SİLO, MONT, KAFE, OZAN, ÖĞLE, TAZI.

İki kelime düzeltme işareti kaldırılarak alındı: KÂSE → KASE, KÂFİ → KAFİ
(düz yazımları boştu). KÛFİ, EHLÎ, İLMÎ alınmadı — düz yazımları da yeterince
tanınan kelimeler değil.

RAKI kabul edildi: sözlükte ŞARAP, BİRA, VOTKA, VİSKİ, KONYAK, LİKÖR, MEYHANE
zaten var, ayrı bir ölçüt uygulamak tutarsız olurdu.

Hassas içerik nedeniyle elenenler: PUŞT ve LUTİ (TDK'da `kaba` etiketli
hakaretler), SEKS, MENİ, ZİNA, ŞİRK, PEPE (kekemeliği tanımlıyor), KOKA
(kokain kaynağı bitki).

Sıklık verisinin bittiği 204. satırdan sonra eleme oranı %70 civarında
sabitlendi:

| aralık  | kabul | eleme | 4 harfli | tavan |
|---------|-------|-------|----------|-------|
| 1-100   |    78 |    22 |     1259 |   161 |
| 101-200 |    65 |    35 |     1324 |   169 |
| 201-300 |    29 |    71 |     1353 |   173 |
| 301-400 |    29 |    71 |     1381 |   177 |
| 401-607 |    85 |   122 |     1466 |   187 |

Toplam: 607 aday, 286 kabul, 321 eleme. Başlangıç 1181 idi.

**Sırada:** sözlük tarafı bu turda tükendi — TDK'nın 4 harfli havuzunda
incelenmemiş aday kalmadı. Kapasiteyi daha ileri götürmek için
`node tools/regenerate-all.mjs --strict` koşup pratikte kaç bulmaca çıktığını
ölçmek gerekiyor; tavan 151'den 187'ye çıktığı için 83 bulmacanın belirgin
şekilde üstüne çıkması bekleniyor.

## Tur 11 — kaynakların tüketilmesi (2026-08-21)

### Hürriyet kapsam doğrulaması

2025 ve 2026'nın on iki ayından beşer gün × iki varyant = 240 günlük sayfa
tarandı; bulmaca içeren 151 sayfanın tamamı zaten çekilmiş dört çengel dizinine
işaret ediyor. Hürriyet'in çengel arşivi 593 bulmacayla tamamlanmış durumda.

### Kare bulmaca arşivi (yeni kaynak, düşük verim)

```
s.hurriyet.com.tr/dinamik/bulmaca/kare12052020/kare-(021..200).html
s.hurriyet.com.tr/dinamik/bulmaca/kare06052020/kare-(11..20).html
```

Aynı `_PUZZLE_DATA` yapısı, tek farkı `puzzleData` içindeki `answer`/`clue`
alanlarının nesne değil düz metin olması. 190 benzersiz bulmaca, 5723 soru.
4 harfli 311 "yeni" cevap çıktı ama TDK destekli olanların tamamı zaten
938'lik listedeydi; geri kalanı kısaltma ve jargon (TCDD, İETT, UEFA, AAMU).

### posta.com.tr arşivi (yeni kaynak, düşük verim)

```
www.posta.com.tr/bulmaca-coz/cengel/<gg>-<ay>-<yyyy>-cengel-bulmaca
```

Veri sayfaya gömülü Crossword Compiler XML'i; `<word id x y solution="...">`
etiketleri cevapları doğrudan veriyor. 2023-2026 arası 1329 tarih denendi,
710 benzersiz bulmaca, 29.171 cevap toplandı. 4 harfli 313 yeni cevabın 190'ı
TDK listesinde (yani ya incelenmiş ya ön filtrede), 123'ü TDK'da hiç yok —
bunlar da özel ad, kısaltma ve para birimi: LENA, UTAH, NASA, CORK, GANA,
EURO, KYAT, TCDD, FIFA.

### 4letter-round2-worklist.tsv

Üç arşiv birleştirildi: 1493 bulmaca, 1736 farklı 4 harfli cevap. Sözlükte
olmayan 713 cevabın dağılımı:

- 161 — TDK'da var, ön filtre elemiş, hiç incelenmemiş → bu worklist
- 111 — birinci turda incelenip reddedilmiş
- 441 — TDK'da hiç yok (jargon, özel ad, kısaltma)

161'i elden geçirildi: **14 kabul, 147 eleme.** Kabul edilenler bugün hâlâ
gerçekten kullanılan `esk.` kelimeler: AKİL, AKİM, ASRİ, BEİS, CAKA, ELİM,
FEZA, İZAN, LİME, LİNK, NAAŞ, NAME, ŞARK, TALİ. (LİNK'in TDK'daki anlamı atın
yürüyüşü; kelimenin bugünkü bilinen anlamı yazıldı.)

Geri kalanı ya bulmaca jargonu (İARE, İHAM, İSAL, LAİN, KAİL) ya ağız (BALA,
APAZ, EMMİ, KEME) ya da fiil adı (ALMA, YEME, UMMA).

4 harfli katman 1466 → 1480, tavan 187 → 189.

### Sonuç: kelime kaynağı tükendi

TDK'nın 4 harfli havuzunda (938 aday) incelenmemiş kelime kalmadı. Üç ayrı
bulmaca arşivinde (1493 bulmaca, 57 bin soru) geçen ve sözlükte olmayan her
4 harfli cevap ya incelendi ya da TDK'da bulunmadığı için elendi.

Bundan sonrası artan getiri vermiyor: ikinci tur 161 adaydan yalnızca 14
kelime ve tavana 2 bulmaca ekledi. Kapasiteyi büyütmenin kalan yolu kelime
aramak değil, üretim tarafı.

## Tur 12 — özel adlar, kısaltmalar, para birimleri (2026-08-21)

Klasik çengel bulmacanın standart malzemesi; TDK'da sözcük maddesi olmadıkları
için ilk turlarda havuz dışında kalmışlardı. Üç arşivde de geçtikleri
doğrulanarak 67 kelime eklendi, 4 harfli katman 1480 → 1547 (tavan 189 → 198).

- Türkiye'den 25 ilçe/yer adı (FOÇA, ŞİLE, URLA, SOMA, HOPA…). Çoğu daha önce
  hiç açılmamış `4letter-tdk-proper.tsv` dosyasından geldi; oyunun Türkiye
  haritası temasıyla da örtüşüyorlar.
- Dünyadan 15 yer adı, 12 halk/mitoloji adı, 7 kısaltma, 8 para birimi.

Alınmayanlar: kişi adları, çok küçük ilçeler (İLİÇ, KİĞİ, GÜCE, AĞIN), iç
politika ve din hassasiyeti taşıyanlar (NAZİ, KÂBE, OĞAN, HÜDA).

## Kapasite ölçümü (2026-08-21/22)

`tools/grow-puzzles.mjs` ile ölçüldü. Sonuç, projenin kapasite modelini
değiştiriyor:

- Varsayılan arama gayretiyle (`--tries=8 --giveup=12`) koşu **88 bulmacada**
  duruyor ve sözlüğün yarısından fazlası kullanılmamış oluyor.
- `--tries=40 --giveup=40` ile aynı sözlük **125+ bulmaca** veriyor.

Yani darboğaz kelime sayısı değil, doldurma aramasının erken pes etmesiydi.
366 kelime eklemek 83 → 88 getirmişti (5 bulmaca); iki parametreyi büyütmek
42 bulmaca getirdi. Strict mod kullanılan kelimeyi havuzdan tamamen çıkardığı
için yaygın harf desenleri erken tükeniyor ve doldurma, sözlükte binlerce
kelime dururken tıkanıyor.

Yayındaki set şu an **125 bulmaca, 2575 soru**, sıfır tekrar korunuyor.
Katman tüketimi:

```
4 harf: 1018/1547  %66   (8.14/bulmaca)
5 harf:  712/2308  %31   (5.70/bulmaca)
6 harf:  471/1456  %32   (3.77/bulmaca)
7 harf:  374/1272  %29   (2.99/bulmaca)
```

**Dikkat — kısmi koşu tuzağı:** `--apply` koşusu yarıda kesilirse ya da bir
bulmaca üretilemezse o dosya *eski içeriğiyle* kalır ve eski takipçiyle
kurulduğu için yeni setle çakışır. Bu bir kez yaşandı: puzzle-67 üretilemedi,
16 cevap/ipucu tekrarı doğdu. Çözümü, o bulmacayı diğerlerinin tamamıyla
doldurulmuş bir takipçiye karşı tek başına yeniden üretmek. Her `--apply`
koşusundan sonra mutlaka `node tools/check-puzzles.mjs` çalıştırın.

## Sözlük stoğunun gerçek durumu

TDK Güncel Türkçe Sözlük v12'de 4 harfli 2163 madde var; 34'ü boşluk/tire
içeriyor, 105'i özel isim, geriye **2071 temiz tek kelime** kalıyor.

Sözlüğümüzdeki 1547 dört harfli cevabın 1472'si TDK'da, 75'i bizim eklerimiz
(kısaltma, para birimi, TDK'nın madde başı farklı olanlar).

**TDK'da olup sözlükte olmayan 633 kelime var** — bunlar incelenmemiş değil,
kalite ölçütüne takılıp *reddedilmiş* kelimeler. Tam listesi tag ve arşiv
sıklığıyla `4letter-remaining-rejected.tsv` içinde: 170'i `esk.`, 82'si `ağz.`,
7'si `argo`, 370'i etiketsiz (çoğu dar teknik madde veya fiil adı). 252'si üç
arşivde gerçekten cevap olarak geçmiş.

Kapasite karşılığı:

- şu anki 1547 kelime → tavan 190 bulmaca
- 633'ün tamamı alınırsa 2180 → tavan 267
- 300 bulmaca için 2442 gerekiyor; TDK'nın tamamı alınsa bile yetmiyor

## Kaldığımız yer (2026-08-22)

Kullanıcının kararını beklediğimiz açık soru: 4 harfli kalite çıtası nerede
duracak?

1. **Çıta aynı** — tavan 190, şu an 125, 65 bulmaca kovalanacak
2. **Orta çıta** — hassas içerik ve fiil adları dışarıda; arkaik ama arşivlerde
   gerçekten geçen kelimeler alınır (`4letter-remaining-rejected.tsv` içinde
   sıklığı > 0 olan 252 satır bu grubun adayı)
3. **Çıta düşük** — 633'ün tamamı, tavan 267

Karar ne olursa olsun sıradaki teknik adım aynı: `node tools/grow-puzzles.mjs
--tries=40 --giveup=40 --apply` koşusunu parça parça sürdürmek (harness uzun
koşuları sonlandırıyor), her turdan sonra `check-puzzles.mjs` →
`npm run puzzles:manifest` → `npx vitest run` ve commit.

Sıfır tekrar kuralının gevşetilmesi kullanıcı tarafından açıkça reddedildi;
gerçek yayımlanmış bulmacaların cevap başına 2.87 kez tekrar ettiği ölçülmüş
olsa da bu yol kapalı.

## Tur 13 — 633'lük artık listenin elden geçirilmesi (2026-08-22)

`4letter-remaining-rejected.tsv`'deki 632 madde tek tek okundu. Alınan 24
kelime:

```
ACUR NATO SELA ŞİRK
ADLI ALIŞ BARK DARP EKLİ EŞLİ FİNK GAZA KALA NECİ
OLEY OLUŞ ONAR OTLU POPO ULAN UÇLU İLLE İSLİ ZİNA
```

Kalan 608'in dağılımı: 252 `esk.`/`ağz.` etiketli, 216 salt yönlendirme
(`RİNA ► tırpana` gibi), 51 fiil-isim (`ÖPÜŞ`, `UMUŞ`), 39 düzeltme işaretli
(klavyede yazılamıyor), gerisi bitki/balık/denizcilik jargonu (`RAMİ`, `FOŞA`,
`AŞOZ`) ve hiç bilinmeyen maddeler (`ACVE`, `BOCİ`, `DÜSE`).

Dört harfli katman 1547 → 1571. **Kelime kaynakları bu noktada tamamen
tükendi.**

## Kapasite: tavan tahmini gerçeği yansıtmıyor (2026-08-22)

Önceki ölçüm koşusu 190-193 bulmacalık bir tavan söylüyordu. Gerçek üretim bunu
doğrulamadı:

- `--tries=40 --giveup=40 --apply` koşusu ~2,5 saat CPU harcayıp yalnızca 13
  yeni bulmaca ekledi. 163-210 arası 48 numara denendi, 13'ü tuttu.
- Son aşamada bulmaca başına süre 10 dakikayı aştı; koşu elle durduruldu.

Yani sınır sözlük değil, doldurma aramasının maliyeti. Set 125 → 134'e çıktı
(2738 soru).

**Kayıp:** 67, 123, 131 ve 144 numaralı bulmacalar koşu sırasında yeniden
üretilemedi, eski içeriklerini korudular ve yeni setle 50 cevapta çakıştılar.
Bozuk yayınlamak yerine silindiler. `tools/rebuild-puzzles.mjs` tek tek onarım
için yazıldı ama havuz bu kadar daraldığında o dördünü de dolduramadı.

**Grow koşusu öncesi/sonrası şart olanlar:** önce `src/puzzles/` yedeklenir;
sonra `node tools/check-puzzles.mjs`, `node tools/audit-puzzles.mjs`,
`node tools/reorder-puzzles.mjs --apply`, `npm run puzzles:manifest`,
`npx vitest run`.

## Bulmaca sırası artık ölçülen zorluğa göre (2026-08-22)

`tools/reorder-puzzles.mjs` bütün seti dört sinyalle puanlayıp `order`, `title`
ve `difficulty` alanlarını yeniden yazıyor; 1. bulmaca en kolay, sonuncusu en
zor. Dosya adları ve `id` alanları değişmiyor, çünkü oyuncu ilerlemesi `id`'ye
bağlı.

Sinyaller: cevabın sözlükte tek ipuçlu olması (yani toplu TDK çekiminden gelmesi,
elle derlenmiş çekirdek kelime olmaması), sözlükteki derinliği, kesişen hücre
oranının tersi ve ızgara alanı. Cevap uzunluğu bilerek kullanılmıyor — bu
sözlükte 4 harfli katman elle derlenmiş çekirdek, 5-7 harfli katmanlar %99-100
toplu çekim, dolayısıyla uzunluk ilk sinyalin tersten kopyası olurdu.

## 3 harfli katman açıldı: set 146 bulmacaya çıktı (2026-08-22)

Sözlükteki 2 ve 3 harfli 475 kelime hiç kullanılmıyordu. Sebep `generate.mjs`
içindeki `MIN_WORD_LEN = 4`: maske onarım geçişleri 4'ten kısa her bloğu ya
uzatıyor ya yok ediyordu, yani ızgarada o boyda yuva hiç açılmıyordu.

O kuralın gerekçesi arz-talep uyumsuzluğuydu. Rastgele maske ipuçlarının
~%31'ini 2 harflik yapıyor; Türkçede 2 harfli kelime 81, 3 harfli 394 tane.
Sıfır tekrar kuralı altında bu talep karşılanamıyor, kural gevşetilirse aynı
cevap onlarca kez tekrarlıyordu.

Çözüm kota: `buildPuzzle` artık `minWordLen` (hedeflenen en kısa cevap) ve
`shortBudget` (bir alt uzunluğa bulmaca başına kaç blok izni) alıyor. Taban
yumuşak tutuluyor — kotayı aşan kısa bloklar giderilir, kota kadarı kalır.
`shortBudget = 0` eski davranışın birebir aynısı (8 tohumda çıktı karşılaştırması
ile doğrulandı).

Bulmaca başına 3 harfli kotası 3 ile koşulan üretim: **134 → 146 bulmaca,
2738 → 3140 soru**, tekrar 0. Katman tüketimi 3h 394/394, 4h 963/1571,
5h 814/2308, 6h 565/1456, 7h 404/1272. Koşu 4 harfli katman bittiği için değil,
3 harfli katman tükendiği için durdu.

## Profil karışımı denemesi başarısız (2026-08-22)

146'lık setin talep karışımı sözlüğün arz karışımına oturmuyordu: 3 harfli
katman arz payının 2 katı hızda tüketiliyor, 5 ve 7 harfli katmanların üçte
biri hiç kullanılmadan kalıyordu. Talep arza birebir oturursa teorik tavan
7001 kelime ÷ 21.5 soru ≈ 325 bulmaca.

Önce blok yoğunluğu (`genMask` içindeki 0.17) kaldıraç sanıldı — değil. 0.08
ile 0.20 arasında süpürüldü, katman dağılımı değişmedi; `repairMask`,
`shortenShortRuns` ve `thinThreeRuns` maskeyi başlangıç yoğunluğundan bağımsız
olarak aynı dağılıma yakınsatıyor. Parametre geriye dönük uyumluluk için duruyor.

Gerçek kaldıraç `minWordLen`. Sert taban çalışmıyor (min5 sert: 25 tohumda 0
üretim — kısa bloğu kaldırma yolu dik yöndeki parçaların da tabanı geçmesini
istiyor). Yumuşak tabanla ölçülen profiller, bulmaca başına talep:

| profil | 3h | 4h | 5h | 6h | 7h | soru | başarı |
|---|---|---|---|---|---|---|---|
| kisa (min4 kota3) | 2.72 | 6.48 | 7.04 | 3.88 | 4.04 | 24.2 | 25/25 |
| uzun (min5 kota4) | 0 | 3.77 | 5.46 | 5.31 | 4.38 | 18.9 | 13/25 |
| cokuzun (min5 kota2) | 0 | 1.83 | 8.50 | 4.17 | 4.83 | 19.3 | 6/25 |

LP karışımı 145 kısa + 157 uzun ≈ 302 bulmaca söylüyordu. Gerçek koşu **91
bulmaca, 1605 soru** verdi — 146'lık setten belirgin kötü, geri alındı.

İki bağımsız hata:

1. **Seçici hiç geçiş yapmadı** (`profil dagilimi: uzun=91`). "En çok bulmaca
   sürdürebilen profili seç" kuralı açgözlü: `kisa`nın kapasitesi baştan 144.9'da
   sabit (3 harfli katman bağlıyor ve onu yalnızca `kisa` tüketiyor), `uzun`
   274'ten başlıyor. `uzun`un kapasitesi 144.9'un altına ancak ~129 bulmaca
   sonra inerdi; koşu 91'de öldü. 3 harfli katman 0/394 kaldı.
2. **Koşu havuz bittiği için değil, arama tıkandığı için durdu.** Bitişte 4h
   %21, 5h %22 kullanılmıştı. 1. aşamada 146 denemenin 63'ü (%43) başarısız —
   min5 ızgarasında hücre başına kesişim arttığı için doldurma çözülemiyor.

Mekanizmanın kendisi doğru çalıştı: koşu sırasında ölçülen talep payları arz
paylarına oturmuştu (3h %4.0/%5.6, 4h %24.6/%22.4, 5h %31.0/%33.0,
6h %23.2/%20.8, 7h %17.3/%18.2). Sorun seçim kuralında ve `uzun` profilinin
arama maliyetinde. Bir sonraki deneme için: seçiciyi açgözlü kural yerine
hesaplanan LP oranına bağla, ve `uzun` yerine daha ucuz `min5 kota6` profilini
(16/25 başarı, 4h talebi 5.44) ölç.
