// Caregiver / family dashboard: who is connected, who is drifting, and who
// needs a call today.

import { html, formatDate, formatDateTime, daysAgoText } from '../html.js';
import { statusBadge, trendBadge, methodLabel, errorSummary, emptyState, tx, many } from '../components.js';
import { weeklyChart } from '../chart.js';
import { STATUS_INFO, needsAttention, attentionBreakdown } from '../../risk.js';
import { noPhone } from '../../roles/viewer.js'; // phone numbers are never displayed, even if typed into a name field
import { t, lowerInText } from '../../i18n/index.js'; // [v2 i18n]

// One sentence that says exactly what every number counts, e.g.
// "Right now, 2 seniors need attention: 1 at isolation risk, 1 waiting for a companion."
// Who counts is needsAttention() in src/risk.js, the same rule as Home and /attention.
// [v2 i18n] The whole sentence is one key, with "in {town}" when a town is picked.
function attentionSentence(flagged, town) {
  const where = town ? 'In' : '';
  if (!flagged.length) return tx(`core.dashboard.status.none${where}`, { town });
  const n = flagged.length;
  return tx(`${many(n, 'core.dashboard.status.count')}${where}`, { n, town, breakdown: attentionBreakdown(flagged) });
}

// "1 day", "3 days"
const dayCount = (n) => t(many(n, 'core.dashboard.dayCount'), { n });

export function dashboardPage({ summary, threshold, volunteersById, errors = {}, thresholdInput, townFilter = '', townName = null }) { // [towns] townFilter, townName
  const counts = Object.fromEntries(Object.keys(STATUS_INFO).map((k) => [k, summary.filter((r) => r.status === k).length]));
  const soonFrom = Math.max(1, threshold - 2);
  const flagged = summary.filter(needsAttention);
  // "1 to 3 days", or just "1 day" when the range is a single day.
  const soonRange = soonFrom >= threshold ? dayCount(threshold) : t('core.dashboard.dayRange', { from: soonFrom, to: threshold });

  return html`
    <h1>${tx('core.dashboard.title')}</h1>
    <p class="lead">${tx('core.dashboard.lead')}</p>
    ${townFilter}
    ${errorSummary(errors)}

    <section class="summary-tiles" aria-label="${t('core.dashboard.tilesLabel')}">
      <div class="tile tile-at_risk"><p class="tile-value">${counts.at_risk}</p><p class="tile-label"><span aria-hidden="true">${STATUS_INFO.at_risk.icon}</span> ${tx(many(counts.at_risk, 'core.dashboard.tile.atRisk'))}</p></div>
      <div class="tile tile-needs_match"><p class="tile-value">${counts.needs_match}</p><p class="tile-label"><span aria-hidden="true">${STATUS_INFO.needs_match.icon}</span> ${tx(many(counts.needs_match, 'core.dashboard.tile.needsMatch'))}</p></div>
      <div class="tile tile-due_soon"><p class="tile-value">${counts.due_soon}</p><p class="tile-label"><span aria-hidden="true">${STATUS_INFO.due_soon.icon}</span> ${tx(many(counts.due_soon, 'core.dashboard.tile.dueSoon'))}</p></div>
      <div class="tile tile-ok"><p class="tile-value">${counts.ok}</p><p class="tile-label"><span aria-hidden="true">${STATUS_INFO.ok.icon}</span> ${tx(many(counts.ok, 'core.dashboard.tile.ok'))}</p></div>
    </section>
    <p class="status-line"><strong>${attentionSentence(flagged, townName)}</strong>${flagged.length ? html` <a href="/admin/attention">${tx('core.dashboard.seeNext')}</a>` : ''}</p>

    <h2 class="section-heading">${tx('core.dashboard.listHeading')}</h2>
    ${summary.length
      ? html`<ul class="dashboard-grid">
      ${summary.map((r) => seniorCard(r, volunteersById))}
    </ul>`
      : townName // [towns]
        ? emptyState(html`<p><strong>${tx('core.dashboard.empty.inTown', { town: townName })}</strong> <a href="/admin/dashboard">${tx('core.dashboard.empty.allTowns')}</a></p>`)
        : emptyState(html`<p><strong>${tx('core.dashboard.empty.title')}</strong> ${tx('core.dashboard.empty.text')}</p>
          <p><a class="button" href="/admin/seniors/new">${tx('core.dashboard.empty.add')}</a></p>`)}

    <section class="panel threshold-panel" aria-labelledby="threshold-heading">
      <h2 id="threshold-heading">${tx('core.dashboard.threshold.heading')}</h2>
      <form method="post" action="/admin/settings" class="threshold-form" novalidate>
        <div class="field${errors.riskThresholdDays ? ' has-error' : ''}">
          <label for="field-riskThresholdDays">${tx('core.dashboard.threshold.label')}</label>
          ${errors.riskThresholdDays ? html`<p class="field-error" id="error-riskThresholdDays"><span aria-hidden="true">⚠ </span>${errors.riskThresholdDays}</p>` : ''}
          <div class="inline-input">
            <input id="field-riskThresholdDays" name="riskThresholdDays" type="number" inputmode="numeric" min="1" max="60"
              value="${thresholdInput ?? threshold}"${errors.riskThresholdDays ? html` aria-invalid="true" aria-describedby="error-riskThresholdDays"` : ''}>
            <span>${tx('core.dashboard.threshold.days')}</span>
            <button type="submit" class="button button-secondary">${tx('core.dashboard.threshold.save')}</button>
          </div>
        </div>
      </form>
      <p class="muted">${tx(many(soonFrom, 'core.dashboard.threshold.soon'), { n: soonFrom })}</p>
    </section>

    <section class="panel explain" aria-labelledby="flags-heading">
      <h2 id="flags-heading">${tx('core.dashboard.flags.heading')}</h2>
      <ul>
        <li>${statusBadge('at_risk', STATUS_INFO.at_risk)} ${tx('core.dashboard.flags.atRisk', { days: html`<strong>${dayCount(threshold)}</strong>` })}</li>
        <li>${statusBadge('due_soon', STATUS_INFO.due_soon)} ${tx('core.dashboard.flags.dueSoon', { range: soonRange })}</li>
        <li>${statusBadge('needs_match', STATUS_INFO.needs_match)} ${tx('core.dashboard.flags.needsMatch')}</li>
        <li>${trendBadge({ dropping: true })} ${tx('core.dashboard.flags.dropping')}</li>
      </ul>
      <p>${tx('core.dashboard.flags.onlyCompleted')}</p>
    </section>`;
}

function seniorCard(r, volunteersById) {
  const { senior } = r;
  const first = senior.preferredName || senior.name.split(' ')[0];
  const last = r.lastContact;
  const lastVolunteer = last ? volunteersById.get(last.volunteerId) : null;
  const family = senior.caregiver?.name
    ? senior.caregiver.relationship
      ? tx('core.dashboard.card.familyWith', { name: noPhone(senior.caregiver.name), relationship: noPhone(senior.caregiver.relationship) })
      : tx('core.dashboard.card.family', { name: noPhone(senior.caregiver.name) })
    : '';
  return html`
    <li class="card dash-card dash-${r.status}">
      <div class="dash-head">
        <h3 class="card-title"><a href="/seniors/${senior.id}">${senior.name}</a></h3>
        <p class="badges">${statusBadge(r.status, r.info)} ${trendBadge(r.trend)}</p>
      </div>
      ${family ? html`<p class="card-meta">${family}</p>` : ''}
      <dl class="facts compact">
        <dt>${tx('core.dashboard.card.last')}</dt>
        <dd>${last
          ? tx(lastVolunteer ? 'core.dashboard.card.lastWhenWith' : 'core.dashboard.card.lastWhen', {
            when: html`<strong>${daysAgoText(r.daysSince)}</strong>`,
            date: formatDate(last.completedAt),
            method: lowerInText(methodLabel(last.type)),
            name: lastVolunteer ? lastVolunteer.name : '',
          })
          : tx(r.since.kind === 'match' ? 'core.dashboard.card.noneMatched' : 'core.dashboard.card.noneJoined', {
            none: html`<strong>${tx('core.dashboard.card.noneYet')}</strong>`,
            when: daysAgoText(r.daysSince),
          })}</dd>
        <dt>${tx('core.dashboard.card.fourWeeks')}</dt>
        <dd>${t(many(r.trend.recent, 'core.dashboard.card.recent'), { n: r.trend.recent })} <span class="muted">${tx('core.dashboard.card.previous', { n: r.trend.previous })}</span></dd>
        <dt>${tx('core.dashboard.card.next')}</dt>
        <dd>${r.nextScheduled ? formatDateTime(r.nextScheduled.scheduledFor) : html`<strong>${tx('core.dashboard.card.nothingScheduled')}</strong>`}</dd>
        ${r.missedRecently ? html`<dt>${tx('core.dashboard.card.missed')}</dt><dd>${t(many(r.missedRecently, 'core.home.row.missed'), { n: r.missedRecently })}</dd>` : ''}
      </dl>
      <p class="advice">${r.status === 'ok' && r.trend.dropping ? t('core.dashboard.card.fading') : r.info.advice}</p>
      ${weeklyChart(r.weekly, { idPrefix: `chart-${senior.id}`, name: first })}
      <p class="actions">
        ${r.status === 'needs_match'
          ? html`<a class="button" href="/admin/match?seniorId=${senior.id}">${tx('core.dashboard.card.findCompanion', { name: first })}</a>`
          : html`<a class="button button-secondary" href="/seniors/${senior.id}">${tx('core.dashboard.card.viewProfile', { name: first })}</a>`}
        <a class="button button-secondary" href="/seniors/${senior.id}/summary">${tx('core.dashboard.card.summary')}<span class="visually-hidden"> ${tx('core.dashboard.card.summaryFor', { name: first })}</span></a>
      </p>
    </li>`;
}
