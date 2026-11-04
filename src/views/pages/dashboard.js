// Caregiver / family dashboard: who is connected, who is drifting, and who
// needs a call today.

import { html, formatDate, formatDateTime, daysAgoText, plural } from '../html.js';
import { statusBadge, trendBadge, methodLabel, errorSummary, emptyState } from '../components.js';
import { weeklyChart } from '../chart.js';
import { STATUS_INFO, needsAttention, attentionBreakdown } from '../../risk.js';

// One sentence that says exactly what every number counts, e.g.
// "2 seniors need attention: 1 at isolation risk, 1 waiting for a companion."
// Who counts is needsAttention() in src/risk.js, the same rule as Home and /attention.
function attentionSentence(flagged) {
  if (!flagged.length) return 'no seniors need attention.';
  const n = flagged.length;
  return `${plural(n, 'senior')} ${n === 1 ? 'needs' : 'need'} attention: ${attentionBreakdown(flagged)}.`;
}

const seniorWord = (n) => (n === 1 ? 'senior' : 'seniors');

export function dashboardPage({ summary, threshold, volunteersById, errors = {}, thresholdInput, townFilter = '', townName = null }) { // [towns] townFilter, townName
  const counts = Object.fromEntries(Object.keys(STATUS_INFO).map((k) => [k, summary.filter((r) => r.status === k).length]));
  const soonFrom = Math.max(1, threshold - 2);
  const flagged = summary.filter(needsAttention);
  // "1 to 3 days", or just "1 day" when the range is a single day.
  const soonRange = soonFrom >= threshold ? plural(threshold, 'day') : `${soonFrom} to ${plural(threshold, 'day')}`;

  return html`
    <h1>Family dashboard</h1>
    <p class="lead">How often each senior hears from their companion. A flag goes up when calls and visits drop off, before loneliness turns into a crisis.</p>
    ${townFilter}
    ${errorSummary(errors)}

    <section class="summary-tiles" aria-label="Seniors by status">
      <div class="tile tile-at_risk"><p class="tile-value">${counts.at_risk}</p><p class="tile-label"><span aria-hidden="true">${STATUS_INFO.at_risk.icon}</span> ${seniorWord(counts.at_risk)} at isolation risk</p></div>
      <div class="tile tile-needs_match"><p class="tile-value">${counts.needs_match}</p><p class="tile-label"><span aria-hidden="true">${STATUS_INFO.needs_match.icon}</span> ${seniorWord(counts.needs_match)} waiting for a companion</p></div>
      <div class="tile tile-due_soon"><p class="tile-value">${counts.due_soon}</p><p class="tile-label"><span aria-hidden="true">${STATUS_INFO.due_soon.icon}</span> ${seniorWord(counts.due_soon)} to check in with soon</p></div>
      <div class="tile tile-ok"><p class="tile-value">${counts.ok}</p><p class="tile-label"><span aria-hidden="true">${STATUS_INFO.ok.icon}</span> ${seniorWord(counts.ok)} connected</p></div>
    </section>
    <p class="status-line"><strong>Right now${townName ? ` in ${townName}` : ''}, ${attentionSentence(flagged)}</strong>${flagged.length ? html` <a href="/attention">See what to do next</a>` : ''}</p>

    <h2 class="section-heading">Seniors, most urgent first</h2>
    ${summary.length
      ? html`<ul class="dashboard-grid">
      ${summary.map((r) => seniorCard(r, volunteersById))}
    </ul>`
      : townName // [towns]
        ? emptyState(html`<p><strong>No seniors in ${townName}.</strong> <a href="/dashboard">Show all towns</a></p>`)
        : emptyState(html`<p><strong>No seniors yet.</strong> Add the first senior, then match them with a companion.</p>
          <p><a class="button" href="/seniors/new">Add a senior</a></p>`)}

    <section class="panel threshold-panel" aria-labelledby="threshold-heading">
      <h2 id="threshold-heading">When to raise a flag</h2>
      <form method="post" action="/settings" class="threshold-form" novalidate>
        <div class="field${errors.riskThresholdDays ? ' has-error' : ''}">
          <label for="field-riskThresholdDays">Flag a senior after this many days without a call or visit</label>
          ${errors.riskThresholdDays ? html`<p class="field-error" id="error-riskThresholdDays"><span aria-hidden="true">⚠ </span>${errors.riskThresholdDays}</p>` : ''}
          <div class="inline-input">
            <input id="field-riskThresholdDays" name="riskThresholdDays" type="number" inputmode="numeric" min="1" max="60"
              value="${thresholdInput ?? threshold}"${errors.riskThresholdDays ? html` aria-invalid="true" aria-describedby="error-riskThresholdDays"` : ''}>
            <span>days</span>
            <button type="submit" class="button button-secondary">Save setting</button>
          </div>
        </div>
      </form>
      <p class="muted">"Check in soon" starts ${plural(soonFrom, 'day')} after the last call or visit.</p>
    </section>

    <section class="panel explain" aria-labelledby="flags-heading">
      <h2 id="flags-heading">How the flags work</h2>
      <ul>
        <li>${statusBadge('at_risk', STATUS_INFO.at_risk)} No completed call or visit in more than <strong>${plural(threshold, 'day')}</strong>.</li>
        <li>${statusBadge('due_soon', STATUS_INFO.due_soon)} Getting close: ${soonRange} since the last call or visit, or a new match still waiting for the first call.</li>
        <li>${statusBadge('needs_match', STATUS_INFO.needs_match)} Not matched with a companion yet.</li>
        <li>${trendBadge({ dropping: true })} Calls and visits in the last 4 weeks fell to half (or less) of the 4 weeks before. This catches a slow fade early.</li>
      </ul>
      <p>Only completed calls and visits count. Scheduled and missed ones don't.</p>
    </section>`;
}

function seniorCard(r, volunteersById) {
  const { senior } = r;
  const first = senior.preferredName || senior.name.split(' ')[0];
  const last = r.lastContact;
  const lastVolunteer = last ? volunteersById.get(last.volunteerId) : null;
  return html`
    <li class="card dash-card dash-${r.status}">
      <div class="dash-head">
        <h3 class="card-title"><a href="/seniors/${senior.id}">${senior.name}</a></h3>
        <p class="badges">${statusBadge(r.status, r.info)} ${trendBadge(r.trend)}</p>
      </div>
      ${senior.caregiver?.name ? html`<p class="card-meta">Family: ${senior.caregiver.name}${senior.caregiver.relationship ? ` (${senior.caregiver.relationship})` : ''}</p>` : ''}
      <dl class="facts compact">
        <dt>Last call or visit</dt>
        <dd>${last
          ? html`<strong>${daysAgoText(r.daysSince)}</strong> (${formatDate(last.completedAt)}, ${methodLabel(last.type).toLowerCase()}${lastVolunteer ? ` with ${lastVolunteer.name}` : ''})`
          : r.since.kind === 'match'
            ? html`<strong>None yet</strong> (matched ${daysAgoText(r.daysSince)})`
            : html`<strong>None yet</strong> (joined ${daysAgoText(r.daysSince)})`}</dd>
        <dt>Last 4 weeks</dt>
        <dd>${plural(r.trend.recent, 'call or visit', 'calls and visits')} <span class="muted">(${r.trend.previous} in the 4 weeks before)</span></dd>
        <dt>Next call or visit</dt>
        <dd>${r.nextScheduled ? formatDateTime(r.nextScheduled.scheduledFor) : html`<strong>Nothing scheduled</strong>`}</dd>
        ${r.missedRecently ? html`<dt>Missed recently</dt><dd>${plural(r.missedRecently, 'missed call', 'missed calls')} in the last 2 weeks</dd>` : ''}
      </dl>
      <p class="advice">${r.info.advice}</p>
      ${weeklyChart(r.weekly, { idPrefix: `chart-${senior.id}`, name: first })}
      <p class="actions">
        ${r.status === 'needs_match'
          ? html`<a class="button" href="/match?seniorId=${senior.id}">Find a companion for ${first}</a>`
          : html`<a class="button button-secondary" href="/seniors/${senior.id}">View ${first}'s profile</a>`}
        <a class="button button-secondary" href="/seniors/${senior.id}/summary">Weekly summary<span class="visually-hidden"> for ${first}</span></a>
      </p>
    </li>`;
}
