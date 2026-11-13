export const FORM_LIMITS = Object.freeze({
  rollNumberLength: 10,
  nameMin: 2,
  nameMax: 100,
  marksMin: 1,
  marksMax: 50,
  feedbackMax: 3000
});

function asText(value) {
  return typeof value === 'string' ? value : String(value ?? '');
}

export function validateRollNumber(value) {
  const rollNumber = asText(value);
  if (!/^\d{10}$/.test(rollNumber)) {
    return 'Enter exactly 10 numeric digits.';
  }
  return '';
}

export function validateName(value) {
  const name = asText(value).trim();
  if (name.length < FORM_LIMITS.nameMin || name.length > FORM_LIMITS.nameMax) {
    return 'Enter a name between 2 and 100 characters.';
  }
  // Unicode property escapes allow names such as Aisha, Priya, José, and 李明.
  if (!/\p{L}/u.test(name)) {
    return 'Enter a name containing at least one letter.';
  }
  return '';
}

export function validateMarks(value) {
  const marks = asText(value);
  if (!/^\d+$/.test(marks)) {
    return 'Enter a whole number from 1 to 50.';
  }
  const numericMarks = Number(marks);
  if (!Number.isInteger(numericMarks) || numericMarks < FORM_LIMITS.marksMin || numericMarks > FORM_LIMITS.marksMax) {
    return 'Marks must be an integer from 1 to 50.';
  }
  return '';
}

export function validateFeedback(value) {
  const feedback = asText(value);
  if (feedback.trim().length === 0) {
    return 'Please share your feedback.';
  }
  if (feedback.length > FORM_LIMITS.feedbackMax) {
    return 'Feedback cannot exceed 3,000 characters.';
  }
  return '';
}

export function validateSubmission(values) {
  const errors = {
    rollNumber: validateRollNumber(values.rollNumber),
    name: validateName(values.name),
    marks: validateMarks(values.marks),
    feedback: validateFeedback(values.feedback)
  };

  return {
    errors,
    isValid: Object.values(errors).every((error) => error === '')
  };
}
