import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cengelbulmaca.app',
  appName: 'Cengel Bulmaca',
  webDir: 'dist',
  plugins: {
    // skipNativeAuth ZORUNLU olarak true: oyunun tüm veri katmanı
    // (src/cloud-save.ts, src/referral.ts) Firebase JS SDK'sını kullanıyor.
    // Varsayılan (false) davranışta eklenti oturumu NATIVE SDK'da açar; JS
    // SDK'nın oturumu ayrı kaldığı için giriş "başarılı" görünür ama Firestore
    // yazmaları hâlâ eski anonim kullanıcıya gider. true iken native katman
    // yalnızca hesap seçiciyi gösterip kimlik bilgisini döndürür, oturumu JS
    // SDK açar (bkz. src/firebase-app.ts linkWithGoogle).
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
