// Review: numbers and state that disagree between pages, and the demo
// tour. Each test FAILS on the current code and passes once the bug is fixed.

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
import { startOfLocalDay } from '../../src/tz.js';
import { toDateInput } from '../../src/views/html.js';

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

const get = (p) => fetch(base + p, { redirect: 'manual' });
const page = async (p) => (await get(p)).text();
const encode = (data) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  return params.toString();
};
const post = (p, data) =>
  fetch(base + p, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: encode(data),
  });
const reset = async () => assert.equal((await post('/demo/reset', {})).status, 303);
const tomorrow = () => toDateInput(startOfLocalDay(new Date(), 1));

// "N seniors need attention" on each page.
async function attentionCounts() {
  const home = await page('/admin'); // [v2] the coordinator home moved from / to /admin
  const dash = await page('/dashboard');
  const att = await page('/attention');
  const homeTile = Number(home.match(/<p class="tile-value">(\d+)<\/p>\s*<p class="tile-label">(?:senior needs|seniors need) attention/)[1]);
  const line = dash.match(/<p class="status-line"><strong>Right now, ([^<]*)<\/strong>/)[1];
  const dashboard = /^no seniors/.test(line) ? 0 : Number(line.match(/^(\d+) seniors? needs? attention/)[1]);
  const attention = (att.match(/<li class="card dash-card/g) || []).length;
  return { homeTile, dashboard, attention };
}

test('B-04: home, dashboard, and /attention agree on how many seniors need attention (README demo steps 5-6)', async () => {
  await reset();
  // README step 3-5: schedule Hal's visit from the queue, then "Log this visit" on Ethan's week.
  let res = await post('/contacts', { matchId: 'm-harold-ethan', action: 'schedule', type: 'visit', date: tomorrow(), time: '16:00' });
  assert.equal(res.status, 303);
  const visit = store.contacts.find((c) => c.seniorId === 's-harold' && c.status === 'scheduled');
  res = await post(`/contacts/${visit.id}/complete`, { back: '/volunteers/v-ethan/week' });
  assert.equal(res.status, 303);
  let counts = await attentionCounts();
  assert.equal(counts.homeTile, counts.attention, `step 5: home says ${counts.homeTile}, /attention lists ${counts.attention}`);
  assert.equal(counts.dashboard, counts.attention, `step 5: dashboard says ${counts.dashboard}, /attention lists ${counts.attention}`);

  // README step 6: match Gene with Sam.
  res = await post('/matches', { seniorId: 's-eugene', volunteerId: 'v-sam' });
  assert.equal(res.status, 303);
  counts = await attentionCounts();
  assert.equal(counts.dashboard, counts.attention, `step 6: dashboard says ${counts.dashboard}, /attention lists ${counts.attention}`);
});

test('B-03: tour step "Ethan\'s week" shows a call to log right after a reset', async () => {
  await reset();
  const tour = await page('/tour');
  const step = tour.split('<li class="card tour-step">').find((s) => /one click to log a call/.test(s));
  assert.ok(step, 'the tour has a "log a call" step');
  const href = step.match(/href="([^"]+)"/)[1].replace(/&amp;/g, '&');
  const html = await page(href);
  assert.match(html, /<button type="submit" class="button">Log this (call|visit)/, `${href} has nothing to log after a reset: ${(html.match(/Coming up \(\d+\)/) || [''])[0]}`);
});

test('B-05: ending a match also takes its scheduled calls off the volunteer\'s week and the calls list', async () => {
  await reset();
  assert.ok(store.contacts.some((c) => c.seniorId === 's-rosa' && c.volunteerId === 'v-linda' && c.status === 'scheduled'), 'seed has a scheduled Rosa/Linda call');
  const res = await post('/matches/m-rosa-linda/end', {});
  assert.equal(res.status, 303);
  const week = await page('/volunteers/v-linda/week');
  assert.doesNotMatch(week, /with <a href="\/seniors\/s-rosa">/, "Linda's week still lists a call with Rosa after their match ended");
  const contacts = await page('/contacts');
  const upcoming = contacts.split('id="upcoming-heading"')[1].split('</section>')[0];
  assert.doesNotMatch(upcoming, /\/seniors\/s-rosa"/, '/contacts "Coming up" still lists the ended pair');
});

test('B-13: a volunteer\'s capacity can\'t be lowered below the seniors they already have', async () => {
  await reset();
  let res = await post('/matches', { seniorId: 's-eugene', volunteerId: 'v-maya' }); // Maya: 2 of 2
  assert.equal(res.status, 303);
  const maya = store.volunteer('v-maya');
  res = await post('/volunteers/v-maya', {
    name: maya.name, affiliation: maya.affiliation, interests: maya.interests,
    availability: maya.availability, contactMethods: maya.contactMethods, maxSeniors: '1',
  });
  assert.notEqual(res.status, 303, 'saved max 1 senior while Maya has 2');
  assert.doesNotMatch(await page('/volunteers'), /Companion to 2 of 1 senior/);
});

test('B-11: editing a matched volunteer or senior so the pair no longer fits warns the coordinator', async () => {
  await reset();
  const maya = store.volunteer('v-maya');
  // Dorothy prefers phone and is free weekday mornings; make Maya video-only on Sunday morning.
  let res = await post('/volunteers/v-maya', {
    name: maya.name, affiliation: maya.affiliation, interests: maya.interests,
    availability: ['sun-morning'], contactMethods: ['video'], maxSeniors: String(maya.maxSeniors),
  });
  assert.ok(res.status !== 303 || /warn=/.test(res.headers.get('location')), `volunteer edit silently saved: ${res.status} ${res.headers.get('location')}`);

  await reset();
  const hal = store.senior('s-harold');
  // Ethan offers visit and phone on weekday/weekend afternoons; make Hal video-only on Monday morning.
  res = await post('/seniors/s-harold', {
    name: hal.name, preferredName: hal.preferredName, age: String(hal.age), neighborhood: hal.neighborhood,
    interests: hal.interests, aboutMe: hal.aboutMe, availability: ['mon-morning'], contactMethod: 'video',
    caregiverName: hal.caregiver.name, caregiverRelationship: hal.caregiver.relationship,
  });
  assert.ok(res.status !== 303 || /warn=/.test(res.headers.get('location')), `senior edit silently saved: ${res.status} ${res.headers.get('location')}`);
});

test('B-09: a call that has not happened yet is not reported as missed', async () => {
  await reset();
  const future = store.contacts.find((c) => c.seniorId === 's-dorothy' && c.status === 'scheduled');
  assert.ok(new Date(future.scheduledFor) > new Date(), 'Dorothy has a call later this week');
  const res = await post(`/contacts/${future.id}/missed`, { reason: 'no_answer' });
  if (res.status === 303) {
    const summary = await page('/seniors/s-dorothy/summary');
    const text = summary.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)[1];
    assert.match(text, /Missed calls in the last 4 weeks: 0/, `family summary lists a missed call dated in the future:\n${text}`);
    assert.doesNotMatch(await page('/attention'), /Dorothy couldn(&#39;|')t be reached for the last call/);
  }
});

test('B-15: submitting the same schedule form twice does not create a duplicate call', async () => {
  await reset();
  const form = { matchId: 'm-rosa-linda', action: 'schedule', type: 'video', date: tomorrow(), time: '10:00' };
  await post('/contacts', form);
  await post('/contacts', form);
  const dupes = store.contacts.filter((c) => c.seniorId === 's-rosa' && c.status === 'scheduled' && c.scheduledFor === store.contacts.at(-1).scheduledFor);
  assert.equal(dupes.length, 1, 'two identical scheduled calls');
});
