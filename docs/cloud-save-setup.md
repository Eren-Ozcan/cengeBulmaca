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
3. **SHA-1 fingerprints added** — all three, so `google-services.json` now carries
   three Android OAuth clients:
   - debug key — emulator and local debug builds
   - upload key (`android/cengelbulmaca.keystore`) — local release builds
   - **Play app signing key** — what players actually get. Play re-signs the uploaded
     AAB with Google's own key, so a store build carries neither of the other two
     certificates. Without this entry Google sign-in fails *only* in the store build,
     and silently. Found at Play Console → Google Play ile korunanlar → Uygulama
     imzalama → "Klasik anahtar" → SHA-1 (**not** the "Kuantum sonrası kriptografi
     anahtarı" column next to it, which is a different certificate).

   Note: the app signing key was rotated on 2026-07-24 and the previous key is still
   listed. The install base was 0% at rotation time, so the old fingerprint was not
   added; if an old tester install ever fails to sign in, that is the reason.
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

## When the conflict chooser is skipped

A cloud document ahead of the local `rev` while the local save is dirty is *not* enough
to ask the player to pick a side: a fresh install is dirty the moment the game paints a
screen (the starting joker balance is written on first read, the intro and the tutorial
stamp their "seen" flags). Asking then shows a two-column chooser with one side empty,
and a player who picks that side loses a real save.

So the branch also consults `hasPlayerProgress()` (exported from `src/cloud-save.ts`,
unit-tested), which reads the *substance* of the save rather than the dirty flag:
puzzle progress keys, a stats entry, a joker balance that differs from `START_JOKERS`,
a used daily hint, or a claimed referral reward. Settings (theme/sound/music), the
`jokers-init` marker and the story/epilogue/tutorial "seen" stamps deliberately do not
count — they change without the player earning anything, and counting them would bring
back the empty chooser this exists to prevent. Anything unreadable or unrecognised
counts as progress: a wrong "has progress" only falls back to the chooser, a wrong "no
progress" silently discards the player's game.

Both entry points benefit, because both go through `handleSyncResult()` in
`src/cloud-ui.ts`: the startup sync and the re-sync after the player links a Google
account.

## Privacy policy

Cloud save uploads progress to Google servers under a per-player identifier, and the
identity is created *automatically* — the anonymous sign-in happens on first launch,
before the player has chosen anything. Nothing about that is optional from the player's
side, so the policy has to state it rather than describe cloud save as a feature they
opt into.

Done on 2026-08-08: `PRIVACY.md` and its published copy `docs/index.md` were rewritten
(the old text claimed the app "sends no data to its own servers" and that progress "is
kept only on your device" — both false since cloud save landed), and the studio-wide
policy at <https://yilkgames.com/privacy-policy/> was updated to match. Reefy, which had
no policy file at all, got one.

**Still open: the Play Console Data Safety form.** It was answered when the app only
served ads, so it declares advertising data and nothing else. The exact additions are
listed under "Still to declare for cloud save" in `docs/store-listing.md`. This is a
console action, not a code change, and it blocks a production release the same way the
policy text did.

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

## What the two-emulator run proved (2026-08-08)

Two Android 14 emulators, the same Google account, real Firestore:

- **The widened predicate holds on a device.** Device B was a clean install whose only
  actions were skipping the story screen and the 10-step tutorial. Linking restored A's
  state directly (2 solved, 1/15 cats, the same cat destination) with **no** chooser —
  which is exactly what the `*-seen` stamps being excluded from `hasPlayerProgress()`
  buys. Had they counted, the run would have shown a chooser with an empty side.
- **A mid-session restore survives the reload.** Choosing "use the cloud one" on A
  applied the download and reloaded without losing data — the class of bug that cost
  reefy five fish does not occur here.
- **Device B → device A works, but only after a timeout fix.** Typing a real answer on
  B (ŞEMSİYE) and cold-starting A left A empty across several attempts. The sync logic
  was not at fault: `syncCloudSave()` wrapped the whole identity chain in a 3 s budget,
  and in this app that chain includes three **dynamic** Firebase imports (app + auth +
  firestore) before IndexedDB session restore even begins. Overrunning made
  `withTimeout` return null and the sync go silently `disabled` — no restore, no
  chooser, no error — and the startup sync runs once per session, so the miss was
  permanent for that launch. `AUTH_TIMEOUT_MS` is now 15 s. The old 3 s was justified as
  "don't block startup on a bad network", but startup was never blocked: `main.ts`
  calls `void initCloudSave(root)` and nothing awaits it. With the fix, A picked up
  ŞEMSİYE on the next cold start.

Still not proven:

- **Two devices live at once.** Both directions work with the other device idle; the
  rev race when both write inside the same window was not exercised.
- **The joker/hint/referral half of the predicate, on a device.** The two-emulator run
  above exercised the `*-seen` exclusions, which is the half that mattered. The joker
  balance, used hints and referral rewards are covered in `src/cloud-save.test.ts` but
  were not the deciding signal in any device run.
- **The toast before the post-restore reload.** A restore now shows a short toast and
  reloads ~1.4 s later instead of reloading immediately, so the player is not dropped
  into what looks like a crash. Only reasoned about, not watched on a device.
- **Entitlement stripping, in production.** `src/cloud-save.test.ts` asserts that a
  tampered document cannot set `cengel-ads-removed`, and the allowlist makes it
  structurally impossible, but the emulator account never owned the purchase, so the
  guarantee was not exercised against live data.
- ~~The conflict chooser with two real, differing saves.~~ Done in the 2026-08-08 run:
  linking on A found a cloud save from an earlier session and showed both columns
  filled; nothing was merged, and picking the cloud side applied it cleanly.
