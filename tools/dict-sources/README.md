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
