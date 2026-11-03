// Calls & Visits: schedule a future call/visit, log one that happened, and
// mark scheduled ones as completed or missed.

import { html, formatDateTime, formatDate } from '../html.js';
import { errorSummary, textField, textArea, selectField, methodLabel } from '../components.js';
import { CONTACT_METHODS } from '../../vocab.js';

export function contactsPage({ pairs, form, errors = {}, upcoming, overdue, recent }) {
  const pairOptions = [
    { value: '', label: 'Choose a senior and companion…' },
    ...pairs.map((p) => ({ value: p.match.id, label: `${p.senior.name} with ${p.volunteer.name}` })),
  ];
  const typeOptions = CONTACT_METHODS.map((m) => ({ value: m.id, label: m.label }));
  const action = form.action || 'schedule';

  return html`
    <h1>Calls &amp; visits</h1>
    <p class="lead">Volunteers schedule their next call or visit here and log the ones that happened. Every entry is saved with a timestamp, and the Family Dashboard updates right away.</p>

    ${overdue.length
      ? html`
        <section class="panel notice-panel" aria-labelledby="overdue-heading">
          <h2 id="overdue-heading">Did these happen?</h2>
          <p>These were scheduled in the past. Mark each one so the dashboard stays accurate.</p>
          <ul class="contact-list">${overdue.map((c) => contactItem(c))}</ul>
        </section>`
      : ''}

    <div class="two-col">
      <section class="panel" aria-labelledby="form-heading">
        <h2 id="form-heading">Schedule or log a call</h2>
        ${errorSummary(errors)}
        ${pairs.length === 0
          ? html`<p>There are no active matches yet. <a href="/match">Match a senior with a companion</a> first.</p>`
          : html`
          <form method="post" action="/contacts" class="stack-form" novalidate>
            ${selectField({ name: 'matchId', label: 'Who is this for?', options: pairOptions, value: form.matchId, error: errors.matchId, required: true })}
            <fieldset class="choice-group" id="field-action" tabindex="-1">
              <legend>What would you like to do?</legend>
              <div class="choices">
                <div class="choice">
                  <input type="radio" id="action-schedule" name="action" value="schedule"${action === 'schedule' ? html` checked` : ''}>
                  <label for="action-schedule">Schedule a future call or visit</label>
                </div>
                <div class="choice">
                  <input type="radio" id="action-log" name="action" value="log"${action === 'log' ? html` checked` : ''}>
                  <label for="action-log">Log one that already happened</label>
                </div>
              </div>
            </fieldset>
            ${selectField({ name: 'type', label: 'Type', options: typeOptions, value: form.type || 'phone', error: errors.type })}
            <div class="field-row">
              ${textField({ name: 'date', label: 'Date', type: 'date', value: form.date, error: errors.date, required: true })}
              ${textField({ name: 'time', label: 'Time', type: 'time', value: form.time, error: errors.time, required: true })}
            </div>
            ${textField({ name: 'durationMinutes', label: 'How long was it? (minutes, for logged calls)', type: 'number', value: form.durationMinutes, error: errors.durationMinutes, attrs: 'inputmode="numeric" min="1" max="480"' })}
            ${textArea({ name: 'notes', label: 'Notes (optional)', value: form.notes, error: errors.notes, rows: 3, hint: 'Something to remember for next time, like "Ask how the choir concert went." Notes are never sent to the AI.' })}
            <div class="form-actions"><button type="submit" class="button">Save</button></div>
          </form>`}
      </section>

      <section class="panel" aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading">Coming up (${upcoming.length})</h2>
        ${upcoming.length ? html`<ul class="contact-list">${upcoming.map((c) => contactItem(c))}</ul>` : html`<p class="muted">Nothing scheduled.</p>`}
      </section>
    </div>

    <section class="panel" aria-labelledby="recent-heading">
      <h2 id="recent-heading">Recent activity</h2>
      ${recent.length
        ? html`
        <div class="table-wrap">
          <table class="data-table">
            <caption class="visually-hidden">The 15 most recent calls and visits</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Senior</th><th scope="col">Companion</th><th scope="col">Type</th><th scope="col">Result</th><th scope="col">Recorded</th></tr></thead>
            <tbody>
              ${recent.map(
                (c) => html`<tr>
                  <td>${formatDate(c.completedAt || c.scheduledFor)}</td>
                  <td><a href="/seniors/${c.senior.id}">${c.senior.name}</a></td>
                  <td>${c.volunteer ? c.volunteer.name : 'Unknown'}</td>
                  <td>${methodLabel(c.type)}</td>
                  <td>${c.status === 'missed' ? html`<span class="badge badge-missed">Missed</span>` : html`Completed${c.durationMinutes ? ` (${c.durationMinutes} min)` : ''}`}</td>
                  <td class="muted small">${formatDateTime(c.createdAt)}</td>
                </tr>`
              )}
            </tbody>
          </table>
        </div>`
        : html`<p class="muted">No calls or visits yet.</p>`}
    </section>`;
}

function contactItem(c) {
  return html`
    <li class="contact-item">
      <p><strong>${formatDateTime(c.scheduledFor)}</strong></p>
      <p>${methodLabel(c.type)}: <a href="/seniors/${c.senior.id}">${c.senior.name}</a> with ${c.volunteer ? c.volunteer.name : 'unknown volunteer'}</p>
      ${c.notes ? html`<p class="muted">${c.notes}</p>` : ''}
      <div class="actions">
        <form method="post" action="/contacts/${c.id}/complete" class="inline-form">
          <button type="submit" class="button button-small">Mark completed<span class="visually-hidden"> for ${c.senior.name} on ${formatDate(c.scheduledFor)}</span></button>
        </form>
        <form method="post" action="/contacts/${c.id}/missed" class="inline-form">
          <button type="submit" class="button button-secondary button-small">Mark missed<span class="visually-hidden"> for ${c.senior.name} on ${formatDate(c.scheduledFor)}</span></button>
        </form>
      </div>
    </li>`;
}
