// Languages PEOPLE SPEAK (v2): the list on profiles, used for matching.
// It is longer than the interface list
// (./languages.js): a senior can list Hakha Chin, and be paired with a
// companion who speaks it, even though the app itself doesn't come in Hakha
// Chin. Why each one is here: docs/research.md, section 4.
//
//   code     what we store on a profile: { code, level }
//   name     the language's own name, so a reader can find theirs
//   english  its English name
//   ui       the interface language for the same readers, or null if there
//            is none planned. hasInterface(code) says whether it ships now.
//   dir      'rtl' for right-to-left scripts

import { currentLang } from './index.js';
import { canonicalCode, localeOf } from './languages.js';

export const SPOKEN_LANGUAGES = Object.freeze([
  { code: 'en', name: 'English', english: 'English', ui: 'en' },
  { code: 'es', name: 'Español', english: 'Spanish', ui: 'es' },
  { code: 'ar', name: 'العربية', english: 'Arabic', ui: 'ar', dir: 'rtl' },
  { code: 'my', name: 'မြန်မာ', english: 'Burmese', ui: 'my' },
  { code: 'zh', name: '中文', english: 'Chinese', ui: 'zh-Hans' },
  { code: 'fr', name: 'Français', english: 'French', ui: null },
  { code: 'de', name: 'Deutsch', english: 'German', ui: 'de' },
  { code: 'ht', name: 'Kreyòl ayisyen', english: 'Haitian Creole', ui: 'ht' },
  // Spoken list only: machine translation for Hakha Chin is new and we have no one to check it.
  { code: 'cnh', name: 'Laiholh', english: 'Hakha Chin', ui: null },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi', ui: null },
  { code: 'ja', name: '日本語', english: 'Japanese', ui: null },
  { code: 'ko', name: '한국어', english: 'Korean', ui: null },
  // Spoken list only: mostly spoken, not written.
  { code: 'pdc', name: 'Deitsch', english: 'Pennsylvania Dutch', ui: null },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', english: 'Punjabi', ui: null },
  { code: 'tl', name: 'Tagalog', english: 'Tagalog', ui: null },
  { code: 'te', name: 'తెలుగు', english: 'Telugu', ui: null },
  { code: 'vi', name: 'Tiếng Việt', english: 'Vietnamese', ui: 'vi' },
]);

// How well someone speaks it, best first. `rank` is used by matching.
export const LEVELS = Object.freeze(['native', 'fluent', 'conversational', 'learning']);
export const LEVEL_RANK = Object.freeze({ native: 4, fluent: 3, conversational: 2, learning: 1 });

export const spokenLanguage = (code) => SPOKEN_LANGUAGES.find((l) => l.code === code) || null;
export const isSpokenLanguage = (code) => spokenLanguage(code) !== null;
export const isLevel = (level) => LEVELS.includes(level);

// Does the app come in this spoken language right now?
export const hasInterface = (code) => Boolean(spokenLanguage(code)?.ui && canonicalCode(spokenLanguage(code).ui));

const displayNames = new Map();
function namesIn(lang) {
  if (!displayNames.has(lang)) {
    let names = null;
    try {
      names = new Intl.DisplayNames(localeOf(lang), { type: 'language', fallback: 'none' });
    } catch {
      names = null;
    }
    displayNames.set(lang, names);
  }
  return displayNames.get(lang);
}

// The language's name in the reader's language: "Spanish" in English,
// "español" in Spanish. English uses our own list, so it never changes with
// the Intl data. A name Intl doesn't know (Hakha Chin) falls back to English.
export function languageName(code, lang = currentLang()) {
  const entry = spokenLanguage(code);
  if (!entry) return String(code ?? '');
  if (lang === 'en') return entry.english;
  let name;
  try {
    name = namesIn(lang)?.of(code);
  } catch {
    name = undefined;
  }
  return name && name !== code ? name : entry.english;
}
