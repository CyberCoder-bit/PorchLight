// Spoken-language fields for profiles (v2).
// STUB for now. Accounts (sign-up, /account) and
// the admin senior/volunteer forms call these, so the signatures are fixed:
//
//   languageFieldset({ values, errors, legend })  -> html for the form
//       values: { languages: [{ code, level }], translateHelp }
//   readLanguages(body) -> { languages, translateHelp, errors }
//       errors are keyed by field name, like the other validators
//   formatLanguages(person) -> "English (native), Spanish (fluent)" in the reader's language
//   languagesOf(person) -> person.languages, or [{ code: 'en', level: 'native' }] for old data

export const DEFAULT_LANGUAGES = Object.freeze([{ code: 'en', level: 'native' }]);

export function languagesOf(person) {
  return Array.isArray(person?.languages) && person.languages.length ? person.languages : DEFAULT_LANGUAGES;
}

export function languageFieldset(/* { values, errors, legend } */) {
  return '';
}

export function readLanguages(/* body */) {
  return { languages: [...DEFAULT_LANGUAGES], translateHelp: false, errors: {} };
}

export function formatLanguages(person) {
  return languagesOf(person).map((l) => `${l.code} (${l.level})`).join(', ');
}
