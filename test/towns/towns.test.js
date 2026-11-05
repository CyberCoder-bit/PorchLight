// Towns: the statewide town list, one time zone per deployment, the town
// picker and filter, and the in-person county rule in matching. Same harness
// as test/app.test.js: the real app on a temporary data file.

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
import {
  COMMUNITY, INDIANA_EASTERN_TIME, INDIANA_CENTRAL_TIME, INDIANA_CENTRAL_TIME_COUNTIES, timeZoneForCounty,
} from '../../src/community.js';
import {
  TOWNS, DEPLOYMENT_TOWNS, townsForTimeZone, townByName, countyOf, townOf, townFromQuery, checkTown,
} from '../../src/towns/index.js';
import { scorePair, rankVolunteers } from '../../src/matching.js';
import { buildSeedData } from '../../src/seed.js';

process.env.TZ = 'America/Indiana/Indianapolis'; // match test/app.test.js

let server;
let base;
let store;
let tmpDir;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-towns-'));
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
const page = async (p) => {
  const res = await get(p);
  assert.equal(res.status, 200, p);
  return res.text();
};
const mainOf = (body) => body.slice(body.indexOf('<main'), body.indexOf('</main>'));
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
const dashCards = (html) => [...html.matchAll(/<h3 class="card-title"><a href="\/seniors\/([^"]+)">/g)].map((m) => m[1]);
const seniorCards = (html) => [...mainOf(html).matchAll(/<h2 class="card-title"><a href="\/seniors\/([^"]+)">/g)].map((m) => m[1]);
const volunteerCards = (html) => [...mainOf(html).matchAll(/<h2 class="card-title"><a href="\/volunteers\/([^"]+)">/g)].map((m) => m[1]);

// ----- the list -----

test('town list: spot checks of counties, in both time zones', () => {
  for (const name of ['Carmel', 'Fishers', 'Noblesville', 'Westfield']) assert.equal(countyOf(name), 'Hamilton County', name);
  assert.equal(countyOf('Indianapolis'), 'Marion County');
  assert.equal(countyOf('Fort Wayne'), 'Allen County');
  assert.equal(countyOf('South Bend'), 'St. Joseph County');
  assert.equal(countyOf('Bloomington'), 'Monroe County');
  assert.equal(countyOf('Kokomo'), 'Howard County');
  assert.equal(countyOf('Evansville'), 'Vanderburgh County');
  assert.equal(countyOf('Gary'), 'Lake County');
  assert.equal(countyOf('Michigan City'), 'LaPorte County');
  // The city of Jasper is in Dubois County (Eastern), not Jasper County (Central).
  assert.equal(countyOf('Jasper'), 'Dubois County');
  assert.equal(townByName('Jasper').timeZone, INDIANA_EASTERN_TIME);
  assert.equal(townByName('Rensselaer').county, 'Jasper County');
  assert.equal(townByName('Rensselaer').timeZone, INDIANA_CENTRAL_TIME);
  assert.equal(townByName('westfield').name, 'Westfield', 'lookups ignore case');
  assert.equal(countyOf('Atlantis'), null);
});

test('town list: well formed, no duplicates, and every Central-time county is covered', () => {
  assert.ok(TOWNS.length >= 30, `a few dozen towns (${TOWNS.length})`);
  const names = TOWNS.map((t) => t.name.toLowerCase());
  assert.equal(new Set(names).size, names.length, 'no duplicate towns');
  for (const t of TOWNS) {
    assert.match(t.county, /^[A-Z][A-Za-z. ]+ County$/, t.name);
    assert.equal(t.timeZone, timeZoneForCounty(t.county), t.name);
  }
  const counties = new Set(TOWNS.map((t) => t.county.replace(/ County$/, '').replace(/\s/g, '')));
  for (const c of INDIANA_CENTRAL_TIME_COUNTIES) assert.ok(counties.has(c), `${c} County has a town`);
});

test('only towns in this deployment\'s time zone are offered', async () => {
  const eastern = townsForTimeZone(INDIANA_EASTERN_TIME).map((t) => t.name);
  const central = townsForTimeZone(INDIANA_CENTRAL_TIME).map((t) => t.name);
  assert.ok(eastern.includes('Carmel') && eastern.includes('Indianapolis') && !eastern.includes('Evansville'));
  assert.ok(central.includes('Evansville') && central.includes('Gary') && !central.includes('Carmel'));
  assert.equal(eastern.length + central.length, TOWNS.length, 'two deployments cover every listed town');
  assert.equal(COMMUNITY.timeZone, INDIANA_EASTERN_TIME);
  assert.deepEqual(DEPLOYMENT_TOWNS.map((t) => t.name), eastern);

  for (const p of ['/seniors/new', '/volunteers/new', '/dashboard', '/seniors', '/volunteers', '/attention']) {
    const main = mainOf(await page(p));
    assert.match(main, /<option value="Westfield"/, p);
    assert.match(main, /<option value="Indianapolis"/, p);
    for (const other of ['Evansville', 'Gary', 'Valparaiso', 'Tell City']) {
      assert.doesNotMatch(main, new RegExp(`<option value="${other}"`), `${p} does not offer ${other} (Central time)`);
    }
  }
  // The form's select is labeled.
  const form = await page('/seniors/new');
  assert.match(form, /<label for="field-town">Town<\/label>/);
  assert.match(form, /<select id="field-town" name="town"/);
});

// ----- the filter -----

test('town filter: dashboard, seniors, volunteers, and Needs attention', async () => {
  await reset();
  // All towns (the default): the seeded story, unchanged.
  const all = await page('/dashboard');
  assert.deepEqual(dashCards(all), ['s-harold', 's-eugene', 's-rosa', 's-dorothy']);
  assert.match(all, /<label for="town-filter">Show seniors in<\/label>/);
  assert.match(all, /<option value="" selected>All towns<\/option>/);
  assert.doesNotMatch(all, /town-filter-status/);
  assert.match(all, /Right now, 2 seniors need attention/);

  const westfield = await page('/dashboard?town=Westfield');
  assert.deepEqual(dashCards(westfield), ['s-rosa']);
  assert.match(westfield, /<strong>In Westfield: 1 senior<\/strong> \(4 in all towns\)/);
  assert.match(westfield, /<option value="Westfield" selected>/);
  assert.match(westfield, /Right now in Westfield, no seniors need attention\./);
  assert.match(westfield, /<p class="tile-value">1<\/p><p class="tile-label"><span aria-hidden="true">◷<\/span> senior to check in with soon/);

  const carmel = await page('/dashboard?town=carmel');
  assert.deepEqual(dashCards(carmel), ['s-harold', 's-eugene', 's-dorothy']);
  assert.match(carmel, /In Carmel: 3 seniors/);

  const fishers = await page('/dashboard?town=Fishers');
  assert.deepEqual(dashCards(fishers), []);
  assert.match(fishers, /In Fishers: 0 seniors/);
  assert.match(fishers, /No seniors in Fishers\./);

  assert.deepEqual(seniorCards(await page('/seniors?town=Westfield')), ['s-rosa']);
  assert.match(await page('/seniors?town=Westfield'), /In Westfield: 1 senior<\/strong> \(4 in all towns\)/);
  assert.deepEqual(volunteerCards(await page('/volunteers?town=Indianapolis')), ['v-linda']);
  assert.match(await page('/volunteers?town=Indianapolis'), /In Indianapolis: 1 volunteer<\/strong> \(4 in all towns\)/);
  assert.equal(volunteerCards(await page('/volunteers?town=Carmel')).length, 3);

  const queueCarmel = await page('/attention?town=Carmel');
  assert.match(queueCarmel, /id="senior-s-harold"/);
  assert.match(queueCarmel, /id="senior-s-eugene"/);
  assert.match(queueCarmel, /In Carmel: 2 seniors on the list<\/strong> \(2 in all towns\)/);
  const queueWestfield = await page('/attention?town=Westfield');
  assert.doesNotMatch(queueWestfield, /id="senior-s-/);
  assert.match(queueWestfield, /Everyone in Westfield has had a recent check-in\./);
  assert.match(queueWestfield, /Not on the list yet, but due soon[\s\S]*Rosa Delgado/);
});

test('per town, the dashboard and Needs attention agree on who needs attention (needsAttention)', async () => {
  await reset();
  const flaggedOnDashboard = (body) => {
    const m = body.match(/Right now(?: in [^,]+)?, (no|\d+) seniors? needs? attention/);
    assert.ok(m, 'status line found');
    return m[1] === 'no' ? 0 : Number(m[1]);
  };
  const onQueue = (body) => (body.match(/class="card dash-card dash-\w+" id="senior-/g) || []).length;
  let sum = 0;
  for (const town of ['Carmel', 'Westfield', 'Fishers']) {
    const dash = flaggedOnDashboard(await page(`/dashboard?town=${town}`));
    const queue = onQueue(await page(`/attention?town=${town}`));
    assert.equal(dash, queue, town);
    sum += queue;
  }
  assert.equal(sum, onQueue(await page('/attention')), 'the towns add up to the whole list');
  assert.equal(flaggedOnDashboard(await page('/dashboard')), sum);
});

test('an unknown or other-time-zone town is ignored safely', async () => {
  const all = dashCards(await page('/dashboard'));
  for (const town of ['Atlantis', 'Evansville', '<script>alert(1)</script>', '', '%E0%A4%A', 'Westfield&town=Carmel']) {
    const res = await get(`/dashboard?town=${encodeURIComponent(town)}`);
    assert.equal(res.status, 200, town);
    const body = await res.text();
    assert.deepEqual(dashCards(body), all, `${town} shows every town`);
    assert.doesNotMatch(body, /town-filter-status"><strong>In /); // never claims to be filtered
    assert.doesNotMatch(body, /<script>alert/);
  }
  // A repeated ?town= uses the last value the URL parser keeps, and is still checked.
  assert.equal((await get('/seniors?town=Nowhere&town=Westfield')).status, 200);
  assert.equal(townFromQuery({ town: ['Westfield', 'Carmel'] }), 'Westfield');
  assert.equal(townFromQuery({ town: 'Gary' }), null);
  assert.equal(townFromQuery({}), null);
});

// ----- the data -----

test('town validation: only towns on the list; old forms keep the saved town', async () => {
  const senior = {
    name: 'Town Test', interests: 'gardening', availability: 'mon-morning', contactMethod: 'phone',
  };
  let res = await post('/seniors', { ...senior, town: 'Evansville' });
  assert.equal(res.status, 200, 'form shown again');
  let body = await res.text();
  assert.match(body, /href="#field-town">Choose a town from the list\./);
  assert.match(body, /<select id="field-town" name="town"[^>]*aria-invalid="true"/);

  res = await post('/seniors', { ...senior, town: '<b>Carmel</b>' });
  assert.equal(res.status, 200);

  res = await post('/seniors', { ...senior, town: 'fishers' });
  assert.equal(res.status, 303);
  const id = res.headers.get('location').match(/\/seniors\/([^?]+)/)[1];
  assert.equal(store.senior(id).town, 'Fishers', 'saved with the list spelling');
  assert.match(await page(`/seniors/${id}`), /<dt>Town<\/dt><dd>Fishers \(Hamilton County\)<\/dd>/);
  assert.match(await page(`/seniors/${id}/edit`), /<option value="Fishers" selected>/);

  // An old form with no town field leaves the saved town alone.
  res = await post(`/seniors/${id}`, { ...senior, name: 'Town Test Two' });
  assert.equal(res.status, 303);
  assert.equal(store.senior(id).town, 'Fishers');

  // Volunteers too.
  const volunteer = { name: 'Vol Town', interests: 'reading', availability: 'mon-morning', contactMethods: 'phone', maxSeniors: '1' };
  res = await post('/volunteers', { ...volunteer, town: 'Gary' });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Choose a town from the list\./);
  res = await post('/volunteers', { ...volunteer, town: 'Noblesville' });
  assert.equal(res.status, 303);
  const vid = res.headers.get('location').match(/\/volunteers\/([^?]+)/)[1];
  assert.equal(store.volunteer(vid).town, 'Noblesville');
  assert.match(await page('/volunteers'), /Community volunteer · Noblesville \(Hamilton County\)|· Noblesville \(Hamilton County\)/);

  // Unit: checkTown never touches values without a town field.
  const values = {};
  const errors = {};
  checkTown({}, values, errors);
  assert.deepEqual([values, errors], [{}, {}]);
});

test('old data without a town counts as the community town', async () => {
  assert.equal(townOf({}), COMMUNITY.town);
  assert.equal(townOf({ town: '  ' }), COMMUNITY.town);
  assert.equal(townOf(null), COMMUNITY.town);
  await reset();
  delete store.senior('s-dorothy').town; // like a data file from before towns existed
  delete store.volunteer('v-maya').town;
  store.save();
  assert.match(await page('/seniors/s-dorothy'), /<dt>Town<\/dt><dd>Carmel \(Hamilton County\)<\/dd>/);
  assert.ok(dashCards(await page('/dashboard?town=Carmel')).includes('s-dorothy'));
  assert.ok(volunteerCards(await page('/volunteers?town=Carmel')).includes('v-maya'));
  await reset();
});

test('seed: everyone has a town, Rosa is in Westfield, and the demo story is unchanged', async () => {
  const db = buildSeedData(new Date());
  for (const p of [...db.seniors, ...db.volunteers]) assert.ok(townByName(p.town), `${p.name} has a listed town`);
  const hamiltonNotCarmel = [...db.seniors, ...db.volunteers].filter((p) => countyOf(p.town) === 'Hamilton County' && p.town !== 'Carmel');
  assert.ok(hamiltonNotCarmel.length >= 1, 'someone lives in another Hamilton County town');
  assert.equal(db.seniors.find((s) => s.id === 's-rosa').town, 'Westfield');

  await reset();
  const dash = await page('/dashboard');
  const order = [...dash.matchAll(/class="card dash-card dash-(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['at_risk', 'needs_match', 'due_soon', 'ok']);
  const card = (id) => dash.slice(dash.indexOf(`/seniors/${id}"`) - 200, dash.indexOf(`/seniors/${id}"`) + 600);
  assert.match(card('s-harold'), /Isolation risk[\s\S]*Contact dropping/);
  assert.match(card('s-rosa'), /dash-due_soon/);
  assert.match(card('s-eugene'), /dash-needs_match/);

  const gene = db.seniors.find((s) => s.id === 's-eugene');
  const { eligible, ineligible } = rankVolunteers(gene, db.volunteers, db.matches);
  assert.equal(eligible[0].volunteer.id, 'v-sam');
  assert.equal(eligible[0].score, 25); // [v2] 21, plus 4 for a shared language (English)
  assert.deepEqual(ineligible.map((r) => [r.volunteer.id, r.problems]), [
    ['v-ethan', ['At capacity (already has 1 of 1 senior)']],
    ['v-linda', ['No overlapping availability']],
  ]);
  const matchPage = await page('/match?seniorId=s-eugene');
  assert.match(matchPage, /At capacity/);
  assert.match(matchPage, /No overlapping availability/);
  assert.ok(matchPage.indexOf('Sam Rivera') < matchPage.indexOf('Maya Patel'));
});

// ----- matching -----

test('matching: in-person visits need the same county; phone and video work statewide', () => {
  const senior = (over) => ({ id: 's', name: 'S', interests: ['history'], availability: ['mon-morning'], contactMethod: 'visit', town: 'Carmel', ...over });
  const vol = (over) => ({ id: 'v', name: 'V', interests: ['history'], availability: ['mon-morning'], contactMethods: ['visit', 'phone', 'video'], maxSeniors: 2, town: 'Carmel', ...over });

  const far = scorePair(senior(), vol({ town: 'Indianapolis' }), 0);
  assert.equal(far.eligible, false);
  assert.deepEqual(far.problems, ['Lives in Marion County - too far for in-person visits']);

  assert.equal(scorePair(senior(), vol({ town: 'Westfield' }), 0).eligible, true, 'same county, different town');
  assert.equal(scorePair(senior({ contactMethod: 'phone' }), vol({ town: 'Indianapolis' }), 0).eligible, true, 'phone works statewide');
  assert.equal(scorePair(senior({ contactMethod: 'video' }), vol({ town: 'Fort Wayne' }), 0).eligible, true, 'video works statewide');
  assert.equal(scorePair(senior({ town: undefined }), vol({ town: undefined }), 0).eligible, true, 'no town = the community town');
  assert.equal(scorePair(senior(), vol({ town: 'Somewhere Else' }), 0).eligible, true, 'an unknown town is not judged');
  // The score itself never changes with the town.
  assert.equal(scorePair(senior(), vol({ town: 'Westfield' }), 0).score, scorePair(senior(), vol(), 0).score);
});

test('matching: Hal\'s match page explains the county rule, and the server enforces it', async () => {
  await reset();
  const hal = await page('/match?seniorId=s-harold');
  assert.match(hal, /<strong>Linda Okafor<\/strong>: No overlapping availability; Lives in Marion County - too far for in-person visits\./);
  assert.match(hal, /For in-person visits, they also live in the same county/);

  // End Hal's match, give Linda Hal's hours: she is still too far for visits.
  assert.equal((await post('/matches/m-harold-ethan/end', {})).status, 303);
  store.volunteer('v-linda').availability.push('tue-afternoon');
  store.save();
  const res = await post('/matches', { seniorId: 's-harold', volunteerId: 'v-linda' });
  assert.equal(res.status, 409);
  assert.match(await res.text(), /too far for in-person visits/);
  assert.equal(store.activeMatchForSenior('s-harold'), null);
  await reset();
});

test('a town this deployment does not serve says so instead of silently showing everyone', async () => {
  const body = await (await fetch(`${base}/dashboard?town=${encodeURIComponent('Evansville<b>')}`)).text();
  assert.match(body, /"Evansville&lt;b&gt;" isn(&#39;|')t one of the towns this PorchLight serves/);
  assert.doesNotMatch(body, /Evansville<b>/);
});
