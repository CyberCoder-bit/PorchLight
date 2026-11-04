// Demo sign-in by role: the sign-in page, the `viewer` cookie, what each role
// may open and change (checked on the server), the "not for you" page, stale
// cookies, private notes, and escaping. Same harness as test/app.test.js.

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
import { can, ACCESS_RULES } from '../../src/roles/index.js';
import { relationWord, noPhone, viewerFromCookie } from '../../src/roles/viewer.js';
import { stripBlocked } from '../../src/roles/links.js';

process.env.TZ = 'America/Indiana/Indianapolis'; // match test/app.test.js

let server;
let base;
let store;
let tmpDir;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-roles-'));
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

const cookieFor = (viewer) => (viewer ? { cookie: `viewer=${encodeURIComponent(viewer)}` } : {});
const get = (p, viewer) => fetch(base + p, { redirect: 'manual', headers: cookieFor(viewer) });
const text = async (p, viewer) => (await get(p, viewer)).text();
const encode = (data) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  return params.toString();
};
const post = (p, data = {}, viewer) =>
  fetch(base + p, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...cookieFor(viewer) },
    body: encode(data),
  });
const reset = async () => assert.equal((await post('/demo/reset')).status, 303);
const mainOf = (body) => body.slice(body.indexOf('<main'), body.indexOf('</main>'));
const navOf = (body) => body.slice(body.indexOf('<nav class="site-nav"'), body.indexOf('</nav>'));
const navLinks = (body) => [...navOf(body).matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
const scheduledCall = (seniorId) => store.contacts.find((c) => c.seniorId === seniorId && c.status === 'scheduled');

async function statuses(viewer, paths) {
  const out = {};
  for (const p of paths) out[p] = (await get(p, viewer)).status;
  return out;
}

// ----- demo mode (no cookie) -----

test('no cookie: demo mode, everything visible, nav unchanged', async () => {
  await reset();
  const home = await text('/');
  assert.deepEqual(navLinks(home), ['/', '/seniors', '/volunteers', '/match', '/contacts', '/dashboard', '/attention', '/help']);
  assert.match(home, /Demo mode: everything is visible\. <a href="\/sign-in">Try the demo sign-in<\/a>/);
  assert.doesNotMatch(home, /Signed in as/);
  const all = await statuses(null, ['/', '/dashboard', '/attention', '/match', '/seniors/s-harold', '/seniors/s-harold/edit', '/volunteers/v-maya/week', '/contacts', '/demo/reset', '/tour']);
  for (const [p, status] of Object.entries(all)) assert.equal(status, 200, p);
  // Demo-mode pages keep every link and form, e.g. the alert setting and Edit buttons.
  assert.match(await text('/dashboard'), /action="\/settings"/);
  assert.match(await text('/seniors/s-harold'), /href="\/seniors\/s-harold\/edit"/);
  assert.match(await text('/seniors/s-harold'), /Watched the second half of the game together\./);
});

// ----- the sign-in page -----

test('the sign-in page: one h1, a banner, labeled choices, and no phone numbers', async () => {
  const res = await get('/sign-in');
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.equal((body.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(body, /<h1>Demo sign-in \(no passwords\)<\/h1>/);
  assert.match(body, /A real launch needs real accounts with passwords, which aren&#39;t built yet\./);
  for (const id of ['as-volunteer', 'as-family', 'as-senior']) {
    assert.match(body, new RegExp(`<label for="${id}">[^<]+</label>`), `${id} has a label`);
    assert.match(body, new RegExp(`<select id="${id}" name="as">`));
  }
  assert.match(body, /<option value="family:s-harold">Mike Whitaker \(Hal&#39;s son\)<\/option>/);
  assert.match(body, /<option value="family:s-dorothy">Karen Jensen \(Dorothy&#39;s daughter\)<\/option>/);
  assert.match(body, /<option value="volunteer:v-sam">Sam Rivera<\/option>/);
  assert.match(body, /<option value="senior:s-eugene">Eugene Park<\/option>/);
  assert.match(body, /<input type="hidden" name="as" value="coordinator">/);
  assert.doesNotMatch(mainOf(body), /\d{3}[-. )]\d{3}[-. ]\d{4}/, 'no phone numbers');
});

test('a phone number typed into a family contact is never shown on the sign-in page', async () => {
  assert.equal(relationWord('Son, lives in Phoenix'), 'son');
  assert.equal(relationWord('317-555-0100'), 'family');
  assert.equal(relationWord(''), 'family');
  assert.equal(noPhone('Pat (317) 555-0100'), 'Pat [number hidden]');
  const res = await post('/seniors', {
    name: 'Phone Test', interests: 'gardening', availability: 'mon-morning', contactMethod: 'phone',
    caregiverName: 'Pat 317-555-0100', caregiverRelationship: 'Call 317.555.0199',
  });
  assert.equal(res.status, 303);
  const page = mainOf(await text('/sign-in'));
  assert.doesNotMatch(page, /555/);
  assert.match(page, /Pat \[number hidden\] \(Phone&#39;s family\)/);
  await reset();
});

test('POST /sign-in sets the cookie and goes to the role\'s home page (Post/Redirect/Get)', async () => {
  const cases = [
    ['coordinator', '/attention?msg=signed_in'],
    ['volunteer:v-sam', '/volunteers/v-sam/week?msg=signed_in'],
    ['family:s-harold', '/dashboard?msg=signed_in'],
    ['senior:s-harold', '/seniors/s-harold?msg=signed_in'],
  ];
  for (const [as, home] of cases) {
    const res = await post('/sign-in', { as });
    assert.equal(res.status, 303, as);
    assert.equal(res.headers.get('location'), home, as);
    assert.match(res.headers.get('set-cookie'), new RegExp(`^viewer=${encodeURIComponent(as)}; Path=/; Max-Age=\\d+; SameSite=Lax`), as);
    const landing = await get(home, as);
    assert.equal(landing.status, 200, home);
    assert.match(await landing.text(), /Signed in for the demo\./);
  }
  // Only real ids are accepted.
  for (const as of ['volunteer:v-nobody', 'family:s-nobody', 'senior:', 'admin', '', 'coordinator:x']) {
    const res = await post('/sign-in', { as });
    assert.equal(res.status, 200, `"${as}" shows the form again`);
    assert.equal(res.headers.get('set-cookie'), null, `"${as}" sets no cookie`);
    assert.match(await res.text(), /Choose a person from one of the lists\./);
  }
});

test('POST /sign-out clears the cookie and goes home, in demo mode again', async () => {
  const res = await post('/sign-out', {}, 'family:s-harold');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/?msg=signed_out');
  assert.match(res.headers.get('set-cookie'), /^viewer=; Path=\/; Max-Age=0/);
  assert.match(await text('/?msg=signed_out'), /Signed out\. Demo mode is back/);
});

// ----- the header and nav -----

test('signed in: the header says who, the nav shows only allowed pages', async () => {
  const fam = await text('/dashboard', 'family:s-harold');
  assert.match(fam, /Signed in as <strong>Mike Whitaker \(Hal&#39;s family\)<\/strong>/);
  assert.match(fam, /<form method="post" action="\/sign-out"/);
  assert.deepEqual(navLinks(fam), ['/dashboard', '/seniors/s-harold', '/help']);
  assert.match(navOf(fam), /<a href="\/dashboard" aria-current="page">Family Dashboard<\/a>/);

  const vol = await text('/volunteers/v-ethan/week', 'volunteer:v-ethan');
  assert.match(vol, /Signed in as <strong>Ethan Brooks \(volunteer\)<\/strong>/);
  assert.deepEqual(navLinks(vol), ['/volunteers/v-ethan/week', '/contacts', '/help']);

  const sen = await text('/seniors/s-harold', 'senior:s-harold');
  assert.match(sen, /Signed in as <strong>Harold Whitaker<\/strong>/);
  assert.deepEqual(navLinks(sen), ['/seniors/s-harold', '/help']);

  const coord = await text('/attention', 'coordinator');
  assert.match(coord, /Signed in as <strong>the coordinator<\/strong>/);
  assert.equal(navLinks(coord).length, 8, 'the coordinator gets the full nav');
});

// ----- volunteer -----

test('volunteer: allowed and blocked pages', async () => {
  await reset();
  const ethan = 'volunteer:v-ethan';
  const allowed = ['/volunteers/v-ethan', '/volunteers/v-ethan/week', '/seniors/s-harold', '/contacts', '/help', '/about-ai', '/tour', '/sign-in', '/healthz'];
  const blocked = ['/dashboard', '/attention', '/seniors', '/seniors/s-dorothy', '/seniors/s-harold/edit', '/seniors/s-harold/summary', '/volunteers', '/volunteers/v-maya', '/volunteers/v-maya/week', '/volunteers/v-ethan/edit', '/match', '/match?seniorId=s-eugene', '/demo/reset', '/seniors/new', '/attention/s-harold/rematch'];
  for (const [p, status] of Object.entries(await statuses(ethan, allowed))) assert.equal(status, 200, `${p} allowed`);
  for (const [p, status] of Object.entries(await statuses(ethan, blocked))) assert.equal(status, 403, `${p} blocked`);
  const home = await get('/', ethan);
  assert.equal(home.status, 303);
  assert.equal(home.headers.get('location'), '/volunteers/v-ethan/week');

  const denied = await text('/dashboard', ethan);
  assert.match(denied, /<h1>This page is for coordinators<\/h1>/);
  assert.match(denied, /You're signed in as Ethan Brooks \(volunteer\)/);
  assert.match(mainOf(denied), /<a href="\/volunteers\/v-ethan\/week">My week<\/a>/);
  assert.match(mainOf(denied), /<form method="post" action="\/sign-out"/);
});

test('volunteer: can act on their own calls only (GET and POST checked on the server)', async () => {
  await reset();
  const dorothyCall = scheduledCall('s-dorothy'); // Maya's call
  assert.equal(dorothyCall.volunteerId, 'v-maya');

  // Ethan tries to log, miss, or download Maya's call.
  let res = await post(`/contacts/${dorothyCall.id}/complete`, {}, 'volunteer:v-ethan');
  assert.equal(res.status, 403);
  assert.match(await res.text(), /This page is for coordinators/);
  res = await post(`/contacts/${dorothyCall.id}/missed`, { reason: 'no_answer' }, 'volunteer:v-ethan');
  assert.equal(res.status, 403);
  assert.equal(store.contacts.find((c) => c.id === dorothyCall.id).status, 'scheduled', 'nothing changed');
  assert.equal((await get(`/contacts/${dorothyCall.id}/calendar.ics`, 'volunteer:v-ethan')).status, 403);
  assert.equal((await get(`/contacts/c-nope/calendar.ics`, 'volunteer:v-ethan')).status, 403);

  // Ethan tries to schedule a call for Maya's pair.
  const before = store.contacts.length;
  res = await post('/contacts', { matchId: 'm-dorothy-maya', action: 'schedule', type: 'phone', date: '2099-01-01', time: '16:00' }, 'volunteer:v-ethan');
  assert.equal(res.status, 403);
  assert.equal(store.contacts.length, before);

  // ...or sparks for someone else's senior, or coordinator actions.
  assert.equal((await post('/seniors/s-dorothy/sparks', { variant: '0' }, 'volunteer:v-ethan')).status, 403);
  assert.equal((await post('/settings', { riskThresholdDays: '3' }, 'volunteer:v-ethan')).status, 403);
  assert.equal(store.settings.riskThresholdDays, 7);
  assert.equal((await post('/matches', { seniorId: 's-eugene', volunteerId: 'v-ethan' }, 'volunteer:v-ethan')).status, 403);
  assert.equal((await post('/matches/m-harold-ethan/end', {}, 'volunteer:v-ethan')).status, 403);
  assert.equal(store.activeMatchForSenior('s-harold').id, 'm-harold-ethan');
  assert.equal((await post('/demo/reset', {}, 'volunteer:v-ethan')).status, 403);
  assert.equal((await post('/volunteers/v-ethan', { name: 'Changed' }, 'volunteer:v-ethan')).status, 403);
  assert.equal(store.volunteer('v-ethan').name, 'Ethan Brooks');

  // Maya can download her own call.
  assert.equal((await get(`/contacts/${dorothyCall.id}/calendar.ics`, 'volunteer:v-maya')).status, 200);

  // Ethan's visit with Hal from yesterday is still unmarked. Maya can't log it; Ethan can.
  const halVisit = store.contacts.find((c) => c.seniorId === 's-harold' && c.status === 'scheduled');
  assert.equal(halVisit.volunteerId, 'v-ethan');
  assert.equal((await post(`/contacts/${halVisit.id}/complete`, {}, 'volunteer:v-maya')).status, 403);
  assert.equal((await post(`/contacts/${halVisit.id}/missed`, {}, 'volunteer:v-maya')).status, 403);
  assert.equal(store.contacts.find((c) => c.id === halVisit.id).status, 'scheduled', 'nothing changed');
  res = await post(`/contacts/${halVisit.id}/complete`, { back: '/volunteers/v-ethan/week' }, 'volunteer:v-ethan');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/volunteers/v-ethan/week?msg=completed');
  assert.equal(store.contacts.find((c) => c.id === halVisit.id).status, 'completed');

  // Ethan can schedule for his own pair, ask for Hal's sparks, and change text size.
  res = await post('/contacts', { matchId: 'm-harold-ethan', action: 'schedule', type: 'visit', date: '2099-01-01', time: '15:00' }, 'volunteer:v-ethan');
  assert.equal(res.status, 200, 'own pair gets past the guard (the form then says the date is too far out)');
  assert.doesNotMatch(await res.text(), /This page is for coordinators/);
  res = await post('/seniors/s-harold/sparks', { variant: '0', back: '/volunteers/v-ethan/week' }, 'volunteer:v-ethan');
  assert.equal(res.status, 303);
  res = await post('/prefs/text-size', { size: 'large', back: '/volunteers/v-ethan/week' }, 'volunteer:v-ethan');
  assert.equal(res.status, 303);
  assert.match(res.headers.get('set-cookie'), /textsize=large/);
});

test('volunteer: Calls & Visits shows only their own pairs and calls', async () => {
  await reset();
  const main = mainOf(await text('/contacts', 'volunteer:v-maya'));
  assert.match(main, /<option value="m-dorothy-maya">Dorothy Jensen with Maya Patel<\/option>/);
  assert.doesNotMatch(main, /m-rosa-linda|m-harold-ethan/);
  assert.doesNotMatch(main, /Rosa Delgado|Harold Whitaker|Linda Okafor|Ethan Brooks/);
  assert.match(main, /Dorothy Jensen/);
  // Volunteers still see their own call notes.
  assert.match(await text('/seniors/s-harold', 'volunteer:v-ethan'), /Watched the second half of the game together\./);
});

// ----- family -----

test('family: only their senior, notes hidden, no alert setting', async () => {
  await reset();
  const mike = 'family:s-harold';
  // The tour stays open to everyone: its step 7 signs in as Mike (B-35).
  const allowed = ['/dashboard', '/seniors/s-harold', '/seniors/s-harold/summary', '/help', '/about-ai', '/sign-in', '/tour'];
  const blocked = ['/attention', '/seniors', '/seniors/s-rosa', '/seniors/s-rosa/summary', '/seniors/s-harold/edit', '/volunteers', '/volunteers/v-ethan', '/volunteers/v-ethan/week', '/contacts', '/match', '/demo/reset'];
  for (const [p, status] of Object.entries(await statuses(mike, allowed))) assert.equal(status, 200, `${p} allowed`);
  for (const [p, status] of Object.entries(await statuses(mike, blocked))) assert.equal(status, 403, `${p} blocked`);
  assert.match(await text('/seniors/s-rosa/summary', mike), /You're signed in as Mike Whitaker \(Hal&#39;s family\)/);

  const dash = await text('/dashboard', mike);
  assert.deepEqual([...dash.matchAll(/class="card dash-card dash-(\w+)"/g)].map((m) => m[1]), ['at_risk']);
  assert.match(dash, /\/seniors\/s-harold"/);
  assert.doesNotMatch(mainOf(dash), /Dorothy|Rosa|Eugene/);
  assert.doesNotMatch(dash, /action="\/settings"/, 'the alert setting form is hidden');
  assert.doesNotMatch(dash, /town-filter/, 'no town filter for one senior');
  assert.doesNotMatch(dash, /href="\/attention"/);

  const res = await post('/settings', { riskThresholdDays: '3' }, mike);
  assert.equal(res.status, 403);
  assert.match(await res.text(), /This page is for coordinators/);
  assert.equal(store.settings.riskThresholdDays, 7);

  const profile = await text('/seniors/s-harold', mike);
  assert.doesNotMatch(profile, /Watched the second half|store ledger|gin rummy|Army days/, 'call notes hidden');
  assert.doesNotMatch(profile, /basketball practice ran late/, 'missed-call notes hidden');
  assert.match(profile, /<span class="badge badge-missed">Missed<\/span>/, 'the missed visit itself still shows');
  assert.doesNotMatch(profile, /href="\/seniors\/s-harold\/edit"/);
  assert.doesNotMatch(profile, /action="\/seniors\/s-harold\/sparks"/);
  assert.doesNotMatch(profile, /id="sparks"/, 'sparks are a volunteer tool');
  assert.doesNotMatch(profile, /href="\/volunteers\//);
  assert.match(profile, /<dt>Companion<\/dt><dd>Ethan Brooks<\/dd>/);

  const summary = await text('/seniors/s-harold/summary', mike);
  assert.doesNotMatch(summary, /basketball practice ran late|Watched the second half/);
});

// ----- senior -----

test('senior: their own page only, notes hidden', async () => {
  await reset();
  const hal = 'senior:s-harold';
  for (const [p, status] of Object.entries(await statuses(hal, ['/seniors/s-harold', '/help', '/about-ai', '/sign-in', '/tour']))) assert.equal(status, 200, p);
  for (const [p, status] of Object.entries(await statuses(hal, ['/dashboard', '/seniors/s-harold/summary', '/seniors/s-dorothy', '/attention', '/contacts', '/seniors/s-harold/edit']))) {
    assert.equal(status, 403, p);
  }
  assert.equal((await get('/', hal)).headers.get('location'), '/seniors/s-harold');
  const page = await text('/seniors/s-harold', hal);
  assert.match(page, /Hi Hal! Here is your PorchLight\./);
  assert.doesNotMatch(page, /Watched the second half|basketball practice ran late/);
  assert.equal((await post('/seniors/s-harold/sparks', { variant: '0' }, hal)).status, 403);
  assert.equal((await post('/prefs/text-size', { size: 'xlarge', back: '/seniors/s-harold' }, hal)).status, 303);
});

// ----- coordinator -----

test('coordinator: everything, the same as demo mode', async () => {
  await reset();
  const all = await statuses('coordinator', ['/', '/dashboard', '/attention', '/match', '/seniors', '/seniors/s-harold/edit', '/volunteers/v-maya/week', '/contacts', '/demo/reset']);
  for (const [p, status] of Object.entries(all)) assert.equal(status, 200, p);
  assert.match(await text('/dashboard', 'coordinator'), /action="\/settings"/);
  assert.match(await text('/seniors/s-harold', 'coordinator'), /Watched the second half/);
  assert.equal((await post('/settings', { riskThresholdDays: '8' }, 'coordinator')).status, 303);
  assert.equal(store.settings.riskThresholdDays, 8);
  await reset();
});

// ----- stale cookies -----

test('a stale or unknown cookie falls back to demo mode and is cleared', async () => {
  await reset();
  for (const value of ['volunteer:v-gone', 'family:s-gone', 'senior:s-gone', 'admin', 'volunteer:', ':s-harold', 'x'.repeat(500)]) {
    const res = await get('/attention', value);
    assert.equal(res.status, 200, value);
    assert.match(res.headers.get('set-cookie') || '', /^viewer=; Path=\/; Max-Age=0/, `${value} is cleared`);
    const body = await res.text();
    assert.match(body, /Demo mode: everything is visible/);
    assert.equal(navLinks(body).length, 8);
  }
  // A volunteer added after the last reset is deleted by the next reset.
  const res = await post('/volunteers', { name: 'Temp Vol', interests: 'reading', availability: 'mon-morning', contactMethods: 'phone', maxSeniors: '1' });
  const id = res.headers.get('location').match(/\/volunteers\/([^?]+)/)[1];
  assert.equal((await get('/dashboard', `volunteer:${id}`)).status, 403);
  await reset();
  assert.equal((await get('/dashboard', `volunteer:${id}`)).status, 200, 'back to demo mode after the reset');
  // A family cookie for a senior whose family contact was removed is stale too.
  store.senior('s-rosa').caregiver = { name: '', relationship: '' };
  store.save();
  assert.equal((await get('/attention', 'family:s-rosa')).status, 200);
  await reset();
});

// ----- escaping -----

test('names in the "Signed in as" line and the sign-in page are escaped', async () => {
  let res = await post('/seniors', {
    name: '<img src=x onerror=alert(1)>', interests: 'gardening', availability: 'mon-morning', contactMethod: 'phone',
    caregiverName: '<script>alert("fam")</script>', caregiverRelationship: '<b>Son</b>',
  });
  assert.equal(res.status, 303);
  const sid = res.headers.get('location').match(/\/seniors\/([^?]+)/)[1];
  res = await post('/volunteers', { name: '"><svg onload=alert(2)>', interests: 'reading', availability: 'mon-morning', contactMethods: 'phone', maxSeniors: '1' });
  const vid = res.headers.get('location').match(/\/volunteers\/([^?]+)/)[1];

  const signIn = await text('/sign-in');
  assert.doesNotMatch(signIn, /<script>alert|<img src=x|<svg onload/);
  assert.match(signIn, /&lt;script&gt;alert\(&quot;fam&quot;\)&lt;\/script&gt;/);

  for (const [viewer, home] of [[`family:${sid}`, '/dashboard'], [`senior:${sid}`, `/seniors/${sid}`], [`volunteer:${vid}`, `/volunteers/${vid}/week`]]) {
    const body = await text(home, viewer);
    assert.match(body, /Signed in as <strong>/, viewer);
    assert.doesNotMatch(body, /<script>alert|<img src=x|<svg onload/, viewer);
  }
  assert.match(await text('/dashboard', `family:${sid}`), /Signed in as <strong>&lt;script&gt;alert\(&quot;fam&quot;\)&lt;\/script&gt; \(&lt;img&#39;s family\)<\/strong>/);
  await reset();
});

// ----- no dead ends -----

test('every link a signed-in person is shown leads to a page they may open', async () => {
  await reset();
  for (const [viewer, start] of [['volunteer:v-ethan', '/volunteers/v-ethan/week'], ['volunteer:v-maya', '/volunteers/v-maya'], ['family:s-harold', '/dashboard'], ['senior:s-rosa', '/seniors/s-rosa']]) {
    const seen = new Set();
    const queue = [start, '/sign-in', '/help'];
    while (queue.length && seen.size < 60) {
      const p = queue.shift();
      if (seen.has(p)) continue;
      seen.add(p);
      const res = await get(p, viewer);
      if (res.status === 303) continue; // "/" goes to the person's home page
      assert.equal(res.status, 200, `${viewer}: ${p}`);
      if (!(res.headers.get('content-type') || '').includes('text/html')) continue;
      const body = await res.text();
      assert.equal((body.match(/<h1[\s>]/g) || []).length, 1, `${viewer}: ${p} has one h1`);
      for (const m of body.matchAll(/<a\b[^>]*\bhref="(\/[^"#]*)/g)) {
        const href = m[1].replace(/&amp;/g, '&');
        if (!href.startsWith('//') && !seen.has(href)) queue.push(href);
      }
      const mayUse = canAs(viewer);
      for (const m of body.matchAll(/<form\b[^>]*\baction="([^"]+)"/g)) {
        const method = /method="post"/i.test(m[0]) ? 'POST' : 'GET';
        assert.ok(mayUse(method, m[1]), `${viewer}: ${p} shows a ${method} form to ${m[1]}`);
      }
    }
    assert.ok(seen.size >= 3, `${viewer} crawled ${seen.size} pages`);
  }
});

// can() for a cookie value, with the viewer built from the store the same way the app does.
function canAs(value) {
  const viewer = viewerFromCookie(value, store);
  return (method, p) => can(viewer, method, p.split('?')[0], { store });
}

// ----- units -----

test('the access table and the link stripper', () => {
  assert.ok(ACCESS_RULES.length > 10);
  const fakeStore = {
    activeMatchesForVolunteer: (id) => (id === 'v1' ? [{ seniorId: 's1' }] : []),
    contacts: [{ id: 'c1', volunteerId: 'v1' }],
    matches: [{ id: 'm1', volunteerId: 'v1', active: true }, { id: 'm2', volunteerId: 'v2', active: true }],
  };
  const v1 = { kind: 'volunteer', id: 'v1' };
  const fam = { kind: 'family', id: 's1' };
  assert.equal(can(null, 'POST', '/demo/reset'), true, 'demo mode');
  assert.equal(can({ kind: 'coordinator' }, 'POST', '/demo/reset'), true);
  assert.equal(can(v1, 'GET', '/seniors/s1', { store: fakeStore }), true);
  assert.equal(can(v1, 'GET', '/seniors/s1/', { store: fakeStore }), true, 'trailing slash, like the router');
  assert.equal(can(v1, 'GET', '/seniors/s2', { store: fakeStore }), false);
  assert.equal(can(v1, 'POST', '/contacts/c1/complete', { store: fakeStore }), true);
  assert.equal(can(v1, 'POST', '/contacts/c2/complete', { store: fakeStore }), false);
  assert.equal(can(v1, 'POST', '/contacts', { store: fakeStore, body: { matchId: 'm2' } }), false);
  assert.equal(can(v1, 'POST', '/contacts', { store: fakeStore, body: { matchId: 'm1' } }), true);
  assert.equal(can(v1, 'GET', '/contacts/c1/calendarXics', { store: fakeStore }), false, 'dots are literal');
  assert.equal(can(v1, 'GET', '/seniors/%E0%A4%A', { store: fakeStore }), false, 'malformed escapes never match');
  assert.equal(can(fam, 'GET', '/seniors/s1/summary', { store: fakeStore }), true);
  assert.equal(can(fam, 'POST', '/settings', { store: fakeStore }), false);
  assert.equal(can(fam, 'POST', '/prefs/anything-new', { store: fakeStore }), true);

  const allowed = (method, p) => p !== '/blocked' && !(method === 'POST' && p === '/settings');
  const page = [
    '<p class="back-link"><a href="/blocked"><span aria-hidden="true">←</span> Back to all</a></p>',
    '<p>Companion: <a href="/blocked">Ethan</a></p>',
    '<p><strong>Right now.</strong> <a href="/blocked">See what to do next</a></p>',
    '<a class="button button-secondary" href="/blocked?x=1">Edit</a>',
    '<a href="/blocked" download>Add to calendar</a>',
    '<a href="/ok#here">Fine</a>',
    '<a href="https://example.org/blocked">Outside</a>',
    '<form method="post" action="/settings"><button>Save</button></form>',
    '<form method="post" action="/prefs/text-size"><button>A</button></form>',
  ].join('\n');
  assert.equal(
    stripBlocked(page, allowed),
    [
      '',
      '<p>Companion: Ethan</p>',
      '<p><strong>Right now.</strong> </p>',
      '',
      '',
      '<a href="/ok#here">Fine</a>',
      '<a href="https://example.org/blocked">Outside</a>',
      '',
      '<form method="post" action="/prefs/text-size"><button>A</button></form>',
    ].join('\n')
  );
});

test("a senior's own page has no risk labels about them; family still sees them", async () => {
  await reset();
  const own = mainOf(await text('/seniors/s-harold', 'senior:s-harold'));
  assert.doesNotMatch(own, /Isolation risk|Contact dropping/);
  assert.match(own, /Hi Hal!/);
  const family = mainOf(await text('/seniors/s-harold', 'family:s-harold'));
  assert.match(family, /Isolation risk/);
});
