// "Needs attention" queue and the re-match confirm page.
// [v2 i18n] Words are core.attention.* / core.rematch.* keys; names and notes are user data.

import { html, formatDate, formatLongDate, daysAgoText } from '../html.js';
import { statusBadge, trendBadge, methodLabel } from '../components.js';
import { STATUS_INFO } from '../../risk.js';
import { methodLower } from '../../vocab.js';
import { firstName, missedReasonLabel, tCount } from '../../features/words.js';
import { t } from '../../i18n/index.js';

export function attentionPage({ items, comingUp, thresholdDays, townFilter = '', townName = null }) { // [towns] townFilter, townName
  return html`
    <h1>${t('core.attention.title')}</h1>
    ${townFilter}
    ${items.length
      ? html`
        <p class="lead">${tCount('core.attention.lead', items.length)}</p>
        <p><strong>${t('core.attention.orderLabel')}</strong> ${t('core.attention.order', {
          atRisk: STATUS_INFO.at_risk.label,
          needsMatch: STATUS_INFO.needs_match.label,
          dueSoon: STATUS_INFO.due_soon.label,
          ok: STATUS_INFO.ok.label,
        })}</p>
        <ol class="match-list">${items.map((item, i) => queueCard(item, i + 1))}</ol>`
      : html`
        <section class="panel welcome" aria-labelledby="empty-heading">
          <h2 id="empty-heading"><span aria-hidden="true">✓ </span>${townName ? t('core.attention.emptyTown', { town: townName }) : t('core.attention.empty')}</h2>
          <p>${t('core.attention.emptyText')}</p>
          <p><a href="/admin/dashboard">${t('core.attention.openDashboard')}</a></p>
        </section>`}

    ${comingUp.length
      ? html`
        <section class="panel" aria-labelledby="soon-heading">
          <h2 id="soon-heading">${t('core.attention.soonTitle')}</h2>
          <ul class="plain-list">
            ${comingUp.map(
              (a) => html`<li>${statusBadge(a.status, a.info)} <a href="/seniors/${a.senior.id}">${a.senior.name}</a>: ${a.lastContact ? t('core.attention.soonLast', { when: daysAgoText(a.daysSince) }) : t('core.attention.soonFirst')}</li>`
            )}
          </ul>
        </section>`
      : ''}

    <section class="panel explain" aria-labelledby="rules-heading">
      <h2 id="rules-heading">${t('core.attention.rulesTitle')}</h2>
      <ul>
        <li>${statusBadge('at_risk', STATUS_INFO.at_risk)} ${tCount('core.attention.rule.atRisk', thresholdDays)}</li>
        <li>${trendBadge({ dropping: true })} ${t('core.attention.rule.dropping')}</li>
        <li>${statusBadge('needs_match', STATUS_INFO.needs_match)} ${t('core.attention.rule.needsMatch')}</li>
        <li><span class="badge badge-missed">${t('core.attention.missedBadge')}</span> ${t('core.attention.rule.missed')}</li>
      </ul>
      <p>${t('core.attention.rulesNote')}</p>
    </section>`;
}

function queueCard(item, position) {
  const { senior, assessment: a, volunteer, missed, reason, step } = item;
  return html`
    <li class="card dash-card dash-${a.status}" id="senior-${senior.id}">
      <div class="dash-head">
        <h2 class="card-title">${position}. <a href="/seniors/${senior.id}">${senior.name}</a></h2>
        <p class="badges">${statusBadge(a.status, a.info)} ${trendBadge(a.trend)}${missed.length ? html` <span class="badge badge-missed">${tCount('core.attention.missedCount', missed.length)}</span>` : ''}</p>
      </div>
      <p><strong>${t('core.attention.why')}</strong> ${reason}</p>
      <p class="card-meta">${volunteer ? html`${t('core.attention.companion')} <a href="/volunteers/${volunteer.id}">${volunteer.name}</a>` : t('core.attention.noCompanion')}</p>
      ${missed.length
        ? html`
          <h3>${t('core.attention.missedTitle')}</h3>
          <ul class="plain-list">
            ${missed.map(
              (c) => html`<li><strong>${formatDate(c.scheduledFor)}</strong>: ${c.volunteer
                ? t('core.attention.missedLineWith', { method: methodLabel(c.type), volunteer: c.volunteer.name, reason: missedReasonLabel(c.missedReason) })
                : t('core.attention.missedLine', { method: methodLabel(c.type), reason: missedReasonLabel(c.missedReason) })}${c.missedNote ? html` <span class="muted">${t('core.attention.note')} ${c.missedNote}</span>` : ''}</li>`
            )}
          </ul>`
        : ''}
      <h3>${t('core.attention.nextStep', { step: step.title })}</h3>
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
  if (match && step.kind !== 'schedule') links.push({ href: `/contacts?seniorId=${senior.id}`, text: t('core.attention.link.schedule') });
  if (match && step.kind !== 'rematch') links.push({ href: `/attention/${senior.id}/rematch`, text: t('core.attention.link.rematch') });
  if (step.kind !== 'family') links.push({ href: `/seniors/${senior.id}/summary`, text: t('core.attention.link.summary') });
  return links.map(
    (l) => html`<a class="button button-secondary button-small" href="${l.href}">${l.text}<span class="visually-hidden"> ${t('core.attention.link.forName', { name })}</span></a> `
  );
}

export function rematchPage({ senior, match, volunteer, together, missedWithVolunteer }) {
  const name = firstName(senior);
  if (!match) {
    return html`
      <p class="breadcrumb"><a href="/admin/attention">← ${t('core.rematch.back')}</a></p>
      <h1>${t('core.rematch.noneTitle', { name: senior.name })}</h1>
      <p>${t('core.rematch.noneText', { name })}</p>
      <p class="actions"><a class="button" href="/admin/match?seniorId=${senior.id}">${t('core.attention.step.firstCompanion.link', { name })}</a></p>`;
  }
  const vName = volunteer ? volunteer.name : t('core.rematch.theirCurrent');
  const vFirst = volunteer ? firstName(volunteer) : t('core.rematch.them');
  const last = together[0];
  return html`
    <p class="breadcrumb"><a href="/admin/attention">← ${t('core.rematch.back')}</a></p>
    <h1>${t('core.rematch.title', { name: senior.name })}</h1>

    <section class="panel notice-panel" aria-labelledby="current-heading">
      <h2 id="current-heading">${t('core.rematch.current', { volunteer: vName })}</h2>
      <dl class="facts">
        <dt>${t('core.rematch.since')}</dt><dd>${formatLongDate(match.createdAt)}</dd>
        <dt>${t('core.rematch.together')}</dt><dd>${tCount('core.rematch.togetherCount', together.length)}</dd>
        <dt>${t('core.rematch.last')}</dt><dd>${last ? `${formatLongDate(last.completedAt)} (${methodLower(last.type)})` : t('core.rematch.noneYet')}</dd>
        <dt>${t('core.rematch.missed')}</dt><dd>${missedWithVolunteer.length
          ? html`${tCount('core.rematch.missedCount', missedWithVolunteer.length)}: ${missedWithVolunteer.map((c, i) => html`${i ? '; ' : ''}${formatDate(c.scheduledFor)} (${missedReasonLabel(c.missedReason)})`)}`
          : t('core.rematch.none')}</dd>
      </dl>
    </section>

    <section class="panel" aria-labelledby="what-heading">
      <h2 id="what-heading">${t('core.rematch.whatTitle')}</h2>
      <ul class="plain-list">
        <li>${t('core.rematch.what1', { name, volunteer: vName, first: vFirst })}</li>
        <li><strong>${t('core.rematch.what2Strong')}</strong> ${t('core.rematch.what2', { name })}</li>
        <li>${t('core.rematch.what3', { name, first: vFirst })}</li>
      </ul>
      <div class="actions">
        <form method="post" action="/admin/matches/${match.id}/end" class="inline-form">
          <button type="submit" class="button button-danger">${t('core.rematch.endButton', { volunteer: vName })}</button>
        </form>
        <a class="button button-secondary" href="/admin/attention">${t('core.rematch.keep', { first: vFirst, name })}</a>
      </div>
    </section>`;
}
