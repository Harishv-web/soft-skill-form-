import {
  auth,
  db,
  describeFirebaseError,
  doc,
  firebaseReady,
  getDoc,
  isLikelyMobileBrowser,
  isVerifiedGoogleUser,
  onAuthStateChanged,
  serverTimestamp,
  setDoc,
  signInWithGoogle,
  signOut,
  completeGoogleRedirect
} from './firebase-client.js';
import { FORM_LIMITS, validateFeedback, validateMarks, validateName, validateRollNumber, validateSubmission } from './validation.js';

const screens = ['loading', 'sign-in', 'form', 'success', 'already-submitted', 'error'];
const dom = {
  status: document.querySelector('#app-status'),
  profile: document.querySelector('#profile-slot'),
  form: document.querySelector('#feedback-form'),
  rollNumber: document.querySelector('#roll-number'),
  name: document.querySelector('#student-name'),
  marks: document.querySelector('#marks'),
  feedback: document.querySelector('#feedback'),
  feedbackCounter: document.querySelector('#feedback-counter'),
  submitButton: document.querySelector('#submit-button'),
  successDetail: document.querySelector('#success-detail'),
  alreadyDetail: document.querySelector('#already-detail'),
  errorDetail: document.querySelector('#error-detail'),
  errorSignOut: document.querySelector('#error-sign-out'),
  googleSignIn: document.querySelector('#google-sign-in'),
  retry: document.querySelector('#retry-button'),
  successSignOut: document.querySelector('#success-sign-out'),
  alreadySignOut: document.querySelector('#already-sign-out')
};

const errors = {
  rollNumber: document.querySelector('#roll-number-error'),
  name: document.querySelector('#student-name-error'),
  marks: document.querySelector('#marks-error'),
  feedback: document.querySelector('#feedback-error')
};

let activeUser = null;
let isSaving = false;
let authObserverBound = false;

function showScreen(name) {
  screens.forEach((screen) => {
    document.querySelector(`#screen-${screen}`).hidden = screen !== name;
  });
}

function showStatus(message = '', type = '') {
  dom.status.textContent = message;
  dom.status.className = `status-message${type ? ` is-${type}` : ''}`;
  dom.status.hidden = !message;
}

function formatDate(timestamp) {
  if (!timestamp?.toDate) return '';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium'
  }).format(timestamp.toDate());
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
  image.src = user.photoURL || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect width="100%25" height="100%25" fill="%23142b45"/%3E%3Ctext x="50%25" y="55%25" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="18" fill="white"%3E%3F%3C/text%3E%3C/svg%3E';
  const text = document.createElement('span');
  text.className = 'profile-text';
  const name = document.createElement('strong');
  name.textContent = user.displayName || 'Signed-in student';
  const email = document.createElement('small');
  email.textContent = user.email || '';
  text.append(name, email);
  dom.profile.replaceChildren(image, text);
  dom.profile.hidden = false;
}

function setFieldError(field, message) {
  const control = dom[field];
  errors[field].textContent = message;
  control.toggleAttribute('aria-invalid', Boolean(message));
  control.closest('.field-group').classList.toggle('has-error', Boolean(message));
}

function clearFieldErrors() {
  Object.keys(errors).forEach((field) => setFieldError(field, ''));
}

function updateFeedbackCounter() {
  const length = dom.feedback.value.length;
  dom.feedbackCounter.textContent = `${length} / ${FORM_LIMITS.feedbackMax}`;
  dom.feedbackCounter.classList.toggle('at-limit', length >= FORM_LIMITS.feedbackMax);
}

function currentValues() {
  return {
    rollNumber: dom.rollNumber.value,
    name: dom.name.value,
    marks: dom.marks.value,
    feedback: dom.feedback.value
  };
}

function validateOne(field) {
  const value = dom[field].value;
  const validator = {
    rollNumber: validateRollNumber,
    name: validateName,
    marks: validateMarks,
    feedback: validateFeedback
  }[field];
  const message = validator(value);
  setFieldError(field, message);
  return !message;
}

function setSaving(saving) {
  isSaving = saving;
  dom.submitButton.disabled = saving;
  dom.submitButton.textContent = saving ? 'Saving your response…' : 'Submit securely';
}

function setError(message, { canSignOut = Boolean(activeUser) } = {}) {
  dom.errorDetail.textContent = message;
  dom.errorSignOut.hidden = !canSignOut;
  showScreen('error');
}

async function checkExistingSubmission(user) {
  showScreen('loading');
  showStatus('Checking your one-time submission status…');
  const submissionRef = doc(db, 'submissions', user.uid);
  const snapshot = await getDoc(submissionRef);
  showStatus();
  if (snapshot.exists()) {
    const timestamp = formatDate(snapshot.data().submittedAt);
    dom.alreadyDetail.textContent = timestamp
      ? `This Google account submitted a response on ${timestamp}.`
      : 'This Google account already has a recorded Soft Skills Lab response.';
    showScreen('already-submitted');
    return;
  }
  clearFieldErrors();
  showScreen('form');
}

async function processAuthenticatedUser(user) {
  activeUser = user;
  renderProfile(user);
  if (!isVerifiedGoogleUser(user)) {
    await signOut(auth);
    activeUser = null;
    renderProfile(null);
    setError('Only verified Google accounts can submit this form.', { canSignOut: false });
    return;
  }

  try {
    await checkExistingSubmission(user);
  } catch (error) {
    setError(`Unable to verify submission status. ${describeFirebaseError(error)}`);
  }
}

async function handleSignIn() {
  dom.googleSignIn.disabled = true;
  dom.googleSignIn.textContent = 'Opening Google…';
  showStatus();
  try {
    const result = await signInWithGoogle({ preferRedirect: isLikelyMobileBrowser() });
    if (result?.redirected) {
      showScreen('loading');
      return;
    }
  } catch (error) {
    setError(describeFirebaseError(error), { canSignOut: false });
  } finally {
    dom.googleSignIn.disabled = false;
    dom.googleSignIn.innerHTML = '<span class="google-g" aria-hidden="true">G</span> Continue with Google';
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!activeUser || isSaving) return;

  const values = currentValues();
  const result = validateSubmission(values);
  Object.entries(result.errors).forEach(([field, message]) => setFieldError(field, message));
  if (!result.isValid) {
    document.querySelector('.has-error input, .has-error textarea')?.focus();
    return;
  }

  setSaving(true);
  showStatus('Saving your response securely…');
  try {
    const submissionRef = doc(db, 'submissions', activeUser.uid);
    await setDoc(submissionRef, {
      email: activeUser.email,
      rollNumber: values.rollNumber,
      name: values.name.trim(),
      marks: Number(values.marks),
      feedback: values.feedback.trim(),
      submittedAt: serverTimestamp()
    });

    // The write promise only resolves after Firestore confirms the committed write.
    const confirmed = await getDoc(submissionRef);
    const submittedAt = confirmed.exists() ? formatDate(confirmed.data().submittedAt) : '';
    dom.successDetail.textContent = submittedAt
      ? `Your response was securely recorded on ${submittedAt}.`
      : 'Your response was securely recorded.';
    showStatus();
    showScreen('success');
  } catch (error) {
    // A concurrent second tab is denied as an update; show the accurate state.
    try {
      const existing = await getDoc(doc(db, 'submissions', activeUser.uid));
      if (existing.exists()) {
        const submittedAt = formatDate(existing.data().submittedAt);
        dom.alreadyDetail.textContent = submittedAt
          ? `This Google account submitted a response on ${submittedAt}.`
          : 'This Google account already has a recorded Soft Skills Lab response.';
        showStatus();
        showScreen('already-submitted');
        return;
      }
    } catch {
      // Preserve the original write error if status cannot be rechecked.
    }
    showStatus();
    setError(`Your response was not saved. ${describeFirebaseError(error)}`);
  } finally {
    setSaving(false);
  }
}

async function handleSignOut() {
  if (firebaseReady && auth) await signOut(auth);
  activeUser = null;
  renderProfile(null);
  dom.form.reset();
  updateFeedbackCounter();
  clearFieldErrors();
  showStatus();
  showScreen('sign-in');
}

async function initialise() {
  updateFeedbackCounter();
  if (!firebaseReady) {
    setError('Firebase is not configured. Add your Web App configuration in public/firebase-config.js before using this form.', { canSignOut: false });
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
      if (user) {
        processAuthenticatedUser(user).catch((error) => setError(describeFirebaseError(error)));
      } else if (!activeUser) {
        renderProfile(null);
        showScreen('sign-in');
      }
    });
  }
}

dom.rollNumber.addEventListener('input', () => {
  dom.rollNumber.value = dom.rollNumber.value.replace(/\D/g, '').slice(0, FORM_LIMITS.rollNumberLength);
  validateOne('rollNumber');
});
dom.marks.addEventListener('input', () => {
  dom.marks.value = dom.marks.value.replace(/\D/g, '').slice(0, 2);
  validateOne('marks');
});
dom.name.addEventListener('blur', () => validateOne('name'));
dom.feedback.addEventListener('input', () => {
  updateFeedbackCounter();
  if (errors.feedback.textContent) validateOne('feedback');
});
dom.form.addEventListener('submit', handleSubmit);
dom.googleSignIn.addEventListener('click', handleSignIn);
dom.retry.addEventListener('click', () => {
  if (activeUser) checkExistingSubmission(activeUser).catch((error) => setError(describeFirebaseError(error)));
  else initialise();
});
[dom.successSignOut, dom.alreadySignOut, dom.errorSignOut].forEach((button) => button.addEventListener('click', handleSignOut));

initialise();
