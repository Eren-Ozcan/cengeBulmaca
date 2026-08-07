# Cloud save — Firebase setup

**Verified end to end on an emulator on 2026-08-07** with a real Google account: link →
upload → uninstall → reinstall → restore. What that run proved, and what it did not, is
at the bottom.

This game already has a Firebase project (`cengel-bulmaca-c504d`) because the referral
system uses it. Auth is now shared: `src/firebase-app.ts` owns the app and
`ensureUid()`, and both `src/referral.ts` and `src/cloud-save.ts` consume it. There is
no second Firebase app.

## Console setup — done

All of this is already configured; it is written down so it can be repeated for the
next game, and so nobody undoes a step without knowing what it was for.

1. **Android app registered** (`com.cengelbulmaca.app`). The project previously had
   only a Web app, which is why `google-services.json` did not exist.
2. **Google sign-in provider enabled**, with the project's public-facing name set to
   `Cengel Bulmaca` and the support email to `yilkgamesstudio@gmail.com` — both appear
   on the consent screen the player sees. Anonymous was already on (referrals).
3. **SHA-1 fingerprints added**: the debug key and the upload key. The **Play app
   signing key is still missing** (Play Console → Setup → App integrity) — Google
   sign-in fails silently in a Play-distributed build without it.
4. **Security rules published** from `firestore.rules`. The monotonic `rev` guarantee
   lives in these rules, not in the client — a stale device overwriting newer progress
   is prevented server-side or not at all. Re-publish after any edit:
   `npx firebase deploy --only firestore:rules --project cengel-bulmaca-c504d`.
5. **`android/app/google-services.json` committed.** Order matters: it must be
   downloaded *after* the SHA-1s are added, otherwise it carries no `oauth_client`
   entries and Google sign-in fails with no visible error.

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

## What the emulator run proved (2026-08-07)

Verified, in this order, on a debug build with a real Google account:

- The account picker opens on the **first** sign-in. This is the failure that cost a
  whole session in reefy — Credential Manager returns nothing until the account has
  authorized this app — and the fallback added up front prevented it here.
- `saves/{uid}` is created with `rev: 1`, `schemaVersion: 1`, a server-stamped
  `updatedAt`, and a `summary` matching the HUD exactly (5 jokers, 2 solved).
- The link **survives a force-stop and relaunch**. This is the second reefy bug —
  `signInAnonymously()` running before the persisted session is restored, minting a new
  anonymous user on every launch — and it does not occur here.
- Uninstall → reinstall → link the same account **restores the progress** (solved count
  and cat collection came back identical). No conflict screen appeared, which is
  correct: the local save was an untouched default, so the code restored directly
  instead of asking. That is the fast path reefy's roadmap still lists as a to-do.

Not proven:

- **Cross-device restore.** Everything ran on one emulator, so "cloud → this device"
  was always the same device.
- **Entitlement stripping, in production.** `src/cloud-save.test.ts` asserts that a
  tampered document cannot set `cengel-ads-removed`, and the allowlist makes it
  structurally impossible, but the emulator account never owned the purchase, so the
  guarantee was not exercised against live data.
- **The conflict chooser with two real, differing saves.** The restore path was
  exercised; the "both sides changed" path was not.
