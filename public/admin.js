import {
  auth,
  collection,
  completeGoogleRedirect,
  db,
  describeFirebaseError,
  firebaseReady,
  getDocs,
  isLikelyMobileBrowser,
  isVerifiedGoogleUser,
  onAuthStateChanged,
  query,
  signInWithGoogle,
  signOut
} from './firebase-client.js';

const screens = ['loading', 'sign-in', 'unauthorised', 'error', 'dashboard'];
const dom = {
  profile: document.querySelector('#profile-slot'),
  googleSignIn: document.querySelector('#google-sign-in'),
  unauthorisedSignOut: document.querySelector('#unauthorised-sign-out'),
  errorDetail: document.querySelector('#error-detail'),
  errorSignOut: document.querySelector('#error-sign-out'),
  retry: document.querySelector('#retry-button'),
  total: document.querySelector('#total-count'),
  search: document.querySelector('#search-input'),
  marksFilter: document.querySelector('#marks-filter'),
  sort: document.querySelector('#sort-select'),
  shown: document.querySelector('#shown-count'),
  tableBody: document.querySelector('#submissions-body'),
  empty: document.querySelector('#empty-state'),
  export: document.querySelector('#export-button'),
  signOut: document.querySelector('#sign-out')
};

let activeUser = null;
let submissions = [];
let authorising = false;
let authObserverBound = false;

function showScreen(name) {
  screens.forEach((screen) => {
    document.querySelector(`#screen-${screen}`).hidden = screen !== name;
  });
}

function formatDate(timestamp) {
  if (!timestamp?.toDate) return 'Pending server timestamp';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(timestamp.toDate());
}

function formatIsoDate(timestamp) {
  return timestamp?.toDate ? timestamp.toDate().toISOString() : '';
}

function renderProfile(user) {
  if (!user) {
    dom.profile.hidden = true;
    dom.profile.replaceChildren();
    return;
  }
  const image = document.createElement('img');
  image.className = 'profile-image';
  image.alt = '';
  image.referrerPolicy = 'no-referrer';
  image.src = user.photoURL || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect width="100%25" height="100%25" fill="%23142b45"/%3E%3Ctext x="50%25" y="55%25" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="18" fill="white"%3EA%3C/text%3E%3C/svg%3E';
  const text = document.createElement('span');
  text.className = 'profile-text';
  const name = document.createElement('strong');
  name.textContent = user.displayName || 'Administrator';
  const email = document.createElement('small');
  email.textContent = user.email || '';
  text.append(name, email);
  dom.profile.replaceChildren(image, text);
  dom.profile.hidden = false;
}

function setError(message, { canSignOut = Boolean(activeUser) } = {}) {
  dom.errorDetail.textContent = message;
  dom.errorSignOut.hidden = !canSignOut;
  showScreen('error');
}

function timestampMs(timestamp) {
  return timestamp?.toMillis ? timestamp.toMillis() : 0;
}

function filteredSubmissions() {
  const term = dom.search.value.trim().toLocaleLowerCase();
  const range = dom.marksFilter.value;
  const sorted = submissions.filter((submission) => {
    const matchesSearch = !term
      || submission.rollNumber.toLocaleLowerCase().includes(term)
      || submission.name.toLocaleLowerCase().includes(term);
    const matchesMarks = range === 'all' || (() => {
      const [min, max] = range.split('-').map(Number);
      return submission.marks >= min && submission.marks <= max;
    })();
    return matchesSearch && matchesMarks;
  });

  const sort = dom.sort.value;
  return sorted.sort((a, b) => {
    if (sort === 'submitted-asc') return timestampMs(a.submittedAt) - timestampMs(b.submittedAt);
    if (sort === 'marks-desc') return b.marks - a.marks || a.name.localeCompare(b.name);
    if (sort === 'marks-asc') return a.marks - b.marks || a.name.localeCompare(b.name);
    if (sort === 'name-asc') return a.name.localeCompare(b.name);
    return timestampMs(b.submittedAt) - timestampMs(a.submittedAt);
  });
}

function appendCell(row, text, className = '') {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  cell.textContent = text;
  row.append(cell);
}

function renderTable() {
  const rows = filteredSubmissions();
  const fragment = document.createDocumentFragment();
  rows.forEach((submission) => {
    const row = document.createElement('tr');
    appendCell(row, submission.rollNumber, 'roll-cell');
    appendCell(row, submission.name, 'name-cell');
    appendCell(row, submission.email, 'email-cell');
    appendCell(row, String(submission.marks), 'marks-cell');
    appendCell(row, submission.feedback, 'feedback-cell');
    appendCell(row, formatDate(submission.submittedAt), 'date-cell');
    fragment.append(row);
  });
  dom.tableBody.replaceChildren(fragment);
  dom.empty.hidden = rows.length !== 0;
  dom.shown.textContent = `Showing ${rows.length} of ${submissions.length} submission${submissions.length === 1 ? '' : 's'}.`;
}

async function loadSubmissions() {
  const snapshot = await getDocs(query(collection(db, 'submissions')));
  submissions = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  dom.total.textContent = String(submissions.length);
  renderTable();
}

async function authoriseUser(user) {
  if (authorising) return;
  authorising = true;
  activeUser = user;
  renderProfile(user);
  showScreen('loading');
  try {
    if (!isVerifiedGoogleUser(user)) {
      showScreen('unauthorised');
      return;
    }
    // Force a token refresh so a newly granted custom claim is recognised.
    const token = await user.getIdTokenResult(true);
    if (token.claims.admin !== true) {
      showScreen('unauthorised');
      return;
    }
    await loadSubmissions();
    showScreen('dashboard');
  } catch (error) {
    setError(`Could not load the private dashboard. ${describeFirebaseError(error)}`);
  } finally {
    authorising = false;
  }
}

async function handleSignIn() {
  dom.googleSignIn.disabled = true;
  dom.googleSignIn.textContent = 'Opening Google…';
  try {
    const result = await signInWithGoogle({ preferRedirect: isLikelyMobileBrowser() });
    if (result?.redirected) showScreen('loading');
  } catch (error) {
    setError(describeFirebaseError(error), { canSignOut: false });
  } finally {
    dom.googleSignIn.disabled = false;
    dom.googleSignIn.innerHTML = '<span class="google-g" aria-hidden="true">G</span> Sign in as administrator';
  }
}

async function handleSignOut() {
  if (firebaseReady && auth) await signOut(auth);
  activeUser = null;
  submissions = [];
  authorising = false;
  renderProfile(null);
  showScreen('sign-in');
}

function safeCsvCell(value) {
  const text = String(value ?? '');
  // Avoid spreadsheet formula execution when a CSV is opened in Excel.
  const protectedText = /^\s*[=+\-@]/.test(text) ? `\t${text}` : text;
  return `"${protectedText.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const header = ['Roll Number', 'Student Name', 'Email', 'Marks', 'Feedback', 'Submitted At (ISO 8601)'];
  const lines = [header.map(safeCsvCell).join(',')];
  submissions.forEach((submission) => {
    lines.push([
      submission.rollNumber,
      submission.name,
      submission.email,
      submission.marks,
      submission.feedback,
      formatIsoDate(submission.submittedAt)
    ].map(safeCsvCell).join(','));
  });
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `soft-skills-lab-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function initialise() {
  if (!firebaseReady) {
    setError('Firebase is not configured. Add your Web App configuration in public/firebase-config.js before using the dashboard.', { canSignOut: false });
    return;
  }
  try {
    await completeGoogleRedirect();
  } catch (error) {
    setError(describeFirebaseError(error), { canSignOut: false });
  }
  if (!authObserverBound) {
    authObserverBound = true;
    onAuthStateChanged(auth, (user) => {
      if (user) authoriseUser(user);
      else if (!activeUser) showScreen('sign-in');
    });
  }
}

dom.googleSignIn.addEventListener('click', handleSignIn);
dom.unauthorisedSignOut.addEventListener('click', handleSignOut);
dom.errorSignOut.addEventListener('click', handleSignOut);
dom.signOut.addEventListener('click', handleSignOut);
dom.retry.addEventListener('click', () => {
  if (activeUser) authoriseUser(activeUser);
  else initialise();
});
[dom.search, dom.marksFilter, dom.sort].forEach((control) => control.addEventListener('input', renderTable));
dom.export.addEventListener('click', exportCsv);

initialise();
