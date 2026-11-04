// Calls & Visits: schedule a future call/visit, log one that happened, and
// mark scheduled ones as completed or missed.

import { html, formatDateTime, formatDate, formatLongDate } from '../html.js';
import { errorSummary, textField, textArea, selectField, methodLabel, emptyState } from '../components.js';
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
    <p class="lead">Volunteers schedule their next call or visit here, and log the ones that already happened. Each one is saved with the date and time, and the Family Dashboard updates right away.</p>

    ${overdue.length
      ? html`
        <section class="panel notice-panel" aria-labelledby="overdue-heading">
          <h2 id="overdue-heading">Did these happen?</h2>
          <p>These were planned for a time that has passed. Mark each one as done or missed so the dashboard stays accurate.</p>
          <ul class="contact-list">${overdue.map((c) => contactItem(c))}</ul>
        </section>`
      : ''}

    <div class="two-col">
      <section class="panel" aria-labelledby="form-heading">
        <h2 id="form-heading">Schedule or log a call</h2>
        ${errorSummary(errors)}
        ${pairs.length === 0
          ? emptyState(html`<p><strong>No one is matched yet.</strong> <a href="/match">Match a senior with a companion</a> first, then come back to schedule their first call.</p>`)
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
            ${textField({ name: 'durationMinutes', label: 'How many minutes did it last? (only when logging one that happened)', type: 'number', value: form.durationMinutes, error: errors.durationMinutes, attrs: 'inputmode="numeric" min="1" max="480"' })}
            ${textArea({ name: 'notes', label: 'Notes (optional)', value: form.notes, error: errors.notes, rows: 3, hint: 'Something to remember for next time, like "Ask how the choir concert went." Notes show with the call in PorchLight, for example on the senior\'s profile. They are never put in the family summary or sent to the AI.' })}
            <div class="form-actions"><button type="submit" class="button">Save call or visit</button></div>
          </form>`}
      </section>

      <section class="panel" aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading">Coming up (${upcoming.length})</h2>
        ${upcoming.length
          ? html`<ul class="contact-list">${upcoming.map((c) => contactItem(c))}</ul>`
          : emptyState(html`<p><strong>Nothing scheduled yet.</strong> Use the form to schedule the next call or visit.</p>`)}
      </section>
    </div>

    <section class="panel" aria-labelledby="recent-heading">
      <h2 id="recent-heading">Recent activity</h2>
      ${recent.length
        ? html`
        <p class="table-hint muted">On a small screen, slide the table sideways to see all 6 columns.</p>
        <div class="table-wrap" role="region" aria-labelledby="recent-heading" tabindex="0">
          <table class="data-table">
            <caption class="visually-hidden">The 15 most recent calls and visits</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Senior</th><th scope="col">Companion</th><th scope="col">Type</th><th scope="col">What happened</th><th scope="col">Saved on</th></tr></thead>
            <tbody>
              ${recent.map(
                (c) => html`<tr>
                  <td>${formatDate(c.completedAt || c.scheduledFor)}</td>
                  <td><a href="/seniors/${c.senior.id}">${c.senior.name}</a></td>
                  <td>${c.volunteer ? c.volunteer.name : 'Unknown'}</td>
                  <td>${methodLabel(c.type)}</td>
                  <td>${outcome(c)}</td>
                  <td class="muted">${formatDateTime(c.createdAt)}</td>
                </tr>`
              )}
            </tbody>
          </table>
        </div>`
        : emptyState(html`<p><strong>No calls or visits yet.</strong> After the first one, log it with the form on this page.</p>`)}
    </section>`;
}

// `canLog` / `canMiss` come from canLogNow() / canMarkMissedNow() in src/risk.js:
// a call can be marked done on its day or later, and missed once its time has come.
function contactItem(c) {
  const noun = c.type === 'visit' ? 'visit' : 'call';
  return html`
    <li class="contact-item">
      <p><strong>${formatDateTime(c.scheduledFor)}</strong></p>
      <p>${methodLabel(c.type)}: <a href="/seniors/${c.senior.id}">${c.senior.name}</a> with ${c.volunteer ? c.volunteer.name : 'unknown volunteer'}</p>
      ${c.notes ? html`<p class="muted">${c.notes}</p>` : ''}
      ${c.canLog ? '' : html`<p class="muted">You can mark this ${noun} done on ${formatLongDate(c.scheduledFor)}, once it has happened.</p>`}
      <div class="actions">
        ${c.canLog
          ? html`<form method="post" action="/contacts/${c.id}/complete" class="inline-form">
          <button type="submit" class="button button-small">Mark as done<span class="visually-hidden"> for ${c.senior.name} on ${formatDate(c.scheduledFor)}</span></button>
        </form>`
          : ''}
        ${c.canMiss
          ? html`<form method="post" action="/contacts/${c.id}/missed" class="inline-form">
          <button type="submit" class="button button-secondary button-small">Mark as missed<span class="visually-hidden"> for ${c.senior.name} on ${formatDate(c.scheduledFor)}</span></button>
        </form>`
          : ''}
        <a class="button button-secondary button-small" href="/contacts/${c.id}/calendar.ics" download>Add to calendar<span class="visually-hidden">: ${c.senior.name} on ${formatDate(c.scheduledFor)}</span></a>
      </div>
    </li>`;
}

// What happened to a call or visit, in words (never color alone).
function outcome(c) {
  if (c.status === 'missed') return html`<span class="badge badge-missed">Missed</span>`;
  if (c.status === 'cancelled') return 'Cancelled (the match ended)';
  return html`Done${c.durationMinutes ? ` (${c.durationMinutes} min)` : ''}`;
}
