// "Get help in Indiana": the cited help data in src/community.js and the
// GET /help page. Also the county -> time zone rule.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMUNITY, COMMUNITIES, CHECKED, localHelpFor, timeZoneForCounty,
  INDIANA_CENTRAL_TIME_COUNTIES, INDIANA_TIME_ZONE_SOURCE, AAA_DIRECTORY_URL,
} from '../../src/community.js';
import { BaseStore } from '../../src/store-core.js';
import { createApp } from '../../src/app.js';
import { createSparkService } from '../../src/sparks/index.js';
import { buildConfig } from '../../src/config.js';
import { helpPage, telHref } from '../../src/indiana/help-page.js';

const OFFICIAL_HOSTS = ['www.in.gov', 'faqs.in.gov', 'cicoa.org', 'swirca.org', 'in211.org', 'www.in911.net'];

function memoryApp() {
  const store = new BaseStore({ read: () => null, write: () => {} });
  store.open(new Date('2026-11-02T17:00:00Z'));
  const sparks = createSparkService(buildConfig({}), { effective: 'mock', reason: 'test', warning: null });
  return createApp({ store, sparks });
}

test('the 12 Central-time counties match the in.gov list (Perry, not Pike)', () => {
  assert.equal(INDIANA_CENTRAL_TIME_COUNTIES.length, 12);
  assert.ok(INDIANA_CENTRAL_TIME_COUNTIES.includes('Perry'));
  assert.ok(!INDIANA_CENTRAL_TIME_COUNTIES.includes('Pike'));
  assert.match(INDIANA_TIME_ZONE_SOURCE, /^https:\/\/faqs\.in\.gov\//);
  for (const county of INDIANA_CENTRAL_TIME_COUNTIES) assert.equal(timeZoneForCounty(`${county} County`), 'America/Chicago', county);
});

test('timeZoneForCounty: Central for the 12, Eastern everywhere else, forgiving about spelling', () => {
  assert.equal(timeZoneForCounty('Hamilton County'), 'America/Indiana/Indianapolis');
  assert.equal(timeZoneForCounty('Marion'), 'America/Indiana/Indianapolis');
  assert.equal(timeZoneForCounty('Pike County'), 'America/Indiana/Indianapolis');
  assert.equal(timeZoneForCounty('La Porte County'), 'America/Chicago');
  assert.equal(timeZoneForCounty('LAPORTE'), 'America/Chicago');
  assert.equal(timeZoneForCounty('Vanderburgh County'), 'America/Chicago');
});

test('every community profile has the contract fields and the right time zone for its county', () => {
  for (const [key, c] of Object.entries(COMMUNITIES)) {
    assert.equal(c.id, key);
    for (const field of ['town', 'county', 'state', 'timeZone']) assert.ok(c[field], `${key}.${field}`);
    assert.ok(Array.isArray(c.localTouches), `${key}.localTouches`);
    assert.ok(Array.isArray(c.help), `${key}.help`);
    assert.equal(c.timeZone, timeZoneForCounty(c.county), key);
  }
  assert.equal(COMMUNITY, COMMUNITIES.carmel, 'Carmel stays the default community');
});

test('localHelpFor(Carmel): CICOA first, then Indiana 211, the statewide list, and 911', () => {
  const help = localHelpFor(COMMUNITY);
  assert.deepEqual(help.map((r) => r.kind), ['aaa', 'info-line', 'aaa-directory', 'emergency']);
  assert.equal(help[0].name, 'CICOA Aging & In-Home Solutions');
  assert.ok(help[0].counties.includes('Hamilton'), 'FSSA lists Hamilton County under CICOA');
  assert.equal(help.find((r) => r.kind === 'emergency').description, 'If someone may be in danger, call 911.');
  assert.equal(localHelpFor().length, help.length, 'defaults to COMMUNITY');
});

test('every help entry is cited, dated, and uses only well-formed phone numbers', () => {
  for (const community of Object.values(COMMUNITIES)) {
    for (const r of localHelpFor(community)) {
      for (const field of ['id', 'name', 'description', 'whenToUse', 'situation']) assert.ok(r[field], `${r.id}.${field}`);
      assert.equal(r.checked, CHECKED);
      assert.equal(CHECKED, '2026-11-03');
      assert.ok(r.sources.length >= 1, `${r.id} has a source`);
      assert.ok(r.sources.includes(r.source));
      for (const url of [...r.sources, ...(r.url ? [r.url] : [])]) {
        const u = new URL(url);
        assert.equal(u.protocol, 'https:', url);
        assert.ok(OFFICIAL_HOSTS.includes(u.hostname), `${url} is on an official site`);
      }
      if (r.phone) assert.ok(r.phones.some((p) => p.number === r.phone), `${r.id}: main phone is in phones`);
      for (const p of r.phones) {
        assert.match(p.number, /^(\d{3}-\d{3}-\d{4}|211|911)$/, `${r.id}: ${p.number}`);
        assert.ok(p.label);
        if (p.number !== '911') assert.ok(p.source && r.sources.includes(p.source), `${r.id}: ${p.number} has a source`);
      }
    }
  }
});

test('the Evansville sample profile points to SWIRCA & More, which FSSA lists for Vanderburgh County', () => {
  const [aaa] = localHelpFor(COMMUNITIES.evansville);
  assert.equal(aaa.name, 'SWIRCA & More');
  assert.ok(aaa.counties.includes('Vanderburgh'));
  assert.equal(aaa.source, AAA_DIRECTORY_URL);
});

test('telHref makes dialable links from readable numbers', () => {
  assert.equal(telHref('317-803-6131'), 'tel:+13178036131');
  assert.equal(telHref('211'), 'tel:211');
  assert.equal(telHref('911'), 'tel:911');
});

test('GET /help shows the AAA, 211, and the 911 line, with sources and checked dates', async () => {
  const handle = memoryApp();
  const res = await handle(new Request('http://localhost/help'));
  assert.equal(res.status, 200);
  const page = await res.text();
  assert.match(page, /<title>Get help in Indiana · PorchLight<\/title>/);
  assert.equal(page.match(/<h1[\s>]/g).length, 1, 'exactly one h1');
  assert.match(page, /<h1>Get help in Indiana<\/h1>/);
  assert.match(page, /If someone may be in danger, call 911\./);
  assert.match(page, /CICOA Aging &amp; In-Home Solutions/);
  assert.match(page, /Indiana 211/);
  assert.match(page, /Hamilton County/);
  for (const href of ['tel:911', 'tel:211', 'tel:+18662119966', 'tel:+13178036131', 'tel:+13172545465', 'tel:+18004322422', 'tel:+18007139023']) {
    assert.ok(page.includes(`href="${href}"`), href);
  }
  assert.match(page, />317-803-6131</, 'phone numbers are readable link text');
  assert.match(page, /Checked November 3, 2026/);
  assert.ok(page.includes(`href="${AAA_DIRECTORY_URL}"`), 'links the FSSA source');
  assert.ok(page.includes('href="https://www.in.gov/fssa/indiana-211/"'));
  assert.ok(page.includes('href="https://www.in911.net/text-for-911.html"'));
  assert.match(page, /href="\/">← Back to home</);
  // Never state a count of Area Agencies on Aging (sources disagree).
  assert.doesNotMatch(page, /\b(15|16|fifteen|sixteen)\b[^.<]{0,30}(Area Agenc|AAA)/i);
  // No inline scripts: the page works without JavaScript.
  assert.doesNotMatch(page.replace('<script src="/app.js" defer></script>', ''), /<script/i);
});

test('the help page escapes text from the profile', () => {
  const evil = {
    id: 'x', kind: 'aaa', name: '<script>alert(1)</script>', description: 'd', situation: 's', whenToUse: 'w',
    phone: null, phones: [], url: null, source: null, sources: [], checked: null,
  };
  const out = String(helpPage({ community: { county: 'Test County', state: 'Indiana' }, resources: [evil] }));
  assert.doesNotMatch(out, /<script>/);
  assert.match(out, /&lt;script&gt;/);
});
