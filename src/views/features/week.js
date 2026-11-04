// A volunteer's "My week": the next 7 days of calls, saved sparks inline,
// one-click "Log this call", and "Mark missed" with a reason.

import { html, formatDate, formatTime, formatDateTime, formatLongDate, plural } from '../html.js';
import { methodLabel, sparkSourceLabel } from '../components.js';
import { MISSED_REASONS } from '../../vocab.js';
import { COMMUNITY } from '../../community.js';
import { firstName } from '../../features/words.js';


const noun = (type) => (type === 'visit' ? 'visit' : 'call');

function dayHeading(day) {
  const date = formatLongDate(day.date);
  if (day.offset === 0) return `Today, ${date}`;
  if (day.offset === 1) return `Tomorrow, ${date}`;
  return date;
}

export function myWeekPage(week, { busyText = 'Working…' } = {}) {
  const { volunteer, days, overdue, later, assigned, unplanned, callCount, lastDay, zone, back } = week;
  return html`
    <p class="breadcrumb"><a href="/volunteers/${volunteer.id}">← Back to ${volunteer.name}</a></p>
    <h1>My week: ${volunteer.name}</h1>
    <p class="lead">Calls and visits from today through ${formatLongDate(lastDay)}. Times are ${COMMUNITY.town}, ${COMMUNITY.state} time (${zone}).</p>

    ${overdue.length
      ? html`
        <section class="panel notice-panel" aria-labelledby="overdue-heading">
          <h2 id="overdue-heading">Did these calls happen?</h2>
          <p>These were scheduled in the past but never marked. Log each one that happened, or mark it missed, so the Family Dashboard stays accurate.</p>
          <ul class="contact-list">${overdue.map((c) => callItem(c, { back, past: true, busyText }))}</ul>
        </section>`
      : ''}

    <section aria-labelledby="week-heading">
      <h2 id="week-heading" class="section-heading">Coming up (${callCount})</h2>
      ${callCount
        ? days.map(
            (day) => html`
            <section class="panel" aria-labelledby="day-${day.key}">
              <h3 id="day-${day.key}">${dayHeading(day)}</h3>
              <ul class="contact-list">${day.calls.map((c) => callItem(c, { back, past: false, busyText }))}</ul>
            </section>`
          )
        : html`<p class="big">Nothing scheduled in the next 7 days.</p>`}
    </section>

    ${assigned.length === 0
      ? html`
        <section class="panel" aria-labelledby="none-heading">
          <h2 id="none-heading">No senior yet</h2>
          <p>${firstName(volunteer)} isn't matched with a senior yet. A coordinator can make a match on the Match page.</p>
          <p class="actions"><a class="button" href="/match">Go to the Match page</a></p>
        </section>`
      : unplanned.length
        ? html`
          <section class="panel" aria-labelledby="unplanned-heading">
            <h2 id="unplanned-heading">Nothing planned yet this week</h2>
            <ul class="plain-list">
              ${unplanned.map(
                ({ senior, match }) => html`<li><a href="/seniors/${senior.id}">${senior.name}</a> has no ${noun(senior.contactMethod)} in the next 7 days.
                  <p class="actions"><a class="button${callCount ? ' button-secondary' : ''}" href="/contacts?matchId=${match.id}">Schedule a ${noun(senior.contactMethod)} with ${firstName(senior)}</a></p></li>`
              )}
            </ul>
          </section>`
        : ''}

    ${later.length
      ? html`<p class="muted">${plural(later.length, 'more call', 'more calls')} ${later.length === 1 ? 'is' : 'are'} scheduled after this week, starting ${formatDate(later[0].scheduledFor)}. <a href="/contacts">See all calls and visits</a></p>`
      : ''}`;
}

function callItem(c, { back, past, busyText }) {
  const name = firstName(c.senior);
  const when = formatDate(c.scheduledFor);
  const forWhom = html`<span class="visually-hidden"> with ${name} on ${when}</span>`;
  return html`
    <li class="contact-item" id="call-${c.id}">
      <p><strong>${past ? formatDateTime(c.scheduledFor) : formatTime(c.scheduledFor)}</strong>: ${methodLabel(c.type)} with <a href="/seniors/${c.senior.id}">${c.senior.name}</a></p>
      ${c.notes ? html`<p class="muted">Your note: ${c.notes}</p>` : ''}
      ${past ? '' : sparks(c, name, busyText, back)}
      ${c.canLog
        ? html`
      <div class="actions">
        <form method="post" action="/contacts/${c.id}/complete" class="inline-form">
          <input type="hidden" name="back" value="${back}">
          <button type="submit" class="button">Log this ${noun(c.type)}${forWhom}</button>
        </form>
      </div>`
        : html`<p class="muted">You can log this ${noun(c.type)} on ${formatLongDate(c.scheduledFor)}, once it has happened.</p>`}
      ${c.canMiss ? missedForm(c, back, forWhom) : c.canLog ? html`<p class="muted">If it doesn't happen, you can mark it missed after ${formatTime(c.scheduledFor)}.</p>` : ''}
    </li>`;
}

function missedForm(c, back, forWhom) {
  return html`
      <form method="post" action="/contacts/${c.id}/missed" class="stack-form">
        <fieldset>
          <legend>Didn't happen? Mark it missed</legend>
          <div class="field-row">
            <div class="field">
              <label for="reason-${c.id}">Why was it missed?</label>
              <select id="reason-${c.id}" name="reason">
                <option value="">Choose a reason (optional)</option>
                ${MISSED_REASONS.map((r) => html`<option value="${r.id}">${r.label}</option>`)}
              </select>
            </div>
            <div class="field">
              <label for="note-${c.id}">Short note (optional)</label>
              <p class="hint" id="hint-note-${c.id}">Up to 200 characters. Only coordinators see it (on the Needs attention list and the senior's page). Family members and the senior never see it, and it is never sent to the AI.</p>
              <input type="text" id="note-${c.id}" name="reasonNote" maxlength="200" aria-describedby="hint-note-${c.id}">
            </div>
          </div>
          <input type="hidden" name="back" value="${back}">
          <button type="submit" class="button button-secondary">Mark missed${forWhom}</button>
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
        <button type="submit" class="button button-secondary">Get conversation sparks for ${name}</button>
      </form>`;
  }
  return html`
    <div class="panel spark-panel">
      <h4><span aria-hidden="true">✦</span> Conversation sparks for ${name}</h4>
      <ol class="sparks">
        ${set.sparks.map((s) => html`<li><p class="spark-text">${s.text}</p><p class="spark-basis">Based on: ${s.basedOn}</p></li>`)}
      </ol>
      ${set.tip ? html`<p class="tip"><strong>Volunteer tip:</strong> ${set.tip}</p>` : ''}
      <p class="muted small">Suggestions only. ${sparkSourceLabel(set)} · ${formatDateTime(set.createdAt)}</p>
    </div>`;
}
