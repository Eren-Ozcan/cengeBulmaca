# Güvenlik testleri

Bu klasördeki testler `firestore.rules`'a karşı saldırı senaryoları çalıştırır.
Normal `npm test` koşusuna DAHİL DEĞİLDİR (bkz. `vitest.config.ts`) çünkü
canlı bir Firestore emulator gerektirirler ve gerçek Firebase projesine asla
dokunmazlar.

## Çalıştırma

```sh
npm run test:rules
```

Bu komut `firebase-tools`'un Firestore emulator'ünü ayağa kaldırır, testleri
emulator'e karşı çalıştırır ve emulator'ü kapatır. Ek kurulum gerekmez
(`@firebase/rules-unit-testing` ve `firebase-tools` zaten devDependency).

## Bulunan / düzeltilen açıklar

### 1. Davet ödülü sınırsız tekrar (2026-08-04, düzeltildi)

`referral-exploit.test.ts` — rule (2) ("davet ettiğim arkadaş ilk bulmacasını
çözünce beni ödüllendirsin") yalnızca davet edilenin KENDİ belgesindeki
`firstPuzzleRewardClaimed` alanının hâlâ `false` olduğunu kontrol ediyordu.
Resmi uygulama kodu (`src/referral.ts`) bu güncellemeyi her zaman
`runTransaction` içinde, davet edilenin kendi belgesini `true` yapan
güncellemeyle ATOMİK yapıyordu — ama kural bunu zorunlu kılmıyordu.

Sonuç: Firebase SDK'sını resmi uygulama kodu dışında (ör. tarayıcı konsolundan
veya özel bir istemciden) doğrudan kullanan biri, kendi
`firstPuzzleRewardClaimed` alanını hiç `true` yapmadan, davet edenin
belgesine `jokerBalanceCloud` alanını defalarca +3 artıracak şekilde
yazabiliyordu → sınırsız premium para (joker) üretimi.

Düzeltme: rule (2)'ye `getAfter()` ile davet edilenin kendi belgesinin AYNI
atomik commit içinde `false -> true` geçtiği şartı eklendi. Bu geçiş yalnızca
bir kez yapılabildiği için (rule (1) tarafından zorunlu kılınıyor), referrer
ödülü de doğal olarak bir kereyle sınırlanmış oldu.

**Not:** Bu düzeltme yalnızca yerel `firestore.rules` dosyasında. Canlı
Firebase projesine yansıması için:

```sh
npx firebase-tools deploy --only firestore:rules --project cengel-bulmaca-c504d
```

çalıştırılıp Firebase Console'da kuralların güncellendiği doğrulanmalı.
