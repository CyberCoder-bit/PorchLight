// Review: dates and times. The app runs on a fixed clock (Tuesday,
// November 3, 2026 at noon in Carmel), so these tests behave the same on any
// day and in any TZ. Each test FAILS on the current code and passes once the
// bug is fixed.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../../src/store.js';
import { createApp } from '../../src/app.js';
import { createNodeServer } from '../../src/node-server.js';
import { createSparkService } from '../../src/sparks/index.js';
import { buildConfig, ROOT_DIR } from '../../src/config.js';
import { fromLocal, parseLocalDateTime } from '../../src/tz.js';
import { slotForDate } from '../../src/vocab.js';

const NOW = fromLocal(2026, 11, 3, 12, 0); // Tuesday, Nov 3, 2026, 12:00 PM in Carmel
let server;
let base;
let store;
let tmpDir;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-review-'));
  store = new Store(path.join(tmpDir, 'db.json'));
  store.open(NOW);
  const sparks = createSparkService(buildConfig({}), { effective: 'mock', reason: 'test', warning: null });
  server = createNodeServer({ handle: createApp({ store, sparks, now: () => NOW }), publicDir: path.join(ROOT_DIR, 'public') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const page = async (p) => (await fetch(base + p)).text();
const post = (p, data) =>
  fetch(base + p, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data).toString(),
  });
const fieldErrors = (html) =>
  Object.fromEntries([...html.matchAll(/<p class="field-error" id="error-(\w+)">[\s\S]*?<\/span>([^<]*)<\/p>/g)].map((m) => [m[1], m[2]]));

test('B-07: a call almost a year away shows its year, so it is not confused with today', async () => {
  // Today is Tuesday, November 3, 2026. A call on Wednesday, November 3, 2027 must not read "Wednesday, November 3".
  const res = await post('/contacts', { matchId: 'm-rosa-linda', action: 'schedule', type: 'video', date: '2027-11-03', time: '18:00' });
  assert.equal(res.status, 303);
  const call = store.contacts.find((c) => c.status === 'scheduled' && c.scheduledFor.startsWith('2027-11-03'));
  const html = await page('/contacts');
  const item = html.split('<li class="contact-item">').find((s) => s.includes(`/contacts/${call.id}/`));
  const shown = item.match(/<strong>([^<]+)<\/strong>/)[1];
  assert.match(shown, /2027/, `the call is shown as "${shown}"`);
});

test('B-14: 2:30 AM on spring-forward day gets an error about the time, not "Enter a real date"', async () => {
  // 2:00-2:59 AM did not exist in Indiana on Sunday, March 8, 2026.
  const res = await post('/contacts', { matchId: 'm-rosa-linda', action: 'log', type: 'video', date: '2026-03-08', time: '02:30', durationMinutes: '30' });
  assert.equal(res.status, 200);
  const errors = fieldErrors(await res.text());
  assert.ok(Object.keys(errors).length, 'the form shows an error');
  const all = Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join(' | ');
  assert.ok(errors.time || /time|clock/i.test(errors.date || ''), `the error does not mention the time: ${all}`);
});

test('B-08: the prefilled call time falls inside the pair\'s shared free time', async () => {
  // From /attention, "Schedule a visit with Hal" opens this form. Hal and Ethan share
  // Tue/Thu/Sat/Sun afternoons. Tomorrow (Wednesday) at 4 PM is outside all of them,
  // so saving the prefilled form shows "Heads up: that time is outside ...".
  const html = await page('/contacts?seniorId=s-harold');
  const date = html.match(/name="date" type="date" value="([^"]*)"/)[1];
  const time = html.match(/name="time" type="time" value="([^"]*)"/)[1];
  const slot = slotForDate(parseLocalDateTime(date, time));
  const hal = store.senior('s-harold');
  const ethan = store.volunteer('v-ethan');
  const shared = hal.availability.filter((s) => ethan.availability.includes(s));
  assert.ok(shared.includes(slot), `prefilled ${date} ${time} (${slot}) is outside the shared times: ${shared.join(', ')}`);
});
