/*
 * Public Firebase Web App configuration.
 *
 * Replace every empty string with the values from Firebase Console > Project
 * settings > Your apps > Web app. These identifiers are safe to ship to a
 * browser; Firestore Security Rules protect the data. Never put a service
 * account JSON file, Admin SDK private key, or other server secret here.
 */
export const firebaseConfig = Object.freeze({
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
});

export function isFirebaseConfigured(config = firebaseConfig) {
  return Object.values(config).every(
    (value) => typeof value === 'string' && value.trim().length > 0
  );
}
