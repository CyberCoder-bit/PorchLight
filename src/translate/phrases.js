// The phrase card (/phrases) and the languages the translate tools offer (v2).
//
// The phrases are interface text: keys translate.phrase.* in
// src/i18n/en/translate.js, translated ahead of time in each language's
// catalog. No AI is involved. A phrase is only shown in a language whose
// catalog really has it, so English never pretends to be Spanish.

import { EN } from '../i18n/index.js';
import { UI_LANGUAGES, CATALOGS } from '../i18n/languages.js';

// Languages people can write messages in or pick on the helper. The interface
// languages come first. The rest match the spoken-language registry
// (src/i18n/spoken.js): AI mode can translate them, and
// the phrase card says plainly when their phrases are not written yet.
// `name` is the language's own name, `english` its English name (sent to the
// AI as the language name; nothing else about the person is sent).
const SPOKEN = [
  { code: 'en', name: 'English', english: 'English', dir: 'ltr' },
  { code: 'es', name: 'Español', english: 'Spanish', dir: 'ltr' },
  { code: 'ar', name: 'العربية', english: 'Arabic', dir: 'rtl' },
  { code: 'cnh', name: 'Laiholh', english: 'Hakha Chin', dir: 'ltr' },
  { code: 'my', name: 'မြန်မာ', english: 'Burmese', dir: 'ltr' },
  { code: 'pdc', name: 'Deitsch', english: 'Pennsylvania Dutch', dir: 'ltr' },
  { code: 'zh', name: '中文', english: 'Chinese', dir: 'ltr' },
  { code: 'vi', name: 'Tiếng Việt', english: 'Vietnamese', dir: 'ltr' },
  { code: 'fr', name: 'Français', english: 'French', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', english: 'German', dir: 'ltr' },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi', dir: 'ltr' },
  { code: 'te', name: 'తెలుగు', english: 'Telugu', dir: 'ltr' },
  { code: 'ko', name: '한국어', english: 'Korean', dir: 'ltr' },
  { code: 'tl', name: 'Tagalog', english: 'Tagalog', dir: 'ltr' },
];

export const TRANSLATE_LANGUAGES = Object.freeze([
  ...UI_LANGUAGES.map((l) => ({ code: l.code, name: l.name, english: l.english, dir: l.dir || 'ltr' })),
  ...SPOKEN.filter((s) => !UI_LANGUAGES.some((l) => l.code === s.code)),
]);

export const isTranslateLanguage = (code) => TRANSLATE_LANGUAGES.some((l) => l.code === code);
export const languageInfo = (code) => TRANSLATE_LANGUAGES.find((l) => l.code === code) || null;
// "Español (Spanish)", or just "English" when the two names are the same.
export function languageLabel(code) {
  const l = languageInfo(code);
  if (!l) return String(code || '');
  return l.name === l.english ? l.name : `${l.name} (${l.english})`;
}
export const englishName = (code) => languageInfo(code)?.english || String(code || '');
export const dirOf = (code) => languageInfo(code)?.dir || 'ltr';

// The phrase keys, in the order the card shows them.
export const PHRASE_KEYS = Object.freeze([
  'hello', 'goodMorning', 'goodAfternoon', 'howAreYou', 'imFine', 'niceToMeet',
  'canYouHear', 'speakSlower', 'sayAgain', 'dontUnderstand', 'oneMoment', 'callBack',
  'sameTime', 'whatDay', 'tellMeMore', 'yourDay', 'thankYou', 'enjoyed', 'takeCare', 'goodbye',
].map((k) => `translate.phrase.${k}`));

// The real text of a phrase key in `lang`, or null if that catalog has not
// been written yet (t() would fall back to English, which is not a translation).
export function phraseIn(lang, key) {
  const text = lang === 'en' ? EN[key] : CATALOGS[lang]?.[key];
  return typeof text === 'string' && text.trim() ? text : null;
}

// Does `lang` have the phrase card yet?
export const hasPhrases = (lang) => PHRASE_KEYS.every((k) => phraseIn(lang, k));

// Exact phrase-card match: the phrase typed in `from`, written in `to`.
// Spaces at the ends and letter case do not matter.
export function phraseMatch(text, from, to) {
  const wanted = String(text || '').trim().toLowerCase();
  if (!wanted) return null;
  for (const key of PHRASE_KEYS) {
    const source = phraseIn(from, key);
    if (source && source.trim().toLowerCase() === wanted) return phraseIn(to, key);
  }
  return null;
}
