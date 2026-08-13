// Shared Firebase app and player identity — the "identity seam".
//
// Both the referral system (referral.ts) and cloud save (cloud-save.ts) use
// the same Firebase project and the SAME player identity. Calling
// initializeApp() a second time with the same config throws Firebase's
// "app/duplicate-app" error; that's why a single instance is kept here and
// shared by both features.
//
// Firebase modules are DELIBERATELY loaded via dynamic import (preserving
// referral.ts's original approach): keeps the SDK out of the main bundle so
// the initial load doesn't grow.
//
// IDENTITY SEAM — this is what keeps the iOS path open: the rest of the
// game sees a player ONLY through ensureUid(). Whether this identity was
// obtained anonymously or via Google is encapsulated here. When Sign in
// with Apple is added later, only this file changes; cloud-save.ts and the
// rest of the game code stay untouched.
//
// The identity is deliberately NOT tied to a platform-specific id (Play
// Games player_id): the Firebase UID works the same on Android and iOS, so
// the same player can reach a single record from either platform.
//
// If not configured, or on a network/permission error, every function
// silently returns null/no-ops — same convention as ads.ts/billing.ts.

import { Capacitor } from "@capacitor/core";
import type { Auth, User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

type AuthModules = typeof import("firebase/auth");
type FirestoreModules = typeof import("firebase/firestore");

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDAYdtc5t_-rUgLFg-_Y30cvFpwqWSuC8c",
  authDomain: "cengel-bulmaca-c504d.firebaseapp.com",
  projectId: "cengel-bulmaca-c504d",
  storageBucket: "cengel-bulmaca-c504d.firebasestorage.app",
  messagingSenderId: "211808649907",
  appId: "1:211808649907:web:f75b8c07a446d8e8c4e6c6",
};

export function isFirebaseConfigured(): boolean {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}

export interface FirebaseSdk {
  auth: Auth;
  db: Firestore;
  authMod: AuthModules;
  fs: FirestoreModules;
}

let sdkPromise: Promise<FirebaseSdk | null> | null = null;

/**
 * Loads the Firebase SDK (once) and initializes the app.
 * On failure, the promise is dropped from the cache: if the first attempt
 * happened while offline, the feature shouldn't stay dead for the rest of
 * the session — the next call retries.
 */
export function firebaseSdk(): Promise<FirebaseSdk | null> {
  if (!isFirebaseConfigured()) return Promise.resolve(null);
  sdkPromise ??= (async () => {
    const [{ initializeApp }, authMod, fs] = await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
      import("firebase/firestore"),
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    return { authMod, fs, auth: authMod.getAuth(app), db: fs.getFirestore(app) };
  })().catch(() => {
    sdkPromise = null;
    return null;
  });
  return sdkPromise;
}

/**
 * Waits for Firebase to restore the persisted session from disk.
 *
 * onAuthStateChanged only fires its first notification after this restore
 * completes; until then `auth.currentUser` is null and could be mistaken
 * for "no session".
 */
function waitForRestoredUser(authMod: AuthModules, auth: Auth): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = authMod.onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      () => {
        unsubscribe();
        resolve(null);
      },
    );
  });
}

let uidPromise: Promise<string | null> | null = null;

/**
 * Signs in and returns the player's persistent identity; returns null if
 * not configured or if the connection can't be established.
 *
 * CRITICAL: signInAnonymously() is deliberately NOT called directly. Since
 * it runs before the persisted session is restored from disk, it would
 * create a NEW anonymous user on EVERY launch; the linked Google account
 * would be orphaned and cloud save would never work for a returning player
 * (caught with a real account on reefy). We wait for the existing session
 * to be restored first.
 */
export function ensureUid(): Promise<string | null> {
  if (!isFirebaseConfigured()) return Promise.resolve(null);
  uidPromise ??= (async () => {
    const sdk = await firebaseSdk();
    if (!sdk) return null;
    const restored = await waitForRestoredUser(sdk.authMod, sdk.auth);
    if (restored) return restored.uid;
    const cred = await sdk.authMod.signInAnonymously(sdk.auth);
    return cred.user.uid;
  })().catch(() => {
    uidPromise = null;
    return null;
  });
  return uidPromise;
}

// ---------- persistent identity (account linking) ----------

/** Account linking only makes sense in the native build (Google account picker lives there). */
export function isAccountLinkingAvailable(): boolean {
  return isFirebaseConfigured() && Capacitor.isNativePlatform();
}

/**
 * The label to show (name or email) if the session is linked to a
 * persistent account; null if anonymous/no session. Async because it waits
 * for the session to be restored.
 */
export async function linkedAccountLabel(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  await ensureUid();
  const sdk = await firebaseSdk();
  const u = sdk?.auth.currentUser;
  if (!u || u.isAnonymous) return null;
  return u.displayName || u.email || "Google hesabı";
}

export type LinkResult =
  | { ok: true; switched: false; msg: string }
  /** This Google account turned out to be linked to ANOTHER record: we
   *  switched to that account, cloud progress needs to be downloaded (the
   *  caller must re-run cloud sync). */
  | { ok: true; switched: true; uid: string; msg: string }
  | { ok: false; msg: string };

/**
 * Fetches the Google credential.
 *
 * On Android the plugin uses Credential Manager by default; this API only
 * returns accounts that have PREVIOUSLY authorized THIS APP on the device.
 * So on the first sign-in it returns empty (and the account picker never
 * opens) even if an account is set up on the device. That's why the modern
 * flow is tried first, falling back to the classic picker if it returns
 * empty — otherwise no player could link their account for the FIRST TIME
 * (caught on a real device on reefy).
 */
async function requestGoogleIdToken(): Promise<string | null> {
  const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
  try {
    const res = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    if (res.credential?.idToken) return res.credential.idToken;
  } catch {
    /* fall through to the backup flow */
  }
  try {
    const res = await FirebaseAuthentication.signInWithGoogle({
      skipNativeAuth: true,
      useCredentialManager: false,
    });
    return res.credential?.idToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Links the anonymous session to a persistent Google account.
 *
 * Critical branch — `auth/credential-already-in-use`: if the selected
 * Google account is already linked to ANOTHER Firebase user (the player
 * linked it on a different device before), the link fails. The correct
 * behavior is not to swallow the error but to SWITCH to that account and
 * download the cloud record; otherwise the player's old progress stays
 * unreachable.
 *
 * The anonymous user here is left orphaned (not deleted) — the local save
 * on it already lives on the device, and the user is asked if the conflict
 * flow kicks in.
 */
export async function linkWithGoogle(): Promise<LinkResult> {
  if (!isAccountLinkingAvailable()) {
    return { ok: false, msg: "Hesap bağlama mobil sürümde kullanılabilir." };
  }
  try {
    await ensureUid(); // make sure the anonymous session is open
    const sdk = await firebaseSdk();
    if (!sdk) return { ok: false, msg: "Bağlantı kurulamadı, daha sonra tekrar dene." };

    // skipNativeAuth: only the account picker + credential; the JS SDK
    // opens the session itself (see the rationale in capacitor.config.ts).
    const idToken = await requestGoogleIdToken();
    if (!idToken) return { ok: false, msg: "Google girişi tamamlanmadı." };

    const { GoogleAuthProvider, linkWithCredential, signInWithCredential } = sdk.authMod;
    const credential = GoogleAuthProvider.credential(idToken);
    const current = sdk.auth.currentUser;

    if (current && current.isAnonymous) {
      try {
        await linkWithCredential(current, credential);
        return {
          ok: true,
          switched: false,
          msg: "Hesabın bağlandı — ilerlemen artık diğer cihazlarında da açılabilir. ☁️",
        };
      } catch (e) {
        const code = (e as { code?: string } | null)?.code;
        if (code !== "auth/credential-already-in-use") throw e;
        // This Google account already has a record: switch to it.
        const signedIn = await signInWithCredential(sdk.auth, credential);
        uidPromise = Promise.resolve(signedIn.user.uid);
        return {
          ok: true,
          switched: true,
          uid: signedIn.user.uid,
          msg: "Bu hesabın kayıtlı bir ilerlemesi var, ona geçildi.",
        };
      }
    }

    // Already on a persistent account (or no anonymous session): sign in directly.
    const signedIn = await signInWithCredential(sdk.auth, credential);
    uidPromise = Promise.resolve(signedIn.user.uid);
    return { ok: true, switched: true, uid: signedIn.user.uid, msg: "Giriş yapıldı." };
  } catch {
    return { ok: false, msg: "Google girişi başarısız oldu, daha sonra tekrar dene." };
  }
}
