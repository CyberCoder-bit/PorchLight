// v2 extraction pass, part B ("features"): with the pseudo-locale on, every
// word on the parts this pass owns comes through t(). Checked: the header and
// footer (src/views/layout.js) of a public page and an admin page, and <main>
// of Needs attention, a volunteer's week, the family summary, and Get help.
// `ignore` holds what is allowed to stay as it is: user data from the store
// (names, notes, towns, saved sparks), organization names, phone numbers,
// dates written by Intl, and text from helpers the other pass owns
// (components.js, html.js), which it checks itself.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../../src/store.js';
import { createApp } from '../../src/app.js';
import { createSparkService } from '../../src/sparks/index.js';
import { buildConfig } from '../../src/config.js';
import { UI_LANGUAGES } from '../../src/i18n/languages.js';
import { EN } from '../../src/i18n/index.js';
import { localHelpFor, COMMUNITIES, INDIANA_HELP } from '../../src/community.js';
import { helpText } from '../../src/indiana/help-page.js';
import { DEPLOYMENT_TOWNS } from '../../src/towns/index.js';
import { withPseudo, unwrappedText } from './pseudo.js';
import { sessionCookieFor } from '../helpers/server.js';

let app;
let store;
let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-pseudo-features-'));
  store = new Store(path.join(tmpDir, 'db.json'));
  store.open();
  const sparks = createSparkService(buildConfig({}), { effective: 'mock', reason: 'test', warning: null });
  app = createApp({ store, sparks });
});

after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

async function page(p, who) {
  const headers = who ? { cookie: await sessionCookieFor(store, who) } : {};
  const res = await app(new Request(`http://porchlight.test${p}`, { headers }));
  assert.equal(res.status, 200, p);
  return res.text();
}

const part = (body, tag) => {
  const m = new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`).exec(body);
  assert.ok(m, `<${tag}> on the page`);
  return m[0];
};

// Words written by Intl (dates and times), not by us.
const INTL_WORDS = (() => {
  const words = new Set(['AM', 'PM', 'at', 'EST', 'EDT', 'CST', 'CDT']);
  for (let m = 0; m < 12; m++) {
    const d = new Date(Date.UTC(2026, m, 15));
    for (const month of ['long', 'short']) words.add(new Intl.DateTimeFormat('en-US', { month, timeZone: 'UTC' }).format(d));
  }
  for (let day = 0; day < 7; day++) {
    const d = new Date(Date.UTC(2026, 0, 4 + day));
    for (const weekday of ['long', 'short']) words.add(new Intl.DateTimeFormat('en-US', { weekday, timeZone: 'UTC' }).format(d));
  }
  return [...words];
})();

// User data from the store, plus the brand and the languages' own names.
function userData() {
  const people = [...store.seniors, ...store.volunteers];
  const words = new Set(['Porch', 'Light', 'PorchLight', ...UI_LANGUAGES.map((l) => l.name)]);
  for (const p of people) {
    for (const v of [p.name, p.preferredName, ...p.name.split(' '), p.town, p.caregiver?.name]) if (v) words.add(v);
  }
  for (const u of store.users) if (u.name) words.add(u.name);
  for (const c of store.contacts) for (const v of [c.notes, c.missedNote]) if (v) words.add(v);
  for (const set of store.sparkSets || []) {
    for (const s of set.sparks || []) for (const v of [s.text, s.basedOn]) if (v) words.add(v);
    if (set.tip) words.add(set.tip);
  }
  for (const t of DEPLOYMENT_TOWNS) for (const v of [t.name, t.county]) words.add(v);
  return [...words];
}

// Organization names and phone numbers stay as they are.
const ORGS = [
  ...new Set(
    [...COMMUNITIES.carmel.help, ...COMMUNITIES.evansville.help, ...Object.values(INDIANA_HELP)]
      .flatMap((r) => [r.name, r.shortName, r.url && new URL(r.url).hostname.replace(/^www\./, '')]) // web addresses too
      .filter(Boolean)
  ),
  'Indiana', 'Hamilton County', 'Vanderburgh County', 'Carmel', 'Gemini', 'Google', 'Cloudflare Workers AI',
];

// Text from helpers the pages pass owns (components.js, html.js).
// Symbols, not words.
const SYMBOLS = ['←', '✓', '⚠', '✦'];

const OTHER_PASS = ['Contact dropping', 'today', 'yesterday', 'days ago', 'From the built-in ideas (offline mode)', 'None listed'];

const ignore = () => [...userData(), ...ORGS, ...INTL_WORDS, ...OTHER_PASS, ...SYMBOLS].sort((a, b) => b.length - a.length);

const check = (label, markup) => assert.deepEqual(unwrappedText(markup, ignore()), [], label);

test('pseudo-locale: header and footer of a public page and of an admin page are all in t()', async () => {
  await withPseudo(async () => {
    const pub = await page('/how-it-works');
    check('public <header>', part(pub, 'header'));
    check('public <footer>', part(pub, 'footer'));
    const admin = await page('/admin', 'admin');
    check('admin <header>', part(admin, 'header'));
    check('admin <footer>', part(admin, 'footer'));
    // The skip link and the meta description, outside <header>.
    assert.match(admin, /<a class="skip-link" href="#main">⟦/);
    assert.match(admin, /<meta name="description" content="⟦/);
  });
});

test('pseudo-locale: Needs attention, My week, the family summary, and Get help are all in t()', async () => {
  await withPseudo(async () => {
    check('/admin/attention <main>', part(await page('/admin/attention', 'admin'), 'main'));
    check('/volunteers/v-ethan/week <main>', part(await page('/volunteers/v-ethan/week', 'volunteer:v-ethan'), 'main'));
    // The "Message to copy" box (and its print-only twin) stays English on purpose.
    const summary = part(await page('/seniors/s-harold/summary', 'family:s-harold'), 'main');
    const withoutCopy = summary
      .replace(/<textarea\b[\s\S]*?<\/textarea>/, '')
      .replace(/<div class="print-copy" hidden>[\s\S]*?<\/div>/, '');
    check('/seniors/s-harold/summary <main>', withoutCopy);
    check('/help <main>', part(await page('/help'), 'main'));
  });
});

test('the family summary copy text is English whatever the reader picks', async () => {
  const body = await page('/seniors/s-harold/summary', 'family:s-harold');
  const copy = /<textarea[^>]*>([\s\S]*?)<\/textarea>/.exec(body)[1];
  assert.match(copy, /^PorchLight weekly update: /);
  await withPseudo(async () => {
    const pseudoCopy = /<textarea[^>]*>([\s\S]*?)<\/textarea>/.exec(await page('/seniors/s-harold/summary', 'family:s-harold'))[1];
    assert.match(pseudoCopy, /^PorchLight weekly update: /);
  });
});

test('help resources: the catalog English matches src/community.js word for word', () => {
  const all = [...COMMUNITIES.carmel.help, ...COMMUNITIES.evansville.help, ...localHelpFor()];
  for (const r of all) {
    for (const field of ['name', 'shortName', 'description', 'situation', 'whenToUse', 'textLine', 'urlLabel']) {
      if (r[field]) assert.equal(helpText(r, field), r[field], `${r.id}.${field}`);
    }
  }
  assert.ok(Object.keys(EN).some((k) => k.startsWith('core.help.res.cicoa.')));
});
