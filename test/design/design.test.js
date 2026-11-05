// Design checks: the demo tour, navigation wayfinding, one h1 per page, and
// on-camera wording. Uses the same harness as test/app.test.js: the real app on
// a temporary data file. Routes built by other modules (/attention, /help,
// /volunteers/:id/week) are only linked to here, never requested.

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
import { COMMUNITY } from '../../src/community.js';

process.env.TZ = 'America/Indiana/Indianapolis'; // match test/app.test.js

let server;
let base;
let tmpDir;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-design-test-'));
  const store = new Store(path.join(tmpDir, 'db.json'));
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

const get = (p, headers = {}) => fetch(base + p, { headers });
const page = async (p, headers) => {
  const res = await get(p, headers);
  assert.equal(res.status, 200, p);
  return res.text();
};
const mainOf = (body) => body.slice(body.indexOf('<main'), body.indexOf('</main>'));

// Pages this module's tests may request (all served by src/app.js or extra.js).
const PAGES = [
  '/', '/admin', '/tour', '/dashboard', '/seniors', '/seniors/new', '/seniors/s-harold', '/seniors/s-harold/edit',
  '/volunteers', '/volunteers/new', '/volunteers/v-ethan', '/volunteers/v-ethan/edit',
  '/match', '/match?seniorId=s-eugene', '/match?seniorId=s-harold', '/contacts', '/about-ai', '/demo/reset',
];

test('the demo tour renders and links to every fixed route, starting with a reset', async () => {
  const body = await page('/tour');
  assert.match(body, /<h1>The 2-minute demo tour<\/h1>/);
  const main = mainOf(body);
  const links = [...main.matchAll(/<a class="button[^"]*" href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  assert.deepEqual(links, [
    '/demo/reset',
    '/dashboard',
    '/attention',
    '/match?seniorId=s-eugene',
    '/volunteers/v-ethan/week',
    '/seniors/s-harold#sparks',
    '/sign-in',
    '/help',
  ]);
  // Numbered steps, each with one "what to notice" sentence.
  assert.equal((main.match(/<h2>Step \d+: /g) || []).length, 8);
  assert.equal((main.match(/What to notice:/g) || []).length, 8);
  // A no-JS A++ button that comes back to the tour.
  assert.match(main, /action="\/prefs\/text-size"/);
  assert.match(main, /name="back" value="\/tour"/);
  assert.match(main, /name="size" value="xlarge"/);
});

// [v2] The coordinator home moved from / to /admin (the public home is in site.test.js).
const ADMIN = { cookie: 'viewer=coordinator' };

test('the coordinator home explains the loop and offers the tour', async () => {
  const body = await page('/admin');
  const main = mainOf(body);
  assert.match(main, /href="\/tour"[^>]*>Take the 2-minute demo tour/);
  for (const step of ['Match', 'Connect', 'Spark', 'Watch']) assert.match(main, new RegExp(`</span> ${step}</h3>`));
  // Hero copy comes from the community profile.
  assert.match(main, new RegExp(`Built for Indiana communities, starting in ${COMMUNITY.town}, ${COMMUNITY.county}`));
  // The "Needs attention today" panel links to the queue.
  assert.match(main, /href="\/attention"/);
});

test('the nav marks the current page with aria-current and includes the new sections', async () => {
  const cases = [
    ['/admin', '/'],
    ['/seniors', '/seniors'],
    ['/seniors/s-harold', '/seniors'],
    ['/volunteers/v-ethan', '/volunteers'],
    ['/match?seniorId=s-eugene', '/match'],
    ['/contacts', '/contacts'],
    ['/dashboard', '/dashboard'],
  ];
  for (const [url, current] of cases) {
    const body = await page(url, ADMIN);
    const nav = body.slice(body.indexOf('<nav class="site-nav"'), body.indexOf('</nav>'));
    const marked = [...nav.matchAll(/<a href="([^"]+)" aria-current="page">/g)].map((m) => m[1]);
    assert.deepEqual(marked, [current], `${url} marks ${current}`);
    assert.match(nav, /<a href="\/attention"[^>]*>Needs attention<\/a>/);
    assert.match(nav, /<a href="\/help"[^>]*>Get help<\/a>/);
  }
});

test('every page has exactly one h1, normal and A++ text', async () => {
  for (const cookie of ['', 'textsize=xlarge']) {
    for (const p of PAGES) {
      const body = await page(p, cookie ? { cookie } : {});
      assert.equal((body.match(/<h1[\s>]/g) || []).length, 1, `${p} has exactly one h1`);
    }
  }
});

test('flagged numbers say exactly what they count', async () => {
  const dash = await page('/dashboard');
  assert.doesNotMatch(dash, /seniors? flagged/);
  assert.match(dash, /2 seniors need attention: 1 at isolation risk, 1 waiting for a companion\./);
  assert.match(dash, /1<\/p><p class="tile-label"><span aria-hidden="true">⚠<\/span> senior at isolation risk/);

  const home = await page('/admin');
  assert.doesNotMatch(home, /seniors? flagged/);
  assert.match(home, /seniors need attention<\/p>\s*<p class="tile-detail">1 at isolation risk, 1 waiting for a companion<\/p>/);
});

test('sub-pages have a "Back to" link, and volunteers link to their week', async () => {
  const backs = {
    '/seniors/s-harold': '/seniors',
    '/seniors/new': '/seniors',
    '/seniors/s-harold/edit': '/seniors/s-harold',
    '/volunteers/v-ethan': '/volunteers',
    '/volunteers/new': '/volunteers',
    '/volunteers/v-ethan/edit': '/volunteers/v-ethan',
    '/match?seniorId=s-eugene': '/match',
    '/about-ai': '/',
    '/tour': '/',
  };
  for (const [url, parent] of Object.entries(backs)) {
    const body = await page(url);
    assert.match(body, new RegExp(`<p class="back-link"><a href="${parent.replace(/\//g, '\\/')}"><span aria-hidden="true">←</span> Back to `), url);
  }
  const ethan = await page('/volunteers/v-ethan');
  assert.match(ethan, /href="\/volunteers\/v-ethan\/week"/);
});

test('feedback banners pair an icon and a word with the color', async () => {
  const res = await get('/dashboard?msg=reset');
  const body = await res.text();
  assert.match(body, /class="banner banner-success flash flash-success" role="status"/);
  assert.match(body, /<span class="banner-icon" aria-hidden="true">✓<\/span>/);
  assert.match(body, /<strong class="banner-word">Done:<\/strong> Demo data reset/);
  // The success message names the next step.
  assert.match(body, /<a href="\/tour">Continue the 2-minute demo tour/);

  const warn = await (await get('/contacts?msg=scheduled&warn=outside_hours')).text();
  assert.match(warn, /banner banner-warning flash flash-warning/);
  assert.doesNotMatch(warn, /Heads up:<\/strong> Heads up/);

  const missing = await get('/seniors/nobody');
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /class="banner banner-error" role="alert"/);
});

test('the scrolling data table is a labeled, focusable region, and the footer note is there', async () => {
  const body = await page('/contacts');
  assert.match(body, /<div class="table-wrap" role="region" aria-labelledby="recent-heading" tabindex="0">/);
  assert.match(body, /A student prototype for Nextech CSforGood 2026\. Everyone in the demo is fictional\./);
});

test('the stylesheet keeps the design rules: press feedback, reduced motion, contrast, print', async () => {
  const css = await (await get('/styles.css')).text();
  assert.match(css, /\.button:active \{[^}]*transform: scale\(0\.98\)/);
  assert.match(css, /--press: 100ms/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(prefers-contrast: more\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /@media print/);
  assert.doesNotMatch(css, /backdrop-filter|blur\(/);
  // No text smaller than 1rem: every rem/em font-size is at least 1 (or the small "aka" em tweak).
  const tooSmall = [...css.matchAll(/font-size:\s*(0?\.\d+)rem/g)].map((m) => m[0]);
  assert.deepEqual(tooSmall, []);
});
