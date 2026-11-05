// The language picker in the page header (v2).
//
// A native <details> disclosure, like the Accessibility menu: it opens and
// closes with a click, Enter, or Space, with no JavaScript. Inside is one
// small POST form (/prefs/language, see ./routes.js) with a button per
// shipped language. Each button shows the language's own name, marked with
// its own lang and dir, so a screen reader says "Español" in Spanish and
// someone who can't read the current language can still find theirs. The
// current one has aria-pressed="true".
//
// The summary says "Language" in the current language plus, as a way back,
// the same word in one other language: Spanish on English pages ("Language /
// Idioma") and English everywhere else ("Idioma / Language").

import { html, raw } from '../views/html.js';
import { prefsReturnPath } from '../views/layout.js';
import { t, tIn, currentLang, DEFAULT_LANG } from './index.js';
import { UI_LANGUAGES } from './languages.js';

const GLOBE =
  '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2.5 12h19M12 2.5c2.6 2.7 3.9 5.9 3.9 9.5s-1.3 6.8-3.9 9.5c-2.6-2.7-3.9-5.9-3.9-9.5S9.4 5.2 12 2.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>';
const globe = raw(`<svg class="a11y-icon lang-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">${GLOBE}</svg>`);

function summaryText(lang) {
  const second = lang === DEFAULT_LANG ? UI_LANGUAGES.find((l) => l.code === 'es') : UI_LANGUAGES.find((l) => l.code === DEFAULT_LANG);
  const word = t('lang.picker.summary');
  if (!second) return html`<span class="a11y-summary-text lang-summary-text">${word}</span>`;
  return html`<span class="a11y-summary-text lang-summary-text">${word} / <span lang="${second.code}">${tIn(second.code, 'lang.picker.summary')}</span></span>`;
}

export function languagePicker(req) {
  if (UI_LANGUAGES.length < 2) return '';
  const lang = currentLang();
  const back = prefsReturnPath(req);
  return html`
      <details class="lang-menu">
        <summary class="a11y-summary lang-summary">${globe}${summaryText(lang)}</summary>
        <div class="a11y-panel lang-panel">
          <form class="pref-language" method="post" action="/prefs/language">
            <input type="hidden" name="back" value="${back}">
            <fieldset class="pref-group">
              <legend class="pref-legend">${t('lang.picker.legend')}</legend>
              <div class="pref-options">
                ${UI_LANGUAGES.map((l) => {
                  const pressed = l.code === lang;
                  return html`<button type="submit" name="lang" value="${l.code}" aria-pressed="${pressed ? 'true' : 'false'}" class="pref-option pref-language-${l.code}"><span class="pref-word" lang="${l.code}" dir="${l.dir}">${l.name}</span>${pressed ? html`<span class="pref-check" aria-hidden="true">✓</span>` : ''}</button>`;
                })}
              </div>
            </fieldset>
          </form>
          <p class="a11y-intro">${t('lang.picker.saved')} ${t('lang.picker.machine')}</p>
        </div>
      </details>`;
}
