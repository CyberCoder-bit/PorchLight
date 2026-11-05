// v2 i18n, extraction pass (pages): every coordinator page in
// src/views/pages/ (plus components.js and chart.js) shows its interface text
// through t(). The pages are drawn with the pseudo-locale on (every t()
// string comes back as ⟦…⟧), and the <main> element must have no visible
// text without markers, apart from user data and the other modules' words
// listed in `ignore` below. The header and footer belong to the layout and
// are checked elsewhere.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../../src/store.js';
import { createApp } from '../../src/app.js';
import { createSparkService } from '../../src/sparks/index.js';
import { buildConfig } from '../../src/config.js';
import { INTERESTS, DAYS, PERIODS, CONTACT_METHODS, MISSED_REASONS } from '../../src/vocab.js';
import { STATUS_INFO } from '../../src/risk.js';
import { COMMUNITY } from '../../src/community.js';
import { TOWNS } from '../../src/towns/index.js';
import { townSelectField, townFilter } from '../../src/towns/views.js';
import { SPOKEN_LANGUAGES } from '../../src/i18n/spoken.js';
import { scorePair } from '../../src/matching.js';
import { withPseudo, unwrappedText, visibleText } from './pseudo.js';
import { sessionCookieFor } from '../helpers/server.js';

let app;
let store;
let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-pseudo-pages-'));
  store = new Store(path.join(tmpDir, 'db.json'));
  store.open();
  const sparks = createSparkService(buildConfig({}), { effective: 'mock', reason: 'test', warning: null });
  app = createApp({ store, sparks });
});

after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

async function request(p, who, { method = 'GET', body } = {}) {
  const headers = { cookie: await sessionCookieFor(store, who) };
  if (body) headers['content-type'] = 'application/x-www-form-urlencoded';
  return app(new Request(`http://porchlight.test${p}`, { method, headers, body: body && new URLSearchParams(body).toString() }));
}

// Only <main>. Links, bold text and spans are taken out (their words stay),
// so a sentence that holds a link as a {variable} is checked as one sentence.
function mainOf(page) {
  const m = /<main\b[^>]*>([\s\S]*)<\/main>/.exec(page);
  assert.ok(m, 'the page has a <main>');
  return m[1]
    .replace(/<[^>]*\baria-hidden="true"[^>]*>[\s\S]*?<\/(?:span|svg)>/g, ' ') // decoration
    .replace(/<\/?(?:a|strong|span)\b[^>]*>/g, '');
}

// Text that may stay as it is.
function ignoreList() {
  const people = [...store.seniors, ...store.volunteers];
  // User data: never translated.
  const userData = [
    ...people.flatMap((p) => [p.name, p.preferredName, p.name.split(' ')[0], p.aboutMe, p.neighborhood, p.affiliation, p.town]),
    ...store.seniors.flatMap((s) => [s.caregiver?.name, s.caregiver?.relationship, s.familyCode]),
    ...store.contacts.map((c) => c.notes),
    ...store.users.map((u) => u.name),
    'x'.repeat(600), // the "about me" text the form test sends back
  ];
  // Proper names: the demo community, Indiana towns and counties.
  const places = [COMMUNITY.town, COMMUNITY.county, ...TOWNS.flatMap((tw) => [tw.name, tw.county])];
  // Dates and times come from Intl (src/tz.js), already in the reader's language.
  const day = (i) => new Date(Date.UTC(2026, 0, 4 + i, 12));
  const month = (i) => new Date(Date.UTC(2026, i, 15, 12));
  const dates = [
    ...[0, 1, 2, 3, 4, 5, 6].flatMap((i) => ['short', 'long'].map((weekday) => day(i).toLocaleDateString('en-US', { weekday, timeZone: 'UTC' }))),
    ...[...Array(12).keys()].flatMap((i) => ['short', 'long'].map((m) => month(i).toLocaleDateString('en-US', { month: m, timeZone: 'UTC' }))),
    'AM', 'PM',
  ];
  // Words from modules this pass does not own (src/vocab.js, src/risk.js,
  // src/towns/views.js): the other extraction pass wraps them. Listed here so
  // this test checks only the pages above.
  const otherModules = [
    ...INTERESTS.map((i) => i.label),
    ...DAYS.map((d) => d.label),
    ...PERIODS.flatMap((p) => [p.label, p.label.toLowerCase(), p.hours]),
    ...CONTACT_METHODS.flatMap((m) => [m.label, m.label.toLowerCase()]),
    ...MISSED_REASONS.map((r) => r.label),
    ...Object.values(STATUS_INFO).flatMap((s) => [s.label, s.advice]),
    ...visibleText(townSelectField({}, undefined)),
    ...visibleText(townFilter({ action: '/admin/seniors', town: null, shown: 1, total: 1 })),
    ...visibleText(townFilter({ action: '/admin/volunteers', town: null, shown: 1, total: 1, noun: ['volunteer', 'volunteers'], label: 'Show volunteers in' })),
    // src/matching.js: the score breakdown and the reasons a volunteer is left out
    ...store.seniors.flatMap((s) => store.volunteers.flatMap((v) => {
      const r = scorePair(s, v, store.activeMatchesForVolunteer(v.id).length);
      return [...r.breakdown.flatMap((b) => [b.label, b.detail]), ...r.problems];
    })),
    // src/views/layout.js: the "next step" link under a message after a form
    'Continue the 2-minute demo tour',
    // src/i18n/fields.js: each spoken language's own name is data (as in languages.test.js)
    ...SPOKEN_LANGUAGES.flatMap((l) => [l.name, l.english]),
    'test', // the spark service's "reason" in this test (the technical detail on /about-ai)
  ];
  return [...userData, ...places, ...dates, ...otherModules]
    .filter((s) => typeof s === 'string' && s.trim())
    .sort((a, b) => b.length - a.length); // longest first, so "Hal Whitaker" goes before "Hal"
}

async function check(p, who, options) {
  const res = await request(p, who, options);
  const page = await res.text();
  return { status: res.status, left: unwrappedText(mainOf(page), ignoreList()) };
}

// Every page's leftover text, so one run lists all of them.
const leftovers = (results) => Object.fromEntries(results.filter(([, r]) => r.left.length).map(([name, r]) => [name, r.left]));

const ADMIN_PAGES = [
  '/admin', '/about-ai', '/admin/demo/reset', '/tour',
  '/admin/seniors', '/admin/seniors/new', '/seniors/s-harold', '/seniors/s-eugene', '/seniors/s-harold/edit',
  '/admin/volunteers', '/admin/volunteers/new', '/volunteers/v-ethan', '/volunteers/v-ethan/edit',
  '/admin/match', '/admin/match?seniorId=s-eugene', '/admin/match?seniorId=s-harold',
  '/contacts', '/admin/dashboard',
];

test('pseudo-locale: every page in src/views/pages shows its words through t() (admin)', async () => {
  await withPseudo(async () => {
    const results = [];
    for (const p of ADMIN_PAGES) results.push([p, await check(p, 'admin')]);
    for (const [p, r] of results) assert.equal(r.status, 200, p);
    assert.deepEqual(leftovers(results), {});
  });
});

test("pseudo-locale: a senior's page as the senior, the volunteer, and the family member", async () => {
  await withPseudo(async () => {
    const results = [];
    for (const who of ['senior', 'volunteer', 'family']) results.push([who, await check('/seniors/s-harold', who)]);
    for (const [who, r] of results) assert.equal(r.status, 200, who);
    assert.deepEqual(leftovers(results), {});
  });
});

test('pseudo-locale: form errors, messages after a form, and error pages', async () => {
  await withPseudo(async () => {
    const forms = [
      ['/admin/seniors', { name: '', age: '12', aboutMe: 'x'.repeat(600) }],
      ['/admin/volunteers', { name: '', maxSeniors: '9' }],
      ['/contacts', { matchId: '', date: 'x', time: 'y' }],
      ['/admin/settings', { riskThresholdDays: '0' }],
    ];
    const results = [];
    for (const [p, body] of forms) results.push([`POST ${p}`, await check(p, 'admin', { method: 'POST', body })]);
    for (const [p, r] of results) assert.equal(r.status, 200, p);
    for (const q of ['msg=senior_added', 'msg=reset', 'warn=outside_hours', 'warn=match_misfit']) results.push([q, await check(`/admin?${q}`, 'admin')]);
    const missing = await check('/seniors/s-nobody', 'admin');
    assert.equal(missing.status, 404);
    results.push(['404', missing]);
    assert.deepEqual(leftovers(results), {});
  });
});

test('backLink: "Back to {place}" is one key, so a language can put the place first', async () => {
  const { backLink } = await import('../../src/views/components.js');
  assert.equal(String(backLink('/x', 'home')), '<p class="back-link"><a href="/x"><span aria-hidden="true">←</span> Back to home</a></p>');
  await withPseudo(async () => {
    assert.match(String(backLink('/x', 'home')), /⟦Back to home⟧/);
  });
});
