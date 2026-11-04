// Review, round 2: the demo sign-in by role, the Accessibility menu,
// and the parts of round-1 fixes that only cover the exact input in the
// round-1 tests. Each test FAILS on d8dd722 and passes once the bug is fixed.
// Findings B-12, B-20, B-21, B-25, B-29 to B-34.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../../src/store.js';
import { createApp } from '../../src/app.js';
import { createNodeServer } from '../../src/node-server.js';
import { createSparkService, buildSparkInput } from '../../src/sparks/index.js';
import { buildUserMessage } from '../../src/sparks/live.js';
import { buildConfig, ROOT_DIR } from '../../src/config.js';
import { startOfLocalDay } from '../../src/tz.js';
import { toDateInput } from '../../src/views/html.js';
import { TOUR_STEPS } from '../../src/views/pages/extra.js';

let server;
let base;
let store;
let tmpDir;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-review-'));
  store = new Store(path.join(tmpDir, 'db.json'));
  store.open();
  const sparks = createSparkService(buildConfig({}), { effective: 'mock', reason: 'test', warning: null });
  server = createNodeServer({ handle: createApp({ store, sparks }), publicDir: path.join(ROOT_DIR, 'public') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const encode = (data) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  return params.toString();
};
const request = (method, p, { cookie, data } = {}) =>
  fetch(base + p, {
    method,
    redirect: 'manual',
    headers: { ...(data ? { 'content-type': 'application/x-www-form-urlencoded' } : {}), ...(cookie ? { cookie } : {}) },
    body: data ? encode(data) : undefined,
  });
const page = async (p, cookie) => (await request('GET', p, { cookie })).text();
const reset = () => store.reset();

const ETHAN = 'viewer=volunteer:v-ethan';
const HAL_FAMILY = 'viewer=family:s-harold';
const HAL = 'viewer=senior:s-harold';
const SENIOR = { interests: ['cars'], availability: ['tue-afternoon'], contactMethod: 'phone' };

// ---------- the demo sign-in ----------

test('B-29: a signed-in volunteer cannot save a call for someone else\'s pair by repeating matchId', async () => {
  reset();
  const today = toDateInput(startOfLocalDay(new Date()));
  // A single matchId for Dorothy and Maya is refused (403), as the access table says.
  let res = await request('POST', '/contacts', { cookie: ETHAN, data: { matchId: 'm-dorothy-maya', action: 'log', type: 'phone', date: today, time: '00:05', notes: 'single' } });
  assert.equal(res.status, 403);
  // The same request with matchId sent twice must be refused too.
  res = await request('POST', '/contacts', { cookie: ETHAN, data: { matchId: ['m-dorothy-maya', 'x'], action: 'log', type: 'phone', date: today, time: '00:06', notes: 'forged by Ethan' } });
  const forged = store.contacts.filter((c) => c.seniorId === 's-dorothy' && c.notes === 'forged by Ethan');
  assert.equal(forged.length, 0, `Ethan logged a call for Dorothy and Maya (status ${res.status}, ${res.headers.get('location')})`);
});

test('B-31: a signed-in person who opens a wrong address still sees their own header, not demo mode', async () => {
  reset();
  const html = await page('/dashbord', HAL_FAMILY); // a typo: no such page
  assert.match(html, /Signed in as <strong>/, '404 page says "Demo mode: everything is visible" to a signed-in family member');
  assert.doesNotMatch(html, /<a href="\/attention"/, '404 page offers the coordinator nav to a family member');
});

test('B-32: a phone number typed into the family contact fields is never shown to signed-in people', async () => {
  reset();
  const hal = store.senior('s-harold');
  hal.caregiver = { name: 'Mike Whitaker 602-555-0177', relationship: 'Son, cell (602) 555-0178' };
  store.save();
  const phone = /602\D{0,2}555\D?017[78]/;
  for (const [who, cookie, pages] of [
    ['family', HAL_FAMILY, ['/dashboard', '/seniors/s-harold']],
    ['volunteer', ETHAN, ['/seniors/s-harold']],
    ['senior', HAL, ['/seniors/s-harold']],
  ]) {
    for (const p of pages) {
      const html = await page(p, cookie);
      assert.doesNotMatch(html, phone, `${who} sees a phone number on ${p}`);
    }
  }
});

test('B-33: HEAD / answers like GET / for a signed-in person (a redirect to their home)', async () => {
  reset();
  for (const cookie of [ETHAN, HAL_FAMILY, HAL]) {
    const get = await request('GET', '/', { cookie });
    const head = await request('HEAD', '/', { cookie });
    assert.equal(head.status, get.status, `${cookie}: GET / is ${get.status}, HEAD / is ${head.status}`);
  }
});

test('B-35: after tour step 7 signs in as Hal\'s family, the tour itself still opens', async () => {
  reset();
  // The tour says "Use your browser's Back button to return here after each step."
  const step = TOUR_STEPS.findIndex((s) => s.href === '/sign-in');
  assert.ok(step >= 0 && step < TOUR_STEPS.length - 1, 'the sign-in step is not the last step');
  const res = await request('GET', '/tour', { cookie: HAL_FAMILY });
  assert.equal(res.status, 200, 'signed in as Mike (tour step 7), /tour says "This page is for coordinators"');
});

// ---------- Accessibility menu and layout (browser behaviour checked in the CSS/JS) ----------

test('B-30: keyboard focus never ends up hidden under the open Accessibility menu', () => {
  // In Chrome: open the menu, Tab past "Match my device", and focus lands on links the panel covers
  // ("Try the demo sign-in" at 375px; Family Dashboard, Needs attention, Get help at 1280px).
  // Fixed either way: the menu closes when focus leaves it, or the panel no longer overlays the page.
  const js = fs.readFileSync(path.join(ROOT_DIR, 'public', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT_DIR, 'public', 'styles.css'), 'utf8');
  const closesOnFocusLeave = /addEventListener\(\s*['"]focus(?:in|out)['"]/.test(js);
  const overlays = /\.a11y-panel\s*\{[^}]*position:\s*(?:absolute|fixed)/.test(css);
  assert.ok(closesOnFocusLeave || !overlays, 'the open menu stays on top of the page when keyboard focus moves past it');
});

test('B-34: the "Signed in as" line wraps a long name instead of overflowing a phone screen', () => {
  // In Chrome at 375px with A++, "Signed in as Maximiliana Featherstonehaugh-Wolfeschlegelsteinhausen"
  // is 13px wider than the screen: .viewer-line is a flex row and its <p> keeps min-width: auto.
  const css = fs.readFileSync(path.join(ROOT_DIR, 'public', 'styles.css'), 'utf8');
  const rules = [...css.matchAll(/([^{}]*\.viewer-line[^{}]*)\{([^}]*)\}/g)].map((m) => m[2]).join(';');
  assert.ok(/overflow-wrap:\s*anywhere|word-break:\s*break-word|min-width:\s*0/.test(rules), 'no .viewer-line rule lets a long name wrap');
});

// ---------- round-1 fixes that only cover the round-1 test input ----------

test('B-12 (partly fixed): phone numbers written with other dashes or digits are removed before the AI sees them', () => {
  const senior = { id: 's-x', name: 'Test Senior', interests: ['music'], contactMethod: 'phone' };
  for (const phone of ['317–555–0142', '317‑555‑0142', '３１７-５５５-０１４２', '317/555/0142']) {
    const input = buildSparkInput({ ...senior, aboutMe: `Call my daughter at ${phone}.` }, [], new Date());
    const message = buildUserMessage(input);
    assert.ok(!message.includes(phone), `"${phone}" is sent to the AI: ${message.split('\n').find((l) => l.startsWith('About'))}`);
  }
});

test('B-20 (partly fixed): names made of blank-looking letters are rejected', async () => {
  reset();
  for (const name of ['ㅤ', 'ᅟ', '⠀', 'ﾠ', '́']) {
    const res = await request('POST', '/seniors', { data: { ...SENIOR, name } });
    assert.equal(res.status, 200, `blank-looking name ${JSON.stringify(name)} was saved`);
  }
});

test('B-21 (partly fixed): "About them" counts what people see as one character as one', async () => {
  reset();
  for (const [label, aboutMe] of [
    ['300 thumbs-up with a skin tone', '\u{1F44D}\u{1F3FD}'.repeat(300)],
    ['500 accented e typed as e + accent', 'é'.repeat(500)],
  ]) {
    const res = await request('POST', '/seniors', { data: { ...SENIOR, name: 'Emoji Fan', aboutMe } });
    assert.equal(res.status, 303, `${label} rejected as more than 500 characters`);
  }
});

test('B-25: the README demo lists the same steps as /tour', () => {
  const readme = fs.readFileSync(path.join(ROOT_DIR, 'README.md'), 'utf8');
  const section = readme.split('### The 2-minute demo')[1].split('\n### ')[0];
  const listed = [...section.matchAll(/^\d+\. \*\*([^*]+?)\.?\*\*/gm)].map((m) => m[1].trim());
  assert.deepEqual(listed, TOUR_STEPS.map((s) => s.title), 'README says "These are the tour\'s steps, word for word"');
});
