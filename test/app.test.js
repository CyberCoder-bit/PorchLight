// End-to-end HTTP test: runs the real app on a temporary data file and walks
// through the whole demo loop (match, schedule, complete, sparks, dashboard).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';
import { createApp } from '../src/app.js';
import { createSparkService } from '../src/sparks/index.js';
import { buildConfig } from '../src/config.js';

let server;
let base;
let store;
let tmpDir;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-test-'));
  store = new Store(path.join(tmpDir, 'db.json'));
  store.open();
  const sparks = createSparkService(buildConfig({}), { effective: 'mock', reason: 'test', warning: null });
  server = createApp({ store, sparks });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const get = (p) => fetch(base + p);
// Like a browser form: an array value becomes a repeated field (checkbox groups).
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
const localDate = (offsetDays) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('first run creates the data file with demo data', () => {
  assert.ok(fs.existsSync(store.filePath));
  const saved = JSON.parse(fs.readFileSync(store.filePath, 'utf8'));
  assert.equal(saved.seniors.length, 4);
  assert.equal(saved.volunteers.length, 4);
});

test('every page loads', async () => {
  const pages = [
    '/', '/seniors', '/seniors/new', '/seniors/s-dorothy', '/seniors/s-dorothy/edit',
    '/volunteers', '/volunteers/new', '/volunteers/v-maya', '/volunteers/v-maya/edit',
    '/match', '/match?seniorId=s-eugene', '/contacts', '/dashboard', '/about-ai', '/demo/reset',
  ];
  for (const p of pages) {
    const res = await get(p);
    assert.equal(res.status, 200, p);
    const body = await res.text();
    assert.match(body, /<html lang="en"/, p);
    assert.match(body, /<a class="skip-link" href="#main">/, p);
    assert.equal((body.match(/<h1[\s>]/g) || []).length, 1, `${p} has exactly one h1`);
  }
  assert.equal((await get('/does-not-exist')).status, 404);
  assert.equal((await get('/seniors/nobody')).status, 404);
});

test('static files are served, and path traversal is blocked', async () => {
  assert.equal((await get('/styles.css')).status, 200);
  assert.equal((await get('/%2e%2e/package.json')).status, 404);
});

test('dashboard shows the seeded isolation-risk story', async () => {
  const html = await (await get('/dashboard')).text();
  const order = [...html.matchAll(/class="card dash-card dash-(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['at_risk', 'needs_match', 'due_soon', 'ok']);
  assert.match(html, /Contact dropping/);
});

test('full loop: match Eugene, schedule, complete, sparks, dashboard updates', async () => {
  // Matching page ranks Sam first
  const matchPage = await (await get('/match?seniorId=s-eugene')).text();
  assert.ok(matchPage.indexOf('Sam Rivera') < matchPage.indexOf('Maya Patel'));
  assert.match(matchPage, /At capacity/);
  assert.match(matchPage, /No overlapping availability/);

  // Confirm the match (Post/Redirect/Get)
  let res = await post('/matches', { seniorId: 's-eugene', volunteerId: 'v-sam' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/seniors/s-eugene?msg=matched');
  const match = store.activeMatchForSenior('s-eugene');
  assert.equal(match.volunteerId, 'v-sam');

  // Newly matched, no call yet -> "Check in soon"
  const pending = await (await get('/dashboard')).text();
  assert.match(pending.slice(pending.indexOf('/seniors/s-eugene"') - 200, pending.indexOf('/seniors/s-eugene"')), /dash-due_soon/);
  assert.match(pending, /Newly matched! Schedule the first call soon\./);

  // Can't double-match
  res = await post('/matches', { seniorId: 's-eugene', volunteerId: 'v-maya' });
  assert.equal(res.status, 409);

  // Schedule a call for tomorrow afternoon
  res = await post('/contacts', { matchId: match.id, action: 'schedule', type: 'phone', date: localDate(1), time: '15:00', notes: 'First call!' });
  assert.equal(res.status, 303);
  const scheduled = store.contacts.find((c) => c.seniorId === 's-eugene' && c.status === 'scheduled');
  assert.ok(scheduled.createdAt, 'recorded with a timestamp');

  // Mark it completed
  res = await post(`/contacts/${scheduled.id}/complete`, {});
  assert.equal(res.status, 303);
  assert.equal(store.contacts.find((c) => c.id === scheduled.id).status, 'completed');

  // Log a past visit too
  res = await post('/contacts', { matchId: match.id, action: 'log', type: 'phone', date: localDate(-1), time: '14:00', durationMinutes: '30' });
  assert.equal(res.status, 303);

  // Eugene is now "Connected" on the dashboard
  const dash = await (await get('/dashboard')).text();
  const eugeneCard = dash.slice(dash.indexOf('/seniors/s-eugene"') - 200, dash.indexOf('/seniors/s-eugene"'));
  assert.match(eugeneCard, /dash-ok/);

  // Conversation sparks: generate, then ask for different ones
  res = await post('/seniors/s-eugene/sparks', { variant: '0' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/seniors/s-eugene?msg=sparks#sparks');
  const first = store.latestSparkSet('s-eugene');
  assert.equal(first.sparks.length, 3);
  assert.equal(first.mode, 'mock');
  const profile = await (await get('/seniors/s-eugene')).text();
  assert.match(profile, /Conversation sparks for Gene/);
  assert.match(profile, /Show different sparks/);
  await post('/seniors/s-eugene/sparks', { variant: '1' });
  assert.notDeepEqual(store.latestSparkSet('s-eugene').sparks, first.sparks);
});

test('form validation shows an error summary and keeps what was typed', async () => {
  const res = await post('/seniors', { name: '', age: '12', aboutMe: 'Hello' });
  assert.equal(res.status, 200); // the form is shown again (not a redirect)
  const html = await res.text();
  assert.match(html, /id="error-summary"/);
  assert.match(html, /href="#field-name"/);
  assert.match(html, /href="#field-interests"/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, />Hello<\/textarea>/);

  const bad = await post('/contacts', { matchId: 'm-dorothy-maya', action: 'schedule', type: 'phone', date: localDate(-2), time: '10:00' });
  assert.equal(bad.status, 200);
  assert.match(await bad.text(), /must be in the future/);
});

test('user input is escaped (no XSS)', async () => {
  const res = await post('/seniors', {
    name: '<img src=x onerror=alert(1)>',
    interests: 'gardening',
    availability: 'mon-morning',
    contactMethod: 'phone',
  });
  assert.equal(res.status, 303);
  const html = await (await get('/seniors')).text();
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('changing the alert threshold updates the flags', async () => {
  const invalid = await post('/settings', { riskThresholdDays: '0' });
  assert.equal(invalid.status, 200);
  assert.match(await invalid.text(), /whole number of days from 1 to 60/);
  const res = await post('/settings', { riskThresholdDays: '4' });
  assert.equal(res.status, 303);
  assert.equal(store.settings.riskThresholdDays, 4);
  const html = await (await get('/dashboard')).text();
  const rosa = html.slice(html.indexOf('/seniors/s-rosa"') - 200, html.indexOf('/seniors/s-rosa"'));
  assert.match(rosa, /dash-at_risk/);
});

test('editing a volunteer saves changes', async () => {
  const res = await post('/volunteers/v-linda', {
    name: 'Linda Okafor', affiliation: 'Retired librarian', interests: ['reading', 'travel'],
    availability: ['tue-morning', 'sat-morning'], contactMethods: ['video'], maxSeniors: '2',
  });
  assert.equal(res.status, 303);
  assert.deepEqual(store.volunteer('v-linda').availability, ['tue-morning', 'sat-morning']);
});

test('text-size preference is stored in a cookie and rejects off-site redirects', async () => {
  const res = await post('/prefs/text-size', { size: 'xlarge', back: '//evil.example' });
  assert.match(res.headers.get('set-cookie'), /textsize=xlarge/);
  assert.equal(res.headers.get('location'), '/');
  const page = await (await fetch(base + '/', { headers: { cookie: 'textsize=xlarge' } })).text();
  assert.match(page, /class="text-xlarge"/);
});

test('demo reset restores the original data', async () => {
  const res = await post('/demo/reset', {});
  assert.equal(res.status, 303);
  assert.equal(store.seniors.length, 4);
  assert.equal(store.activeMatchForSenior('s-eugene'), null);
  assert.equal(store.settings.riskThresholdDays, 7);
});
