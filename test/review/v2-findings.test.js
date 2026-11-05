// Review of v2 (accounts, roles, /admin, languages, messages, translate):
// findings V2-B-01 to V2-B-13. Each test failed before its bug was fixed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { startApp, sessionCookieFor, sessionFrom, encode } from '../helpers/server.js';
import { Store } from '../../src/store.js';
import { createApp } from '../../src/app.js';
import { createNodeServer } from '../../src/node-server.js';
import { createSparkService, resolveSparkMode } from '../../src/sparks/index.js';
import { buildConfig, ROOT_DIR } from '../../src/config.js';

// ---------- helpers ----------

// Many requests at the same moment, each on its own connection.
function burst(base, requests) {
  const url = new URL(base);
  const agent = new http.Agent({ keepAlive: false, maxSockets: Infinity });
  const one = ({ path: p, body }) =>
    new Promise((resolve, reject) => {
      const data = encode(body);
      const req = http.request(
        { host: url.hostname, port: url.port, path: p, method: 'POST', agent, headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(data) } },
        (res) => {
          res.resume();
          res.on('end', () => resolve(res.statusCode));
        }
      );
      req.on('error', reject);
      req.end(data);
    });
  return Promise.all(requests.map(one)).finally(() => agent.destroy());
}

const SENIOR_FORM = { interests: 'gardening', availability: 'mon-morning', contactMethod: 'phone', town: 'Carmel' };

// A stand-in for the Gemini API that records every request it gets.
async function fakeGemini() {
  const received = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      received.push(raw);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({ translation: 'ترجمة' }) }] }, finishReason: 'STOP', index: 0 }],
        modelVersion: 'fake',
      }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, received, close: () => server.close() };
}

// The app on `store`, in MOCK or in LIVE mode (LIVE talks to `baseUrl`).
async function appOn(store, { live = false, baseUrl } = {}) {
  const config = buildConfig(live ? { GEMINI_API_KEY: 'gemini-test-key', GEMINI_BASE_URL: baseUrl } : {});
  const sparks = createSparkService(config, { effective: live ? 'live' : 'mock', reason: 'test', warning: null });
  const server = createNodeServer({ handle: createApp({ store, sparks }), publicDir: path.join(ROOT_DIR, 'public') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = async ({ as, cookie } = {}) => ({ ...(as ? { cookie: await sessionCookieFor(store, as) } : cookie ? { cookie } : {}) });
  return {
    base,
    get: async (p, opts) => fetch(base + p, { redirect: 'manual', headers: await headers(opts) }),
    post: async (p, data, opts) =>
      fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', ...(await headers(opts)) }, body: encode(data) }),
    close: () => server.close(),
  };
}

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-v2b-'));
  const store = new Store(path.join(dir, 'db.json'));
  store.open();
  return { store, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const aiTries = (store) => store.data.usage?.total ?? 0;

// ---------- V2-B-01 (BLOCKER) ----------

test('V2-B-01: no module makes a random value while it loads (Cloudflare Workers refuses to start otherwise)', () => {
  // Workers forbid crypto.getRandomValues()/randomUUID() in global scope:
  // "Disallowed operation called within global scope ... generating random values".
  const imports = ['src/app.js', 'src/app-config.js', 'src/store-core.js', 'src/sparks/index.js']
    .map((f) => `await import(${JSON.stringify(pathToFileURL(path.join(ROOT_DIR, f)).href)});`)
    .join('\n');
  const code = `
    const real = crypto.getRandomValues.bind(crypto);
    const realUuid = crypto.randomUUID.bind(crypto);
    let loading = true;
    crypto.getRandomValues = (a) => { if (loading) throw new Error('getRandomValues() called while modules load'); return real(a); };
    crypto.randomUUID = () => { if (loading) throw new Error('randomUUID() called while modules load'); return realUuid(); };
    ${imports}
    loading = false;
  `;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: ROOT_DIR, encoding: 'utf8' });
  assert.equal(run.status, 0, `importing the app made a random value at load time:\n${run.stderr}`);
});

// ---------- V2-B-02 (HIGH) ----------

test("V2-B-02: a new companion does not see the previous volunteer's call notes about the senior", async () => {
  const app = await startApp();
  try {
    const { store } = app;
    const ethanNotes = store.contacts
      .filter((c) => c.seniorId === 's-harold' && c.volunteerId === 'v-ethan' && c.notes && c.status !== 'scheduled')
      .map((c) => c.notes);
    assert.ok(ethanNotes.length > 0, 'the demo data has Ethan’s notes about Hal');

    // The coordinator ends Hal's match with Ethan and matches Hal with Sam.
    let res = await app.post('/admin/matches/m-harold-ethan/end', {}, { as: 'admin' });
    assert.equal(res.status, 303);
    const hal = store.senior('s-harold');
    Object.assign(store.volunteer('v-sam'), { availability: [...hal.availability], contactMethods: ['phone', 'video', 'visit'], languages: hal.languages, town: hal.town });
    res = await app.post('/admin/matches', { seniorId: 's-harold', volunteerId: 'v-sam' }, { as: 'admin' });
    assert.equal(res.status, 303, 'Sam is matched with Hal');

    const page = await (await app.get('/seniors/s-harold', { as: 'volunteer:v-sam' })).text();
    const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const leaked = ethanNotes.filter((n) => page.includes(escape(n)));
    assert.deepEqual(leaked, [], 'Sam sees notes that Ethan wrote');
  } finally {
    app.close();
  }
});

// ---------- V2-B-03 (MEDIUM) ----------

test('V2-B-03a: the sign-in limit holds when 40 wrong passwords arrive at once', async () => {
  const app = await startApp();
  try {
    const codes = await burst(app.base, Array.from({ length: 40 }, (_, i) => ({ path: '/sign-in', body: { email: 'hal@porchlight.example', password: `wrong-password-${i}` } })));
    const checked = codes.filter((c) => c !== 429).length;
    assert.ok(checked <= 5, `${checked} passwords were checked; the limit is 5 per 15 minutes`);
  } finally {
    app.close();
  }
});

test('V2-B-03b: the sign-up limit holds when 20 senior sign-ups arrive at once', async () => {
  const app = await startApp();
  try {
    const before = app.store.users.length;
    await burst(app.base, Array.from({ length: 20 }, (_, i) => ({ path: '/sign-up/senior', body: { ...SENIOR_FORM, name: `Burst Senior ${i}`, email: `burst${i}@example.com`, password: `Long-enough-pass-${i}` } })));
    const made = app.store.users.length - before;
    assert.ok(made <= 5, `${made} accounts were made from one address; the limit is 5 per hour`);
  } finally {
    app.close();
  }
});

// ---------- V2-B-04 (MEDIUM) ----------

test('V2-B-04: a message written while AI was off ("nothing you write leaves PorchLight") is never sent to the AI later', async () => {
  const { store, cleanup } = tempStore();
  const api = await fakeGemini();
  const mock = await appOn(store);
  let live;
  try {
    // AI is off: the form promises that nothing leaves PorchLight.
    const form = await (await mock.get('/messages/m-samira-jordan', { as: 'volunteer-translate' })).text();
    assert.match(form, /nothing you write leaves PorchLight/);
    const res = await mock.post('/messages/m-samira-jordan', { text: 'Written while AI was off: my dad is in the hospital again.', lang: 'en' }, { as: 'volunteer-translate' });
    assert.equal(res.status, 303);
    mock.close();

    // Later the same data runs with LIVE translation, and Samira (Arabic) opens the thread.
    live = await appOn(store, { live: true, baseUrl: api.baseUrl });
    const page = await live.get('/messages/m-samira-jordan', { as: 'senior-ar' });
    assert.equal(page.status, 200);
    await page.text();
    assert.equal(api.received.length, 0, 'the old message was sent to the AI');
    assert.equal(aiTries(store), 0, 'PorchLight tried to send the old message to the AI');
  } finally {
    live?.close();
    api.close();
    cleanup();
  }
});

// ---------- V2-B-05 (MEDIUM) ----------

test('V2-B-05: a brand-new senior account with no companion cannot spend the shared AI translation budget', async () => {
  const { store, cleanup } = tempStore();
  const api = await fakeGemini();
  const live = await appOn(store, { live: true, baseUrl: api.baseUrl });
  try {
    // Anyone can make a senior account: no approval, no match.
    const signUp = await live.post('/sign-up/senior', { ...SENIOR_FORM, name: 'Throwaway One', email: 'throwaway1@example.com', password: 'Long-enough-pass-1' });
    assert.equal(signUp.status, 303);
    const cookie = sessionFrom(signUp);
    assert.ok(cookie, 'signed in right away');
    const res = await live.post('/translate', { mine: 'Burning the shared budget, one request at a time.', mineLang: 'en', theirs: '', theirsLang: 'ar' }, { cookie });
    assert.equal(res.status, 200);
    await res.text();
    assert.equal(aiTries(store), 0, 'an unmatched, unapproved account used one of the 300 shared AI translations');
  } finally {
    live.close();
    api.close();
    cleanup();
  }
});

// ---------- V2-B-06 (LOW) ----------

test("V2-B-06: /contacts?matchId= (or ?seniorId=) of someone else's pair does not pre-fill that pair's next free time", async () => {
  const app = await startApp();
  try {
    const formValues = async (url) => {
      const page = await (await app.get(url, { as: 'volunteer:v-ethan' })).text();
      return {
        date: /name="date" type="date" value="([^"]*)"/.exec(page)?.[1],
        time: /name="time" type="time" value="([^"]*)"/.exec(page)?.[1],
      };
    };
    const own = await formValues('/contacts');
    assert.deepEqual(await formValues('/contacts?matchId=m-dorothy-maya'), own, "the form shows Dorothy and Maya's shared free time");
    assert.deepEqual(await formValues('/contacts?seniorId=s-dorothy'), own, "the form shows Dorothy's pair's shared free time");
  } finally {
    app.close();
  }
});

// ---------- V2-B-07 (LOW) ----------

test('V2-B-07: a password of only spaces or invisible characters is refused', async () => {
  const app = await startApp();
  try {
    for (const [email, password] of [['spaces@example.com', ' '.repeat(10)], ['zwsp@example.com', '​'.repeat(10)]]) {
      await (await app.post('/sign-up/senior', { ...SENIOR_FORM, name: 'Blank Password', email, password })).arrayBuffer();
      assert.equal(app.store.userByEmail(email), null, `an account was made with the password ${JSON.stringify(password)}`);
    }
  } finally {
    app.close();
  }
});

// ---------- V2-B-08 (LOW) ----------

test("V2-B-08: an email that only looks like someone else's (zero-width space, fullwidth letter) is not a second account", async () => {
  const app = await startApp();
  try {
    const looksLike = (u) => u.email.normalize('NFKC').replace(/\p{Cf}/gu, '') === 'hal@porchlight.example';
    for (const email of ['hal@porchlight.example​', 'ｈal@porchlight.example']) {
      await (await app.post('/sign-up/senior', { ...SENIOR_FORM, name: 'Harold Whitaker', email, password: 'Long-enough-pass-1' })).arrayBuffer();
    }
    assert.equal(app.store.users.filter(looksLike).length, 1, 'there are now several accounts that read as hal@porchlight.example');
  } finally {
    app.close();
  }
});

// ---------- V2-B-09 (LOW) ----------

test('V2-B-09: "500 characters" and "80 characters" cannot hide thousands of combining marks', async () => {
  const app = await startApp();
  try {
    const zalgo = 'a' + '́'.repeat(15000); // one "character" to Intl.Segmenter, 15,001 code units
    await (await app.post('/messages/m-harold-ethan', { text: zalgo, lang: 'en' }, { as: 'volunteer:v-ethan' })).arrayBuffer();
    const longest = Math.max(0, ...app.store.messages.map((m) => m.text.length));
    assert.ok(longest <= 8000, `a message of ${longest} code units was saved as "1 character"`);

    await (await app.post('/account', { name: 'E' + '́'.repeat(3000), uiLanguage: 'en' }, { as: 'volunteer:v-ethan' })).arrayBuffer();
    const name = app.store.volunteer('v-ethan').name;
    assert.ok(name.length <= 1000, `a name of ${name.length} code units was saved as "1 character"`);
  } finally {
    app.close();
  }
});

// ---------- V2-B-10 (LOW) ----------

test('V2-B-10: a form on another site cannot sign this browser in to an account (login CSRF)', async () => {
  const app = await startApp();
  try {
    const crossSite = { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' };
    for (const [p, body] of [['/sign-in/demo', 'as=volunteer'], ['/sign-in', encode({ email: 'ethan@porchlight.example', password: 'PorchLight-demo-2026' })]]) {
      const res = await fetch(app.base + p, { method: 'POST', redirect: 'manual', headers: crossSite, body });
      await res.arrayBuffer();
      assert.equal(sessionFrom(res), null, `a cross-site POST ${p} started a session`);
    }
  } finally {
    app.close();
  }
});

// ---------- Round 2 (on b5b6353) ----------

test('V2-B-11: a refused cross-site POST gets the 403 error page, not a blank 200', async () => {
  const app = await startApp();
  try {
    for (const origin of ['https://evil.example', 'null']) {
      const res = await fetch(app.base + '/sign-in/demo', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', origin }, body: 'as=volunteer' });
      const body = await res.text();
      assert.equal(sessionFrom(res), null, 'no session for a cross-site form');
      assert.equal(res.status, 403, `Origin ${origin}: status ${res.status}`);
      assert.ok(body.includes('<!DOCTYPE html>'), `Origin ${origin}: the page is blank (${body.length} bytes)`);
    }
  } finally {
    app.close();
  }
});

test('V2-B-12: the sign-in limit holds when each try comes from a new IPv6 address in the same /64', async () => {
  const { store, cleanup } = tempStore();
  try {
    const handle = createApp({ store, sparks: createSparkService(buildConfig({}), { effective: 'mock', reason: 'test', warning: null }) });
    let checked = 0;
    for (let i = 1; i <= 30; i++) {
      // One home connection gets a whole /64: 2^64 addresses. On Workers this is CF-Connecting-IP.
      const res = await handle(new Request('http://porchlight.test/sign-in', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'cf-connecting-ip': `2001:db8:1:2::${i.toString(16)}` },
        body: encode({ email: 'hal@porchlight.example', password: `wrong-guess-${i}` }),
      }));
      await res.arrayBuffer();
      if (res.status !== 429) checked++;
    }
    assert.ok(checked <= 10, `${checked} of 30 passwords were checked for one account from one /64`);
  } finally {
    cleanup();
  }
});

test('V2-B-13: the header AI badge has no English tooltip in other languages', async () => {
  const { store, cleanup } = tempStore();
  try {
    // The mode as `npm start` resolves it with no key: "Offline templates (no GEMINI_API_KEY is set)".
    const config = buildConfig({});
    const handle = createApp({ store, sparks: createSparkService(config, await resolveSparkMode(config)) });
    for (const lang of ['de', 'ar', 'my']) {
      const res = await handle(new Request('http://porchlight.test/sign-in', { headers: { cookie: `lang=${lang}` } }));
      const badge = /<a class="mode-badge[^>]*>/.exec(await res.text())?.[0] || '';
      assert.ok(badge, 'the header has the AI badge');
      assert.ok(!/Offline templates|GEMINI_API_KEY/.test(badge), `${lang}: ${badge}`);
    }
  } finally {
    cleanup();
  }
});
