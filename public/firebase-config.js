/*
 * Public Firebase Web App configuration.
 *
 * Replace every empty string with the values from Firebase Console > Project
 * settings > Your apps > Web app. These identifiers are safe to ship to a
 * browser; Firestore Security Rules protect the data. Never put a service
 * account JSON file, Admin SDK private key, or other server secret here.
 */
export const firebaseConfig = Object.freeze({
  apiKey: 'AIzaSyChmoJZeVzJzAAOXOVbm23aoCy-xnh5xSQ',
  authDomain: 'soft-skills-lab-feedback.firebaseapp.com',
  projectId: 'soft-skills-lab-feedback',
  storageBucket: 'soft-skills-lab-feedback.firebasestorage.app',
  messagingSenderId: '220814705433',
  appId: '1:220814705433:web:7fbf68243dc39995dbfb88'
});

export function isFirebaseConfigured(config = firebaseConfig) {
  return Object.values(config).every(
    (value) => typeof value === 'string' && value.trim().length > 0
  );
}
