# Puzzle content audit — 2026-08-15

Full sweep, all 300 files (`src/puzzles/puzzle-1.json` .. `puzzle-300.json`), 10 parallel read-only agents, 30 files each. 126 raw findings. Grouped below by recurring root cause first, then one-offs. **Nothing has been edited yet** — this is the report to review before any fix is applied.

## High-confidence systemic patterns (safe to batch-fix)

### 1. "PA" etymology wrong (Fransızca → should be Farsça)
Clue "Fransızca kökenli eski 'ayak' sözcüğü" for answer PA. "Pa/pâ" (ayak) is Persian, not French (French for foot is "pied"). Confirmed inconsistent with other PA clues in the same file set that correctly say Farsça or say nothing about origin.
Files: puzzle-18, 22, 24, 57, 63, 68(AB not PA - see #4), 73, 78, 82(URAN not PA), 93, 97, 102, 163, 193, 204, 206, 210, 237, 262.
Fix: replace "Fransızca" → "Farsça" in the clue text wherever this exact clue pairs with answer PA.

### 2. TAVŞAN called "kemirgen" (rodent) — factually wrong
Rabbit is Lagomorpha, not Rodentia.
Files: puzzle-57, 71, 80, 195, 233, 261.
Fix: "Uzun kulaklı, hızlı koşan otçul hayvan" (drop "kemirgen").

### 3. KAZA hierarchy reversed
Clue "İlin bağlı olduğu idari alt birim" implies il is subordinate to kaza — backwards; kaza/ilçe is the sub-unit of il.
Files: puzzle-76, 142, 241, 254, 258.
Fix: "İlçenin eski adı" or "İlin alt kademesindeki idari birim."

### 4. Musical notes (Mİ/FA/RE/DO/LA/Sİ) — generic "Bir nota" clue reused across puzzles
Same clue text "Bir nota" (or near-identical "X'dan önce/sonra gelen nota") is paired with different 2-letter notes in different files — ambiguous within any single puzzle since 6 different notes are all 2 letters. Also literal duplicate clue text reused with a different note answer.
Files: puzzle-45/58 (LA vs Mİ swap), 100/108/111 (Mİ vs FA collision), 188/203/205 (Mİ/FA/LA collision), 219/225/229/236 (RE wrong-fact + DO/RE/FA collision).
Fix: needs per-file distinguishing clue ("Re ile Fa arasındaki nota" style) — can't batch with one text, but pattern is consistent.

### 5. Tİ — instrument sound inconsistent (trampet vs zurna vs borazan)
"Trampet sesini taklit eden hece" is wrong (trampet is percussion); other files in the set use zurna/borazan (wind instrument) for the same answer TI, which is internally consistent — the trampet-labeled ones are the outliers.
Files: puzzle-24, 105, 253, 264 (say trampet — wrong), 257, 262, 268 (say zurna — also flagged only because it conflicts with borazan version elsewhere; treat zurna vs borazan as needing one canonical choice).
Fix: standardize to "Borazan sesini anlatan hece" (majority version) and fix the trampet ones.

### 6. HALA / TEYZE swapped
Clue "Baba tarafından teyze" for answer HALA — teyze is strictly maternal aunt; hala is paternal aunt. Wrong relation word used.
Files: puzzle-102, 116, 218, 260, 266.
Fix: "Babanın kız kardeşi."

### 7. TERAZİ "Ekim ayında başlayan burç" — wrong month
Libra (Terazi) starts Sept 23, not October (that's Scorpio/Akrep).
Files: puzzle-166, 203, 210.
Fix: "Eylül sonunda başlayan burç."

### 8. ER called "rütbeli" — wrong, er is rütbesiz by definition
Files: puzzle-91, 248, 251, 255, 266.
Fix: "Rütbesiz asker, nefer."

### 9. KAZ "vak vak öten" — vak vak is duck (ördek), not goose
Files: puzzle-43, 102, 207.
Fix: "Uzun boyunlu, iri beyaz kümes hayvanı."

### 10. İKİZ used for the zodiac sign — should be İKİZLER
"İkiz" just means "twin," not the sign name.
Files: puzzle-106, 157, 223, 262.
Fix: either change answer to İKİZLER (grid permitting) or reclue as "Aynı doğumda dünyaya gelen kardeşlerden her biri."

### 11. AB "Eski Türkçede su" — wrong, âb is Farsça not Eski Türkçe
Files: puzzle-68, 97, 198, 219.
Fix: "Divan edebiyatında su" or "Farsça kökenli 'su' sözcüğü."

### 12. ATİNA "Ege'deki antik Yunan başkenti" — ancient Greece had no single capital; also Athens isn't "in the Aegean"
Files: puzzle-74, 241, 247.
Fix: "Yunanistan'ın başkenti."

### 13. BİR "En küçük doğal sayı" — smallest doğal sayı is 0 in TR curriculum, not 1
Files: puzzle-210, 263.
Fix: "En küçük sayma sayısı."

### 14. TAVA "Yemek kızartılan sapı kap" — typo, should be "saplı"
Identical typo reused in two files (template reuse bug).
Files: puzzle-26, 115.

### 15. Duplicate capital-city clue reused with different answer
"Orta Asya'daki bir başkent" → answered BİŞKEK in puzzle-184 but AŞKABAT in puzzle-188 and puzzle-201.
Fix: give each its own country name in the clue (Kırgızistan's/Türkmenistan's başkenti).

## Needs a judgment call — do NOT batch-fix, agents disagreed or it's ambiguous

### ATE (answer, 3 letters) — appears extremely often across nearly every range
Files: puzzle-6, 32, 49, 50, 55, 75, 89, 90, 95, 98, 110, 148, 151, 162, 169, 170, 177, 180, 182, 183, 184, 185, 188, 192, 193, 197, 200, 228, 271, 283, 298 (~30 files).
Two different theories from different agents:
- (a) "ATE" is not a standalone real Turkish word at all — it's a truncated fragment of ATEİST, and the grid slot may genuinely need lengthening.
- (b) ATE is being used as intended shorthand, but the clue text is wrong (confuses "materyalist" with "ateist," or defines a philosophy instead of a person).
This is either a one-word decision (accept ATE as a valid crossword fill answer and just fix ~10 mismatched clue texts) or a much bigger grid-editing job (~30 files, resizing arms to fit ATEİST). **Need your call before touching this** — it's the single largest cluster.

### ARAKA — definition conflict between agents
Some agents insist araka = "iri taneli bezelye" (large edible pea) and flag "yem bitkisi" (fodder) framing as wrong; another agent (271-300 batch) said the opposite — araka = a vetch/fodder legume (mürdümük), not a pea, and flagged the "bezelye" framing as wrong instead.
Files involved either way: puzzle-10, 34, 41, 47, 52, 65, 67, 181, 187, 245, 247, 267, 287.
TDK actually defines araka as a legume (Lathyrus sativus / mürdümük-adjacent) grown both as fodder and, regionally, eaten — so both clue styles have some truth, which is exactly why it reads as ambiguous/wrong depending on which one a given file uses inconsistently. Needs one canonical clue text picked and applied everywhere, not a mechanical find-replace.

## One-off findings (single file each, no pattern)

- puzzle-64: NE — clue has stray space/missing apostrophe: `'Ne yapıyorsun?' daki` → `'Ne yapıyorsun?'daki`
- puzzle-72: TEYZE — clue garbled, reads as "half-sister" not "mother's sister" → "Annenin kız kardeşi"
- puzzle-117: NİSAN — "Baharın geldiği ay" wrong, spring starts in March → "Yılın dördüncü ayı"
- puzzle-48: DUT — silkworms eat the mulberry leaf, not the fruit → "İpek böceğinin yaprağıyla beslendiği ağacın meyvesi"
- puzzle-122: ÇİN — "Dünyanın en kalabalık ülkesi" outdated, India passed China in 2023 → "Çin Seddi'yle ünlü Uzak Doğu ülkesi"
- puzzle-140: CAZ — "Afrika kökenli" wrong, jazz originated in the US (New Orleans) → "Amerika kökenli, doğaçlamaya dayanan müzik türü"
- puzzle-246: UD — "Klasik müziğin telli çalgısı" reads as Western classical; ud is Turkish/Ottoman classical → "Klasik Türk müziğinin telli çalgısı"
- puzzle-278: URAN — clued as "Sanayi, endüstri" but URAN is uranium/the element, not a synonym for industry (separately, puzzle-82's URAN "Fransızca kökenli 'sanayi' sözcüğü" is also wrong — uran-as-sanayi is a Turkish coinage, not French)
- puzzle-188: İLE — "Bir bağlaç" ambiguous vs AMA (also 3 letters)
- puzzle-198: VOLEY — "Fileyle ayrılmış sahada oynanan top sporu" ambiguous vs TENİS (clued identically in puzzle-199)
- puzzle-197: YA — "Bir seslenme sözü" collides with EY (same 2-letter length, near-identical clue used in puzzle-191/198)
- puzzle-270: MİT — near-copy of same file's EFSANE clue, not distinguishable
- puzzle-113: ŞU — "Bir işaret sıfatı" collides with BU in the same puzzle
- puzzle-36: NAZ — "Kırıtma, cilvelenme" collides with EDA in the same puzzle
- puzzle-212: KİŞİNEV — "Doğu Avrupa'daki küçük ülkenin başkenti" too vague, country not named (fixed correctly elsewhere as "Moldova'nın...")
- puzzle-205: TİFLİS — "Kafkasya'daki bir başkent" ambiguous vs EREVAN (also 6 letters)

## Counts by range
1-30: 7 · 31-60: 15 · 61-90: 12 · 91-120: 18 · 121-150: 4 · 151-180: 9 · 181-210: 21 · 211-240: 11 · 241-270: 24 · 271-300: 5 — **126 total**, 300/300 files read.
