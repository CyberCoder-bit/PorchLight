// The public website (v2) and the brand: the signed-out header, the public
// pages, the logo files, the self-hosted font, and right-to-left support.
// Same harness as design.test.js: the real app on a temporary data file.

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
import { EN } from '../../src/i18n/index.js';
import { SITE_RULES, EVERYONE } from '../../src/views/site/access.js';

process.env.TZ = 'America/Indiana/Indianapolis'; // match test/app.test.js

let server;
let base;
let tmpDir;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-site-test-'));
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

const page = async (p, cookie) => {
  const res = await fetch(base + p, { headers: cookie ? { cookie } : {} });
  assert.equal(res.status, 200, p);
  return res.text();
};
const mainOf = (body) => body.slice(body.indexOf('<main'), body.indexOf('</main>'));
const headerOf = (body) => body.slice(body.indexOf('<header class="site-header">'), body.indexOf('</header>'));
const navNamed = (body, label) => new RegExp(`<nav class="site-nav"[^>]*aria-label="${label}">([\\s\\S]*?)</nav>`).exec(body)[1];
const links = (nav) => [...nav.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
const current = (nav) => [...nav.matchAll(/<a href="([^"]+)" aria-current="page">/g)].map((m) => m[1]);
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const SITE = ['/', '/how-it-works', '/for-seniors', '/for-volunteers', '/for-families', '/languages', '/safety', '/about'];

test('every public page loads with one h1, the site header, and the new footer', async () => {
  for (const cookie of ['', 'textsize=xlarge']) {
    for (const p of SITE) {
      const body = await page(p, cookie);
      assert.equal((body.match(/<h1[\s>]/g) || []).length, 1, `${p} has one h1`);
      assert.match(body, /<a class="button nav-cta" href="\/sign-up">Get started<\/a>/, p);
      const footer = body.slice(body.indexOf('<footer'));
      for (const href of ['/safety', '/about', '/about-ai', '/tour']) assert.match(footer, new RegExp(`<a href="${href}">`), `${p} footer links ${href}`);
      assert.match(footer, /A student prototype for Nextech CSforGood 2026\. Everyone in the demo is fictional\./);
      assert.doesNotMatch(footer, /Reset demo data|Signed out, you can see every screen/);
      // No key left untranslated ("site.home.title" on screen means a missing key).
      assert.doesNotMatch(body.replace(/<[^>]+>/g, ' '), /\bsite\.[a-z]+\.[A-Za-z.]+/, p);
    }
  }
});

test('the public home: what PorchLight does, a sign-up path for each role, how it works, sourced facts, and the tour', async () => {
  const main = mainOf(await page('/'));
  assert.match(main, /<h1 id="hero-heading">Leave the porch light on for older neighbors\.<\/h1>/);
  assert.match(main, /PorchLight matches an older adult with a volunteer who calls or visits every week/);
  for (const role of ['senior', 'volunteer', 'family']) assert.match(main, new RegExp(`<a class="button" href="/sign-up/${role}">`), role);
  assert.match(main, /href="\/sign-up"/);
  // How it works, in 4 numbered steps.
  assert.equal((main.match(/<li class="how-step">/g) || []).length, 4);
  // The problem statement keeps its sources.
  assert.match(main, /one in five Hoosiers will be 65 or older/);
  assert.match(main, /href="https:\/\/www\.incontext\.indiana\.edu\/2024\/nov-dec\/article1\.asp"/);
  assert.match(main, /up to 15 cigarettes a day/);
  assert.match(main, /href="https:\/\/www\.hhs\.gov\/sites\/default\/files\/surgeon-general-social-connection-advisory\.pdf"/);
  assert.match(main, /href="\/tour"[^>]*>Take the 2-minute tour/);
  // The picture is decoration.
  assert.match(main, /<svg class="hero-art"[^>]*aria-hidden="true"/);
});

test('each public page marks itself in the nav and ends with a way to sign up', async () => {
  const marks = { '/how-it-works': '/how-it-works', '/for-seniors': '/for-seniors', '/for-volunteers': '/for-volunteers', '/for-families': '/for-families', '/languages': '/languages', '/safety': '/safety' };
  for (const [p, here] of Object.entries(marks)) {
    const body = await page(p);
    assert.deepEqual(current(navNamed(body, 'Main')), [here], p);
    assert.deepEqual(current(navNamed(body, 'Main menu')), [here], p);
    assert.match(mainOf(body), /<a class="button[^"]*" href="\/sign-up\/senior">/, `${p} ends with the sign-up band`);
  }
  // A page for one role makes that role's button the primary one.
  for (const [p, role] of [['/for-seniors', 'senior'], ['/for-volunteers', 'volunteer'], ['/for-families', 'family']]) {
    const main = mainOf(await page(p));
    assert.deepEqual(main.match(/<a class="button" href="\/sign-up\/[a-z]+">/g), [`<a class="button" href="/sign-up/${role}">`], p);
  }
});

test('/safety says exactly what goes to AI, and what never does', async () => {
  const main = mainOf(await page('/safety'));
  assert.match(main, /first name, their interests, their &quot;about me&quot; text with phone numbers and email addresses removed, and the number of days since the last call/);
  assert.match(main, /only the text a person chooses to translate/);
  assert.match(main, /Never sent to AI: family contact details and call notes\./);
  for (const role of ['Seniors', 'Volunteers', 'Family members', 'Coordinators']) assert.match(main, new RegExp(`<dt>${role}</dt>`));
});

test('/languages lists the real interface languages and is honest about machine translation', async () => {
  const main = mainOf(await page('/languages'));
  assert.match(main, /<span lang="en" dir="ltr" class="language-name">English<\/span>/);
  assert.match(main, /made by a computer\. They can be wrong\./);
  assert.match(main, /Native speakers have not checked/);
});

test('/about keeps the team placeholders and only sourced facts', async () => {
  const main = mainOf(await page('/about'));
  assert.match(main, /\[TEAM: /);
  assert.match(main, /grew 40% from 2010 to 2023/);
  assert.match(main, /no partnership/);
});

test('signed in, the header keeps the person\'s own nav', async () => {
  const body = await page('/how-it-works', 'viewer=family%3As-harold');
  assert.deepEqual(links(navNamed(body, 'Main')), ['/dashboard', '/seniors/s-harold', '/help']);
  assert.doesNotMatch(headerOf(body), /nav-cta/);
  assert.match(headerOf(body), /Signed in as/);
});

test('the public pages are open to everyone in the access table', () => {
  const paths = SITE_RULES.map((r) => r.path);
  for (const p of SITE.filter((x) => x !== '/')) assert.ok(paths.includes(p), p);
  for (const rule of SITE_RULES) {
    assert.equal(rule.method, 'GET');
    assert.deepEqual(rule.roles, EVERYONE);
  }
});

test('every site.* string is plain text (no HTML in the catalog)', () => {
  const keys = Object.keys(EN).filter((k) => k.startsWith('site.'));
  assert.ok(keys.length > 50);
  for (const k of keys) assert.doesNotMatch(EN[k], /<[a-z/]/i, k);
});

test('the logo files exist, each with a title, and the header and footer use the mark', async () => {
  const body = await page('/');
  const header = headerOf(body);
  assert.match(header, /<a class="brand" href="\/" aria-label="PorchLight home">\s*<svg class="brand-mark"[^>]*aria-hidden="true"/);
  assert.match(header, /<span class="brand-name">Porch<span class="brand-name-light">Light<\/span><\/span>/);
  const footer = body.slice(body.indexOf('<footer'));
  assert.match(footer, /<a class="brand brand-footer" href="\/" aria-label="PorchLight home"><svg class="brand-mark"[^>]*aria-hidden="true"/);
  assert.doesNotMatch(body, /<svg(?![^>]*aria-hidden="true")/, 'every inline SVG is decoration');
  assert.match(body, /<link rel="apple-touch-icon" href="\/apple-touch-icon.png">/);
  const files = ['/favicon.svg', '/brand/porchlight-mark.svg', '/brand/porchlight-mark-dark.svg', '/brand/porchlight-mark-mono.svg',
    '/brand/porchlight-wordmark.svg', '/brand/porchlight-wordmark-dark.svg', '/brand/porchlight-lockup.svg',
    '/brand/porchlight-lockup-dark.svg', '/brand/porchlight-lockup-mono.svg'];
  for (const file of files) {
    const res = await fetch(base + file);
    assert.equal(res.status, 200, file);
    assert.match(res.headers.get('content-type'), /image\/svg\+xml/, file);
    assert.match(await res.text(), /<title>PorchLight<\/title>/, `${file} has a title`);
  }
  const png = await fetch(base + '/apple-touch-icon.png');
  assert.equal(png.status, 200);
  const bytes = new Uint8Array(await png.arrayBuffer());
  // PNG signature, then IHDR width and height: 180 x 180.
  assert.deepEqual([...bytes.slice(1, 4)], [80, 78, 71]);
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(16), 180);
  assert.equal(view.getUint32(20), 180);
});

test('the brand font is self-hosted with its license, behind a stack that covers other scripts', async () => {
  for (const file of ['/fonts/atkinson-hyperlegible-next-latin.woff2', '/fonts/atkinson-hyperlegible-next-latin-ext.woff2']) {
    const res = await fetch(base + file);
    assert.equal(res.status, 200, file);
    assert.equal(res.headers.get('content-type'), 'font/woff2');
  }
  assert.match(await (await fetch(base + '/fonts/OFL.txt')).text(), /SIL Open Font License/);
  const css = await (await fetch(`${base}/styles.css`)).text();
  assert.equal((css.match(/@font-face \{[^}]*font-display: swap;[^}]*\}/g) || []).length, 2);
  for (const family of ['system-ui', 'Noto Sans Arabic', 'Noto Sans Myanmar', 'PingFang SC', 'Microsoft YaHei']) assert.ok(css.includes(family), family);
  assert.match(css, /html:lang\(ar\), html:lang\(my\) \{[^}]*--leading-base: 1\.85/);
  assert.match(css, /:where\(:lang\(ar\), :lang\(my\)\) \{ letter-spacing: 0 !important; \}/);
});

test('the stylesheet uses logical properties, so right-to-left pages mirror', async () => {
  const css = stripComments(await (await fetch(`${base}/styles.css`)).text());
  const physical = [...css.matchAll(/(?:^|[\s;{])((?:margin|padding|border)-(?:left|right)(?:-[a-z]+)?|left|right)\s*:/g)].map((m) => m[1]);
  assert.deepEqual(physical, []);
  assert.doesNotMatch(css, /text-align:\s*(left|right)/);
  assert.doesNotMatch(css, /float:\s*(left|right)/);
});
