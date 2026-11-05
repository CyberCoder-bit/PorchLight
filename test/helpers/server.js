// Test helpers (v2 accounts): start the real app on a temporary data file
// with MOCK sparks, and sign in as anyone in the demo data.
//
//   const app = await startApp();               // { base, store, close, get, post, cookieFor, signIn }
//   const cookie = await app.cookieFor('admin');  // 'pl_session=...'
//   await app.get('/admin', { as: 'admin' });
//   await app.post('/contacts', { ... }, { as: 'volunteer:v-ethan' });
//
// `who` can be an email, 'admin' (or 'coordinator'), a demo button name
// ('senior', 'senior-ar', 'volunteer', 'volunteer-translate', 'family'), or
// the old demo sign-in values: 'volunteer:v-ethan', 'senior:s-harold',
// 'family:s-harold' (the approved family member of that senior).
//
// cookieFor() makes a session straight in the store (fast: no password
// work). signIn() goes through POST /sign-in with the README's demo password.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../../src/store.js';
import { createApp } from '../../src/app.js';
import { createNodeServer } from '../../src/node-server.js';
import { createSparkService } from '../../src/sparks/index.js';
import { buildConfig, ROOT_DIR } from '../../src/config.js';
import { createSession, SESSION_COOKIE } from '../../src/auth/session.js';
import { DEMO_ACCOUNTS, SEED_ADMIN_EMAIL } from '../../src/auth/routes.js';

process.env.TZ = 'America/Indiana/Indianapolis';

// The demo password lives only in the docs (README and docs/setup.md), never in code.
export function demoPassword() {
  const readme = fs.readFileSync(path.join(ROOT_DIR, 'README.md'), 'utf8');
  const m = /shared demo password[^`]*`([^`]+)`/i.exec(readme);
  if (!m) throw new Error('README.md has no "shared demo password" in backticks');
  return m[1];
}

export function userFor(store, who) {
  if (who === 'admin' || who === 'coordinator') return store.userByEmail(SEED_ADMIN_EMAIL);
  if (DEMO_ACCOUNTS[who]) return store.userByEmail(DEMO_ACCOUNTS[who]);
  if (typeof who === 'string' && who.includes('@')) return store.userByEmail(who);
  const [kind, id] = String(who).split(':');
  if (kind === 'volunteer') return store.users.find((u) => u.role === 'volunteer' && u.volunteerId === id) || null;
  if (kind === 'senior') return store.users.find((u) => u.role === 'senior' && u.seniorId === id) || null;
  if (kind === 'family') {
    const link = store.familyLinks.find((l) => l.seniorId === id && l.status === 'approved');
    return link ? store.user(link.userId) : null;
  }
  return null;
}

// A fresh session cookie for `who`, made straight in the store.
export async function sessionCookieFor(store, who) {
  const user = userFor(store, who);
  if (!user) throw new Error(`No demo account for ${who}`);
  return `${SESSION_COOKIE}=${await createSession(store, user.id, { save: false })}`;
}

// Like a browser form: an array value becomes a repeated field (checkbox groups).
export const encode = (data) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data || {})) {
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  return params.toString();
};

// The session cookie from a response's Set-Cookie headers, or null.
export function sessionFrom(res) {
  for (const c of res.headers.getSetCookie()) {
    const m = new RegExp(`^${SESSION_COOKIE}=([^;]*)`).exec(c);
    if (m) return m[1] ? `${SESSION_COOKIE}=${m[1]}` : null;
  }
  return null;
}

// A fetch that adds a session for `who` (a value, or a function returning
// one) unless the request already carries a session cookie. Each request gets
// a new session, so a demo reset in between never leaves a stale cookie.
// Use it in old tests as `const fetch = fetchAs(() => store, 'admin');`.
export function fetchAs(getStore, who = 'admin') {
  return async (url, init = {}) => {
    const headers = new Headers(init.headers || {});
    const current = headers.get('cookie') || '';
    const person = typeof who === 'function' ? who() : who;
    if (person && !current.includes(`${SESSION_COOKIE}=`)) {
      const session = await sessionCookieFor(getStore(), person);
      headers.set('cookie', current ? `${current}; ${session}` : session);
    }
    return globalThis.fetch(url, { ...init, headers });
  };
}

export async function startApp({ now, prefix = 'porchlight-test-' } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const store = new Store(path.join(tmpDir, 'db.json'));
  store.open();
  const sparks = createSparkService(buildConfig({}), { effective: 'mock', reason: 'test', warning: null });
  const server = createNodeServer({ handle: createApp({ store, sparks, ...(now ? { now } : {}) }), publicDir: path.join(ROOT_DIR, 'public') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const headersFor = async ({ as, cookie } = {}) => {
    const parts = [];
    if (cookie) parts.push(cookie);
    if (as) parts.push(await sessionCookieFor(store, as));
    return parts.length ? { cookie: parts.join('; ') } : {};
  };
  const get = async (p, opts = {}) => globalThis.fetch(base + p, { redirect: 'manual', headers: await headersFor(opts) });
  const post = async (p, data = {}, opts = {}) =>
    globalThis.fetch(base + p, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', ...(await headersFor(opts)) },
      body: encode(data),
    });
  // A real sign-in through the form, with the README's demo password.
  const signIn = async (who, password = demoPassword()) => {
    const email = userFor(store, who)?.email || who;
    const res = await post('/sign-in', { email, password });
    return sessionFrom(res);
  };

  return {
    base,
    store,
    get,
    post,
    signIn,
    cookieFor: (who) => sessionCookieFor(store, who),
    close: () => {
      server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}
