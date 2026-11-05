// Home, "How the AI works", demo reset, and error pages.

import { html } from '../html.js';
import { statusBadge, trendBadge, banner, backLink, emptyState, tx, many } from '../components.js';
import { COMMUNITY } from '../../community.js';
import { attentionBreakdown, attentionReason } from '../../risk.js';
import { t } from '../../i18n/index.js'; // [v2 i18n]

// One short reason per senior on the Needs attention list (the same rule as /attention).
function attentionRowText(r) {
  switch (attentionReason(r)) {
    case 'needs_match': return t('core.home.row.needsMatch');
    case 'at_risk': return t(many(r.daysSince, 'core.home.row.atRisk'), { n: r.daysSince });
    case 'dropping': return t('core.home.row.dropping', { recent: r.trend.recent, previous: r.trend.previous });
    default: return t(many(r.missedRecently, 'core.home.row.missed'), { n: r.missedRecently });
  }
}

// `attention`: the seniors on the Needs attention list (needsAttention() in src/risk.js).
export function homePage({ stats, attention }) {
  const { town, county } = COMMUNITY;
  const breakdown = attentionBreakdown(attention);
  return html`
    <section class="hero" aria-labelledby="hero-heading">
      <p class="eyebrow">${tx('core.home.eyebrow', { town, county })}</p>
      <h1 id="hero-heading">${tx('core.home.title')}</h1>
      <p class="lead">${tx('core.home.lead')}</p>
      <p class="hero-fact">${tx('core.home.fact', {
        source: html`<a href="https://www.incontext.indiana.edu/2024/nov-dec/article1.asp">${tx('core.home.factSource')}</a>`,
        advisory: html`<a href="https://www.hhs.gov/sites/default/files/surgeon-general-social-connection-advisory.pdf">${tx('core.home.factAdvisory')}</a>`,
      })}</p>
      <p class="button-row">
        <a class="button" href="/tour">${tx('core.home.tourButton')} <span aria-hidden="true">→</span></a>
        <a class="button button-secondary" href="/admin/dashboard">${tx('core.home.openDashboard')}</a>
      </p>
    </section>

    <section aria-labelledby="loop-heading">
      <h2 id="loop-heading">${tx('core.home.loop.heading')}</h2>
      <ol class="loop" role="list">
        <li class="loop-step">
          <h3><span class="loop-number" aria-hidden="true">1</span> ${tx('core.home.loop.match')}</h3>
          <p>${tx('core.home.loop.matchText')}</p>
        </li>
        <li class="loop-step">
          <h3><span class="loop-number" aria-hidden="true">2</span> ${tx('core.home.loop.connect')}</h3>
          <p>${tx('core.home.loop.connectText')}</p>
        </li>
        <li class="loop-step">
          <h3><span class="loop-number" aria-hidden="true">3</span> ${tx('core.home.loop.spark')}</h3>
          <p>${tx('core.home.loop.sparkText')}</p>
        </li>
        <li class="loop-step">
          <h3><span class="loop-number" aria-hidden="true">4</span> ${tx('core.home.loop.watch')}</h3>
          <p>${tx('core.home.loop.watchText')}</p>
        </li>
      </ol>
    </section>

    <h2 class="section-heading" id="today-heading">${tx('core.home.today')}</h2>
    <section class="summary-tiles" aria-labelledby="today-heading">
      <div class="tile"><p class="tile-value">${stats.seniors}</p><p class="tile-label">${tx(many(stats.seniors, 'core.home.tile.seniors'))}</p></div>
      <div class="tile"><p class="tile-value">${stats.activeMatches}</p><p class="tile-label">${tx(many(stats.activeMatches, 'core.home.tile.matched'))}</p></div>
      <div class="tile"><p class="tile-value">${stats.checkInsThisWeek}</p><p class="tile-label">${tx(many(stats.checkInsThisWeek, 'core.home.tile.checkIns'))}</p></div>
      <div class="tile${stats.flagged ? ' tile-at_risk' : ''}">
        <p class="tile-value">${stats.flagged}</p>
        <p class="tile-label">${tx(many(stats.flagged, 'core.home.tile.flagged'))}</p>
        ${breakdown ? html`<p class="tile-detail">${breakdown}</p>` : ''}
      </div>
    </section>

    ${attention.length
      ? html`
      <section class="panel notice-panel" aria-labelledby="attention-heading">
        <h2 id="attention-heading">${tx(many(attention.length, 'core.home.attention.count'), { n: attention.length })}</h2>
        <p>${breakdown}.</p>
        <ul class="plain-list">
          ${attention.map(
            (r) => html`<li>${statusBadge(r.status, r.info)} ${trendBadge(r.trend)} <a href="/seniors/${r.senior.id}">${r.senior.name}</a>: ${attentionRowText(r)}</li>`
          )}
        </ul>
        <p class="button-row">
          <a class="button button-secondary print-url" href="/admin/attention">${tx('core.home.attention.open')}</a>
          <a class="button button-secondary" href="/admin/dashboard">${tx('core.home.openDashboard')}</a>
        </p>
      </section>`
      : html`
      <section class="panel" aria-labelledby="attention-heading">
        <h2 id="attention-heading">${tx('core.home.attention.heading')}</h2>
        ${emptyState(html`<p><strong>${tx('core.home.attention.noneTitle')}</strong> ${tx('core.home.attention.noneText')}</p>
          <p><a href="/admin/dashboard">${tx('core.home.attention.seeDashboard')}</a></p>`)}
      </section>`}

    <h2 class="section-heading">${tx('core.home.roles.heading')}</h2>
    <ul class="role-grid">
      <li class="card role-card">
        <h3 class="card-title">${tx('core.home.roles.senior')}</h3>
        <p>${tx('core.home.roles.seniorText')}</p>
        <p><a class="button button-secondary" href="/sign-in#as-senior-heading">${tx('core.home.roles.seniorButton')}</a></p>
      </li>
      <li class="card role-card">
        <h3 class="card-title">${tx('core.home.roles.volunteer')}</h3>
        <p>${tx('core.home.roles.volunteerText')}</p>
        <p><a class="button button-secondary" href="/admin/volunteers">${tx('core.home.roles.volunteerButton')}</a></p>
      </li>
      <li class="card role-card">
        <h3 class="card-title">${tx('core.home.roles.family')}</h3>
        <p>${tx('core.home.roles.familyText')}</p>
        <p><a class="button button-secondary" href="/admin/dashboard">${tx('core.home.roles.familyButton')}</a></p>
      </li>
      <li class="card role-card">
        <h3 class="card-title">${tx('core.home.roles.coordinator')}</h3>
        <p>${tx('core.home.roles.coordinatorText')}</p>
        <p><a class="button button-secondary" href="/admin/match">${tx('core.home.roles.coordinatorButton')}</a></p>
      </li>
    </ul>`;
}

// `lastFallback`: set when LIVE mode is on but the most recent request fell
// back to the offline ideas ({ reason }), so this page never says "Live" while
// sparks are actually coming from the built-in ideas.
export function aboutAiPage({ modeInfo, model, lastFallback = null }) {
  const live = modeInfo.effective === 'live';
  const fellBack = live && lastFallback;
  return html`
    ${backLink('/', t('core.back.home'))}
    <h1>${tx('core.about.title')}</h1>
    <p class="lead">${tx('core.about.lead')}</p>
    <section class="panel ${live && !fellBack ? 'mode-panel-live' : 'mode-panel-mock'}" aria-labelledby="mode-heading">
      <h2 id="mode-heading">${tx('core.about.rightNow', { mode: t(fellBack ? 'core.about.mode.fellBack' : live ? 'core.about.mode.live' : 'core.about.mode.offline') })}</h2>
      ${fellBack
        ? html`<p>${tx('core.about.fellBack', { reason: lastFallback.reason })}</p>`
        : ''}
      <p class="muted">${tx('core.about.technical', { reason: modeInfo.reason })}</p>
      ${modeInfo.warning ? banner({ kind: 'warning', text: modeInfo.warning }) : ''}
    </section>
    <section class="panel" aria-labelledby="what-heading">
      <h2 id="what-heading">${tx('core.about.what.heading')}</h2>
      <p>${tx('core.about.what.why')}</p>
      <p>${tx('core.about.what.labeled')}</p>
      <h3>${tx('core.about.offline.heading')}</h3>
      <p>${tx('core.about.offline.text', { town: COMMUNITY.town })}</p>
      <h3>${tx('core.about.live.heading')}</h3>
      <p>${tx('core.about.live.text', { model })}</p>
      <h3>${tx('core.about.neverSees.heading')}</h3>
      <p>${tx('core.about.neverSees.text')}</p>
      <h3>${tx('core.about.neverDecides.heading')}</h3>
      <p>${tx('core.about.neverDecides.text')}</p>
    </section>`;
}

export function resetConfirmPage() {
  return html`
    ${backLink('/tour', t('core.back.tour'))}
    <h1>${tx('core.reset.title')}</h1>
    <p class="lead">${tx('core.reset.lead')}</p>
    ${banner({ kind: 'warning', text: t('core.reset.warning') })}
    <form method="post" action="/admin/demo/reset" class="button-row">
      <button type="submit" class="button button-danger">${tx('core.reset.confirm')}</button>
      <a class="button button-secondary" href="/">${tx('core.reset.cancel')}</a>
    </form>`;
}

// What to do next, by kind of error, so an error page is never a dead end.
// [v2 i18n] Catalog keys, read when the page is drawn.
const ERROR_HELP = {
  400: { title: 'core.error.didNotWork', help: 'core.error.help400' },
  404: { title: 'core.error.notFound', help: 'core.error.help404' },
  409: { title: 'core.error.didNotWork', help: 'core.error.help409' },
  413: { title: 'core.error.tooMuch', help: 'core.error.help413' },
};

export function errorPage({ status, message }) {
  const spec = ERROR_HELP[status] || { title: 'core.error.wentWrong', help: 'core.error.helpOther' };
  return html`
    <h1>${t(spec.title)}</h1>
    ${banner({ kind: 'error', text: message, role: 'alert' })}
    <p>${t(spec.help)}</p>
    <p class="button-row">
      <a class="button" href="/">${tx('core.error.goHome')}</a>
      <a class="button button-secondary" href="/admin/attention">${tx('core.error.openAttention')}</a>
      <a class="button button-secondary" href="/contacts">${tx('core.error.openContacts')}</a>
      <a class="button button-secondary" href="/tour">${tx('core.error.openTour')}</a>
    </p>`;
}
