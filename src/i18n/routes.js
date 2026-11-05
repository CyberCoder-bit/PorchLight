// POST /prefs/language: the language picker's form (v2).
// createApp() calls registerI18n() before registerRoles(),
// and the /prefs/* access row lets everyone use it.
//
// The choice is checked against the shipped languages and kept in the `lang`
// cookie for a year. For a signed-in person it is also saved as `uiLanguage`
// on their account, so it follows them to other devices. Then they go back
// to the page they were on (only a path on this site, through safeBack).

import { canonicalCode } from './languages.js';
import { LANG_COOKIE } from './negotiate.js';

export const LANG_COOKIE_SECONDS = 60 * 60 * 24 * 365;

export function registerI18n(router, ctx) {
  const { store, str, safeBack } = ctx;
  router.post('/prefs/language', (req, res) => {
    const code = canonicalCode(str(req.body.lang));
    if (code) {
      res.setCookie(LANG_COOKIE, code, LANG_COOKIE_SECONDS);
      const user = req.viewer?.userId && typeof store.user === 'function' ? store.user(req.viewer.userId) : null;
      if (user && user.uiLanguage !== code) {
        user.uiLanguage = code;
        store.save();
      }
    }
    res.redirect(safeBack(req.body.back) || '/');
  });
}
