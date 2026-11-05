// Matching screens: pick a senior, then review ranked volunteer suggestions.

import { html } from '../html.js';
import { chips, slotList, methodLabel, backLink, emptyState, banner, tx, many } from '../components.js';
import { WEIGHTS } from '../../matching.js';
import { townOf } from '../../towns/index.js'; // [towns]
import { t } from '../../i18n/index.js'; // [v2 i18n]

export function matchIndexPage({ unmatched, matched }) {
  return html`
    <h1>${tx('core.match.title')}</h1>
    <p class="lead">${tx('core.match.lead')}</p>

    <section class="panel" aria-labelledby="unmatched-heading">
      <h2 id="unmatched-heading">${tx('core.match.waiting', { n: unmatched.length })}</h2>
      ${unmatched.length
        ? html`<ul class="card-list">${unmatched.map(
            (s) => html`<li class="card">
              <h3 class="card-title">${s.name}</h3>
              <p class="card-meta">${tx('core.match.prefers', { method: methodLabel(s.contactMethod).toLowerCase() })}</p>
              ${chips(s.interests)}
              <p><a class="button" href="/admin/match?seniorId=${s.id}">${tx('core.dashboard.card.findCompanion', { name: s.preferredName || s.name.split(' ')[0] })}</a></p>
            </li>`
          )}</ul>`
        : emptyState(html`<p><strong>${tx('core.match.everyoneMatched')}</strong> ${tx('core.match.whenYouAdd', { link: html`<a href="/admin/seniors/new">${tx('core.match.addSenior')}</a>` })}</p>`)}
    </section>

    <section class="panel" aria-labelledby="matched-heading">
      <h2 id="matched-heading">${tx('core.match.current', { n: matched.length })}</h2>
      ${matched.length
        ? html`<ul class="plain-list">
        ${matched.map(
          ({ senior, volunteer }) => html`<li>${tx('core.contacts.form.pair', { senior: html`<a href="/seniors/${senior.id}">${senior.name}</a>`, volunteer: html`<a href="/volunteers/${volunteer.id}">${volunteer.name}</a>` })} · <a href="/admin/match?seniorId=${senior.id}">${tx('core.match.review')}<span class="visually-hidden"> ${tx('core.dashboard.card.summaryFor', { name: senior.name })}</span></a></li>`
        )}
      </ul>`
        : emptyState(html`<p><strong>${tx('core.match.noMatches')}</strong> ${tx('core.match.chooseAbove')}</p>`)}
    </section>
    ${howMatchingWorks()}`;
}

function howMatchingWorks() {
  return html`
    <section class="panel explain" aria-labelledby="how-heading">
      <h2 id="how-heading">${tx('core.match.how.heading')}</h2>
      <ol>
        <li><strong>${tx('core.match.how.mustHaves')}</strong> ${tx('core.match.how.mustHavesText')} ${t('lang.match.howLanguage')}</li>
        <li><strong>${tx('core.match.how.points')}</strong> ${tx('core.match.how.pointsInterest', { points: WEIGHTS.perSharedInterest })} ${tx('core.match.how.pointsSlot', { points: WEIGHTS.perSharedSlot, max: WEIGHTS.maxCountedSlots })} ${t('lang.match.howPoints', { points: WEIGHTS.sharedLanguage })} ${tx('core.match.how.pointsNew', { points: WEIGHTS.newVolunteerBonus })}</li>
        <li><strong>${tx('core.match.how.ranking')}</strong> ${tx('core.match.how.rankingText')}</li>
        <li><strong>${tx('core.match.how.noAi')}</strong> ${tx('core.match.how.noAiText')}</li>
      </ol>
    </section>`;
}

export function matchSeniorPage({ senior, currentMatch, currentVolunteer, ranking: allRanked }) {
  const first = senior.preferredName || senior.name.split(' ')[0];
  // The current companion is shown in their own panel, so they never appear
  // in the lists below (where "At capacity" would count this senior against them).
  const others = (list) => list.filter((r) => !currentVolunteer || r.volunteer.id !== currentVolunteer.id);
  const ranking = { eligible: others(allRanked.eligible), ineligible: others(allRanked.ineligible) };
  return html`
    ${backLink('/admin/match', t('core.back.allMatches'))}
    <h1>${tx('core.dashboard.card.findCompanion', { name: senior.name })}</h1>

    <section class="panel" aria-labelledby="senior-summary-heading">
      <h2 id="senior-summary-heading">${tx('core.match.glance', { name: first })}</h2>
      <p>${tx('core.match.glanceText', { method: html`<strong>${tx('core.senior.about.prefersMethod', { method: methodLabel(senior.contactMethod).toLowerCase() })}</strong>`, town: townOf(senior) })}</p>
      <h3>${tx('core.senior.about.interests')}</h3>
      ${chips(senior.interests)}
      <h3>${tx('core.senior.about.available')}</h3>
      ${slotList(senior.availability)}
    </section>

    ${currentMatch
      ? html`
        <section class="panel notice-panel" aria-labelledby="current-heading">
          <h2 id="current-heading">${tx('core.match.already', { name: first, volunteer: currentVolunteer.name })}</h2>
          <p>${tx('core.match.alreadyText')}</p>
          <form method="post" action="/admin/matches/${currentMatch.id}/end" class="inline-form">
            <button type="submit" class="button button-secondary">${tx('core.match.end', { volunteer: currentVolunteer.name })}</button>
          </form>
        </section>`
      : ''}

    <section aria-labelledby="suggestions-heading">
      <h2 id="suggestions-heading">${tx('core.match.suggested', { n: ranking.eligible.length })}</h2>
      ${ranking.eligible.length
        ? html`<ol class="match-list">${ranking.eligible.map(
            (r, i) => html`
            <li class="card match-card${i === 0 ? ' top-match' : ''}">
              <div class="match-head">
                <h3 class="card-title">${i === 0 ? html`<span class="badge badge-best">${tx('core.match.best')}</span> ` : ''}${r.volunteer.name}</h3>
                <p class="score">${tx('core.match.score', { score: html`<span class="score-number">${r.score}</span>` })}</p>
              </div>
              <p class="card-meta">${r.volunteer.affiliation || t('core.volunteers.community')} · ${townOf(r.volunteer)} · ${tx(many(r.volunteer.maxSeniors, 'core.match.load'), { n: r.currentLoad, max: r.volunteer.maxSeniors })}</p>
              ${r.usesTranslateHelp ? html`<p class="badges"><span class="badge badge-translate">${t('lang.match.translateBadge')}</span></p>` : ''}
              <table class="breakdown">
                <caption class="visually-hidden">${tx('core.match.why', { name: r.volunteer.name, score: r.score })}</caption>
                <thead><tr><th scope="col">${tx('core.match.reason')}</th><th scope="col" class="num">${tx('core.match.pointsColumn')}</th></tr></thead>
                <tbody>
                  ${r.breakdown.map((b) => html`<tr><th scope="row">${b.label}${b.detail ? html`<span class="detail">${b.detail}</span>` : ''}</th><td class="num">+${b.points}</td></tr>`)}
                </tbody>
                <tfoot><tr><th scope="row">${tx('core.match.total')}</th><td class="num">${r.score}</td></tr></tfoot>
              </table>
              ${currentMatch
                ? ''
                : html`<form method="post" action="/admin/matches" class="inline-form">
                    <input type="hidden" name="seniorId" value="${senior.id}">
                    <input type="hidden" name="volunteerId" value="${r.volunteer.id}">
                    <button type="submit" class="button${i === 0 ? '' : ' button-secondary'}">${tx('core.match.confirm', { name: first, volunteer: r.volunteer.name.split(' ')[0] })}</button>
                  </form>`}
            </li>`
          )}</ol>`
        : banner({ kind: 'warning', text: t('core.match.noneEligible', { name: first, method: methodLabel(senior.contactMethod).toLowerCase() }) })}
    </section>

    ${ranking.ineligible.length
      ? html`
        <section class="panel" aria-labelledby="ineligible-heading">
          <h2 id="ineligible-heading">${tx('core.match.notSuggested', { n: ranking.ineligible.length })}</h2>
          <ul class="plain-list">
            ${ranking.ineligible.map(
              (r) => html`<li><strong>${r.volunteer.name}</strong>: ${r.problems.join('; ')}.${r.sharedInterests.length ? ` ${t(many(r.sharedInterests.length, 'core.match.wouldShare'), { n: r.sharedInterests.length })}` : ''}</li>`
            )}
          </ul>
        </section>`
      : ''}
    ${howMatchingWorks()}`;
}
