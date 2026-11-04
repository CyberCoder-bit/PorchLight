// "Needs attention" queue and the re-match confirm page.

import { html, formatDate, formatLongDate, daysAgoText, plural } from '../html.js';
import { statusBadge, trendBadge, methodLabel } from '../components.js';
import { STATUS_INFO } from '../../risk.js';
import { firstName, missedReasonLabel } from '../../features/words.js';

export function attentionPage({ items, comingUp, thresholdDays }) {
  return html`
    <h1>Needs attention</h1>
    ${items.length
      ? html`
        <p class="lead">${plural(items.length, 'senior')} ${items.length === 1 ? 'needs' : 'need'} a hand today. Each one has a reason and one suggested next step.</p>
        <p><strong>Most urgent first:</strong> ${STATUS_INFO.at_risk.label}, then ${STATUS_INFO.needs_match.label}, then ${STATUS_INFO.due_soon.label}, then ${STATUS_INFO.ok.label}. Within each group, whoever has gone longest without a check-in comes first.</p>
        <ol class="match-list">${items.map((item, i) => queueCard(item, i + 1))}</ol>`
      : html`
        <section class="panel welcome" aria-labelledby="empty-heading">
          <h2 id="empty-heading"><span aria-hidden="true">✓ </span>Everyone has had a recent check-in.</h2>
          <p>Nobody is at isolation risk, waiting for a companion, dropping off, or missing calls right now.</p>
          <p><a href="/dashboard">Open the Family Dashboard</a></p>
        </section>`}

    ${comingUp.length
      ? html`
        <section class="panel" aria-labelledby="soon-heading">
          <h2 id="soon-heading">Not on the list yet, but due soon</h2>
          <ul class="plain-list">
            ${comingUp.map(
              (a) => html`<li>${statusBadge(a.status, a.info)} <a href="/seniors/${a.senior.id}">${a.senior.name}</a>: ${a.lastContact ? `last check-in ${daysAgoText(a.daysSince)}` : 'first call still to come'}.</li>`
            )}
          </ul>
        </section>`
      : ''}

    <section class="panel explain" aria-labelledby="rules-heading">
      <h2 id="rules-heading">Who shows up here</h2>
      <ul>
        <li>${statusBadge('at_risk', STATUS_INFO.at_risk)} No completed call or visit in more than ${plural(thresholdDays, 'day')}.</li>
        <li>${trendBadge({ dropping: true })} Check-ins in the last 4 weeks fell to half (or less) of the 4 weeks before.</li>
        <li>${statusBadge('needs_match', STATUS_INFO.needs_match)} Not matched with a volunteer.</li>
        <li><span class="badge badge-missed">Missed call</span> A call or visit was missed in the last 2 weeks.</li>
      </ul>
      <p>The flags and the suggested steps follow fixed rules. No AI is used on this page.</p>
    </section>`;
}

function queueCard(item, position) {
  const { senior, assessment: a, volunteer, missed, reason, step } = item;
  return html`
    <li class="card dash-card dash-${a.status}" id="senior-${senior.id}">
      <div class="dash-head">
        <h2 class="card-title">${position}. <a href="/seniors/${senior.id}">${senior.name}</a></h2>
        <p class="badges">${statusBadge(a.status, a.info)} ${trendBadge(a.trend)}${missed.length ? html` <span class="badge badge-missed">${plural(missed.length, 'missed call')}</span>` : ''}</p>
      </div>
      <p><strong>Why:</strong> ${reason}</p>
      <p class="card-meta">${volunteer ? html`Companion: <a href="/volunteers/${volunteer.id}">${volunteer.name}</a>` : 'No companion right now'}</p>
      ${missed.length
        ? html`
          <h3>Missed calls</h3>
          <ul class="plain-list">
            ${missed.map(
              (c) => html`<li><strong>${formatDate(c.scheduledFor)}</strong>: ${methodLabel(c.type)}${c.volunteer ? ` with ${c.volunteer.name}` : ''}. Reason: ${missedReasonLabel(c.missedReason)}.${c.missedNote ? html` <span class="muted">Note: ${c.missedNote}</span>` : ''}</li>`
            )}
          </ul>`
        : ''}
      <h3>Suggested next step: ${step.title}</h3>
      <p class="advice">${step.detail}</p>
      <p class="actions">
        <a class="button" href="${step.href}">${step.linkText}</a>
        ${secondaryLinks(item)}
      </p>
    </li>`;
}

// Other useful actions, shown as secondary buttons (never the main one).
function secondaryLinks({ senior, match, step }) {
  const name = firstName(senior);
  const links = [];
  if (match && step.kind !== 'schedule') links.push({ href: `/contacts?seniorId=${senior.id}`, text: 'Schedule a call' });
  if (match && step.kind !== 'rematch') links.push({ href: `/attention/${senior.id}/rematch`, text: 'Find a new companion' });
  if (step.kind !== 'family') links.push({ href: `/seniors/${senior.id}/summary`, text: 'Family summary' });
  return links.map(
    (l) => html`<a class="button button-secondary button-small" href="${l.href}">${l.text}<span class="visually-hidden"> for ${name}</span></a> `
  );
}

export function rematchPage({ senior, match, volunteer, together, missedWithVolunteer }) {
  const name = firstName(senior);
  if (!match) {
    return html`
      <p class="breadcrumb"><a href="/attention">← Back to Needs attention</a></p>
      <h1>${senior.name} has no companion right now</h1>
      <p>There is no match to end. You can choose a companion for ${name} on the Match page.</p>
      <p class="actions"><a class="button" href="/match?seniorId=${senior.id}">Find a companion for ${name}</a></p>`;
  }
  const vName = volunteer ? volunteer.name : 'their current companion';
  const vFirst = volunteer ? firstName(volunteer) : 'them';
  const last = together[0];
  return html`
    <p class="breadcrumb"><a href="/attention">← Back to Needs attention</a></p>
    <h1>Find a new companion for ${senior.name}?</h1>

    <section class="panel notice-panel" aria-labelledby="current-heading">
      <h2 id="current-heading">Current companion: ${vName}</h2>
      <dl class="facts">
        <dt>Matched since</dt><dd>${formatLongDate(match.createdAt)}</dd>
        <dt>Check-ins together</dt><dd>${plural(together.length, 'completed call or visit', 'completed calls and visits')}</dd>
        <dt>Last check-in</dt><dd>${last ? `${formatLongDate(last.completedAt)} (${methodLabel(last.type).toLowerCase()})` : 'None yet'}</dd>
        <dt>Missed in the last 2 weeks</dt><dd>${missedWithVolunteer.length
          ? html`${plural(missedWithVolunteer.length, 'call')}: ${missedWithVolunteer.map((c, i) => html`${i ? '; ' : ''}${formatDate(c.scheduledFor)} (${missedReasonLabel(c.missedReason)})`)}`
          : 'None'}</dd>
      </dl>
    </section>

    <section class="panel" aria-labelledby="what-heading">
      <h2 id="what-heading">What happens next</h2>
      <ul class="plain-list">
        <li>The match between ${name} and ${vName} ends today. ${vFirst} gets a free spot for someone else.</li>
        <li><strong>Nothing is deleted.</strong> Every past call and visit stays in ${name}'s history and still counts on the Family Dashboard.</li>
        <li>You go straight to the Match page to choose ${name}'s new companion. You can pick ${vFirst} again if they are still the best fit.</li>
      </ul>
      <div class="actions">
        <form method="post" action="/matches/${match.id}/end" class="inline-form">
          <button type="submit" class="button button-danger">End match with ${vName} and choose someone new</button>
        </form>
        <a class="button button-secondary" href="/attention">Keep ${vFirst} as ${name}'s companion</a>
      </div>
    </section>`;
}
