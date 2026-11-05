// The phone header: on narrow screens the nav bar becomes a "Menu" button (a
// native <details>, no JavaScript needed), the AI badge shortens, and the
// header stays compact at A++. Same harness as design.test.js: the real app on
// a temporary data file.

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
import { fetchAs, sessionCookieFor } from '../helpers/server.js'; // [v2 accounts] signed in as the coordinator

process.env.TZ = 'America/Indiana/Indianapolis'; // match test/app.test.js

let server;
let base;
let tmpDir;
let store;
// [v2 accounts] Every request is signed in as the coordinator (admin) unless it
// carries its own session cookie. Signed out, a visitor sees only the public site.
const fetch = fetchAs(() => store);

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-menu-test-'));
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

const page = async (p, cookie) => {
  const res = await fetch(base + p, { headers: cookie ? { cookie } : {} });
  assert.equal(res.status, 200, p);
  return res.text();
};
// [v2] Signed out, the header shows the public website; the app's nav is for
// signed-in people. The demo sign-in cookie stands in for a signed-in admin.
const ADMIN = 'viewer=coordinator';
const headerOf = (body) => body.slice(body.indexOf('<header class="site-header">'), body.indexOf('</header>'));
// Each nav by its label: "Main menu" is the narrow-screen copy, "Main" the bar.
const navNamed = (body, label) => {
  const m = new RegExp(`<nav class="site-nav"[^>]*aria-label="${label}">([\\s\\S]*?)</nav>`).exec(body);
  assert.ok(m, `a nav labeled "${label}"`);
  return m[1];
};
const links = (nav) => [...nav.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
const current = (nav) => [...nav.matchAll(/<a href="([^"]+)" aria-current="page">/g)].map((m) => m[1]);

// The body of a CSS block such as "@container site-header (max-width: 32rem)",
// matched brace by brace.
function cssBlock(css, header) {
  const start = css.indexOf(header);
  assert.ok(start >= 0, `styles.css has ${header}`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`unclosed ${header}`);
}
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const NARROW = '@container site-header (max-width: 32rem)';

test('the Menu is a labeled native <details> whose page list comes right after it', async () => {
  const header = headerOf(await page('/dashboard', ADMIN));
  // A real <summary> (a button with an expanded/collapsed state, no JavaScript)
  // whose name is the word "Menu"; the icon is decoration.
  assert.match(
    header,
    /<details class="site-menu">\s*<summary class="site-menu-summary" aria-controls="site-menu-nav"><svg class="site-menu-icon"[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/svg><span class="site-menu-text">Menu<\/span><\/summary>\s*<\/details>/
  );
  // The list is the very next element: styles.css shows it with ".site-menu[open] + .site-nav".
  assert.match(header, /<\/details>\s*<nav class="site-nav" id="site-menu-nav" aria-label="Main menu">/);
  // It comes after Accessibility, so the order on screen is the Tab order.
  assert.ok(header.indexOf('class="a11y-menu"') < header.indexOf('class="site-menu"'));
});

test('both navs list the same pages, each with aria-current on the page you are on, and distinct labels', async () => {
  for (const [url, here] of [['/admin', '/admin'], ['/admin/dashboard', '/admin/dashboard'], ['/admin/attention', '/admin/attention'], ['/seniors/s-harold', '/admin/seniors'], ['/help', '/help']]) {
    const body = await page(url);
    const labels = [...headerOf(body).matchAll(/<nav\b[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(labels, ['Main menu', 'Main'], `${url}: two navs, two different names`);
    assert.equal((body.match(/<nav\b/g) || []).length, 2, `${url}: no other nav`);
    const menu = navNamed(body, 'Main menu');
    const bar = navNamed(body, 'Main');
    assert.deepEqual(links(menu), links(bar), url);
    assert.equal(links(menu).length, 9, `${url}: the coordinator sees every page`);
    assert.deepEqual(current(menu), [here], `${url}: Menu marks ${here}`);
    assert.deepEqual(current(bar), [here], `${url}: the bar marks ${here}`);
  }
});

test('signed in, the Menu shows only that person\'s pages, still marking the current one', async () => {
  const fam = await page('/dashboard', await sessionCookieFor(store, 'family:s-harold'));
  const menu = navNamed(fam, 'Main menu');
  assert.deepEqual(links(menu), ['/dashboard', '/seniors/s-harold', '/account', '/help']);
  assert.deepEqual(links(navNamed(fam, 'Main')), links(menu));
  assert.deepEqual(current(menu), ['/dashboard']);
  // The header still says who is signed in, and Sign out is still there.
  assert.match(headerOf(fam), /Signed in as <strong>/);
  assert.match(headerOf(fam), /action="\/sign-out"/);
});

test('at every width exactly one nav is displayed, so screen readers meet one landmark', async () => {
  const css = stripComments(await (await fetch(`${base}/styles.css`)).text());
  // The header is the container, and the breakpoint is in rem: the page's own
  // rem, so A+ and A++ switch to the Menu on wider screens too.
  assert.match(css, /\.site-header \{ container: site-header \/ inline-size; \}/);
  // Wide (outside the container query): the Menu and its list are display: none.
  const outside = css.replace(cssBlock(css, NARROW), '');
  assert.match(outside, /\.site-menu, \.header-inner > \.site-nav \{ display: none; \}/);
  // Narrow: the bar is display: none; the list shows only while Menu is open.
  const narrow = cssBlock(css, NARROW);
  assert.match(narrow, /\.site-header > \.site-nav \{ display: none; \}/);
  assert.match(narrow, /\.site-menu \{ display: block; \}/);
  assert.match(narrow, /\.site-menu\[open\] \+ \.site-nav \{\s*display: block;/);
  // No other rule displays a nav element itself (rules for its list and links
  // don't count), so nothing can show both at once.
  const shown = [];
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/display:\s*(?!none)[a-z-]+/.test(body)) continue;
    for (const sel of selectors.split(',').map((s) => s.trim())) if (/(\.site-nav|#site-menu-nav)$/.test(sel)) shown.push(sel);
  }
  assert.deepEqual(shown, ['.site-menu[open] + .site-nav']);
});

test('the Menu button looks and behaves like the Accessibility button', async () => {
  const css = stripComments(await (await fetch(`${base}/styles.css`)).text());
  assert.match(css, /\.a11y-summary, \.site-menu-summary \{[^}]*min-height: var\(--target\)/);
  assert.match(css, /\.a11y-summary:active, \.site-menu-summary:active \{[^}]*transform: scale\(0\.98\)/);
  assert.match(css, /\.site-menu\[open\] > \.site-menu-summary \{/, 'an open Menu is drawn inverted, like an open Accessibility');
  assert.match(css, /\.site-menu-summary::marker \{ content: ""; \}/);
  // Reduced motion, forced colors: the same treatment as Accessibility.
  assert.match(cssBlock(css, '@media (prefers-reduced-motion: reduce)'), /\.site-menu-summary:active/);
  assert.match(cssBlock(css, '@media (forced-colors: active)'), /\.site-menu-summary/);
  // The narrow header keeps every control at least 44px tall.
  assert.match(css, /--target-min: 44px;/);
  assert.match(cssBlock(css, NARROW), /\.site-menu-summary, \.a11y-summary \{ min-height: var\(--target-min\);/);
});

test('the AI badge shortens on narrow screens but screen readers still hear all of it', async () => {
  const header = headerOf(await page('/'));
  assert.match(
    header,
    /<a class="mode-badge mode-mock" href="\/about-ai" title="[^"]*"><span class="mode-badge-long">AI: Offline mode<\/span><span class="mode-badge-short" aria-hidden="true">AI: Offline<\/span><\/a>/
  );
  const css = stripComments(await (await fetch(`${base}/styles.css`)).text());
  assert.match(css.replace(cssBlock(css, NARROW), ''), /\.mode-badge-short \{ display: none; \}/);
  const narrow = cssBlock(css, NARROW);
  assert.match(narrow, /\.mode-badge-short \{ display: inline; \}/);
  // Visually hidden (clipped), never display: none, so the link's name stays "AI: Offline mode".
  const long = /\.mode-badge-long \{([^}]*)\}/.exec(narrow);
  assert.ok(long, 'a narrow rule for the full wording');
  assert.match(long[1], /clip: rect\(0 0 0 0\)/);
  assert.doesNotMatch(long[1], /display:\s*none|visibility:\s*hidden/);
});

test('app.js extends Escape, click-outside, and focus-out closing to the Menu, one menu open at a time', async () => {
  const js = await (await fetch(`${base}/app.js`)).text();
  assert.match(js, /querySelectorAll\('\.a11y-menu, \.lang-menu, \.site-menu'\)/); // Accessibility, Language, and Menu
  assert.match(js, /getAttribute\('aria-controls'\)/, "the Menu's list counts as part of the Menu");
  assert.match(js, /addEventListener\('toggle'/, 'opening one closes the other');
  assert.match(js, /event\.key !== 'Escape'/);
  assert.match(js, /addEventListener\('focusout'/);
  assert.match(js, /addEventListener\('click'/);
});
