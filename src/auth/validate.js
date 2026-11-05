// Checks for the account fields (v2). Errors are keyed by field name, like
// the other forms, and the words come from t() (src/i18n/en/auth.js).

import { t } from '../i18n/index.js';

export const MAX_EMAIL = 254;
export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 200;

// A short list of passwords people pick first. Checked without letter case.
const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd', 'p@ssw0rd',
  '1234567890', '0123456789', '12345678910', '1111111111', '0000000000', '9876543210',
  'qwertyuiop', 'qwerty1234', 'qwerty12345', '1q2w3e4r5t', 'abcdefghij', 'abc1234567',
  'iloveyou12', 'letmein123', 'welcome123', 'sunshine12', 'football12', 'baseball12', 'basketball',
  'princess12', 'dragon1234', 'monkey1234', 'starwars12', 'trustno1', 'changeme12',
  'porchlight', 'porchlight1', 'porchlight123', 'indiana123', 'carmel1234',
]);

export const normalizeEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

// Something@something.something, with no spaces. The real test is the email
// arriving, which a real launch would send.
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function checkEmail(email, errors, field = 'email') {
  if (!email) errors[field] = t('auth.errors.emailMissing');
  else if (email.length > MAX_EMAIL) errors[field] = t('auth.errors.emailLong', { max: MAX_EMAIL });
  else if (!EMAIL.test(email)) errors[field] = t('auth.errors.emailFormat');
}

export function checkPassword(password, email, errors, field = 'password') {
  if (!password) errors[field] = t('auth.errors.passwordMissing', { min: MIN_PASSWORD });
  else if ([...password].length < MIN_PASSWORD) errors[field] = t('auth.errors.passwordShort', { min: MIN_PASSWORD });
  else if (password.length > MAX_PASSWORD) errors[field] = t('auth.errors.passwordLong', { max: MAX_PASSWORD });
  else if (email && password.trim().toLowerCase() === email) errors[field] = t('auth.errors.passwordIsEmail');
  else if (COMMON.has(password.trim().toLowerCase())) errors[field] = t('auth.errors.passwordCommon');
}

// The password as typed: never trimmed (a space can be part of it).
export const passwordFrom = (v) => (typeof v === 'string' ? v : '');
