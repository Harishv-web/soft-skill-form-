import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

export const firebaseReady = isFirebaseConfigured();

let app;
let auth;
let db;

if (firebaseReady) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  auth.useDeviceLanguage();
  db = getFirestore(app);
}

export { auth, db, collection, doc, getDoc, getDocs, onAuthStateChanged, query, serverTimestamp, setDoc, signOut };

export function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export async function signInWithGoogle({ preferRedirect = false } = {}) {
  if (!firebaseReady) {
    throw new Error('Firebase has not been configured yet.');
  }

  const provider = createGoogleProvider();
  if (preferRedirect) {
    await signInWithRedirect(auth, provider);
    return { redirected: true };
  }
  return signInWithPopup(auth, provider);
}

export async function completeGoogleRedirect() {
  if (!firebaseReady) return null;
  return getRedirectResult(auth);
}

export function isLikelyMobileBrowser() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isVerifiedGoogleUser(user) {
  return Boolean(
    user?.email
    && user.emailVerified
    && user.providerData?.some((provider) => provider.providerId === 'google.com')
  );
}

export function describeFirebaseError(error) {
  const code = error?.code || '';
  if (code === 'auth/popup-blocked') return 'The sign-in popup was blocked. Please allow popups and try again.';
  if (code === 'auth/popup-closed-by-user') return 'Google sign-in was cancelled.';
  if (code === 'auth/network-request-failed') return 'A network error occurred. Check your connection and try again.';
  if (code === 'auth/unauthorized-domain') return 'This domain is not authorised for Google sign-in in Firebase.';
  if (code === 'permission-denied' || code === 'firestore/permission-denied') return 'This request was not authorised. Please sign in again.';
  if (code === 'unavailable' || code === 'firestore/unavailable') return 'The service is temporarily unavailable. Check your connection and try again.';
  return error?.message || 'Something went wrong. Please try again.';
}
