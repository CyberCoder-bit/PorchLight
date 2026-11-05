// MOCK translation: offline, no AI (v2).
//
// Only two kinds of text can be translated without AI:
//   - the demo messages, whose translations were written ahead of time (./demo.js)
//   - a phrase from the phrase card, typed exactly (./phrases.js)
// Anything else returns null, and the page says "Translation needs AI mode".

import { demoTranslation } from './demo.js';
import { phraseMatch } from './phrases.js';

export function mockTranslate({ text, from, to }) {
  const demo = demoTranslation(text, from, to);
  if (demo) return { text: demo, source: 'demo' };
  const phrase = phraseMatch(text, from, to);
  if (phrase) return { text: phrase, source: 'phrase' };
  return null;
}
