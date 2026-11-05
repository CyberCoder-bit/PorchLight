// Which languages the INTERFACE comes in (v2).
//
// `name` is the language's own name ("Español"), so a reader can find theirs
// without reading English. `dir` is 'rtl' for right-to-left scripts. `locale`
// is used for dates and numbers (Intl), always in Indiana time (src/tz.js).
//
// To add a language: write ./<code>.js with every key in English, import it
// below, and add a row here. The catalog test checks that nothing is missing.
//
// The languages PEOPLE SPEAK (on profiles, used for matching) are a longer,
// separate list: see ./spoken.js.

export const UI_LANGUAGES = Object.freeze([
  { code: 'en', name: 'English', english: 'English', dir: 'ltr', locale: 'en-US' },
]);

// code -> catalog object. English is assembled in ./index.js from ./en/*.js.
export const CATALOGS = Object.freeze({});
