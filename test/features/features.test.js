// End-to-end tests for the day-to-day features: the "Needs attention" queue,
// the re-match flow, a volunteer's "My week", the weekly family summary, and
// the calendar file. Same harness as test/app.test.js: the real app on a
// temporary data file, served by the Node server on a random port.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../../src/store.js';
import { createApp } from '../../src/app.js';
import { createNodeServer } from '../../src/node-server.js';
import { createSparkService } from '../../src/sparks/index.js';
import { buildConfig, ROOT_DIR } from '../../src/config.js';
import { localParts, fromLocal } from '../../src/tz.js';
import { toDateInput, escapeHtml } from '../../src/views/html.js';

process.env.TZ = 'America/Indiana/Indianapolis'; // test dates use the app's Carmel clock (src/tz.js)

let server;
let base;
let store;
let tmpDir;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-features-'));
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

// Every test starts from the seeded demo story.
beforeEach(() => store.reset(new Date()));

const get = (p) => fetch(base + p);
const page = async (p) => {
  const res = await get(p);
  assert.equal(res.status, 200, p);
  const body = await res.text();
  assert.equal((body.match(/<h1[\s>]/g) || []).length, 1, `${p} has exactly one h1`);
  return body;
};
const encode = (data) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  return params.toString();
};
const post = (p, data = {}) =>
  fetch(base + p, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: encode(data),
  });
// YYYY-MM-DD for `offset` days from today, on the Carmel calendar (DST-safe).
const localDay = (offset) => {
  const p = localParts(new Date());
  return toDateInput(fromLocal(p.year, p.month, p.day + offset, 12));
};
// The ids of the queue cards, in order.
const queueOrder = (html) => [...html.matchAll(/<li class="card dash-card dash-\w+" id="senior-([\w-]+)"/g)].map((m) => m[1]);
// One queue card's HTML, from its <li> to the end of its actions.
const card = (html, seniorId) => {
  const id = html.indexOf(`id="senior-${seniorId}"`);
  assert.ok(id > 0, `card for ${seniorId}`);
  const start = html.lastIndexOf('<li', id);
  return html.slice(start, html.indexOf('</p>\n    </li>', id));
};

// ---------- Needs attention ----------

test('queue lists Hal then Eugene for the seed, with reasons and one next step each', async () => {
  const html = await page('/attention');
  assert.match(html, /<title>Needs attention · PorchLight<\/title>/);
  assert.deepEqual(queueOrder(html), ['s-harold', 's-eugene']);
  assert.match(html, /Most urgent first:<\/strong> Isolation risk, then Needs a companion/);

  const hal = card(html, 's-harold');
  assert.match(hal, /Isolation risk/);
  assert.match(hal, /Contact dropping/);
  assert.match(hal, /No completed call or visit in 12 days; only 3 check-ins in the last 4 weeks, down from 8 the 4 weeks before; 1 missed call in the last 2 weeks\./);
  assert.match(hal, /Suggested next step: Schedule a visit/);
  assert.match(hal, /<a class="button" href="\/contacts\?seniorId=s-harold">/);
  assert.match(hal, /href="\/attention\/s-harold\/rematch"/);
  assert.equal((hal.match(/Suggested next step/g) || []).length, 1);

  const gene = card(html, 's-eugene');
  assert.match(gene, /Waiting for a first companion; joined 3 days ago\./);
  assert.match(gene, /Suggested next step: Find a first companion/);
  assert.match(gene, /<a class="button" href="\/match\?seniorId=s-eugene">/);

  // Dorothy (Connected) and Rosa (Check in soon) are not queue cards.
  assert.doesNotMatch(html, /id="senior-s-dorothy"/);
  assert.doesNotMatch(html, /id="senior-s-rosa"/);
  assert.match(html, /Not on the list yet, but due soon[\s\S]*Rosa Delgado/);
});

test('missed-call reasons show their labels (and notes) in the queue', async () => {
  const missed = store.contacts.find((c) => c.seniorId === 's-harold' && c.status === 'missed');
  missed.missedReason = 'volunteer_conflict';
  missed.missedNote = 'Practice ran late';
  store.save();
  const hal = card(await page('/attention'), 's-harold');
  assert.match(hal, /Reason: Volunteer had a conflict\./);
  assert.match(hal, /Practice ran late/);

  // Two cancellations by the same companion in two weeks -> suggest a re-match.
  store.contacts.push({ ...missed, id: 'c-test-missed-2', scheduledFor: new Date(Date.now() - 2 * 86400000).toISOString() });
  store.save();
  const again = card(await page('/attention'), 's-harold');
  assert.match(again, /Suggested next step: Find a new companion/);
  assert.match(again, /Ethan has had to cancel 2 times/);
  assert.match(again, /<a class="button" href="\/attention\/s-harold\/rematch">/);
});

test('a senior who missed the call points to the family, then to local help after a long silence', async () => {
  const missed = store.contacts.find((c) => c.seniorId === 's-harold' && c.status === 'missed');
  missed.missedReason = 'no_answer';
  store.save();
  let hal = card(await page('/attention'), 's-harold');
  assert.match(hal, /Suggested next step: Let the family know/);
  assert.match(hal, /Ask Mike Whitaker to check in/);
  assert.match(hal, /<a class="button" href="\/seniors\/s-harold\/summary">/);

  // 14+ days without contact (2x the 7-day setting) and no answer -> local help.
  store.settings.riskThresholdDays = 6;
  store.save();
  hal = card(await page('/attention'), 's-harold');
  assert.match(hal, /Suggested next step: Get local help/);
  assert.match(hal, /Indiana 211/);
  assert.match(hal, /If someone may be in danger, call 911\./);
  assert.match(hal, /<a class="button" href="\/help">/);
});

test('empty queue says everyone has had a recent check-in', async () => {
  store.data.seniors = store.seniors.filter((s) => s.id === 's-dorothy');
  store.save();
  const html = await page('/attention');
  assert.deepEqual(queueOrder(html), []);
  assert.match(html, /Everyone has had a recent check-in\./);
});

test('re-match flow for Hal: confirm, end the match (history kept), choose again, log a call', async () => {
  const historyBefore = store.contactsForSenior('s-harold').length;

  const confirm = await page('/attention/s-harold/rematch');
  assert.match(confirm, /Find a new companion for Harold Whitaker\?/);
  assert.match(confirm, /Current companion: Ethan Brooks/);
  assert.match(confirm, /Nothing is deleted\./);
  assert.match(confirm, /<form method="post" action="\/matches\/m-harold-ethan\/end"/);
  assert.match(confirm, /href="\/attention">Keep Ethan/);

  let res = await post('/matches/m-harold-ethan/end');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/match?seniorId=s-harold&msg=match_ended');
  const matchPage = await page(res.headers.get('location'));
  assert.match(matchPage, /Match ended\. You can now choose a new companion\./);
  assert.match(matchPage, /Find a companion for Harold Whitaker/);

  const ended = store.matches.find((m) => m.id === 'm-harold-ethan');
  assert.equal(ended.active, false);
  assert.ok(ended.endedAt);
  assert.equal(store.contactsForSenior('s-harold').length, historyBefore, 'history is kept');

  // The queue now says Hal needs a NEW companion.
  let hal = card(await page('/attention'), 's-harold');
  assert.match(hal, /Needs a companion/);
  assert.match(hal, /No companion right now; last check-in was 12 days ago/);
  assert.match(hal, /Suggested next step: Find a new companion/);
  assert.match(hal, /<a class="button" href="\/match\?seniorId=s-harold">/);
  // The confirm page no longer offers to end anything.
  assert.match(await page('/attention/s-harold/rematch'), /Harold Whitaker has no companion right now/);

  // Ethan is the only volunteer who offers visits in Hal's free time.
  res = await post('/matches', { seniorId: 's-harold', volunteerId: 'v-ethan' });
  assert.equal(res.status, 303);
  const match = store.activeMatchForSenior('s-harold');
  res = await post('/contacts', { matchId: match.id, action: 'log', type: 'visit', date: localDay(-1), time: '14:00', durationMinutes: '45' });
  assert.equal(res.status, 303);

  // Status improves: no longer "Isolation risk" or "Needs a companion".
  hal = card(await page('/attention'), 's-harold');
  assert.match(hal, /dash-ok/);
  assert.match(hal, /Connected/);
  assert.doesNotMatch(hal, /Isolation risk/);
  assert.match(hal, /Last check-in was yesterday/);
});

test('attention pages escape names and return 404 for unknown seniors', async () => {
  const res = await post('/seniors', {
    name: '<script>alert(1)</script>',
    interests: 'gardening',
    availability: 'sat-morning',
    contactMethod: 'phone',
  });
  assert.equal(res.status, 303);
  const id = res.headers.get('location').split('/')[2].split('?')[0];
  for (const p of ['/attention', `/attention/${id}/rematch`]) {
    const html = await page(p);
    assert.doesNotMatch(html, /<script>alert/, p);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, p);
  }
  assert.equal((await get('/attention/nobody/rematch')).status, 404);
});
