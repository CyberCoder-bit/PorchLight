// A volunteer's "My week": the next 7 days of calls, saved sparks inline,
// one-click "Log this call", and "Mark missed" with a reason.
// [v2 i18n] Words are core.week.* keys. Spark text and notes are user data.

import { html, formatDate, formatTime, formatDateTime, formatLongDate } from '../html.js';
import { methodLabel, sparkSourceLabel } from '../components.js';
import { MISSED_REASONS } from '../../vocab.js';
import { COMMUNITY } from '../../community.js';
import { firstName, tCount } from '../../features/words.js';
import { t } from '../../i18n/index.js';

// 'call' or 'visit': picks the key (core.week.log.call, core.week.log.visit, ...).
const noun = (type) => (type === 'visit' ? 'visit' : 'call');

function dayHeading(day) {
  const date = formatLongDate(day.date);
  if (day.offset === 0) return t('core.week.today', { date });
  if (day.offset === 1) return t('core.week.tomorrow', { date });
  return date;
}

export function myWeekPage(week, { busyText = t('core.week.working') } = {}) {
  const { volunteer, days, overdue, later, assigned, unplanned, callCount, lastDay, zone, back } = week;
  return html`
    <p class="breadcrumb"><a href="/volunteers/${volunteer.id}">← ${t('core.week.back', { name: volunteer.name })}</a></p>
    <h1>${t('core.week.title', { name: volunteer.name })}</h1>
    <p class="lead">${t('core.week.lead', { date: formatLongDate(lastDay), town: COMMUNITY.town, state: COMMUNITY.state, zone })}</p>

    ${overdue.length
      ? html`
        <section class="panel notice-panel" aria-labelledby="overdue-heading">
          <h2 id="overdue-heading">${t('core.week.overdueTitle')}</h2>
          <p>${t('core.week.overdueText')}</p>
          <ul class="contact-list">${overdue.map((c) => callItem(c, { back, past: true, busyText }))}</ul>
        </section>`
      : ''}

    <section aria-labelledby="week-heading">
      <h2 id="week-heading" class="section-heading">${t('core.week.comingUp', { count: callCount })}</h2>
      ${callCount
        ? days.map(
            (day) => html`
            <section class="panel" aria-labelledby="day-${day.key}">
              <h3 id="day-${day.key}">${dayHeading(day)}</h3>
              <ul class="contact-list">${day.calls.map((c) => callItem(c, { back, past: false, busyText }))}</ul>
            </section>`
          )
        : html`<p class="big">${t('core.week.nothing')}</p>`}
    </section>

    ${assigned.length === 0
      ? html`
        <section class="panel" aria-labelledby="none-heading">
          <h2 id="none-heading">${t('core.week.noSeniorTitle')}</h2>
          <p>${t('core.week.noSeniorText', { name: firstName(volunteer) })}</p>
          <p class="actions"><a class="button" href="/admin/match">${t('core.week.goMatch')}</a></p>
        </section>`
      : unplanned.length
        ? html`
          <section class="panel" aria-labelledby="unplanned-heading">
            <h2 id="unplanned-heading">${t('core.week.unplannedTitle')}</h2>
            <ul class="plain-list">
              ${unplanned.map(
                ({ senior, match }) => html`<li><a href="/seniors/${senior.id}">${senior.name}</a> ${t(`core.week.unplanned.${noun(senior.contactMethod)}`)}
                  <p class="actions"><a class="button${callCount ? ' button-secondary' : ''}" href="/contacts?matchId=${match.id}">${t(`core.week.schedule.${noun(senior.contactMethod)}`, { name: firstName(senior) })}</a></p></li>`
              )}
            </ul>
          </section>`
        : ''}

    ${later.length
      ? html`<p class="muted">${tCount('core.week.later', later.length, { date: formatDate(later[0].scheduledFor) })} <a href="/contacts">${t('core.week.seeAll')}</a></p>`
      : ''}`;
}

function callItem(c, { back, past, busyText }) {
  const name = firstName(c.senior);
  const when = formatDate(c.scheduledFor);
  const forWhom = html`<span class="visually-hidden"> ${t('core.week.forWhom', { name, date: when })}</span>`;
  return html`
    <li class="contact-item" id="call-${c.id}">
      <p><strong>${past ? formatDateTime(c.scheduledFor) : formatTime(c.scheduledFor)}</strong>: ${t('core.week.callWith', { method: methodLabel(c.type) })} <a href="/seniors/${c.senior.id}">${c.senior.name}</a></p>
      ${c.notes ? html`<p class="muted">${t('core.week.yourNote')} ${c.notes}</p>` : ''}
      ${past ? '' : sparks(c, name, busyText, back)}
      ${c.canLog
        ? html`
      <div class="actions">
        <form method="post" action="/contacts/${c.id}/complete" class="inline-form">
          <input type="hidden" name="back" value="${back}">
          <button type="submit" class="button">${t(`core.week.log.${noun(c.type)}`)}${forWhom}</button>
        </form>
      </div>`
        : html`<p class="muted">${t(`core.week.logLater.${noun(c.type)}`, { date: formatLongDate(c.scheduledFor) })}</p>`}
      ${c.canMiss ? missedForm(c, back, forWhom) : c.canLog ? html`<p class="muted">${t('core.week.missLater', { time: formatTime(c.scheduledFor) })}</p>` : ''}
    </li>`;
}

function missedForm(c, back, forWhom) {
  return html`
      <form method="post" action="/contacts/${c.id}/missed" class="stack-form">
        <fieldset>
          <legend>${t('core.week.missedLegend')}</legend>
          <div class="field-row">
            <div class="field">
              <label for="reason-${c.id}">${t('core.week.reasonLabel')}</label>
              <select id="reason-${c.id}" name="reason">
                <option value="">${t('core.week.reasonChoose')}</option>
                ${MISSED_REASONS.map((r) => html`<option value="${r.id}">${r.label}</option>`)}
              </select>
            </div>
            <div class="field">
              <label for="note-${c.id}">${t('core.week.noteLabel')}</label>
              <p class="hint" id="hint-note-${c.id}">${t('core.week.noteHint')}</p>
              <input type="text" id="note-${c.id}" name="reasonNote" maxlength="200" aria-describedby="hint-note-${c.id}">
            </div>
          </div>
          <input type="hidden" name="back" value="${back}">
          <button type="submit" class="button button-secondary">${t('core.week.markMissed')}${forWhom}</button>
        </fieldset>
      </form>`;
}

function sparks(c, name, busyText, back) {
  const set = c.sparkSet;
  if (!set) {
    return html`
      <form method="post" action="/seniors/${c.senior.id}/sparks" class="inline-form" data-busy-text="${busyText}">
        <input type="hidden" name="variant" value="0">
        <input type="hidden" name="back" value="${back}">
        <button type="submit" class="button button-secondary">${t('core.week.getSparks', { name })}</button>
      </form>`;
  }
  return html`
    <div class="panel spark-panel">
      <h4><span aria-hidden="true">✦</span> ${t('core.week.sparksTitle', { name })}</h4>
      <ol class="sparks">
        ${set.sparks.map((s) => html`<li><p class="spark-text">${s.text}</p><p class="spark-basis">${t('core.week.basedOn')} ${s.basedOn}</p></li>`)}
      </ol>
      ${set.tip ? html`<p class="tip"><strong>${t('core.week.tip')}</strong> ${set.tip}</p>` : ''}
      <p class="muted small">${t('core.week.suggestionsOnly')} ${sparkSourceLabel(set)} · ${formatDateTime(set.createdAt)}</p>
    </div>`;
}
