// Reusable, accessible UI pieces: status badges, form fields, and checkbox groups.
//
// Accessibility rules followed throughout:
//   - every input has a visible <label>
//   - groups of checkboxes and radios use <fieldset> + <legend>
//   - errors are written in text, linked from an error summary, and tied to
//     the field with aria-describedby and aria-invalid
//   - status is shown with an icon AND words, never color alone

import { html, raw } from './html.js';
import { t, lowerInText } from '../i18n/index.js'; // [v2 i18n]
import { INTERESTS, DAYS, PERIODS, CONTACT_METHODS, interestLabel, methodLabel, slotLabel } from '../vocab.js';

// [v2 i18n] tx(): t() for text that sits in the page as written in the
// template. The catalog text is plain: &, < and > are escaped, quotes stay as
// they are (as they did when the words were in the template). Each {variable}
// is filled with html`` rules: escaped text, or SafeHtml such as a link, so a
// sentence can hold a link that translators can move.
//   tx('core.x.sentence', { link: html`<a href="/x">${t('core.x.link')}</a>`, name })
const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function tx(key, vars) {
  if (!vars) return raw(escapeText(t(key)));
  const slots = Object.fromEntries(Object.keys(vars).map((name) => [name, `\u0001${name}\u0002`]));
  return raw(escapeText(t(key, slots)).replace(/\u0001(\w+)\u0002/g, (whole, name) => String(html`${vars[name]}`)));
}

// [v2 i18n] Plurals: one of two keys, "<key>.one" or "<key>.other", by the count.
//   t(many(n, 'core.home.tile.seniors'), { n })
export const many = (n, key) => `${key}.${n === 1 ? 'one' : 'other'}`;

export function statusBadge(status, info) {
  return html`<span class="badge badge-${status}"><span class="badge-icon" aria-hidden="true">${info.icon}</span> ${info.label}</span>`;
}

export function trendBadge(trend) {
  if (!trend.dropping) return '';
  return html`<span class="badge badge-dropping"><span class="badge-icon" aria-hidden="true">↓</span> ${tx('core.components.contactDropping')}</span>`;
}

export function chips(ids, labelFn = interestLabel) {
  if (!ids || !ids.length) return html`<p class="muted">${tx('core.components.noneListed')}</p>`;
  return html`<ul class="chips">${ids.map((id) => html`<li>${labelFn(id)}</li>`)}</ul>`;
}

export function slotList(ids) {
  if (!ids || !ids.length) return html`<p class="muted">${tx('core.components.noTimesListed')}</p>`;
  // Group by day: "Monday: morning, afternoon"
  const byDay = DAYS.map((d) => ({
    day: d,
    periods: PERIODS.filter((p) => ids.includes(`${d.id}-${p.id}`)),
  })).filter((g) => g.periods.length);
  return html`<ul class="slot-list">${byDay.map(
    (g) => html`<li><strong>${g.day.label}:</strong> ${g.periods.map((p) => `${lowerInText(p.label)} (${p.hours})`).join(', ')}</li>`
  )}</ul>`;
}

export { slotLabel, methodLabel };

// Where a saved set of conversation sparks came from, in plain words. One
// label everywhere sparks are shown (the senior's profile and My week).
export function sparkSourceLabel(set) {
  if (set.mode === 'live') return t('core.components.sparkSource.live', { model: set.model });
  if (set.mode === 'mock-fallback') return t('core.components.sparkSource.fallback');
  return t('core.components.sparkSource.offline');
}

// ---------- feedback banner ----------
// One pattern for all four kinds of feedback. Each banner has an icon, a word,
// and a color, so meaning never depends on color alone.
//   status  (role="status")  ℹ Note
//   success (role="status")  ✓ Done
//   warning (role="status")  ⚠ Heads up
//   error   (role="alert")   ✕ Problem
// Forms with errors keep their own focusable error summary (errorSummary below).
// U+FE0E asks for the plain text symbol, not a color emoji.
// [v2 i18n] `word` is read in the reader's language each time.
export const BANNER_KINDS = {
  status: { icon: 'ℹ︎', get word() { return t('core.components.banner.status'); } },
  success: { icon: '✓', get word() { return t('core.components.banner.success'); } },
  warning: { icon: '⚠︎', get word() { return t('core.components.banner.warning'); } },
  error: { icon: '✕', get word() { return t('core.components.banner.error'); } },
};

export function banner({ kind = 'status', text, body, next, word, role, extraClass = '' }) {
  const k = BANNER_KINDS[kind] ? kind : 'status';
  const spec = BANNER_KINDS[k];
  const label = word ?? spec.word;
  let message = text;
  // Don't say "Heads up: Heads up: ..." when the message already starts with the word.
  if (typeof message === 'string' && message.toLowerCase().startsWith(`${label.toLowerCase()}:`)) {
    message = message.slice(label.length + 1).trimStart();
  }
  return html`
    <div class="banner banner-${k}${extraClass ? ` ${extraClass}` : ''}" role="${role || (k === 'error' ? 'alert' : 'status')}">
      <span class="banner-icon" aria-hidden="true">${spec.icon}</span>
      <div class="banner-body">
        ${message !== undefined && message !== null ? html`<p><strong class="banner-word">${label}:</strong> ${message}</p>` : ''}
        ${body || ''}
        ${next ? html`<p><a href="${next.href}">${next.label} <span aria-hidden="true">→</span></a></p>` : ''}
      </div>
    </div>`;
}

// "How do I get out?" A plain link back to the parent page, shown above the h1.
export function backLink(href, label) {
  return html`<p class="back-link"><a href="${href}"><span aria-hidden="true">←</span> ${tx('core.components.backTo', { place: label })}</a></p>`;
}

// What an empty list says: what it means, and what to do next.
export function emptyState(content) {
  return html`<div class="empty-state">${content}</div>`;
}

export function errorSummary(errors) {
  const entries = Object.entries(errors || {});
  if (!entries.length) return '';
  return html`
    <div class="error-summary" role="alert" tabindex="-1" id="error-summary" aria-labelledby="error-summary-title">
      <h2 id="error-summary-title"><span aria-hidden="true">✕</span> ${tx(entries.length === 1 ? 'core.components.fixProblems.one' : 'core.components.fixProblems.other', { n: entries.length })}</h2>
      <ul>${entries.map(([field, message]) => html`<li><a href="#field-${field}">${message}</a></li>`)}</ul>
    </div>`;
}

function describedBy(name, hint, error) {
  const ids = [];
  if (hint) ids.push(`hint-${name}`);
  if (error) ids.push(`error-${name}`);
  return ids.length ? html` aria-describedby="${ids.join(' ')}"` : '';
}

function fieldMessages(name, hint, error) {
  return html`${hint ? html`<p class="hint" id="hint-${name}">${hint}</p>` : ''}${
    error ? html`<p class="field-error" id="error-${name}"><span aria-hidden="true">⚠ </span>${error}</p>` : ''
  }`;
}

export function textField({ name, label, value = '', error, hint, type = 'text', required = false, autocomplete, attrs = '' }) {
  return html`
    <div class="field${error ? ' has-error' : ''}">
      <label for="field-${name}">${label}${required ? html` <span class="required">${tx('core.components.required')}</span>` : ''}</label>
      ${fieldMessages(name, hint, error)}
      <input id="field-${name}" name="${name}" type="${type}" value="${value ?? ''}"
        ${required ? html`required` : ''} ${autocomplete ? html`autocomplete="${autocomplete}"` : ''}
        ${error ? html`aria-invalid="true"` : ''}${describedBy(name, hint, error)} ${attrs}>
    </div>`;
}

export function textArea({ name, label, value = '', error, hint, rows = 4 }) {
  return html`
    <div class="field${error ? ' has-error' : ''}">
      <label for="field-${name}">${label}</label>
      ${fieldMessages(name, hint, error)}
      <textarea id="field-${name}" name="${name}" rows="${rows}"
        ${error ? html`aria-invalid="true"` : ''}${describedBy(name, hint, error)}>${value ?? ''}</textarea>
    </div>`;
}

export function selectField({ name, label, options, value, error, hint, required = false }) {
  return html`
    <div class="field${error ? ' has-error' : ''}">
      <label for="field-${name}">${label}${required ? html` <span class="required">${tx('core.components.required')}</span>` : ''}</label>
      ${fieldMessages(name, hint, error)}
      <select id="field-${name}" name="${name}" ${required ? html`required` : ''}
        ${error ? html`aria-invalid="true"` : ''}${describedBy(name, hint, error)}>
        ${options.map((o) => html`<option value="${o.value}"${String(o.value) === String(value) ? html` selected` : ''}>${o.label}</option>`)}
      </select>
    </div>`;
}

// A <fieldset> of checkboxes or radios.
function choiceGroup({ name, legend, hint, error, type, choices, selected = [], columns = false }) {
  const sel = Array.isArray(selected) ? selected : [selected];
  return html`
    <fieldset class="choice-group${error ? ' has-error' : ''}" id="field-${name}" tabindex="-1"${describedBy(name, hint, error)}>
      <legend>${legend}</legend>
      ${fieldMessages(name, hint, error)}
      <div class="choices${columns ? ' choices-columns' : ''}">
        ${choices.map(
          (c) => html`
          <div class="choice">
            <input type="${type}" id="${name}-${c.id}" name="${name}" value="${c.id}"${sel.includes(c.id) ? html` checked` : ''}>
            <label for="${name}-${c.id}">${c.label}</label>
          </div>`
        )}
      </div>
    </fieldset>`;
}

export function interestCheckboxes(selected, error) {
  return choiceGroup({
    name: 'interests',
    legend: t('core.components.interests.legend'),
    hint: t('core.components.interests.hint'),
    error,
    type: 'checkbox',
    choices: INTERESTS,
    selected,
    columns: true,
  });
}

export function methodRadios(selected, error) {
  return choiceGroup({
    name: 'contactMethod',
    legend: t('core.components.methodRadios.legend'),
    error,
    type: 'radio',
    choices: CONTACT_METHODS,
    selected,
  });
}

export function methodCheckboxes(selected, error) {
  return choiceGroup({
    name: 'contactMethods',
    legend: t('core.components.methodCheckboxes.legend'),
    hint: t('core.components.methodCheckboxes.hint'),
    error,
    type: 'checkbox',
    choices: CONTACT_METHODS,
    selected,
  });
}

// Weekly availability: one small fieldset per day, so a screen reader announces
// "Monday, group, Morning 9 AM–noon, checkbox".
export function availabilityFieldset(selected = [], error) {
  return html`
    <fieldset class="availability${error ? ' has-error' : ''}" id="field-availability" tabindex="-1"${describedBy('availability', t('core.components.availability.hint'), error)}>
      <legend>${tx('core.components.availability.legend')}</legend>
      ${fieldMessages('availability', t('core.components.availability.hint'), error)}
      <div class="availability-grid">
        ${DAYS.map(
          (d) => html`
          <fieldset class="day">
            <legend>${d.label}</legend>
            ${PERIODS.map((p) => {
              const id = `${d.id}-${p.id}`;
              return html`
              <div class="choice">
                <input type="checkbox" id="slot-${id}" name="availability" value="${id}"${selected.includes(id) ? html` checked` : ''}>
                <label for="slot-${id}">${p.label} <span class="hours">${p.hours}</span></label>
              </div>`;
            })}
          </fieldset>`
        )}
      </div>
    </fieldset>`;
}
