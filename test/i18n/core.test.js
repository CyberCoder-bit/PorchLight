// v2 i18n core: t() works per request, and every catalog has every key.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, withLang, currentLang, setCurrentLang, dirFor, EN, DEFAULT_LANG } from '../../src/i18n/index.js';
import { UI_LANGUAGES, CATALOGS } from '../../src/i18n/languages.js';
import { languageFromRequest } from '../../src/i18n/negotiate.js';

test('t(): a missing key shows the key itself, never "undefined"', () => {
  assert.equal(t('no.such.key'), 'no.such.key');
  assert.equal(currentLang(), DEFAULT_LANG);
});

test('each request keeps its own language, even across awaits', async () => {
  const seen = [];
  const run = (lang, ms) =>
    withLang(lang, async () => {
      await new Promise((r) => setTimeout(r, ms));
      seen.push([lang, currentLang()]);
    });
  await Promise.all(UI_LANGUAGES.map((l, i) => run(l.code, 10 - i)));
  for (const [asked, got] of seen) assert.equal(got, asked);
  withLang('xx-not-real', () => assert.equal(currentLang(), DEFAULT_LANG));
  withLang('en', () => {
    setCurrentLang('xx-not-real');
    assert.equal(currentLang(), 'en');
  });
  assert.equal(dirFor('en'), 'ltr');
});

test('every UI language has a catalog with every English key', () => {
  for (const { code } of UI_LANGUAGES) {
    if (code === DEFAULT_LANG) continue;
    const catalog = CATALOGS[code];
    assert.ok(catalog, `no catalog for ${code}`);
    const missing = Object.keys(EN).filter((k) => typeof catalog[k] !== 'string' || !catalog[k].trim());
    assert.deepEqual(missing, [], `${code} is missing keys`);
  }
});

test('language from the request: cookie, then Accept-Language, then English', () => {
  assert.equal(languageFromRequest({ cookies: { lang: 'en' } }), 'en');
  assert.equal(languageFromRequest({ cookies: { lang: 'zz' }, acceptLanguage: 'zz-ZZ,en;q=0.5' }), 'en');
  assert.equal(languageFromRequest({}), 'en');
});
