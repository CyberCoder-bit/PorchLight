// Passwords (v2): PBKDF2-SHA256 through Web Crypto (crypto.subtle), so the
// same code runs on Node and on Cloudflare Workers with nothing installed.
//
//   hashPassword(password)           -> { algo: 'pbkdf2-sha256', iterations, salt, hash } (base64)
//   verifyPassword(password, record) -> true or false, using the record's own iteration count
//   wasteTime(password)              -> the same work for an email we don't know, so the
//                                       answer takes as long either way
//
// We never store or log the password itself. No AI is involved anywhere here.

const enc = new TextEncoder();

export const ALGO = 'pbkdf2-sha256';
export const ITERATIONS = 40000;
const SALT_BYTES = 16;
const HASH_BITS = 256; // 32 bytes
// Cloudflare Workers allow at most 100,000 PBKDF2 iterations. A count outside
// this range can't be one of ours, so it never verifies.
const MIN_ITERATIONS = 10000;
const MAX_ITERATIONS = 100000;

export const toBase64 = (bytes) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
export const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, HASH_BITS);
  return new Uint8Array(bits);
}

// XOR over every byte, always, so the time taken never says how much matched.
export function sameBytes(a, b) {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function hashPassword(password, { iterations = ITERATIONS, salt } = {}) {
  const saltBytes = salt ? fromBase64(salt) : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, saltBytes, iterations);
  return { algo: ALGO, iterations, salt: toBase64(saltBytes), hash: toBase64(hash) };
}

function usable(record) {
  return (
    record &&
    record.algo === ALGO &&
    Number.isInteger(record.iterations) &&
    record.iterations >= MIN_ITERATIONS &&
    record.iterations <= MAX_ITERATIONS &&
    typeof record.salt === 'string' &&
    typeof record.hash === 'string'
  );
}

export async function verifyPassword(password, record) {
  if (typeof password !== 'string' || !usable(record)) return wasteTime(password);
  let salt;
  let expected;
  try {
    salt = fromBase64(record.salt);
    expected = fromBase64(record.hash);
  } catch {
    return wasteTime(password);
  }
  const actual = await derive(password, salt, record.iterations);
  return sameBytes(actual, expected);
}

// A made-up record (a random salt, made the first time it's needed: Cloudflare
// Workers refuse to start if a module makes random values while it loads,
// V2-B-01). Checking a password against it costs the same as a real check,
// and the answer is always "no".
let dummySalt = null;
const DUMMY_HASH = new Uint8Array(HASH_BITS / 8);
export async function wasteTime(password) {
  dummySalt ??= crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const actual = await derive(typeof password === 'string' ? password : '', dummySalt, ITERATIONS);
  sameBytes(actual, DUMMY_HASH);
  return false;
}
