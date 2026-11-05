// Which languages the INTERFACE comes in (v2).
//
// `name` is the language's own name ("Español"), so a reader can find theirs
// without reading English. `english` is its English name. `dir` is 'rtl' for
// right-to-left scripts. `locale` is used for dates and numbers (Intl), always
// in Indiana time (src/tz.js).
//
// PLANNED_UI_LANGUAGES is the full list we chose from Census data (see
// docs/research.md, section 6). UI_LANGUAGES is the part of it that ships:
// only languages whose catalog file exists, because the catalog test
// (test/i18n/core.test.js) needs every key in every listed language.
//
// To add a language: write ./<code>.js with every key in English (start it
// with the "Machine-translated" note), import it below, and add it to
// CATALOGS. It then shows up in the picker by itself.
//
// The languages PEOPLE SPEAK (on profiles, used for matching) are a longer,
// separate list: see ./spoken.js.

import es from './es.js';
import zhHans from './zh-Hans.js';
import vi from './vi.js';
import ht from './ht.js';
import de from './de.js';
import ar from './ar.js';

export const PLANNED_UI_LANGUAGES = Object.freeze([
  { code: 'en', name: 'English', english: 'English', dir: 'ltr', locale: 'en-US' },
  { code: 'es', name: 'Español', english: 'Spanish', dir: 'ltr', locale: 'es-US' },
  { code: 'zh-Hans', name: '中文（简体）', english: 'Chinese (Simplified)', dir: 'ltr', locale: 'zh-Hans-CN' },
  { code: 'my', name: 'မြန်မာ', english: 'Burmese', dir: 'ltr', locale: 'my-MM' },
  // Intl has no Haitian Creole dates yet (ht-HT falls back to English), so dates use Haiti's French.
  { code: 'ht', name: 'Kreyòl ayisyen', english: 'Haitian Creole', dir: 'ltr', locale: 'fr-HT' },
  { code: 'de', name: 'Deutsch', english: 'German', dir: 'ltr', locale: 'de-DE' },
  { code: 'ar', name: 'العربية', english: 'Arabic', dir: 'rtl', locale: 'ar' },
  { code: 'vi', name: 'Tiếng Việt', english: 'Vietnamese', dir: 'ltr', locale: 'vi-VN' },
]);

// code -> catalog object. English is assembled in ./index.js from ./en/*.js.
export const CATALOGS = Object.freeze({ es, 'zh-Hans': zhHans, vi, ht, de, ar });

export const UI_LANGUAGES = Object.freeze(
  PLANNED_UI_LANGUAGES.filter((l) => l.code === 'en' || Object.hasOwn(CATALOGS, l.code))
);

// 'ZH-hans', 'zh_hans' -> 'zh-Hans' (the code as we write it), or null.
// `list` defaults to the shipped languages; pass PLANNED_UI_LANGUAGES to ask
// about a language whose catalog is not written yet.
export function canonicalCode(code, list = UI_LANGUAGES) {
  if (typeof code !== 'string' || !code || code.length > 20) return null;
  const wanted = code.trim().replace(/_/g, '-').toLowerCase();
  return list.find((l) => l.code.toLowerCase() === wanted)?.code || null;
}

export const uiLanguage = (code) => {
  const found = canonicalCode(code, PLANNED_UI_LANGUAGES);
  return found ? PLANNED_UI_LANGUAGES.find((l) => l.code === found) : null;
};

// The Intl locale for dates and numbers. Unknown codes get English (en-US).
export const localeOf = (code) => uiLanguage(code)?.locale || 'en-US';
