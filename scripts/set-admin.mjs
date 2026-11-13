/*
 * Run this only from a trusted computer to grant a Google account dashboard
 * access. It uses Application Default Credentials; no credential is ever sent
 * to the browser or stored in this repository.
 *
 * Windows PowerShell example:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\secure\service-account.json'
 *   npm install
 *   npm run set-admin -- admin@example.edu
 */
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFile } from 'node:fs/promises';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes('@')) {
  console.error('Usage: npm run set-admin -- admin@example.edu');
  process.exitCode = 1;
} else {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let credential = applicationDefault();

  // Parsing the file here gives a clearer error for the common local setup.
  if (credentialPath) {
    try {
      const serviceAccount = JSON.parse(await readFile(credentialPath, 'utf8'));
      credential = cert(serviceAccount);
    } catch (error) {
      throw new Error(`Could not read GOOGLE_APPLICATION_CREDENTIALS: ${error.message}`);
    }
  }

  initializeApp({ credential });
  const adminAuth = getAuth();
  const user = await adminAuth.getUserByEmail(email);
  await adminAuth.setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    admin: true
  });
  console.log(`Granted the admin custom claim to ${email}. They must sign out and sign in again.`);
}
