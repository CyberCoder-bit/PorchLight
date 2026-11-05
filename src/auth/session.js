// Sessions (v2). Signing in makes a random 32-byte token. The browser keeps
// the token in the `pl_session` cookie; the store keeps only its SHA-256, so
// a copy of the data file can't be used to sign in as anyone.
//
//   createSession(store, userId)   -> token (save it in the cookie)
//   userForToken(store, token)     -> the user, or null (unknown, expired, or deleted)
//   endSession(store, token)       -> forgets it (sign-out)
//   sessionCookie(res, req, token) / clearSessionCookie(res, req)
//
// Sessions use the real clock, not the demo's clock, and last 8 hours.

import { toBase64 } from './password.js';

export const SESSION_COOKIE = 'pl_session';
export const SESSION_SECONDS = 8 * 60 * 60;
const MAX_SESSIONS = 5000; // the oldest are dropped first

const enc = new TextEncoder();
const base64url = (bytes) => toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function tokenHash(token) {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(token)))));
}

function prune(store, nowMs) {
  store.data.sessions = store.sessions.filter((s) => Date.parse(s.expiresAt) > nowMs);
  if (store.sessions.length > MAX_SESSIONS) store.data.sessions = store.sessions.slice(-MAX_SESSIONS);
}

export async function createSession(store, userId, { save = true } = {}) {
  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  prune(store, now);
  store.sessions.push({
    tokenHash: await tokenHash(token),
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_SECONDS * 1000).toISOString(),
  });
  if (save) store.save();
  return token;
}

const looksLikeToken = (token) => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);

export async function userForToken(store, token) {
  if (!looksLikeToken(token)) return null;
  const hash = await tokenHash(token);
  const session = store.sessions.find((s) => s.tokenHash === hash);
  if (!session || !(Date.parse(session.expiresAt) > Date.now())) return null;
  return store.user(session.userId);
}

export async function endSession(store, token) {
  if (!looksLikeToken(token)) return;
  const hash = await tokenHash(token);
  const before = store.sessions.length;
  store.data.sessions = store.sessions.filter((s) => s.tokenHash !== hash);
  if (store.sessions.length !== before) store.save();
}

const cookieOptions = (req) => ({ httpOnly: true, sameSite: 'Lax', secure: Boolean(req.secure) });

export function sessionCookie(res, req, token) {
  res.setCookie(SESSION_COOKIE, token, SESSION_SECONDS, cookieOptions(req));
}

export function clearSessionCookie(res, req) {
  res.setCookie(SESSION_COOKIE, '', 0, cookieOptions(req));
}
