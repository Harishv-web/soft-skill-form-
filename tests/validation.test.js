import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateFeedback,
  validateMarks,
  validateName,
  validateRollNumber,
  validateSubmission
} from '../public/validation.js';

test('roll number requires exactly ten ASCII digits', () => {
  assert.equal(validateRollNumber('1234567890'), '');
  assert.notEqual(validateRollNumber('123456789'), '');
  assert.notEqual(validateRollNumber('12345678901'), '');
  assert.notEqual(validateRollNumber('12345abc90'), '');
  assert.notEqual(validateRollNumber('12345 7890'), '');
});

test('student name accepts Unicode letters and rejects numeric-only names', () => {
  assert.equal(validateName('Aisha Khan'), '');
  assert.equal(validateName('李明'), '');
  assert.notEqual(validateName('1'), '');
  assert.notEqual(validateName('12345'), '');
  assert.notEqual(validateName('A'.repeat(101)), '');
});

test('marks are whole numbers in the inclusive 1 to 50 range', () => {
  assert.equal(validateMarks('1'), '');
  assert.equal(validateMarks('50'), '');
  assert.notEqual(validateMarks('0'), '');
  assert.notEqual(validateMarks('51'), '');
  assert.notEqual(validateMarks('2.5'), '');
  assert.notEqual(validateMarks('-1'), '');
});

test('feedback is required and limited to 3000 characters', () => {
  assert.equal(validateFeedback('The sessions were useful.'), '');
  assert.notEqual(validateFeedback('   '), '');
  assert.notEqual(validateFeedback('a'.repeat(3001)), '');
});

test('complete valid submission passes all validators', () => {
  const result = validateSubmission({
    rollNumber: '1234567890',
    name: 'Priya Nair',
    marks: '45',
    feedback: 'The lab sessions helped me prepare for the exams.'
  });
  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, { rollNumber: '', name: '', marks: '', feedback: '' });
});
