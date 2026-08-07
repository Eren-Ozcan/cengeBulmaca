# Cloud save — Firebase setup

The code is complete and typechecks, but the feature has **never run against a real
account**. This file lists what is still needed before it works on a device.

Unlike Little Grand Hotel, this game already has a Firebase project
(`cengel-bulmaca-c504d`) because the referral system uses it. Auth is now shared:
`src/firebase-app.ts` owns the app and `ensureUid()`, and both `src/referral.ts` and
`src/cloud-save.ts` consume it. There is no second Firebase app.

## Blocking: `google-services.json` is missing

`android/app/google-services.json` does not exist in this repo. The native plugin
(`@capacitor-firebase/authentication`) requires it on Android — without it the Gradle
build fails, and Google sign-in cannot work.

Download it from Firebase console → Project settings → Your apps → Android
(`com.cengelbulmaca.app`) and place it at `android/app/google-services.json`, then run
`npx cap sync android`.

## Steps in the Firebase / Google Cloud console

The project exists, so these are the deltas cloud save adds:

1. **Enable the Google sign-in provider** — Build → Authentication → Sign-in method →
   Google. Anonymous is presumably already on for referrals; confirm it.
2. **Publish the security rules** from `firestore.rules` (Firestore → Rules → Publish,
   or `firebase deploy --only firestore:rules`). Do this **before** shipping. The
   monotonic `rev` guarantee lives in these rules, not in the client — a stale device
   overwriting newer progress is prevented server-side or not at all.
3. **Add the SHA-1 fingerprints** — Project settings → Your apps → Android → Add
   fingerprint. All three are needed or Google sign-in fails silently: the upload key,
   the Play app-signing key (Play Console → Setup → App integrity), and the debug key
   (`keytool -list -v -keystore ~/.android/debug.keystore`, password `android`).

## Known gotchas, already handled in code

Both were found the hard way in reefy, with a real account on an emulator:

- `signInAnonymously()` must not be called before Firebase restores the persisted
  session, or every launch mints a new anonymous user and orphans the linked Google
  account. `ensureUid()` waits for the first `onAuthStateChanged` notification.
- Android's Credential Manager only returns accounts that already authorized *this
  app*, so the picker never opens on a first sign-in. `firebase-app.ts` falls back to
  `useCredentialManager: false` when the modern flow comes back empty.

## What the save actually contains

The save is spread across ~13 `cengel-` prefixed localStorage keys. They are collected
through an **allowlist** in `src/cloud-save.ts`, not a blocklist, so a key added later
cannot leak to the cloud unnoticed. Date-keyed hint entries are pruned to a one-week
window — without pruning the document would grow by one key per day forever.

The ad-free entitlement is stripped from the payload and re-derived locally. Otherwise
sharing a save would hand out the paid version; `src/cloud-save.test.ts` asserts a
tampered document cannot unlock it.

## Privacy policy

Cloud save uploads progress to Google servers under a per-player identifier. `PRIVACY.md`
and the Play Console Data Safety form must say so before the feature ships.
