// Spoken-language fields for profiles (v2).
// Accounts (sign-up, /account) and the admin senior/volunteer forms call
// these, so the signatures are fixed:
//
//   languageFieldset({ values, errors, legend })  -> html for the form
//       values: { languages: [{ code, level }], translateHelp }
//   readLanguages(body) -> { languages, translateHelp, errors, present }
//       errors are keyed by field name, like the other validators.
//       `present` is false when the form had no language fields at all (an
//       older form), so a caller can keep what is saved.
//   formatLanguages(person) -> "English (native), Spanish (fluent)" in the reader's language
//   languagesOf(person) -> person.languages, or [{ code: 'en', level: 'native' }] for old data
//
// The form fields: lang1/level1, lang2/level2, lang3/level3 (one row each),
// and translateHelp (a checkbox, value "yes"). It works with no JavaScript.

import { html } from '../views/html.js';
import { t, currentLang } from './index.js';
import { localeOf } from './languages.js';
import { SPOKEN_LANGUAGES, LEVELS, isSpokenLanguage, isLevel, languageName, spokenLanguage } from './spoken.js';

export const DEFAULT_LANGUAGES = Object.freeze([{ code: 'en', level: 'native' }]);
export const MAX_LANGUAGES = 3;
const ROWS = Array.from({ length: MAX_LANGUAGES }, (_, i) => i + 1);

export function languagesOf(person) {
  return Array.isArray(person?.languages) && person.languages.length ? person.languages : DEFAULT_LANGUAGES;
}

const one = (v) => (typeof v === 'string' ? v.trim() : Array.isArray(v) ? String(v[0] ?? '').trim() : '');

// The same error look as src/views/components.js (field-error, aria-invalid).
const fieldError = (id, error) =>
  error ? html`<p class="field-error" id="error-${id}"><span aria-hidden="true">⚠ </span>${error}</p>` : '';

function languageOptions(selected, first) {
  return html`<option value=""${selected ? '' : html` selected`}>${first}</option>
          ${SPOKEN_LANGUAGES.map((l) => {
            const shown = languageName(l.code);
            const text = shown === l.name ? shown : t('lang.fields.option', { language: shown, own: l.name });
            return html`<option value="${l.code}"${l.code === selected ? html` selected` : ''}>${text}</option>`;
          })}`;
}

function levelOptions(selected) {
  return html`<option value=""${selected ? '' : html` selected`}>${t('lang.fields.chooseLevel')}</option>
          ${LEVELS.map((level) => html`<option value="${level}"${level === selected ? html` selected` : ''}>${t(`lang.levelOption.${level}`)}</option>`)}`;
}

function row(n, value = {}, errors) {
  const langId = `lang${n}`;
  const levelId = `level${n}`;
  const langError = errors[langId];
  const levelError = errors[levelId];
  return html`
      <div class="language-row">
        <div class="field${langError ? ' has-error' : ''}">
          <label for="field-${langId}">${t('lang.fields.language', { n })}</label>
          ${fieldError(langId, langError)}
          <select id="field-${langId}" name="${langId}"${langError ? html` aria-invalid="true" aria-describedby="error-${langId}"` : ''}>
          ${languageOptions(value.code, n === 1 ? t('lang.fields.choose') : t('lang.fields.none'))}
          </select>
        </div>
        <div class="field${levelError ? ' has-error' : ''}">
          <label for="field-${levelId}">${t('lang.fields.level', { n })}</label>
          ${fieldError(levelId, levelError)}
          <select id="field-${levelId}" name="${levelId}"${levelError ? html` aria-invalid="true" aria-describedby="error-${levelId}"` : ''}>
          ${levelOptions(value.level)}
          </select>
        </div>
      </div>`;
}

// `values.languages` undefined (a new, empty form) starts with English, native.
export function languageFieldset({ values = {}, errors = {}, legend } = {}) {
  const rows = Array.isArray(values.languages) ? values.languages : languagesOf(values);
  const groupError = errors.languages;
  return html`
    <fieldset class="choice-group language-fieldset${groupError ? ' has-error' : ''}" id="field-languages" tabindex="-1" aria-describedby="hint-languages${groupError ? ' error-languages' : ''}">
      <legend>${legend || t('lang.fields.legend')}</legend>
      <p class="hint" id="hint-languages">${t('lang.fields.hint')}</p>
      ${fieldError('languages', groupError)}
      ${ROWS.map((n) => row(n, rows[n - 1], errors))}
      <div class="choice">
        <input type="checkbox" id="field-translateHelp" name="translateHelp" value="yes"${values.translateHelp ? html` checked` : ''} aria-describedby="hint-translateHelp">
        <label for="field-translateHelp">${t('lang.fields.translateHelp')}</label>
      </div>
      <p class="hint" id="hint-translateHelp">${t('lang.fields.translateHint')}</p>
    </fieldset>`;
}

export function readLanguages(body = {}) {
  const errors = {};
  const present = ROWS.some((n) => body[`lang${n}`] !== undefined);
  const translateHelp = one(body.translateHelp) === 'yes' || one(body.translateHelp) === 'on';
  if (!present) return { languages: [...DEFAULT_LANGUAGES], translateHelp, errors, present };

  const languages = [];
  const seen = new Set();
  for (const n of ROWS) {
    const code = one(body[`lang${n}`]);
    const level = one(body[`level${n}`]);
    if (!code) continue; // an empty row ("None") is fine, whatever its level says
    if (!isSpokenLanguage(code)) {
      errors[`lang${n}`] = t('lang.error.unknown');
      continue;
    }
    if (seen.has(code)) {
      errors.languages = t('lang.error.duplicate');
      continue;
    }
    seen.add(code);
    if (!isLevel(level)) errors[`level${n}`] = t('lang.error.level', { language: languageName(code) });
    languages.push({ code, level: isLevel(level) ? level : '' });
  }
  // Any extra rows a hand-made form sends (lang4, ...) are counted, never saved.
  const extra = Object.keys(body).filter((k) => /^lang\d+$/.test(k) && Number(k.slice(4)) > MAX_LANGUAGES && one(body[k]));
  if (extra.length) errors.languages = t('lang.error.tooMany');
  if (!languages.length && !Object.keys(errors).length) errors.languages = t('lang.error.none');
  return { languages, translateHelp, errors, present };
}

// "English (native), Spanish (fluent)", in the reader's language.
export function formatLanguages(person) {
  const items = languagesOf(person)
    .filter((l) => spokenLanguage(l.code))
    .map((l) => t('lang.list.item', { language: languageName(l.code), level: isLevel(l.level) ? t(`lang.level.${l.level}`) : '' }).replace(' ()', ''));
  try {
    return new Intl.ListFormat(localeOf(currentLang()), { type: 'unit', style: 'short' }).format(items);
  } catch {
    return items.join(', ');
  }
}
