// Which language should this request use? (v2)
// Order: the person's profile (set later by the sign-in guard with
// setCurrentLang), then the `lang` cookie, then the browser's Accept-Language,
// then English. Only shipped interface languages are ever chosen.

import { DEFAULT_LANG } from './index.js';
import { canonicalCode } from './languages.js';

export const LANG_COOKIE = 'lang';

// Browser tags that mean one of our codes. Chinese: Simplified is written in
// mainland China and Singapore. Traditional (zh-TW, zh-HK, zh-Hant) is a
// different script, so those readers get English instead of the wrong one.
const ALIASES = { zh: 'zh-Hans', 'zh-cn': 'zh-Hans', 'zh-sg': 'zh-Hans', 'zh-hans-cn': 'zh-Hans' };
const TRADITIONAL = /^zh-(?:hant|tw|hk|mo)\b/;

function fromTag(raw) {
  const tag = raw.toLowerCase();
  if (TRADITIONAL.test(tag)) return null;
  const base = tag.split('-')[0];
  return canonicalCode(tag) || canonicalCode(ALIASES[tag] || '') || canonicalCode(base) || canonicalCode(ALIASES[base] || '');
}

// "es-MX,es;q=0.9,en;q=0.8" -> ['es-MX', 'es', 'en'], highest q first.
// q=0 means "not this one". Ties keep the browser's order.
function rankedTags(header) {
  return String(header)
    .split(',')
    .slice(0, 20) // a real browser sends a handful; ignore the rest of a giant header
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim(), weight: Number.isFinite(weight) ? weight : 0, i };
    })
    .filter((x) => x.tag && x.tag !== '*' && x.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.i - b.i)
    .map((x) => x.tag);
}

export function languageFromRequest({ cookies = {}, acceptLanguage = '' } = {}) {
  const fromCookie = canonicalCode(cookies[LANG_COOKIE]);
  if (fromCookie) return fromCookie;
  for (const tag of rankedTags(acceptLanguage)) {
    const code = fromTag(tag);
    if (code) return code;
  }
  return DEFAULT_LANG;
}
