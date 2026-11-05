// v2 languages: the picker, POST /prefs/language, right-to-left, dates in the
// reader's language (still Indiana time), spoken-language fields, and the
// pseudo-locale check on the pages this module owns.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../../src/store.js';
import { createApp } from '../../src/app.js';
import { createSparkService } from '../../src/sparks/index.js';
import { buildConfig } from '../../src/config.js';
import { withLang, dirFor, isUiLanguage, currentLang, EN } from '../../src/i18n/index.js';
import { UI_LANGUAGES, PLANNED_UI_LANGUAGES, CATALOGS, canonicalCode, localeOf } from '../../src/i18n/languages.js';
import { languageFromRequest } from '../../src/i18n/negotiate.js';
import { registerI18n } from '../../src/i18n/routes.js';
import { languagePicker } from '../../src/i18n/picker.js';
import { languageFieldset, readLanguages, formatLanguages, languagesOf } from '../../src/i18n/fields.js';
import { SPOKEN_LANGUAGES, hasInterface } from '../../src/i18n/spoken.js';
import { scorePair } from '../../src/matching.js';
import { formatTime, formatDateTime, formatLongDate } from '../../src/views/html.js';
import { formatLocal, formatIn, TIME_ZONE } from '../../src/tz.js';
import { withPseudo, unwrappedText } from './pseudo.js';
import { sessionCookieFor } from '../helpers/server.js'; // [v2 accounts] real sessions

process.env.TZ = 'UTC'; // like Cloudflare Workers: Indiana time must come from src/tz.js, not the machine

let app;
let store;
let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-lang-test-'));
  store = new Store(path.join(tmpDir, 'db.json'));
  store.open();
  const sparks = createSparkService(buildConfig({}), { effective: 'mock', reason: 'test', warning: null });
  app = createApp({ store, sparks });
});

after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

const get = (p, headers = {}) => app(new Request(`http://porchlight.test${p}`, { headers }));
const page = async (p, headers) => {
  const res = await get(p, headers);
  assert.equal(res.status, 200, p);
  return res.text();
};
const post = (p, data, headers = {}) =>
  app(new Request(`http://porchlight.test${p}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(data).toString(),
  }));
const htmlTag = (body) => body.match(/<html [^>]*>/)[0];

// ----- the interface languages -----

test('interface languages: every shipped one is planned and has a catalog; the planned list has 8, with Arabic right to left', () => {
  const planned = PLANNED_UI_LANGUAGES.map((l) => l.code);
  assert.deepEqual(UI_LANGUAGES.map((l) => l.code), planned.filter((c) => c === 'en' || CATALOGS[c]));
  assert.ok(UI_LANGUAGES.some((l) => l.code === 'es'), 'Spanish ships');
  assert.deepEqual(PLANNED_UI_LANGUAGES.map((l) => l.code), ['en', 'es', 'zh-Hans', 'my', 'ht', 'de', 'ar', 'vi']);
  for (const l of UI_LANGUAGES) assert.ok(l.code === 'en' || CATALOGS[l.code], `${l.code} ships with a catalog`);
  for (const l of PLANNED_UI_LANGUAGES) {
    assert.ok(l.name && l.english && l.locale, l.code);
    assert.doesNotThrow(() => new Intl.DateTimeFormat(l.locale), l.code);
  }
  assert.equal(PLANNED_UI_LANGUAGES.find((l) => l.code === 'ar').dir, 'rtl');
  assert.ok(PLANNED_UI_LANGUAGES.filter((l) => l.dir === 'rtl').length >= 1);
});

test('codes match whatever the case: ES, zh-hans, zh_Hans', () => {
  assert.equal(canonicalCode('ES'), 'es');
  assert.equal(canonicalCode(' es '), 'es');
  assert.equal(canonicalCode('zh-hans', PLANNED_UI_LANGUAGES), 'zh-Hans');
  assert.equal(canonicalCode('ZH_HANS', PLANNED_UI_LANGUAGES), 'zh-Hans');
  assert.equal(canonicalCode('xx-not-planned'), null, 'not a UI language');
  assert.equal(canonicalCode('x'.repeat(500)), null);
  assert.ok(isUiLanguage('Es'));
  withLang('ES', () => assert.equal(currentLang(), 'es'));
});

test('the Spanish catalog starts with the machine-translation note', () => {
  const source = fs.readFileSync(new URL('../../src/i18n/es.js', import.meta.url), 'utf8');
  assert.match(source.split('\n')[0], /Machine-translated\. Needs review by a native speaker before real use\./);
  for (const key of Object.keys(EN).filter((k) => k.startsWith('lang.'))) {
    const vars = (s) => (s.match(/\{\w+\}/g) || []).sort();
    assert.deepEqual(vars(CATALOGS.es[key]), vars(EN[key]), `${key} keeps its {variables}`);
  }
});

test('language order: cookie, then Accept-Language by q, then English', () => {
  assert.equal(languageFromRequest({ cookies: { lang: 'es' }, acceptLanguage: 'en' }), 'es');
  assert.equal(languageFromRequest({ cookies: { lang: 'ES' } }), 'es');
  assert.equal(languageFromRequest({ acceptLanguage: 'es-MX,es;q=0.9,en;q=0.8' }), 'es');
  assert.equal(languageFromRequest({ acceptLanguage: 'en;q=0.5, es;q=0.9' }), 'es');
  assert.equal(languageFromRequest({ acceptLanguage: 'es;q=0, en' }), 'en');
  assert.equal(languageFromRequest({ acceptLanguage: 'fr-CA, de;q=0.5' }), 'de', 'French is not a UI language, German is');
  assert.equal(languageFromRequest({ acceptLanguage: 'fr-CA, ja;q=0.5' }), 'en', 'not shipped: English');
  assert.equal(languageFromRequest({ acceptLanguage: 'zh-TW' }), 'en', 'Traditional Chinese never gets Simplified');
  assert.equal(languageFromRequest({ cookies: { lang: 'zz' }, acceptLanguage: '*' }), 'en');
});

// ----- POST /prefs/language -----

test('POST /prefs/language keeps you on the same page and sets lang and dir', async () => {
  const back = '/how-it-works?from=test'; // a public page, so no session is needed
  const res = await post('/prefs/language', { lang: 'es', back });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), back);
  assert.match(res.headers.get('set-cookie'), /^lang=es; Path=\/; Max-Age=31536000; SameSite=Lax$/);

  const body = await page(back, { cookie: 'lang=es' });
  assert.match(htmlTag(body), /lang="es" dir="ltr"/);
  assert.match(body, /<button type="submit" name="lang" value="es" aria-pressed="true"[^>]*><span class="pref-word" lang="es" dir="ltr">Español<\/span>/);
  assert.match(body, /<input type="hidden" name="back" value="\/how-it-works\?from=test">/);

  // Case doesn't matter; unknown codes and unsafe "back" values change nothing.
  assert.match((await post('/prefs/language', { lang: 'ES', back: '/' })).headers.get('set-cookie'), /^lang=es;/);
  for (const bad of ['', 'xx', 'pseudo', 'qps-ploc', 'es; Path=/admin', '<script>']) {
    const r = await post('/prefs/language', { lang: bad, back: '/seniors' });
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('set-cookie'), null, JSON.stringify(bad));
  }
  assert.equal((await post('/prefs/language', { lang: 'es', back: '//evil.example' })).headers.get('location'), '/');
  assert.match(htmlTag(await page('/how-it-works', { cookie: 'lang=en' })), /lang="en" dir="ltr"/);
});

test('POST /prefs/language saves uiLanguage on a signed-in person\'s account', () => {
  const routes = {};
  const users = [{ id: 'u-1', uiLanguage: 'en' }];
  let saved = 0;
  const fakeStore = { user: (id) => users.find((u) => u.id === id) || null, save: () => saved++ };
  registerI18n({ post: (p, h) => (routes[p] = h) }, { store: fakeStore, str: (v) => String(v ?? '').trim(), safeBack: (v) => (v?.startsWith('/') ? v : null) });
  const res = { cookies: [], setCookie(n, v) { this.cookies.push([n, v]); }, redirect(l) { this.location = l; } };
  routes['/prefs/language']({ body: { lang: 'es', back: '/account' }, viewer: { userId: 'u-1' } }, res);
  assert.equal(users[0].uiLanguage, 'es');
  assert.equal(saved, 1);
  assert.deepEqual(res.cookies, [['lang', 'es']]);
  assert.equal(res.location, '/account');
  // Signed out (no userId): only the cookie.
  const res2 = { ...res, cookies: [], setCookie: res.setCookie, redirect: res.redirect };
  routes['/prefs/language']({ body: { lang: 'en', back: '/' }, viewer: null }, res2);
  assert.equal(users[0].uiLanguage, 'es');
});

// ----- right to left -----

test('right to left: Arabic is rtl, everything shipped today is ltr', () => {
  assert.equal(dirFor('ar'), 'rtl');
  assert.equal(dirFor('AR'), 'rtl');
  assert.equal(dirFor('es'), 'ltr');
  assert.equal(dirFor('xx'), 'ltr');
  withLang('es', () => assert.equal(dirFor(), 'ltr'));
});

test('right to left: with the Arabic catalog, pages say <html lang="ar" dir="rtl">', { skip: !isUiLanguage('ar') && 'the Arabic catalog is written after the merge' }, async () => {
  const body = await page('/how-it-works', { cookie: 'lang=ar' });
  assert.match(htmlTag(body), /lang="ar" dir="rtl"/);
  assert.match(body, /<span class="pref-word" lang="ar" dir="rtl">العربية<\/span>/);
});

// ----- dates: the reader's language, Indiana's clock -----

// 4:05 PM in Indiana in November (EST, UTC-5) and 4:05 PM in July (EDT, UTC-4).
const NOV = '2026-11-04T21:05:00Z';
const JUL = '2026-07-15T20:05:00Z';
const ARABIC_DIGITS = /[٠-٩]/g;
const westernDigits = (s) => s.replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660));

test('English dates are exactly as before', () => {
  withLang('en', () => {
    assert.equal(formatTime(NOV), '4:05 PM');
    assert.equal(formatTime(JUL), '4:05 PM');
    assert.equal(formatLocal(NOV, { weekday: 'long', month: 'long', day: 'numeric' }), 'Wednesday, November 4');
    assert.match(formatDateTime(NOV), /^Wednesday, November 4(?:, 2026)? at 4:05 PM$/);
  });
});

test('Spanish and Arabic dates still show the right Indiana time', () => {
  withLang('es', () => {
    assert.equal(formatTime(NOV), '4:05 p.m.');
    assert.equal(formatTime(JUL), '4:05 p.m.');
    assert.match(formatLongDate(NOV), /^miércoles, 4 de noviembre/);
    assert.match(formatDateTime(NOV), /^miércoles, 4 de noviembre(?: de 2026)?, 4:05 p\.m\.$/);
  });
  // Arabic: the same Indiana hour, whichever digits the locale uses.
  for (const [iso, hour] of [[NOV, '4:05'], [JUL, '4:05']]) {
    const time = westernDigits(formatIn(localeOf('ar'), iso, { hour: 'numeric', minute: '2-digit' }));
    assert.match(time, new RegExp(`${hour}\\s*م`), time);
  }
  const day = westernDigits(formatIn(localeOf('ar'), NOV, { day: 'numeric', month: 'long' }));
  assert.match(day, /4 نوفمبر/);
  assert.equal(TIME_ZONE, 'America/Indiana/Indianapolis');
  // Late evening in Indiana is already the next day in UTC: the day must stay Indiana's.
  withLang('es', () => assert.match(formatLongDate('2026-11-05T03:30:00Z'), /^miércoles, 4 de noviembre/));
});

// ----- spoken languages on profiles -----

test('the spoken-language registry has the languages Indiana needs, with Hakha Chin spoken-only', () => {
  const codes = SPOKEN_LANGUAGES.map((l) => l.code);
  for (const code of ['en', 'es', 'ar', 'my', 'cnh', 'zh', 'vi', 'fr', 'de', 'pdc', 'hi', 'te', 'ko', 'tl', 'ja']) {
    assert.ok(codes.includes(code), code);
  }
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(SPOKEN_LANGUAGES.find((l) => l.code === 'cnh').ui, null);
  assert.equal(hasInterface('es'), true);
  assert.equal(hasInterface('cnh'), false);
});

test('readLanguages: at least one, at most 3, no repeats, known codes and levels only', () => {
  const ok = readLanguages({ lang1: 'es', level1: 'fluent', lang2: 'en', level2: 'learning', lang3: '', level3: '', translateHelp: 'yes' });
  assert.deepEqual(ok, { languages: [{ code: 'es', level: 'fluent' }, { code: 'en', level: 'learning' }], translateHelp: true, errors: {}, present: true });
  assert.deepEqual(readLanguages({ lang1: '', level1: 'native' }).errors, { languages: 'Choose at least one language.' });
  assert.deepEqual(readLanguages({ lang1: 'es', level1: 'native', lang2: 'es', level2: 'fluent' }).errors, { languages: 'Each language can only be listed once.' });
  assert.deepEqual(readLanguages({ lang1: 'klingon', level1: 'native' }).errors, { lang1: 'Choose a language from the list.' });
  assert.deepEqual(readLanguages({ lang1: 'es', level1: 'expert' }).errors, { level1: 'Choose how well they speak Spanish.' });
  assert.equal(readLanguages({ lang1: 'es', level1: 'native', lang4: 'en', level4: 'native' }).errors.languages, 'Choose up to 3 languages.');
  assert.equal(readLanguages({ lang1: ['es', 'en'], level1: 'native' }).languages[0].code, 'es', 'a repeated field is read once');
  // An older form with no language fields: nothing to read, so the caller keeps what is saved.
  assert.equal(readLanguages({ name: 'X' }).present, false);
  assert.deepEqual(languagesOf({}), [{ code: 'en', level: 'native' }]);
});

test('formatLanguages is in the reader\'s language', () => {
  const rosa = { languages: [{ code: 'es', level: 'fluent' }, { code: 'en', level: 'learning' }] };
  assert.equal(withLang('en', () => formatLanguages(rosa)), 'Spanish (fluent), English (learning)');
  assert.equal(withLang('es', () => formatLanguages(rosa)), 'español (con fluidez) e inglés (aprendiendo)');
  assert.equal(withLang('en', () => formatLanguages({})), 'English (native)');
  assert.equal(withLang('es', () => formatLanguages({ languages: [{ code: 'cnh', level: 'native' }] })), 'Hakha Chin (nativo)');
});

test('the language fieldset is labeled, grouped, and keeps what was typed after an error', () => {
  const markup = String(languageFieldset({
    values: { languages: [{ code: 'ar', level: 'native' }], translateHelp: true },
    errors: { level2: 'Choose how well they speak Spanish.' },
  }));
  assert.match(markup, /<fieldset class="[^"]*" id="field-languages"[^>]*>\s*<legend>Languages they speak<\/legend>/);
  for (const n of [1, 2, 3]) {
    assert.match(markup, new RegExp(`<label for="field-lang${n}">Language ${n}</label>`));
    assert.match(markup, new RegExp(`<label for="field-level${n}">How well, language ${n}</label>`));
  }
  assert.match(markup, /<option value="ar" selected>Arabic \(العربية\)<\/option>/);
  assert.match(markup, /<select id="field-level2" name="level2" aria-invalid="true" aria-describedby="error-level2">/);
  assert.match(markup, /<input type="checkbox" id="field-translateHelp" name="translateHelp" value="yes" checked/);
  assert.match(markup, /<label for="field-translateHelp">Use translate help when we don’t share a language<\/label>/);
});

test('the admin senior form saves languages and translate help, and the profile shows them', async () => {
  const before = store.senior('s-rosa');
  const admin = { cookie: await sessionCookieFor(store, 'admin') };
  const form = await page('/seniors/s-rosa/edit', admin);
  assert.match(form, /id="field-languages"/);
  const res = await post('/seniors/s-rosa', toForm(before, { lang1: 'es', level1: 'fluent', lang2: 'en', level2: 'learning', lang3: '', level3: '', translateHelp: 'yes' }), admin);
  assert.equal(res.status, 303);
  const after = store.senior('s-rosa');
  assert.deepEqual(after.languages, [{ code: 'es', level: 'fluent' }, { code: 'en', level: 'learning' }]);
  assert.equal(after.translateHelp, true);
  const profile = await page('/seniors/s-rosa', admin);
  assert.match(profile, /<dt>Languages<\/dt><dd>Spanish \(fluent\), English \(learning\) · Uses translate help<\/dd>/);

  // A form with a problem comes back with the error and the choices kept.
  const bad = await post('/seniors/s-rosa', toForm(before, { lang1: 'es', level1: 'fluent', lang2: 'es', level2: 'native' }), admin);
  const text = await bad.text();
  assert.equal(bad.status, 200);
  assert.match(text, /href="#field-languages">Each language can only be listed once\./);
});

// Rosa's saved profile as form fields, plus `extra`.
function toForm(senior, extra) {
  const params = new URLSearchParams();
  const add = (k, v) => params.append(k, v == null ? '' : String(v));
  add('name', senior.name);
  add('preferredName', senior.preferredName);
  add('age', senior.age);
  add('neighborhood', senior.neighborhood);
  add('aboutMe', senior.aboutMe);
  add('contactMethod', senior.contactMethod);
  add('caregiverName', senior.caregiver?.name);
  add('caregiverRelationship', senior.caregiver?.relationship);
  if (senior.town) add('town', senior.town);
  for (const i of senior.interests) add('interests', i);
  for (const s of senior.availability) add('availability', s);
  for (const [k, v] of Object.entries(extra)) add(k, v);
  return params;
}

// ----- pseudo-locale: every string on the parts this module owns goes through t() -----

test('pseudo-locale: the picker, the language fieldset, and the language rows of a match are all in t()', async () => {
  await withPseudo(async () => {
    const req = { method: 'GET', path: '/match', query: { seniorId: 's-eugene' } };
    const ownNames = UI_LANGUAGES.map((l) => l.name);
    assert.deepEqual(unwrappedText(languagePicker(req), ownNames), []);

    // The options show each language's own name; those are data, not interface text.
    const fieldset = String(languageFieldset({ values: { languages: [{ code: 'es', level: 'fluent' }] } }));
    assert.deepEqual(unwrappedText(fieldset, SPOKEN_LANGUAGES.flatMap((l) => [l.name, l.english])), []);

    const rosa = { name: 'Rosa Delgado', interests: [], availability: ['mon-morning'], contactMethod: 'phone', languages: [{ code: 'es', level: 'fluent' }] };
    const linda = { id: 'v', name: 'Linda Okafor', interests: [], availability: ['mon-morning'], contactMethods: ['phone'], maxSeniors: 2, languages: [{ code: 'es', level: 'conversational' }] };
    const shared = scorePair(rosa, linda, 1).breakdown.find((b) => b.kind === 'language');
    assert.deepEqual(unwrappedText(shared.label), []);
    const help = scorePair({ ...rosa, languages: [{ code: 'ar', level: 'native' }], translateHelp: true }, { ...linda, translateHelp: true }, 1);
    assert.deepEqual(unwrappedText(help.breakdown.find((b) => b.kind === 'translateHelp').label), []);
    const none = scorePair({ ...rosa, languages: [{ code: 'ar', level: 'native' }] }, { ...linda, status: 'pending' }, 1);
    assert.deepEqual(none.problems.flatMap((p) => unwrappedText(p)), []);

    // The checker does catch text that skipped t().
    assert.deepEqual(unwrappedText('<p>Hello there</p><p>⟦Wrapped⟧</p>'), ['Hello there']);
  });
  // Off again: no markers, and pseudo can never be picked.
  assert.doesNotMatch(String(languagePicker({ method: 'GET', path: '/', query: {} })), /⟦/);
  for (const code of ['pseudo', 'qps', 'qps-ploc', 'en-XA', 'ar-XB']) {
    assert.equal(isUiLanguage(code), false, code);
    // A pseudo tag may fall back to its real base language (ar-XB -> ar), never to pseudo.
    const got = languageFromRequest({ cookies: { lang: code }, acceptLanguage: code });
    assert.ok(isUiLanguage(got) && got !== code, `${code} -> ${got}`);
  }
});
