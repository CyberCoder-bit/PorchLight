// MOCK translation: offline, no AI (v2).
//
// Only two kinds of text can be translated without AI:
//   - the demo messages, whose translations were written ahead of time (./demo.js)
//   - a phrase from the phrase card, typed exactly (./phrases.js)
// Anything else returns null, and the page says "Translation needs AI mode".
//
// Conversation sparks from the built-in ideas are interface text too: each
// template has a translate.spark.* key (src/sparks/templates.js), so a spark
// can be shown in the senior's language once that catalog is written.

import { demoTranslation } from './demo.js';
import { phraseMatch, phraseIn } from './phrases.js';
import { tIn } from '../i18n/index.js';
import { SPARK_TEMPLATE_KEYS, GAP_PHRASE_KEYS } from '../sparks/templates.js';
import { gapPhrase } from '../sparks/mock.js';

export function mockTranslate({ text, from, to }) {
  const demo = demoTranslation(text, from, to);
  if (demo) return { text: demo, source: 'demo' };
  const phrase = phraseMatch(text, from, to);
  if (phrase) return { text: phrase, source: 'phrase' };
  return null;
}

const fill = (template, vars) => template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');

// Which template made this English spark text? vars: { name, town, daysSince }.
export function sparkTemplateKey(text, { name, town, daysSince }) {
  const gap = daysSince != null ? gapPhrase(daysSince) : '';
  const vars = { name, town, gap };
  const found = SPARK_TEMPLATE_KEYS.find(([, template]) => fill(template, vars) === text);
  return found ? { key: found[0], gap } : null;
}

// A spark in `lang`: the LIVE spark's own translation, the English text for
// 'en', or the built-in template in that language's catalog. Null when that
// language has no version yet (never English posing as another language).
export function sparkTextIn(spark, lang, vars) {
  if (spark?.translations && typeof spark.translations[lang] === 'string' && spark.translations[lang].trim()) return spark.translations[lang];
  if (lang === 'en') return spark.text;
  const found = sparkTemplateKey(spark.text, vars);
  if (!found || !phraseIn(lang, found.key)) return null;
  let gap = '';
  if (found.gap) {
    const gapKey = GAP_PHRASE_KEYS[found.gap];
    if (!gapKey || !phraseIn(lang, gapKey)) return null;
    gap = tIn(lang, gapKey);
  }
  return tIn(lang, found.key, { name: vars.name, town: vars.town, gap });
}
