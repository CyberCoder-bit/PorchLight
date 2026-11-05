// Calls & Visits: schedule a future call/visit, log one that happened, and
// mark scheduled ones as completed or missed.

import { html, formatDateTime, formatDate, formatLongDate } from '../html.js';
import { errorSummary, textField, textArea, selectField, methodLabel, emptyState, tx } from '../components.js';
import { CONTACT_METHODS } from '../../vocab.js';
import { t } from '../../i18n/index.js'; // [v2 i18n]

export function contactsPage({ pairs, form, errors = {}, upcoming, overdue, recent }) {
  const pairOptions = [
    { value: '', label: t('core.contacts.form.choosePair') },
    ...pairs.map((p) => ({ value: p.match.id, label: t('core.contacts.form.pair', { senior: p.senior.name, volunteer: p.volunteer.name }) })),
  ];
  const typeOptions = CONTACT_METHODS.map((m) => ({ value: m.id, label: m.label }));
  const action = form.action || 'schedule';

  return html`
    <h1>${tx('core.contacts.title')}</h1>
    <p class="lead">${tx('core.contacts.lead')}</p>

    ${overdue.length
      ? html`
        <section class="panel notice-panel" aria-labelledby="overdue-heading">
          <h2 id="overdue-heading">${tx('core.contacts.overdue.heading')}</h2>
          <p>${tx('core.contacts.overdue.text')}</p>
          <ul class="contact-list">${overdue.map((c) => contactItem(c))}</ul>
        </section>`
      : ''}

    <div class="two-col">
      <section class="panel" aria-labelledby="form-heading">
        <h2 id="form-heading">${tx('core.senior.calls.scheduleOrLog')}</h2>
        ${errorSummary(errors)}
        ${pairs.length === 0
          ? emptyState(html`<p><strong>${tx('core.contacts.noPairs.title')}</strong> ${tx('core.contacts.noPairs.text', { link: html`<a href="/admin/match">${tx('core.contacts.noPairs.link')}</a>` })}</p>`)
          : html`
          <form method="post" action="/contacts" class="stack-form" novalidate>
            ${selectField({ name: 'matchId', label: t('core.contacts.form.who'), options: pairOptions, value: form.matchId, error: errors.matchId, required: true })}
            <fieldset class="choice-group" id="field-action" tabindex="-1">
              <legend>${tx('core.contacts.form.what')}</legend>
              <div class="choices">
                <div class="choice">
                  <input type="radio" id="action-schedule" name="action" value="schedule"${action === 'schedule' ? html` checked` : ''}>
                  <label for="action-schedule">${tx('core.contacts.form.schedule')}</label>
                </div>
                <div class="choice">
                  <input type="radio" id="action-log" name="action" value="log"${action === 'log' ? html` checked` : ''}>
                  <label for="action-log">${tx('core.contacts.form.log')}</label>
                </div>
              </div>
            </fieldset>
            ${selectField({ name: 'type', label: t('core.contacts.form.type'), options: typeOptions, value: form.type || 'phone', error: errors.type })}
            <div class="field-row">
              ${textField({ name: 'date', label: t('core.contacts.form.date'), type: 'date', value: form.date, error: errors.date, required: true })}
              ${textField({ name: 'time', label: t('core.contacts.form.time'), type: 'time', value: form.time, error: errors.time, required: true })}
            </div>
            ${textField({ name: 'durationMinutes', label: t('core.contacts.form.minutes'), type: 'number', value: form.durationMinutes, error: errors.durationMinutes, attrs: 'inputmode="numeric" min="1" max="480"' })}
            ${textArea({ name: 'notes', label: t('core.contacts.form.notes'), value: form.notes, error: errors.notes, rows: 3, hint: t('core.contacts.form.notesHint') })}
            <div class="form-actions"><button type="submit" class="button">${tx('core.contacts.form.save')}</button></div>
          </form>`}
      </section>

      <section class="panel" aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading">${tx('core.contacts.upcoming.heading', { n: upcoming.length })}</h2>
        ${upcoming.length
          ? html`<ul class="contact-list">${upcoming.map((c) => contactItem(c))}</ul>`
          : emptyState(html`<p><strong>${tx('core.senior.calls.nothingYet')}</strong> ${tx('core.contacts.upcoming.empty')}</p>`)}
      </section>
    </div>

    <section class="panel" aria-labelledby="recent-heading">
      <h2 id="recent-heading">${tx('core.contacts.recent.heading')}</h2>
      ${recent.length
        ? html`
        <p class="table-hint muted">${tx('core.contacts.recent.slide')}</p>
        <div class="table-wrap" role="region" aria-labelledby="recent-heading" tabindex="0">
          <table class="data-table">
            <caption class="visually-hidden">${tx('core.contacts.recent.caption')}</caption>
            <thead><tr><th scope="col">${tx('core.contacts.recent.date')}</th><th scope="col">${tx('core.contacts.recent.senior')}</th><th scope="col">${tx('core.contacts.recent.companion')}</th><th scope="col">${tx('core.contacts.recent.type')}</th><th scope="col">${tx('core.contacts.recent.outcome')}</th><th scope="col">${tx('core.contacts.recent.saved')}</th></tr></thead>
            <tbody>
              ${recent.map(
                (c) => html`<tr>
                  <td>${formatDate(c.completedAt || c.scheduledFor)}</td>
                  <td><a href="/seniors/${c.senior.id}">${c.senior.name}</a></td>
                  <td>${c.volunteer ? c.volunteer.name : t('core.contacts.recent.unknown')}</td>
                  <td>${methodLabel(c.type)}</td>
                  <td>${outcome(c)}</td>
                  <td class="muted">${formatDateTime(c.createdAt)}</td>
                </tr>`
              )}
            </tbody>
          </table>
        </div>`
        : emptyState(html`<p><strong>${tx('core.contacts.recent.emptyTitle')}</strong> ${tx('core.contacts.recent.emptyText')}</p>`)}
    </section>`;
}

// `canLog` / `canMiss` come from canLogNow() / canMarkMissedNow() in src/risk.js:
// a call can be marked done on its day or later, and missed once its time has come.
function contactItem(c) {
  const visit = c.type === 'visit';
  return html`
    <li class="contact-item">
      <p><strong>${formatDateTime(c.scheduledFor)}</strong></p>
      <p>${methodLabel(c.type)}: ${c.volunteer
        ? tx('core.contacts.item.with', { senior: html`<a href="/seniors/${c.senior.id}">${c.senior.name}</a>`, volunteer: c.volunteer.name })
        : tx('core.contacts.item.withUnknown', { senior: html`<a href="/seniors/${c.senior.id}">${c.senior.name}</a>` })}</p>
      ${c.notes ? html`<p class="muted">${c.notes}</p>` : ''}
      ${c.canLog ? '' : html`<p class="muted">${tx(visit ? 'core.contacts.item.notYetVisit' : 'core.contacts.item.notYetCall', { date: formatLongDate(c.scheduledFor) })}</p>`}
      <div class="actions">
        ${c.canLog
          ? html`<form method="post" action="/contacts/${c.id}/complete" class="inline-form">
          <button type="submit" class="button button-small">${tx('core.contacts.item.done')}<span class="visually-hidden"> ${tx('core.contacts.item.forOn', { name: c.senior.name, date: formatDate(c.scheduledFor) })}</span></button>
        </form>`
          : ''}
        ${c.canMiss
          ? html`<form method="post" action="/contacts/${c.id}/missed" class="inline-form">
          <button type="submit" class="button button-secondary button-small">${tx('core.contacts.item.missed')}<span class="visually-hidden"> ${tx('core.contacts.item.forOn', { name: c.senior.name, date: formatDate(c.scheduledFor) })}</span></button>
        </form>`
          : ''}
        <a class="button button-secondary button-small" href="/contacts/${c.id}/calendar.ics" download>${tx('core.senior.calls.addToCalendar')}<span class="visually-hidden">: ${tx('core.contacts.item.nameOn', { name: c.senior.name, date: formatDate(c.scheduledFor) })}</span></a>
      </div>
    </li>`;
}

// What happened to a call or visit, in words (never color alone).
function outcome(c) {
  if (c.status === 'missed') return html`<span class="badge badge-missed">${tx('core.senior.calls.missed')}</span>`;
  if (c.status === 'cancelled') return t('core.contacts.outcome.cancelled');
  return c.durationMinutes ? tx('core.contacts.outcome.doneMinutes', { n: c.durationMinutes }) : tx('core.contacts.outcome.done');
}
