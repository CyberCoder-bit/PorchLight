// Reusable, accessible UI pieces: status badges, form fields, and checkbox groups.
//
// Accessibility rules followed throughout:
//   - every input has a visible <label>
//   - groups of checkboxes and radios use <fieldset> + <legend>
//   - errors are written in text, linked from an error summary, and tied to
//     the field with aria-describedby and aria-invalid
//   - status is shown with an icon AND words, never color alone

import { html } from './html.js';
import { INTERESTS, DAYS, PERIODS, CONTACT_METHODS, interestLabel, methodLabel, slotLabel } from '../vocab.js';

export function statusBadge(status, info) {
  return html`<span class="badge badge-${status}"><span class="badge-icon" aria-hidden="true">${info.icon}</span> ${info.label}</span>`;
}

export function trendBadge(trend) {
  if (!trend.dropping) return '';
  return html`<span class="badge badge-dropping"><span class="badge-icon" aria-hidden="true">↓</span> Contact dropping</span>`;
}

export function chips(ids, labelFn = interestLabel) {
  if (!ids || !ids.length) return html`<p class="muted">None listed</p>`;
  return html`<ul class="chips">${ids.map((id) => html`<li>${labelFn(id)}</li>`)}</ul>`;
}

export function slotList(ids) {
  if (!ids || !ids.length) return html`<p class="muted">No times listed</p>`;
  // Group by day: "Monday: morning, afternoon"
  const byDay = DAYS.map((d) => ({
    day: d,
    periods: PERIODS.filter((p) => ids.includes(`${d.id}-${p.id}`)),
  })).filter((g) => g.periods.length);
  return html`<ul class="slot-list">${byDay.map(
    (g) => html`<li><strong>${g.day.label}:</strong> ${g.periods.map((p) => `${p.label.toLowerCase()} (${p.hours})`).join(', ')}</li>`
  )}</ul>`;
}

export { slotLabel, methodLabel };

export function errorSummary(errors) {
  const entries = Object.entries(errors || {});
  if (!entries.length) return '';
  return html`
    <div class="error-summary" role="alert" tabindex="-1" id="error-summary" aria-labelledby="error-summary-title">
      <h2 id="error-summary-title">Please fix ${entries.length === 1 ? 'this problem' : `these ${entries.length} problems`}</h2>
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
      <label for="field-${name}">${label}${required ? html` <span class="required">(required)</span>` : ''}</label>
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
      <label for="field-${name}">${label}${required ? html` <span class="required">(required)</span>` : ''}</label>
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
    legend: 'Interests and hobbies',
    hint: 'Choose all that apply. These drive matching and conversation sparks.',
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
    legend: 'Preferred way to connect',
    error,
    type: 'radio',
    choices: CONTACT_METHODS,
    selected,
  });
}

export function methodCheckboxes(selected, error) {
  return choiceGroup({
    name: 'contactMethods',
    legend: 'Ways you can connect',
    hint: 'Choose all that apply.',
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
    <fieldset class="availability${error ? ' has-error' : ''}" id="field-availability" tabindex="-1"${describedBy('availability', 'Pick every time block that usually works.', error)}>
      <legend>Weekly availability</legend>
      ${fieldMessages('availability', 'Pick every time block that usually works.', error)}
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
