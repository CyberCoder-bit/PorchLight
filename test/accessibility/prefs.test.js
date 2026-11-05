// The Accessibility menu: text size, contrast, and theme. Each choice is a
// cookie set by a no-JavaScript form (POST /prefs/...), checked against an
// allow-list, shown as a class on <html>, and followed by a safe redirect.
// Same harness as test/app.test.js: the real app on a temporary data file.

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

process.env.TZ = 'America/Indiana/Indianapolis'; // match test/app.test.js

let server;
let base;
let tmpDir;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-a11y-test-'));
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

const get = (p, cookie) => fetch(base + p, { redirect: 'manual', headers: cookie ? { cookie } : {} });
const page = async (p, cookie) => {
  const res = await get(p, cookie);
  assert.equal(res.status, 200, p);
  return res.text();
};
const post = (p, data) =>
  fetch(base + p, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data).toString(),
  });
const htmlClass = (body) => body.match(/<html lang="en" dir="ltr" class="([^"]*)">/)[1];
const menuOf = (body) => body.slice(body.indexOf('<details class="a11y-menu">'), body.indexOf('</details>') + 10);
const SITE = 'http://porchlight.test/some/page';
const staysOnSite = (location) => new URL(location, SITE).host === 'porchlight.test';

const ROUTES = [
  { route: '/prefs/text-size', field: 'size', cookie: 'textsize', values: ['normal', 'large', 'xlarge'] },
  { route: '/prefs/contrast', field: 'contrast', cookie: 'contrast', values: ['standard', 'high'] },
  { route: '/prefs/theme', field: 'theme', cookie: 'theme', values: ['light', 'dark', 'auto'] },
];

test('each preference is saved in its own cookie, and the redirect returns to the page', async () => {
  for (const { route, field, cookie, values } of ROUTES) {
    for (const value of values) {
      const res = await post(route, { [field]: value, back: '/seniors/s-harold' });
      assert.equal(res.status, 303, `${route} ${value}`);
      assert.equal(res.headers.get('location'), '/seniors/s-harold');
      const set = res.headers.get('set-cookie') || '';
      assert.match(set, new RegExp(`^${cookie}=${value}; Path=/; Max-Age=\\d+; SameSite=Lax$`), `${route} sets ${cookie}=${value}`);
    }
  }
});

test('values outside the allow-list are ignored: no cookie, and the page falls back to the default', async () => {
  for (const { route, field } of ROUTES) {
    for (const bad of ['', 'huge', 'DARK', 'dark; Path=/admin', '<script>', 'x'.repeat(500)]) {
      const res = await post(route, { [field]: bad, back: '/' });
      assert.equal(res.status, 303, `${route} ${JSON.stringify(bad)}`);
      assert.equal(res.headers.get('set-cookie'), null, `${route} ignores ${JSON.stringify(bad)}`);
    }
  }
  // A forged cookie is ignored too.
  const body = await page('/', 'textsize=enormous; theme=purple; contrast=extreme');
  assert.equal(htmlClass(body), 'text-normal');
});

test('the html element gets the classes on the first paint, with no JavaScript', async () => {
  const cases = [
    ['', 'text-normal'],
    ['textsize=xlarge', 'text-xlarge'], // the class attribute is unchanged when only text size is set
    ['theme=dark', 'text-normal theme-dark'],
    ['theme=light', 'text-normal theme-light'],
    ['theme=auto', 'text-normal'], // "Match my device": the stylesheet follows prefers-color-scheme
    ['contrast=high', 'text-normal contrast-high'],
    ['contrast=standard', 'text-normal'],
    ['textsize=large; theme=dark; contrast=high', 'text-large theme-dark contrast-high'],
  ];
  for (const [cookie, expected] of cases) {
    assert.equal(htmlClass(await page('/dashboard', cookie)), expected, cookie || '(no cookie)');
  }
  // The browser is told which color scheme native controls should use.
  assert.match(await page('/', 'theme=dark'), /<meta name="color-scheme" content="dark">/);
  assert.match(await page('/', 'theme=light'), /<meta name="color-scheme" content="light">/);
  assert.match(await page('/'), /<meta name="color-scheme" content="light dark">/);
});

test('the redirect never leaves the site, for every preference route', async () => {
  const attacks = [
    '//evil.example', '/\\evil.example', '/\\/evil.example', '/\t/evil.example', '/\t\\evil.example',
    'https://evil.example', 'javascript:alert(1)', ' //evil.example', '/ok\r\nSet-Cookie: injected=1',
    '/\u0000/evil.example', '/%0D%0Aevil', '', 'relative/path',
  ];
  for (const { route, field, values } of ROUTES) {
    for (const back of attacks) {
      const res = await post(route, { [field]: values[1], back });
      assert.equal(res.status, 303, `${route} ${JSON.stringify(back)}`);
      const location = res.headers.get('location');
      assert.ok(staysOnSite(location), `${route} back=${JSON.stringify(back)} -> ${JSON.stringify(location)}`);
      assert.ok(!(res.headers.get('set-cookie') || '').includes('injected'), 'no header injection');
    }
  }
  // An ordinary path with a query string is kept as it is.
  const res = await post('/prefs/theme', { theme: 'dark', back: '/match?seniorId=s-eugene' });
  assert.equal(res.headers.get('location'), '/match?seniorId=s-eugene');
});

test('the old POST /prefs/text-size route still works as before', async () => {
  const res = await post('/prefs/text-size', { size: 'large', back: '/tour' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/tour');
  assert.match(res.headers.get('set-cookie'), /textsize=large/);
  // The tour's own A++ button still posts there.
  const tour = await page('/tour');
  assert.match(tour, /<form method="post" action="\/prefs\/text-size" class="inline-form">/);
});

test('the Accessibility menu is a labeled, keyboard-ready disclosure with three groups', async () => {
  const menu = menuOf(await page('/dashboard', 'textsize=xlarge; theme=dark'));
  // A native <details>/<summary>: no JavaScript needed to open it.
  assert.match(menu, /<summary class="a11y-summary">[\s\S]*<span class="a11y-summary-text">Accessibility<\/span>[\s\S]*<\/summary>/);
  // Three forms, each with a fieldset and a legend, posting to their own route.
  const forms = [...menu.matchAll(/<form class="([^"]+)" method="post" action="([^"]+)">\s*<input type="hidden" name="back" value="([^"]*)">\s*<fieldset class="pref-group">\s*<legend class="pref-legend">([^<]+)<\/legend>/g)]
    .map((m) => [m[1], m[2], m[3], m[4]]);
  assert.deepEqual(forms, [
    ['text-size', '/prefs/text-size', '/dashboard', 'Text size'],
    ['pref-contrast', '/prefs/contrast', '/dashboard', 'Contrast'],
    ['pref-theme', '/prefs/theme', '/dashboard', 'Theme'],
  ]);
  // Every option is a real submit button with a visible word and a pressed state.
  const buttons = [...menu.matchAll(/<button type="submit" name="(\w+)" value="(\w+)" aria-pressed="(true|false)"[^>]*>([\s\S]*?)<\/button>/g)]
    .map((m) => ({ name: m[1], value: m[2], pressed: m[3], word: (m[4].match(/<span class="pref-word">([^<]+)<\/span>/) || [])[1] }));
  assert.deepEqual(buttons.map((b) => `${b.name}=${b.value}:${b.pressed}:${b.word}`), [
    'size=normal:false:Normal',
    'size=large:false:Large',
    'size=xlarge:true:Extra large',
    'contrast=standard:true:Standard',
    'contrast=high:false:High',
    'theme=light:false:Light',
    'theme=dark:true:Dark',
    'theme=auto:false:Match my device',
  ]);
  // The chosen option also shows a check mark, so the state never relies on color.
  assert.equal((menu.match(/<span class="pref-check" aria-hidden="true">✓<\/span>/g) || []).length, 3);
  // Decorative samples are hidden from screen readers; the word is the name.
  assert.doesNotMatch(menu, /<svg(?![^>]*aria-hidden="true")/);
  assert.doesNotMatch(menu, /<span class="pref-sample"(?! aria-hidden="true")/);
  // With no cookies, "Match my device" is the theme.
  assert.match(menuOf(await page('/')), /value="auto" aria-pressed="true"/);
});

test('after a form error, the menu returns to a page that loads, and warns about typed text (B-10)', async () => {
  const backOf = (body) => body.match(/<form class="text-size"[\s\S]*?name="back" value="([^"]*)"/)[1].replace(/&amp;/g, '&');
  const cases = [
    ['/settings', { riskThresholdDays: '0' }, '/dashboard'],
    ['/seniors', { name: '' }, '/seniors/new'],
    ['/seniors/s-harold', { name: '' }, '/seniors/s-harold/edit'],
    ['/volunteers', { name: '' }, '/volunteers/new'],
    ['/volunteers/v-ethan', { name: '' }, '/volunteers/v-ethan/edit'],
    ['/contacts', { matchId: 'm-dorothy-maya', action: 'schedule', type: 'phone', date: '', time: '' }, '/contacts?matchId=m-dorothy-maya'],
    ['/matches', { seniorId: 's-harold', volunteerId: 'v-ethan' }, '/match?seniorId=s-harold'], // already matched: 409
  ];
  for (const [route, data, expected] of cases) {
    const res = await post(route, data);
    const body = await res.text();
    const back = backOf(body);
    assert.equal(back, expected, `${route}`);
    assert.equal((await get(back)).status, 200, `${back} loads`);
    assert.match(menuOf(body), /class="a11y-warning"[\s\S]*Heads up:/, `${route} warns that typed text will be cleared`);
  }
  // On an ordinary page, only seniorId/matchId survive in the return path (no ?msg= repeat).
  assert.equal(backOf(await page('/match?seniorId=s-eugene&msg=match_ended')), '/match?seniorId=s-eugene');
  assert.equal(backOf(await page('/contacts?matchId=m-dorothy-maya&msg=scheduled')), '/contacts?matchId=m-dorothy-maya');
  // Pages with nothing to type in don't show the warning.
  assert.doesNotMatch(menuOf(await page('/help')), /a11y-warning/);
});

test('a change keeps the page\'s own query (town filter, prefilled form) but not one-time messages', async () => {
  const backOf = (body) => body.match(/<form class="text-size"[\s\S]*?name="back" value="([^"]*)"/)[1].replace(/&amp;/g, '&');
  assert.equal(backOf(await page('/seniors?town=Carmel')), '/seniors?town=Carmel');
  assert.equal(backOf(await page('/volunteers?town=Fishers&msg=volunteer_saved')), '/volunteers?town=Fishers');
  assert.equal(backOf(await page('/contacts?seniorId=s-harold&warn=outside_hours')), '/contacts?seniorId=s-harold');
  // Odd characters in the query are encoded, so the path still passes safeBack().
  const odd = backOf(await page('/seniors?town=New%20Carmel%20%22x%22&a%20b=c'));
  assert.equal(odd, '/seniors?town=New%20Carmel%20%22x%22&a%20b=c');
  const res = await post('/prefs/theme', { theme: 'dark', back: odd });
  assert.equal(res.headers.get('location'), odd);
});

test('the menu works while signed in (demo sign-in roles)', async () => {
  const viewer = `viewer=${encodeURIComponent('family:s-harold')}`;
  const res = await fetch(base + '/prefs/text-size', {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: viewer },
    body: new URLSearchParams({ size: 'xlarge', back: '/seniors/s-harold/summary' }).toString(),
  });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/seniors/s-harold/summary');
  assert.match(res.headers.get('set-cookie'), /textsize=xlarge/);
  for (const route of ['/prefs/contrast', '/prefs/theme']) {
    const r = await fetch(base + route, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: viewer },
      body: new URLSearchParams({ contrast: 'high', theme: 'dark', back: '/dashboard' }).toString(),
    });
    assert.equal(r.status, 303, route);
    assert.equal(r.headers.get('location'), '/dashboard', route);
  }
  const body = await page('/seniors/s-harold/summary', `${viewer}; textsize=xlarge; theme=dark; contrast=high`);
  assert.equal(htmlClass(body), 'text-xlarge theme-dark contrast-high');
  assert.match(menuOf(body), /name="back" value="\/seniors\/s-harold\/summary"/);
});

test('HEAD works like GET with no body, and a broken %-escape is a 404 (B-17, B-18)', async () => {
  const res = await fetch(base + '/dashboard', { method: 'HEAD' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal(await res.text(), '');
  assert.equal((await fetch(base + '/nope', { method: 'HEAD' })).status, 404);
  assert.equal((await get('/seniors/%E0%A4%A')).status, 404);
});
