// Caregiver / family dashboard: who is connected, who is drifting, and who
// needs a call today.

import { html, formatDate, formatDateTime, daysAgoText, plural } from '../html.js';
import { statusBadge, trendBadge, methodLabel, errorSummary } from '../components.js';
import { weeklyChart } from '../chart.js';
import { STATUS_INFO } from '../../risk.js';

export function dashboardPage({ summary, threshold, volunteersById, errors = {}, thresholdInput }) {
  const counts = Object.fromEntries(Object.keys(STATUS_INFO).map((k) => [k, summary.filter((r) => r.status === k).length]));
  const flagged = counts.at_risk + counts.needs_match;

  return html`
    <h1>Family dashboard</h1>
    <p class="lead">How often each senior is hearing from their companion. A flag goes up when contact drops off, before isolation becomes a crisis.</p>

    <section class="summary-tiles" aria-label="Summary">
      <div class="tile tile-at_risk"><p class="tile-value">${counts.at_risk}</p><p class="tile-label"><span aria-hidden="true">${STATUS_INFO.at_risk.icon}</span> Isolation risk</p></div>
      <div class="tile tile-needs_match"><p class="tile-value">${counts.needs_match}</p><p class="tile-label"><span aria-hidden="true">${STATUS_INFO.needs_match.icon}</span> Needs a companion</p></div>
      <div class="tile tile-due_soon"><p class="tile-value">${counts.due_soon}</p><p class="tile-label"><span aria-hidden="true">${STATUS_INFO.due_soon.icon}</span> Check in soon</p></div>
      <div class="tile tile-ok"><p class="tile-value">${counts.ok}</p><p class="tile-label"><span aria-hidden="true">${STATUS_INFO.ok.icon}</span> Connected</p></div>
    </section>

    <section class="panel threshold-panel" aria-labelledby="threshold-heading">
      <h2 id="threshold-heading">Alert setting</h2>
      ${errorSummary(errors)}
      <form method="post" action="/settings" class="threshold-form" novalidate>
        <div class="field${errors.riskThresholdDays ? ' has-error' : ''}">
          <label for="field-riskThresholdDays">Flag a senior after this many days without contact</label>
          ${errors.riskThresholdDays ? html`<p class="field-error" id="error-riskThresholdDays"><span aria-hidden="true">⚠ </span>${errors.riskThresholdDays}</p>` : ''}
          <div class="inline-input">
            <input id="field-riskThresholdDays" name="riskThresholdDays" type="number" inputmode="numeric" min="1" max="60"
              value="${thresholdInput ?? threshold}"${errors.riskThresholdDays ? html` aria-invalid="true" aria-describedby="error-riskThresholdDays"` : ''}>
            <span>days</span>
            <button type="submit" class="button">Update</button>
          </div>
        </div>
      </form>
      <p class="muted">Right now: <strong>${plural(flagged, 'senior')}</strong> flagged. "Check in soon" starts ${Math.max(1, threshold - 2)} days after the last contact.</p>
    </section>

    <h2 class="section-heading">Seniors, most urgent first</h2>
    <ul class="dashboard-grid">
      ${summary.map((r) => seniorCard(r, volunteersById))}
    </ul>

    <section class="panel explain" aria-labelledby="flags-heading">
      <h2 id="flags-heading">How the flags work</h2>
      <ul>
        <li>${statusBadge('at_risk', STATUS_INFO.at_risk)} No completed call or visit in more than <strong>${threshold} days</strong>.</li>
        <li>${statusBadge('due_soon', STATUS_INFO.due_soon)} Getting close: ${Math.max(1, threshold - 2)} to ${threshold} days since the last contact, or a new match still waiting for the first call.</li>
        <li>${statusBadge('needs_match', STATUS_INFO.needs_match)} Not matched with a companion yet.</li>
        <li>${trendBadge({ dropping: true })} Check-ins in the last 4 weeks fell to half (or less) of the 4 weeks before. This catches a slow fade early.</li>
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
      ${senior.caregiver?.name ? html`<p class="card-meta">Family: ${senior.caregiver.name} (${senior.caregiver.relationship})</p>` : ''}
      <dl class="facts compact">
        <dt>Last contact</dt>
        <dd>${last
          ? html`<strong>${daysAgoText(r.daysSince)}</strong> (${formatDate(last.completedAt)}, ${methodLabel(last.type).toLowerCase()}${lastVolunteer ? ` with ${lastVolunteer.name}` : ''})`
          : r.since.kind === 'match'
            ? html`<strong>None yet</strong> (matched ${daysAgoText(r.daysSince)})`
            : html`<strong>None yet</strong> (joined ${daysAgoText(r.daysSince)})`}</dd>
        <dt>Last 4 weeks</dt>
        <dd>${plural(r.trend.recent, 'check-in')} <span class="muted">(${r.trend.previous} the 4 weeks before)</span></dd>
        <dt>Next scheduled</dt>
        <dd>${r.nextScheduled ? formatDateTime(r.nextScheduled.scheduledFor) : html`<strong>Nothing scheduled</strong>`}</dd>
        ${r.missedRecently ? html`<dt>Missed recently</dt><dd>${plural(r.missedRecently, 'missed call', 'missed calls')} in the last 2 weeks</dd>` : ''}
      </dl>
      <p class="advice">${r.info.advice}</p>
      ${weeklyChart(r.weekly, { idPrefix: `chart-${senior.id}`, name: first })}
      <p class="actions">
        ${r.status === 'needs_match'
          ? html`<a class="button" href="/match?seniorId=${senior.id}">Find a companion</a>`
          : html`<a class="button button-secondary" href="/seniors/${senior.id}">View ${first}'s profile</a>`}
      </p>
    </li>`;
}
