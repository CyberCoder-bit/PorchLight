// Translations for the interface (v2).
//
//   t('auth.signIn.title')                 -> "Sign in" (or the same words in the reader's language)
//   t('core.greeting', { name: 'Hal' })     -> "Hello, Hal"   ({name} is filled in)
//
// The language belongs to the REQUEST, not to the process: createHandler()
// (src/http.js) runs every request inside withLang(), using AsyncLocalStorage,
// so any view can call t() without being handed the language. Code that runs
// later in the same request (the sign-in guard, once it knows the person) can
// switch it with setCurrentLang(). AsyncLocalStorage is built into Node and
// into Cloudflare Workers (nodejs_compat), so nothing new is installed.
//
// Catalogs are plain files written ahead of time and committed. The interface
// is never translated at runtime. English is split into one file per owner
// (./en/*.js) so separate features never edit the same file. Other languages are one
// file each (./<code>.js) and are registered in ./languages.js.
//
// Rules for catalog text:
//   - Plain text only. t() returns a string, and the html`` template escapes it.
//     Put links and <strong> in the view, around separate keys.
//   - Variables look like {name}. Missing variables are left as they are.
//   - Keys are "namespace.area.thing", e.g. "auth.signUp.emailLabel".

import { AsyncLocalStorage } from 'node:async_hooks';
import core from './en/core.js';
import corePages from './en/core-pages.js';
import coreFeatures from './en/core-features.js';
import auth from './en/auth.js';
import site from './en/site.js';
import translate from './en/translate.js';
import lang from './en/lang.js';
import { CATALOGS, canonicalCode, uiLanguage } from './languages.js';

export const DEFAULT_LANG = 'en';

// English is the full set of keys. Every other catalog must have the same keys
// (test/i18n/catalogs.test.js fails on any missing one).
export const EN = Object.freeze({ ...core, ...corePages, ...coreFeatures, ...auth, ...site, ...translate, ...lang });

const storage = new AsyncLocalStorage();

// Shipped interface languages only. Case and '_' don't matter ('ES', 'zh_hans').
export const isUiLanguage = (code) => canonicalCode(code) !== null;

// Run fn() with `lang` as the language for everything it calls, including
// code after an await.
export function withLang(lang, fn) {
  return storage.run({ lang: canonicalCode(lang) || DEFAULT_LANG }, fn);
}

export function currentLang() {
  return storage.getStore()?.lang || DEFAULT_LANG;
}

// Change the language for the rest of this request (e.g. once the signed-in
// person's profile language is known). Unknown codes are ignored.
export function setCurrentLang(lang) {
  const store = storage.getStore();
  const code = canonicalCode(lang);
  if (store && code) store.lang = code;
}

// Right-to-left is a fact about the language, so this answers for planned
// languages too (dirFor('ar') is 'rtl' before the Arabic catalog ships).
export function dirFor(lang = currentLang()) {
  return uiLanguage(lang)?.dir || 'ltr';
}

// ----- pseudo-locale, for tests only -----
// With markers on, every t() string comes back as "⟦text⟧", so a test can
// find text on a page that skipped t() (see test/i18n/pseudo.js). It is a
// switch in this module, not a language: no cookie, header, or profile can
// reach it, and it is never in UI_LANGUAGES.
let pseudoMarkers = false;
export function setPseudoMarkersForTests(on) {
  pseudoMarkers = Boolean(on);
}

const fill = (text, vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (whole, name) => (vars[name] === undefined || vars[name] === null ? whole : String(vars[name]))) : text;

// A label used inside a sentence ("Prefers phone calls"). English and most
// languages lowercase it there; German keeps nouns capitalized ("Telefonanruf"),
// and scripts without case are unchanged anyway.
const KEEP_CASE = new Set(['de']);
export function lowerInText(text) {
  return KEEP_CASE.has(currentLang()) ? String(text) : String(text).toLowerCase();
}

// The reader's language, then English, then the key itself (so a missing key
// shows up as "auth.signIn.title" on screen and in tests, never as "undefined").
export function t(key, vars) {
  const lang = currentLang();
  const catalog = lang === DEFAULT_LANG ? EN : CATALOGS[lang];
  const text = catalog?.[key] ?? EN[key] ?? key;
  return pseudoMarkers ? `⟦${fill(text, vars)}⟧` : fill(text, vars);
}

// Same as t(), but in a language you name (e.g. a message shown to the other
// person in their language).
export function tIn(lang, key, vars) {
  return withLang(lang, () => t(key, vars));
}
