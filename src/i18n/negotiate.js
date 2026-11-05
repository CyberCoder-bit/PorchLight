// Which language should this request use? (v2)
// Order: the person's profile (set later by the sign-in guard with
// setCurrentLang), then the `lang` cookie, then the browser's Accept-Language,
// then English.

import { isUiLanguage, DEFAULT_LANG } from './index.js';

export const LANG_COOKIE = 'lang';

export function languageFromRequest({ cookies = {}, acceptLanguage = '' } = {}) {
  if (isUiLanguage(cookies[LANG_COOKIE])) return cookies[LANG_COOKIE];
  for (const part of String(acceptLanguage).split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase();
    if (!tag) continue;
    if (isUiLanguage(tag)) return tag;
    const base = tag.split('-')[0];
    if (isUiLanguage(base)) return base;
  }
  return DEFAULT_LANG;
}
