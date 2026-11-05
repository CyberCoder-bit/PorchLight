// LIVE_MODE: real conversation sparks from Gemini (Google's AI model), through
// the Gemini API (src/gemini.js). Without GEMINI_API_KEY, MOCK mode is used.
//
// PRIVACY: we send only what's needed to write good starters: the senior's
// preferred first name, interest labels, their "about me" text, days since
// last contact, and today's date and season. We never send caregiver
// details or volunteer call notes, and phone numbers or emails typed into
// "about me" are removed first (redactContactDetails below). [v2] When the
// senior's main language is not English, its name is sent too, so each
// starter also comes in that language.

import { interestLabelEn as interestLabel, methodLabelEn as methodLabel } from '../vocab.js'; // [v2 i18n] the prompt stays English
import { formatLocal } from '../tz.js';
import { COMMUNITY } from '../community.js';
import { englishName } from '../translate/phrases.js'; // [v2 translate] sparks in the senior's language
import { generateJson, LiveSparkError } from '../ai/index.js';

export { LiveSparkError };

// The system prompt names the community's town and state (src/community.js).
// Only the place name changes from town to town; nothing about the senior is
// added here.
export function systemPromptFor(community = COMMUNITY) {
  const { town, state } = community;
  return `You write conversation starters for PorchLight, a program in ${town}, ${state} that pairs older adults with volunteer companions (often high school students) for regular phone calls, video calls, and visits. A volunteer reads your starters right before a call.

Write exactly 3 conversation starters for the senior described in the user message.
- Starter 1 opens the call and fits how long it has been since the last contact: a warm follow-up if it was recent, an easy catch-up after about a week, or a glad-to-reconnect opener after a longer gap. A long gap must never make the senior feel guilty or neglected; the volunteer owns the gap. If there has been no contact yet, write a friendly first-conversation opener.
- Starters 2 and 3 each draw on a different interest or detail from the senior's profile. They can tie in the season or something local to ${town} when it fits naturally. Only mention a local place or event if you are sure it is real; otherwise keep it general.
- Each starter is one or two sentences, under 40 words, in the volunteer's voice, spoken out loud, and ends with an open-ended question.
- Be warm and respectful. Talk to the senior as an adult with a lifetime of experience, never in a childish or patronizing way.
- Do not bring up health, medications, money, grief, or loss unless the profile makes clear the senior wants to talk about it. Do not invent facts about the senior or their family.

For each starter, also give a short "based_on" label (under 8 words) naming what it draws on, for example "Interest: Gardening" or "12 days since last contact".`;
}

export const SYSTEM_PROMPT = systemPromptFor(COMMUNITY);

// JSON schema for structured output: the API's reply must match it.
export const SPARK_SCHEMA = {
  type: 'object',
  properties: {
    sparks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          based_on: { type: 'string' },
        },
        required: ['text', 'based_on'],
        additionalProperties: false,
      },
    },
  },
  required: ['sparks'],
  additionalProperties: false,
};

// [v2 translate] When the senior's main language is not English, each starter
// also comes in that language. The English fields stay the same as above.
export const BILINGUAL_SPARK_SCHEMA = {
  type: 'object',
  properties: {
    sparks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          based_on: { type: 'string' },
          text_senior_language: { type: 'string' },
        },
        required: ['text', 'based_on', 'text_senior_language'],
        additionalProperties: false,
      },
    },
  },
  required: ['sparks'],
  additionalProperties: false,
};

// The senior's main language as an English name, or null when it is English.
export function secondLanguageOf(input) {
  const code = input?.seniorLanguage;
  return code && code !== 'en' ? { code, name: englishName(code) } : null;
}

export function bilingualInstruction(languageName) {
  return `\n\nThe senior's main language is ${languageName}. Write "text" in English for the volunteer, and put the same starter in ${languageName} in "text_senior_language", so the volunteer can show or read it to the senior. Keep "based_on" in English.`;
}

// Phone numbers and email addresses that someone typed into "about me" are
// replaced before the text leaves PorchLight. The rest of the text is kept.
const EMAIL = /[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[A-Za-z]{2,}/g;
// Separators people use between digit groups: spaces, dots, slashes, and every kind of dash.
const SEP = '[\\s./\\-\\u2010-\\u2015\\u2212\\u00a0]';
const PHONE = new RegExp(`(?:\\+?1${SEP}*)?(?:\\(\\d{3}\\)|\\b\\d{3})${SEP}*\\d{3}${SEP}*\\d{4}\\b`, 'g'); // 317-555-0142, (317) 555-0142, +1 317 555 0142, 317/555/0142
const SHORT_PHONE = new RegExp(`\\b\\d{3}${SEP}\\d{4}\\b`, 'g'); // 555-0142
export const REDACTED = '[contact removed]';

export function redactContactDetails(text) {
  // NFKC turns fullwidth digits (\uFF13\uFF11\uFF17) into plain ones (317) so they are caught too.
  return String(text || '')
    .normalize('NFKC')
    .replace(EMAIL, REDACTED)
    .replace(PHONE, REDACTED)
    .replace(SHORT_PHONE, REDACTED);
}

export function buildUserMessage(input) {
  const today = formatLocal(input.now, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const aboutMe = redactContactDetails(input.aboutMe);
  const lastContact =
    input.daysSince == null
      ? 'No contact yet (this will be their first conversation)'
      : `${input.daysSince} day${input.daysSince === 1 ? '' : 's'} ago${input.lastContactType ? ` (${methodLabel(input.lastContactType).toLowerCase()})` : ''}`;
  return [
    `Today: ${today} (${input.season})`,
    `Senior's preferred name: ${input.name}`,
    `Interests: ${input.interests.map(interestLabel).join(', ') || 'none listed'}`,
    `About them: ${aboutMe || 'nothing else on file'}`,
    `Last contact with a PorchLight volunteer: ${lastContact}`,
    `Upcoming contact type: ${methodLabel(input.contactMethod)}`,
  ].join('\n');
}

/**
 * Ask the AI for 3 sparks. Resolves to { sparks: [{text, basedOn}], model, provider }.
 * Throws LiveSparkError (with a friendly .reason) on any failure; the caller
 * falls back to MOCK sparks so the volunteer is never left empty-handed.
 */
export async function generateLiveSparks(input, { apiKey, models, baseURL, workersAi = null, timeoutMs = 15000 }) {
  const second = secondLanguageOf(input); // [v2 translate]
  const { json, model, provider } = await generateJson({
    apiKey,
    models,
    baseURL,
    workersAi,
    timeoutMs,
    system: second ? SYSTEM_PROMPT + bilingualInstruction(second.name) : SYSTEM_PROMPT,
    user: buildUserMessage(input),
    schema: second ? BILINGUAL_SPARK_SCHEMA : SPARK_SCHEMA,
  });
  const sparks = (Array.isArray(json?.sparks) ? json.sparks : [])
    .filter((s) => s && typeof s.text === 'string' && s.text.trim())
    .slice(0, 3)
    .map((s) => {
      const spark = { text: s.text.trim(), basedOn: String(s.based_on || '').trim() || 'AI' };
      const other = second && typeof s.text_senior_language === 'string' ? s.text_senior_language.trim() : '';
      return other ? { ...spark, translations: { [second.code]: other } } : spark;
    });
  if (sparks.length < 3) throw new LiveSparkError('the response had fewer than 3 starters');
  return { sparks, model, provider };
}
