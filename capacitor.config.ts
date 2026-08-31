import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cengelbulmaca.app',
  appName: 'Cengel Bulmaca',
  webDir: 'dist',
  plugins: {
    // skipNativeAuth MUST be true: the game's entire data layer
    // (src/cloud-save.ts, src/referral.ts) uses the Firebase JS SDK.
    // With the default (false), the plugin opens the session in the NATIVE
    // SDK; since the JS SDK's session stays separate, sign-in looks
    // "successful" but Firestore writes still go to the old anonymous user.
    // With true, the native layer only shows the account picker and returns
    // the credential; the JS SDK opens the session (see linkWithGoogle in
    // src/firebase-app.ts).
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
