# Soft Skills Lab — one-time student submission website

This is a browser-based, one-time Soft Skills Lab marks and feedback form. It is not a mobile app, installable app, or student portal. A student signs in with a verified Google account, submits once, then can only see the submitted confirmation. The form has no link to the private dashboard.

## What is included

- A premium responsive student form at `/` with client-side validation and accessible error messages.
- Google sign-in with popup and mobile redirect support.
- One immutable submission per Firebase UID, stored at `submissions/{uid}`.
- Firestore rules that reject duplicate writes, invalid shapes, invalid types, and student reads of other records.
- Server timestamp (`submittedAt`) and authenticated Google email stored with every submission.
- A separate private dashboard at `/admin.html`, protected in the browser and in Firestore rules by a Firebase `admin` custom claim.
- Dashboard count, search by roll number/name, marks filtering/sorting, response table, exact submitted date/time, and safe CSV export for Excel.
- Validation tests runnable without Firebase credentials.

## Project layout

```text
public/
  index.html             Student one-time form
  admin.html             Private dashboard (no student-facing link)
  firebase-config.js     Add your public Firebase Web App configuration here
  firebase-client.js     Auth and Firestore integration
  student.js             Student flow and validation handling
  admin.js               Admin-only dashboard and CSV export
  validation.js          Shared client validation
  styles.css             Responsive premium UI
firestore.rules          Server-enforced access and data validation
scripts/set-admin.mjs    Trusted local utility to grant an admin claim
tests/validation.test.js Client validation tests
firebase.json            Hosting and rules deployment configuration
.firebaserc              Pins the Firebase project used by deployment
```

## 1. Create and configure Firebase

1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
2. In **Project settings → Your apps**, add a **Web app**. Copy its configuration values into `public/firebase-config.js`.
3. In **Build → Authentication**, select **Get started**, then open **Sign-in method → Google**, enable it, choose a project support email, and save.
4. In **Authentication → Settings → Authorized domains**, add your Firebase Hosting domain and any custom domain you use. `localhost` is included for local testing.
5. In **Build → Firestore Database**, create a Firestore database. Choose the production location carefully; it cannot be changed later.

Firebase Web App configuration values (including `apiKey`) identify the web app and are expected to be public. They do **not** bypass Firestore rules. Do not place service account JSON files, Admin SDK credentials, or private keys in `public/`.

## 2. Apply the Firestore security rules

The checked-in `firestore.rules` is required. It enforces all of the following on the Firebase servers:

- authenticated, verified Google account only;
- document ID equals the signed-in user’s UID;
- exactly the six allowed fields and the required types/ranges;
- roll number is exactly 10 digits;
- marks is an integer from 1 through 50;
- feedback is nonblank and at most 3,000 characters;
- `submittedAt` uses Firebase server time;
- create exactly once; update and delete are always denied;
- student can only `get` their own record to display the already-submitted state, never list records;
- only an account with the trusted `admin` custom claim can list/read all submissions.

Deploy the rules with the Hosting deployment in step 4. Do not loosen them in the Firebase Console.

## 3. Create the administrator account

The dashboard has a separate administrator authentication check: a Google account must have a Firebase Auth custom claim of `admin: true`. Merely knowing `/admin.html`, changing browser code, or using a student account is not enough, because Firestore rules independently deny the collection query.

First sign in once with the intended Google account so Firebase Auth creates the user. Then, on a trusted administrator computer:

1. Create a service account in **Google Cloud Console → IAM & Admin → Service Accounts** for the Firebase project and securely download its JSON key. Keep it outside this repository.
2. Install the local tool dependencies: `npm install`.
3. In PowerShell, point Application Default Credentials at the protected file, then run:

   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\secure\your-service-account.json'
   npm run set-admin -- administrator@your-school.edu
   ```

4. Have that administrator sign out and sign in again. The dashboard will force a token refresh as well.

To remove access, use a trusted Admin SDK script/Cloud Function to set that user’s custom claims without `admin`, then revoke refresh tokens or have the user sign in again. Never grant the claim from browser code.

## 4. Deploy to Firebase Hosting

Install prerequisites: Node.js 20+ and the Firebase CLI. The checked-in
`.firebaserc` already selects the `soft-skills-lab-feedback` project and
`firebase.json` targets its default Hosting site.

```powershell
npm install
npm install --global firebase-tools
firebase login
firebase deploy --only firestore:rules,hosting --project soft-skills-lab-feedback
```

Alternatively, run `npx firebase-tools login` and `npx firebase-tools deploy --only firestore:rules,hosting --project soft-skills-lab-feedback` without a global install.

Before deployment, confirm `public/firebase-config.js` contains the correct values and that Google Auth’s authorized domains include the final Hosting URL. Firebase will print the Hosting URL after a successful deployment. This project deliberately does not claim that deployment is complete until you run that command in your Firebase account.

## 5. Local checks and test checklist

Run the included static checks and validation tests:

```powershell
npm run check
npm test
```

Then test against your own Firebase project:

- [ ] A signed-out visitor sees only Google sign-in.
- [ ] An unverified/non-Google account cannot reach the student form.
- [ ] Invalid roll number, name, marks, and feedback show field-specific errors.
- [ ] A valid first submission writes the UID-named document with the Google email and server timestamp.
- [ ] Refreshing after submission shows “already submitted.”
- [ ] Two tabs submitting together produce one record only; the second is denied/changed to already submitted.
- [ ] Firestore Rules simulator: a student cannot list `submissions`, read another UID, update, or delete.
- [ ] A non-admin Google account visiting `/admin.html` sees access denied and cannot read any submission in browser devtools.
- [ ] A custom-claim administrator can view counts, search, filter/sort marks, see times, and export CSV.
- [ ] Check the form and dashboard on a phone, tablet, and desktop.

## Current handoff status

- The Firebase web-app configuration is already in `public/firebase-config.js`.
- A default Cloud Firestore database exists in `soft-skills-lab-feedback`.
- Firebase Authentication has not been initialized yet: its console still shows **Get started**. Enable the Google provider as described above.
- The code and deployment configuration are on the `main` branch of the configured GitHub remote.
- Hosting is not live yet. Its expected URL, `https://soft-skills-lab-feedback.web.app/`, currently returns 404 until the deployment command completes.

Do not embed service-account JSON files, browser tokens, or private keys in this repository.
