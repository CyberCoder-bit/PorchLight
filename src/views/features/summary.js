// Printable weekly family summary, with a plain-text copy to paste into a
// message. Counts and dates only: no call notes, no missed-call notes.

import { html, formatLongDate, formatDateTime, daysAgoText } from '../html.js';
import { statusBadge, trendBadge, methodLabel } from '../components.js';
import { firstName } from '../../features/words.js';

export function familySummaryPage(summary) {
  const { senior, assessment: a, sentence, facts, missed, now, text } = summary;
  const name = firstName(senior);
  return html`
    <p class="breadcrumb"><a href="/seniors/${senior.id}">← Back to ${senior.name}</a></p>
    <h1>Weekly summary: ${senior.name}</h1>
    <p class="lead">A short update for family, for the week ending ${formatLongDate(now)}. Counts and dates only. Call notes stay private.</p>

    <section class="panel" aria-labelledby="status-heading">
      <h2 id="status-heading">How ${name} is doing</h2>
      <p class="badges">${statusBadge(a.status, a.info)} ${trendBadge(a.trend)}</p>
      <p class="big">${sentence}</p>
      <dl class="facts">
        <dt>Check-ins in the last 7 days</dt><dd>${facts.last7}</dd>
        <dt>Check-ins in the last 4 weeks</dt><dd>${facts.last28} <span class="muted">(${facts.previous28} the 4 weeks before)</span></dd>
        <dt>Last contact</dt><dd>${facts.lastContact
          ? `${formatLongDate(facts.lastContact.date)} (${daysAgoText(facts.lastContact.daysAgo)}), ${methodLabel(facts.lastContact.type).toLowerCase()}`
          : 'None yet'}</dd>
        <dt>Next call or visit</dt><dd>${facts.next
          ? `${formatDateTime(facts.next.date)} (${methodLabel(facts.next.type).toLowerCase()})`
          : html`<strong>None scheduled yet</strong>`}</dd>
        <dt>Companion</dt><dd>${facts.companion || 'Not matched yet'}</dd>
      </dl>
    </section>

    <section class="panel" aria-labelledby="missed-heading">
      <h2 id="missed-heading">Missed calls in the last 4 weeks (${missed.length})</h2>
      ${missed.length
        ? html`<ul class="plain-list">${missed.map(
            (m) => html`<li><strong>${formatLongDate(m.date)}</strong>: ${methodLabel(m.type)}. Reason: ${m.reason}.</li>`
          )}</ul>`
        : html`<p>No missed calls in the last 4 weeks.</p>`}
    </section>

    <section class="panel" aria-labelledby="copy-heading">
      <h2 id="copy-heading">Send this to family</h2>
      <div class="field">
        <label for="summary-text">Message to copy</label>
        <p class="hint" id="hint-summary-text">Click in the box, select all (Ctrl+A, or ⌘A on a Mac), copy, and paste it into a text or email to a brother, sister, or anyone who helps.</p>
        <textarea id="summary-text" rows="${text.split('\n').length + 1}" readonly aria-describedby="hint-summary-text">${text}</textarea>
      </div>
    </section>

    <p class="muted">To print this page, use your browser's Print command (Ctrl+P, or ⌘P on a Mac).</p>`;
}
