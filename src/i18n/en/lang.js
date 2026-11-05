// English text, "lang" namespace (v2). Keys start with "lang.".
// See src/i18n/index.js for the rules (plain text, {variables}).

export default {
  // The language picker in the header (src/i18n/picker.js)
  'lang.picker.summary': 'Language',
  'lang.picker.legend': 'Choose your language',
  'lang.picker.saved': 'Your choice is saved on this device.',
  'lang.picker.machine': 'Languages other than English were translated by computer and may have mistakes.',

  // Spoken languages on a profile (src/i18n/fields.js)
  'lang.fields.legend': 'Languages they speak',
  'lang.fields.legendYou': 'Languages you speak',
  'lang.fields.hint': 'Add up to 3 languages. We pair people who share a language.',
  'lang.fields.language': 'Language {n}',
  'lang.fields.level': 'How well, language {n}',
  'lang.fields.choose': 'Choose a language',
  'lang.fields.none': 'None',
  'lang.fields.chooseLevel': 'Choose how well',
  'lang.fields.translateHelp': 'Use translate help when we don’t share a language',
  'lang.fields.translateHint': 'Then we can pair people who don’t share a language. PorchLight translates a message only when someone asks it to.',
  'lang.fields.option': '{language} ({own})',

  'lang.level.native': 'native',
  'lang.level.fluent': 'fluent',
  'lang.level.conversational': 'conversational',
  'lang.level.learning': 'learning',
  'lang.levelOption.native': 'Native (first language)',
  'lang.levelOption.fluent': 'Fluent',
  'lang.levelOption.conversational': 'Conversational (can chat)',
  'lang.levelOption.learning': 'Learning',

  'lang.error.none': 'Choose at least one language.',
  'lang.error.tooMany': 'Choose up to 3 languages.',
  'lang.error.duplicate': 'Each language can only be listed once.',
  'lang.error.unknown': 'Choose a language from the list.',
  'lang.error.level': 'Choose how well they speak {language}.',

  // Showing languages (formatLanguages, profile pages)
  'lang.list.item': '{language} ({level})',
  'lang.profile.languages': 'Languages',
  'lang.profile.translateHelp': 'Uses translate help',

  // Matching (src/matching.js and the Match page)
  'lang.match.shared': 'Shared language: {language} ({senior} {seniorLevel}, {volunteer} {volunteerLevel})',
  'lang.match.translateHelp': 'No shared language: both use translate help',
  'lang.match.noShared': 'No shared language',
  'lang.match.pending': 'Waiting for coordinator approval',
  'lang.match.translateBadge': 'Uses translate help',
  'lang.match.howLanguage': 'They also need a language in common, unless both of them use translate help.',
  'lang.match.howPoints': '+{points} if they share a language and both can at least hold a conversation in it.',

  // Dates (src/views/html.js formatDateTime)
  'lang.date.dateAtTime': '{date} at {time}',
};
