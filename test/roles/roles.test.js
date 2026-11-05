// Roles (v2, real accounts): what each signed-in person may open and change
// (checked on the server), the "not for you" page, the nav for each role,
// private notes, escaping, and no dead ends. Sessions come from
// test/helpers/server.js; sign-in itself is tested in ./accounts.test.js.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { can, ACCESS_RULES } from '../../src/roles/index.js';
import { relationWord, noPhone, viewerFromUser } from '../../src/roles/viewer.js';
import { stripBlocked } from '../../src/roles/links.js';
import { startApp, userFor } from '../helpers/server.js';

let app;
let store;
before(async () => {
  app = await startApp({ prefix: 'porchlight-roles-' });
  store = app.store;
});
after(() => app.close());

const get = (p, as) => app.get(p, { as });
const text = async (p, as) => (await get(p, as)).text();
const post = (p, data = {}, as) => app.post(p, data, { as });
const reset = () => store.reset();
const mainOf = (body) => body.slice(body.indexOf('<main'), body.indexOf('</main>'));
const navOf = (body) => body.slice(body.indexOf('<nav class="site-nav"'), body.indexOf('</nav>'));
const navLinks = (body) => [...navOf(body).matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
const scheduledCall = (seniorId) => store.contacts.find((c) => c.seniorId === seniorId && c.status === 'scheduled');

async function statuses(as, paths) {
  const out = {};
  for (const p of paths) out[p] = (await get(p, as)).status;
  return out;
}

// ----- signed out -----

test('signed out: only the public pages; everything else goes to the sign-in page', async () => {
  reset();
  for (const p of ['/', '/sign-in', '/sign-up', '/sign-up/senior', '/sign-up/volunteer', '/sign-up/family', '/help', '/about-ai', '/tour', '/healthz']) {
    assert.equal((await get(p)).status, 200, p);
  }
  for (const p of ['/admin', '/admin/seniors', '/dashboard', '/contacts', '/seniors/s-harold', '/volunteers/v-ethan/week', '/account', '/home']) {
    const res = await get(p);
    assert.equal(res.status, 303, p);
    assert.equal(res.headers.get('location'), `/sign-in?next=${encodeURIComponent(p)}`, p);
  }
  const home = await text('/');
  assert.doesNotMatch(home, /Demo mode/);
  assert.doesNotMatch(home, /Harold|Isolation risk|href="\/admin/, 'the public home shows no coordinator data and no admin link');
  assert.deepEqual(navLinks(home), [], 'no app nav when signed out');
  // A POST with no session never reaches a handler.
  const res = await post('/admin/settings', { riskThresholdDays: '2' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/sign-in');
  assert.equal(store.settings.riskThresholdDays, 7);
});

test('the old coordinator addresses: admin goes to /admin, everyone else to the sign-in page', async () => {
  for (const [old, now] of [['/seniors', '/admin/seniors'], ['/seniors/new', '/admin/seniors/new'], ['/volunteers', '/admin/volunteers'], ['/volunteers/new', '/admin/volunteers/new'], ['/match', '/admin/match'], ['/attention', '/admin/attention'], ['/demo/reset', '/admin/demo/reset']]) {
    let res = await get(old, 'admin');
    assert.equal(res.status, 303, old);
    assert.equal(res.headers.get('location'), now, old);
    for (const who of ['volunteer:v-ethan', 'family:s-harold', 'senior:s-harold']) {
      res = await get(old, who);
      assert.equal(res.status, 303, `${who} ${old}`);
      assert.equal(res.headers.get('location'), '/sign-in', `${who} ${old}`);
    }
    res = await get(old);
    assert.equal(res.headers.get('location'), `/sign-in?next=${encodeURIComponent(now)}`);
  }
  assert.equal((await get('/match?seniorId=s-eugene', 'admin')).headers.get('location'), '/admin/match?seniorId=s-eugene');
});

test('signed in: the header says who, the nav shows only allowed pages', async () => {
  reset();
  const fam = await text('/dashboard', 'family:s-harold');
  assert.match(fam, /Signed in as <strong>Mike Whitaker \(Hal&#39;s family\)<\/strong>/);
  assert.match(fam, /<form method="post" action="\/sign-out"/);
  assert.deepEqual(navLinks(fam), ['/dashboard', '/seniors/s-harold', '/account', '/help']);
  assert.match(navOf(fam), /<a href="\/dashboard" aria-current="page">Family Dashboard<\/a>/);

  const vol = await text('/volunteers/v-ethan/week', 'volunteer:v-ethan');
  assert.match(vol, /Signed in as <strong>Ethan Brooks \(volunteer\)<\/strong>/);
  assert.deepEqual(navLinks(vol), ['/volunteers/v-ethan/week', '/contacts', '/account', '/help'], '/messages appears once the translate pages exist');

  const sen = await text('/seniors/s-harold', 'senior:s-harold');
  assert.match(sen, /Signed in as <strong>Harold Whitaker<\/strong>/);
  assert.deepEqual(navLinks(sen), ['/seniors/s-harold', '/account', '/help']);

  const coord = await text('/admin/attention', 'admin');
  assert.match(coord, /Signed in as <strong>Casey Reed \(coordinator\)<\/strong>/);
  assert.deepEqual(navLinks(coord), ['/admin', '/admin/seniors', '/admin/volunteers', '/admin/match', '/contacts', '/admin/dashboard', '/admin/attention', '/admin/approvals', '/help']);
});

// ----- volunteer -----

test('volunteer: allowed and blocked pages', async () => {
  reset();
  const ethan = 'volunteer:v-ethan';
  const allowed = ['/volunteers/v-ethan', '/volunteers/v-ethan/week', '/seniors/s-harold', '/contacts', '/help', '/about-ai', '/tour', '/sign-in', '/healthz', '/account'];
  const blocked = ['/admin', '/dashboard', '/admin/dashboard', '/admin/attention', '/admin/seniors', '/seniors/s-dorothy', '/seniors/s-harold/edit', '/seniors/s-harold/summary', '/admin/volunteers', '/volunteers/v-maya', '/volunteers/v-maya/week', '/volunteers/v-ethan/edit', '/admin/match', '/admin/match?seniorId=s-eugene', '/admin/demo/reset', '/admin/seniors/new', '/attention/s-harold/rematch', '/admin/approvals'];
  for (const [p, status] of Object.entries(await statuses(ethan, allowed))) assert.equal(status, 200, `${p} allowed`);
  for (const [p, status] of Object.entries(await statuses(ethan, blocked))) assert.equal(status, 403, `${p} blocked`);
  const home = await get('/', ethan);
  assert.equal(home.status, 303);
  assert.equal(home.headers.get('location'), '/volunteers/v-ethan/week');

  const denied = await text('/dashboard', ethan);
  assert.match(denied, /<h1>This page is not for your account<\/h1>/);
  assert.match(denied, /You&#39;re signed in as Ethan Brooks \(volunteer\)/);
  assert.match(mainOf(denied), /<a href="\/volunteers\/v-ethan\/week">My week<\/a>/);
  assert.match(mainOf(denied), /<form method="post" action="\/sign-out"/);
});

test('volunteer: can act on their own calls only (GET and POST checked on the server)', async () => {
  reset();
  const dorothyCall = scheduledCall('s-dorothy'); // Maya's call
  assert.equal(dorothyCall.volunteerId, 'v-maya');
  const ethan = 'volunteer:v-ethan';

  let res = await post(`/contacts/${dorothyCall.id}/complete`, {}, ethan);
  assert.equal(res.status, 403);
  assert.match(await res.text(), /This page is not for your account/);
  res = await post(`/contacts/${dorothyCall.id}/missed`, { reason: 'no_answer' }, ethan);
  assert.equal(res.status, 403);
  assert.equal(store.contacts.find((c) => c.id === dorothyCall.id).status, 'scheduled', 'nothing changed');
  assert.equal((await get(`/contacts/${dorothyCall.id}/calendar.ics`, ethan)).status, 403);
  assert.equal((await get('/contacts/c-nope/calendar.ics', ethan)).status, 403);

  const before = store.contacts.length;
  res = await post('/contacts', { matchId: 'm-dorothy-maya', action: 'schedule', type: 'phone', date: '2099-01-01', time: '16:00' }, ethan);
  assert.equal(res.status, 403);
  assert.equal(store.contacts.length, before);

  assert.equal((await post('/seniors/s-dorothy/sparks', { variant: '0' }, ethan)).status, 403);
  assert.equal((await post('/admin/settings', { riskThresholdDays: '3' }, ethan)).status, 403);
  assert.equal(store.settings.riskThresholdDays, 7);
  assert.equal((await post('/admin/matches', { seniorId: 's-eugene', volunteerId: 'v-ethan' }, ethan)).status, 403);
  assert.equal((await post('/admin/matches/m-harold-ethan/end', {}, ethan)).status, 403);
  assert.equal(store.activeMatchForSenior('s-harold').id, 'm-harold-ethan');
  assert.equal((await post('/admin/demo/reset', {}, ethan)).status, 403);
  assert.equal((await post('/volunteers/v-ethan', { name: 'Changed' }, ethan)).status, 403);
  assert.equal(store.volunteer('v-ethan').name, 'Ethan Brooks');

  assert.equal((await get(`/contacts/${dorothyCall.id}/calendar.ics`, 'volunteer:v-maya')).status, 200);

  const halVisit = store.contacts.find((c) => c.seniorId === 's-harold' && c.status === 'scheduled');
  assert.equal(halVisit.volunteerId, 'v-ethan');
  assert.equal((await post(`/contacts/${halVisit.id}/complete`, {}, 'volunteer:v-maya')).status, 403);
  assert.equal(store.contacts.find((c) => c.id === halVisit.id).status, 'scheduled', 'nothing changed');
  res = await post(`/contacts/${halVisit.id}/complete`, { back: '/volunteers/v-ethan/week' }, ethan);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/volunteers/v-ethan/week?msg=completed');
  assert.equal(store.contacts.find((c) => c.id === halVisit.id).status, 'completed');

  res = await post('/seniors/s-harold/sparks', { variant: '0', back: '/volunteers/v-ethan/week' }, ethan);
  assert.equal(res.status, 303);
  res = await post('/prefs/text-size', { size: 'large', back: '/volunteers/v-ethan/week' }, ethan);
  assert.equal(res.status, 303);
  assert.match(res.headers.get('set-cookie'), /textsize=large/);
});

test('volunteer: Calls & Visits shows only their own pairs and calls', async () => {
  reset();
  const main = mainOf(await text('/contacts', 'volunteer:v-maya'));
  assert.match(main, /<option value="m-dorothy-maya">/);
  assert.doesNotMatch(main, /m-rosa-linda|m-harold-ethan/);
  assert.doesNotMatch(main, /Rosa Delgado|Harold Whitaker|Linda Okafor|Ethan Brooks/);
});

test("volunteer: a senior's page shows only first name, interests, languages, and times", async () => {
  reset();
  const page = mainOf(await text('/seniors/s-harold', 'volunteer:v-ethan'));
  assert.doesNotMatch(page, /Whitaker/, 'no last name');
  assert.doesNotMatch(page, /Mike|Phoenix/, 'no family contact');
  assert.doesNotMatch(page, /hardware store|Widowed/, 'no life story beyond interests');
  assert.match(page, /Hal/);
  assert.match(page, /Basketball/i);
  // Their own call notes are theirs to see.
  assert.match(page, /Watched the second half of the game together\./);
});

// ----- family -----

test('family: only their senior, notes hidden, no alert setting, companion first name only', async () => {
  reset();
  const mike = 'family:s-harold';
  const allowed = ['/dashboard', '/seniors/s-harold', '/seniors/s-harold/summary', '/help', '/about-ai', '/sign-in', '/tour', '/account'];
  const blocked = ['/admin/attention', '/admin/seniors', '/seniors/s-rosa', '/seniors/s-rosa/summary', '/seniors/s-harold/edit', '/admin/volunteers', '/volunteers/v-ethan', '/volunteers/v-ethan/week', '/contacts', '/admin/match', '/admin/demo/reset', '/admin/dashboard'];
  for (const [p, status] of Object.entries(await statuses(mike, allowed))) assert.equal(status, 200, `${p} allowed`);
  for (const [p, status] of Object.entries(await statuses(mike, blocked))) assert.equal(status, 403, `${p} blocked`);

  const dash = await text('/dashboard', mike);
  assert.deepEqual([...dash.matchAll(/class="card dash-card dash-(\w+)"/g)].map((m) => m[1]), ['at_risk']);
  assert.doesNotMatch(mainOf(dash), /Dorothy|Rosa|Eugene|Samira/);
  assert.doesNotMatch(dash, /action="\/admin\/settings"/, 'the alert setting form is hidden');
  assert.doesNotMatch(dash, /town-filter/);
  assert.doesNotMatch(mainOf(dash), /Brooks/, 'companion first name only');

  const res = await post('/admin/settings', { riskThresholdDays: '3' }, mike);
  assert.equal(res.status, 403);
  assert.equal(store.settings.riskThresholdDays, 7);

  const profile = await text('/seniors/s-harold', mike);
  assert.doesNotMatch(profile, /Watched the second half|store ledger|gin rummy|Army days/, 'call notes hidden');
  assert.doesNotMatch(profile, /basketball practice ran late/, 'missed-call notes hidden');
  assert.match(profile, /<span class="badge badge-missed">Missed<\/span>/, 'the missed visit itself still shows');
  assert.doesNotMatch(profile, /id="sparks"/, 'sparks are a volunteer tool');
  assert.doesNotMatch(profile, /href="\/volunteers\//);
  assert.match(profile, /<dt>Companion<\/dt><dd>Ethan<\/dd>/);
  assert.doesNotMatch(mainOf(profile), /Brooks/);

  const summary = await text('/seniors/s-harold/summary', mike);
  assert.doesNotMatch(summary, /basketball practice ran late|Watched the second half/);
});

// ----- senior -----

test('senior: their own page only, notes hidden, no risk labels', async () => {
  reset();
  const hal = 'senior:s-harold';
  for (const [p, status] of Object.entries(await statuses(hal, ['/seniors/s-harold', '/help', '/about-ai', '/sign-in', '/tour', '/account']))) assert.equal(status, 200, p);
  for (const [p, status] of Object.entries(await statuses(hal, ['/dashboard', '/seniors/s-harold/summary', '/seniors/s-dorothy', '/admin/attention', '/contacts', '/seniors/s-harold/edit']))) {
    assert.equal(status, 403, p);
  }
  assert.equal((await get('/', hal)).headers.get('location'), '/seniors/s-harold');
  const page = mainOf(await text('/seniors/s-harold', hal));
  assert.match(page, /Hi Hal! Here is your PorchLight\./);
  assert.doesNotMatch(page, /Watched the second half|basketball practice ran late/);
  assert.doesNotMatch(page, /Isolation risk|Contact dropping/);
  assert.equal((await post('/seniors/s-harold/sparks', { variant: '0' }, hal)).status, 403);
  // The family code is on their account page.
  assert.match(await text('/account', hal), /HKW8PZ/);
  const family = mainOf(await text('/seniors/s-harold', 'family:s-harold'));
  assert.match(family, /Isolation risk/, 'family still sees the flag');
});

// ----- coordinator -----

test('coordinator: everything', async () => {
  reset();
  const all = await statuses('admin', ['/admin', '/admin/dashboard', '/dashboard', '/admin/attention', '/admin/match', '/admin/seniors', '/seniors/s-harold/edit', '/volunteers/v-maya/week', '/contacts', '/admin/demo/reset', '/admin/approvals']);
  for (const [p, status] of Object.entries(all)) assert.equal(status, 200, p);
  assert.match(await text('/admin/dashboard', 'admin'), /action="\/admin\/settings"/);
  assert.match(await text('/seniors/s-harold', 'admin'), /Watched the second half/);
  assert.equal((await post('/admin/settings', { riskThresholdDays: '8' }, 'admin')).status, 303);
  assert.equal(store.settings.riskThresholdDays, 8);
  reset();
});

// ----- every /admin route -----

test('every /admin route: signed out goes to sign-in, every other role gets 403', async () => {
  reset();
  const gets = ['/admin', '/admin/seniors', '/admin/seniors/new', '/admin/volunteers', '/admin/volunteers/new', '/admin/match', '/admin/match?seniorId=s-eugene', '/admin/dashboard', '/admin/attention', '/admin/approvals', '/admin/demo/reset'];
  const posts = ['/admin/seniors', '/admin/volunteers', '/admin/matches', '/admin/matches/m-harold-ethan/end', '/admin/settings', '/admin/demo/reset', '/admin/approvals/volunteers/v-noah', '/admin/approvals/family/fl-ellen'];
  for (const p of gets) {
    const res = await get(p);
    assert.equal(res.status, 303, p);
    assert.match(res.headers.get('location'), /^\/sign-in\?next=/, p);
  }
  for (const p of posts) assert.equal((await post(p, {})).headers.get('location'), '/sign-in', p);
  for (const who of ['senior', 'senior-ar', 'volunteer', 'volunteer-translate', 'family', 'noah@porchlight.example', 'ellen@porchlight.example']) {
    for (const p of gets) assert.equal((await get(p, who)).status, 403, `${who} GET ${p}`);
    for (const p of posts) assert.equal((await post(p, { decision: 'approve' }, who)).status, 403, `${who} POST ${p}`);
  }
  assert.equal(store.volunteer('v-noah').status, 'pending', 'nothing was approved');
  assert.equal(store.activeMatchForSenior('s-harold').id, 'm-harold-ethan');
});

// ----- escaping -----

test('names in the "Signed in as" line are escaped', async () => {
  reset();
  const user = userFor(store, 'family:s-harold');
  user.name = '<script>alert("fam")</script>';
  const hal = store.senior('s-harold');
  hal.preferredName = '<img src=x onerror=alert(1)>';
  const body = await text('/dashboard', 'family:s-harold');
  assert.doesNotMatch(body, /<script>alert|<img src=x/);
  assert.match(body, /Signed in as <strong>&lt;script&gt;alert\(&quot;fam&quot;\)&lt;\/script&gt; \(&lt;img src=x onerror=alert\(1\)&gt;&#39;s family\)<\/strong>/);
  reset();
});

// ----- no dead ends -----

test('every link a signed-in person is shown leads to a page they may open', async () => {
  reset();
  for (const [who, start] of [['volunteer:v-ethan', '/volunteers/v-ethan/week'], ['volunteer:v-maya', '/volunteers/v-maya'], ['family:s-harold', '/dashboard'], ['senior:s-rosa', '/seniors/s-rosa'], ['noah@porchlight.example', '/home']]) {
    const viewer = viewerFromUser(userFor(store, who), store);
    const mayUse = (method, p) => can(viewer, method, p.split('?')[0], { store });
    const seen = new Set();
    const queue = [start, '/sign-in', '/help', '/account'];
    while (queue.length && seen.size < 60) {
      const p = queue.shift();
      if (seen.has(p)) continue;
      seen.add(p);
      const res = await get(p, who);
      if (res.status === 303) continue; // "/" goes to the person's home page
      assert.equal(res.status, 200, `${who}: ${p}`);
      if (!(res.headers.get('content-type') || '').includes('text/html')) continue;
      const body = await res.text();
      assert.equal((body.match(/<h1[\s>]/g) || []).length, 1, `${who}: ${p} has one h1`);
      assert.doesNotMatch(body, /href="\/admin/, `${who}: ${p} links to /admin`);
      for (const m of body.matchAll(/<a\b[^>]*\bhref="(\/[^"#]*)/g)) {
        const href = m[1].replace(/&amp;/g, '&');
        if (!href.startsWith('//') && !seen.has(href)) queue.push(href);
      }
      for (const m of body.matchAll(/<form\b[^>]*\baction="([^"]+)"/g)) {
        const method = /method="post"/i.test(m[0]) ? 'POST' : 'GET';
        assert.ok(mayUse(method, m[1]), `${who}: ${p} shows a ${method} form to ${m[1]}`);
      }
    }
    assert.ok(seen.size >= 3, `${who} crawled ${seen.size} pages`);
  }
});

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
  const pendingVolunteer = { kind: 'volunteer', id: 'v1', pending: true };
  assert.equal(can(null, 'POST', '/admin/demo/reset'), false, 'signed out: not allowed');
  assert.equal(can(null, 'GET', '/sign-up/senior'), true);
  assert.equal(can({ kind: 'coordinator' }, 'POST', '/admin/demo/reset'), true);
  assert.equal(can(v1, 'GET', '/seniors/s1', { store: fakeStore }), true);
  assert.equal(can(v1, 'GET', '/seniors/s1/', { store: fakeStore }), true, 'trailing slash, like the router');
  assert.equal(can(v1, 'GET', '/seniors/s2', { store: fakeStore }), false);
  assert.equal(can(pendingVolunteer, 'GET', '/seniors/s1', { store: fakeStore }), false, 'a pending volunteer sees no senior');
  assert.equal(can(pendingVolunteer, 'GET', '/account', { store: fakeStore }), true);
  assert.equal(can(v1, 'POST', '/contacts/c1/complete', { store: fakeStore }), true);
  assert.equal(can(v1, 'POST', '/contacts/c2/complete', { store: fakeStore }), false);
  assert.equal(can(v1, 'POST', '/contacts', { store: fakeStore, body: { matchId: 'm2' } }), false);
  assert.equal(can(v1, 'POST', '/contacts', { store: fakeStore, body: { matchId: 'm1' } }), true);
  assert.equal(can(v1, 'GET', '/contacts/c1/calendarXics', { store: fakeStore }), false, 'dots are literal');
  assert.equal(can(v1, 'GET', '/seniors/%E0%A4%A', { store: fakeStore }), false, 'malformed escapes never match');
  assert.equal(can(fam, 'GET', '/seniors/s1/summary', { store: fakeStore }), true);
  assert.equal(can(fam, 'POST', '/admin/settings', { store: fakeStore }), false);
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
  assert.equal(relationWord('Son, lives in Phoenix'), 'son');
  assert.equal(noPhone('Mike 602-555-0177'), 'Mike [number hidden]');
});
