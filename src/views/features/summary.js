// Printable weekly family summary, with a plain-text copy to paste into a
// message. Counts and dates only: no call notes, no missed-call notes.
// [v2 i18n] Page words are core.summary.* keys. The copy text (`text`) is
// built in English by src/features/summary.js.

import { html, formatLongDate, formatDateTime, daysAgoText } from '../html.js';
import { statusBadge, trendBadge, methodLabel } from '../components.js';
import { methodLower } from '../../vocab.js';
import { firstName } from '../../features/words.js';
import { t } from '../../i18n/index.js';

export function familySummaryPage(summary) {
  const { senior, assessment: a, sentence, facts, missed, now, text } = summary;
  const name = firstName(senior);
  return html`
    <p class="breadcrumb"><a href="/seniors/${senior.id}">← ${t('core.summary.back', { name: senior.name })}</a></p>
    <h1>${t('core.summary.title', { name: senior.name })}</h1>
    <p class="lead">${t('core.summary.lead', { date: formatLongDate(now) })}</p>

    <section class="panel" aria-labelledby="status-heading">
      <h2 id="status-heading">${t('core.summary.howDoing', { name })}</h2>
      <p class="badges">${statusBadge(a.status, a.info)} ${trendBadge(a.trend)}</p>
      <p class="big">${sentence}</p>
      <dl class="facts">
        <dt>${t('core.summary.last7')}</dt><dd>${facts.last7}</dd>
        <dt>${t('core.summary.last28')}</dt><dd>${facts.last28} <span class="muted">${t('core.summary.previous28', { count: facts.previous28 })}</span></dd>
        <dt>${t('core.summary.lastContact')}</dt><dd>${facts.lastContact
          ? `${formatLongDate(facts.lastContact.date)} (${daysAgoText(facts.lastContact.daysAgo)}), ${methodLower(facts.lastContact.type)}`
          : t('core.summary.noneYet')}</dd>
        <dt>${t('core.summary.next')}</dt><dd>${facts.next
          ? `${formatDateTime(facts.next.date)} (${methodLower(facts.next.type)})`
          : html`<strong>${t('core.summary.noneScheduled')}</strong>`}</dd>
        <dt>${t('core.summary.companion')}</dt><dd>${facts.companion || t('core.summary.notMatched')}</dd>
      </dl>
    </section>

    <section class="panel" aria-labelledby="missed-heading">
      <h2 id="missed-heading">${t('core.summary.missedTitle', { count: missed.length })}</h2>
      ${missed.length
        ? html`<ul class="plain-list">${missed.map(
            (m) => html`<li><strong>${formatLongDate(m.date)}</strong>: ${t('core.summary.missedLine', { method: methodLabel(m.type), reason: m.reason })}</li>`
          )}</ul>`
        : html`<p>${t('core.summary.noMissed')}</p>`}
    </section>

    <section class="panel" aria-labelledby="copy-heading">
      <h2 id="copy-heading">${t('core.summary.copyTitle')}</h2>
      <div class="field">
        <label for="summary-text">${t('core.summary.copyLabel')}</label>
        <p class="hint" id="hint-summary-text">${t('core.summary.copyHint')}</p>
        <textarea id="summary-text" rows="${text.split('\n').length + 1}" readonly aria-describedby="hint-summary-text">${text}</textarea>
      </div>
    </section>

    <p class="muted">${t('core.summary.print')}</p>`;
}
