# Privacy Policy — Çengel Bulmaca

_Last updated: 8 August 2026_

Çengel Bulmaca is published by Yilk Games. This policy describes this game
specifically; the studio-wide policy covering all of our games is at
<https://yilkgames.com/privacy-policy/>.

## Summary

- Your puzzle progress is stored on your device **and** backed up to our cloud
  save, so it survives reinstalling the app or moving to a new phone.
- To do that, the app creates an **anonymous player ID** for you the first time
  it runs. It is not linked to your name or email unless you choose to sign in.
- Signing in with a Google account is **optional**. It exists so the backup can
  follow you to another device.
- The app displays ads through **Google AdMob**, and offers optional in-app
  purchases through **Google Play**.
- We never ask for your name, phone number, address, or payment card details.

## Player ID and cloud save

The first time you open the game, it signs you in anonymously with Firebase
Authentication (a Google service we use as our backend). This produces a random
player ID. It contains nothing about you: not your name, not your email, not
your phone number.

That ID is used for two things:

1. **Cloud save.** Your game data is copied to our database (Google Firestore),
   in a document only your player ID can read or write. What is copied: your
   puzzle progress, your solve statistics (streak, solved puzzles), your joker
   balance, your daily hint usage, your cat collection, and your theme/sound
   preferences. Daily hint records older than a week are discarded rather than
   kept forever.
2. **Invites.** See "Invite links" below.

Two things are deliberately **not** copied to the cloud: your ad-free purchase
(it is re-checked with Google Play on each device instead, so a shared save
cannot hand out the paid version) and anything not on the explicit list above.

Cloud save is part of how the game works and is not something you switch on. If
you would prefer your progress never to leave the device, the app is not able to
offer that today — you can, however, ask us to delete what has been stored (see
"Keeping and deleting your data").

## Linking a Google account

An anonymous player ID lives with the app installation. If you uninstall the
game without linking an account, that ID — and the backup attached to it — can
no longer be reached.

Linking a Google account solves this: it attaches your anonymous ID to that
account, so signing in on a new phone brings your progress with you. If you do
this, we receive the email address and display name of the Google account you
picked, from Google's sign-in screen. The app shows the account name back to you
so you can tell which one is linked. We do not use it to email you, and we do
not share it.

You are never required to link an account, and you are never asked for a
password — the sign-in screen is Google's own.

## Invite links

If you share an invite link, or open one a friend sent you, we store a small
record against your anonymous player ID: when it was created, which player ID
invited you (if any), whether the invite reward has been claimed, and the joker
balance associated with the invite. This is how the reward reaches the right two
players. No names or email addresses are involved — only the random IDs.

## Ads (Google AdMob)

Çengel Bulmaca is funded by advertising and uses Google AdMob for this:

- **Interstitial ads** are shown occasionally after completing some puzzles.
- **Rewarded ads** are optional: once your daily free hint is used up, you may
  choose to watch one to unlock an additional hint. If you do not watch, no
  data is shared.

To serve and measure ads, AdMob may collect your device's advertising ID, your
IP address (which gives approximate location), device/operating system
information and ad interaction data. This data goes to Google, not to Çengel
Bulmaca itself, and is subject to Google's
[Privacy Policy](https://policies.google.com/privacy).

In the European Economic Area and the UK, a consent form (Google's User
Messaging Platform) is shown before any ad loads, and your choice there is
respected. Everywhere else, you can manage ad personalization from your device's
system settings (Google Settings → Ads → Opt out of Ads Personalization / Reset
advertising ID).

If you buy the ad-free version, no ads are requested at all.

## Purchases

The game offers optional in-app purchases: joker packs and a one-time "remove
ads" purchase. Payment is handled entirely by **Google Play Billing** — we never
see or store your card details. We use **RevenueCat** to manage and verify these
purchases; it receives purchase data such as the product ID, the purchase date
and an anonymous purchase token.

## Data stored on your device

The same data listed under "Cloud save" is also kept locally, in the app's own
storage, so the game works offline. The local copy is deleted when you uninstall
the app. Deleting the app does **not** delete the cloud copy — see below.

## Sharing your result

The "Share result" button passes a short result text to an app of your choice,
only through an action you initiate yourself. This is entirely under your
control.

## Keeping and deleting your data

We keep your cloud save for as long as the game is installed and in use, so it
is there when you need it. Uninstalling removes the local copy only.

To have your cloud save and invite record deleted, write to
erenozcaan@hotmail.com from — or telling us — the Google account you linked, or
including your player ID if you never linked one. We will delete it and confirm.
Data held by Google or RevenueCat on our behalf (your advertising ID, your
purchase history) can also be managed from your Google account's privacy
settings.

## Children's privacy

The app does not target a specific age group and is not marketed to children.
Because it asks for no personal information directly, it collects none from
anyone; however, since ads are served through Google AdMob, we recommend that a
user you know to be under 13 use non-personalized ad settings.

## Changes

If this policy changes, the current version will be published in this file, at
<https://yilkgames.com/privacy-policy/>, and on the app's store page.

## Contact

For questions: erenozcaan@hotmail.com
