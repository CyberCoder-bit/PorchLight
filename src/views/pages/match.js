// Matching screens: pick a senior, then review ranked volunteer suggestions.

import { html } from '../html.js';
import { chips, slotList, methodLabel } from '../components.js';
import { WEIGHTS } from '../../matching.js';

export function matchIndexPage({ unmatched, matched }) {
  return html`
    <h1>Match a senior with a companion</h1>
    <p class="lead">PorchLight suggests volunteers who share a senior's interests and free time. You make the final call.</p>

    <section class="panel" aria-labelledby="unmatched-heading">
      <h2 id="unmatched-heading">Waiting for a companion (${unmatched.length})</h2>
      ${unmatched.length
        ? html`<ul class="card-list">${unmatched.map(
            (s) => html`<li class="card">
              <h3 class="card-title">${s.name}</h3>
              <p class="card-meta">Prefers ${methodLabel(s.contactMethod).toLowerCase()}s</p>
              ${chips(s.interests)}
              <p><a class="button" href="/match?seniorId=${s.id}">Find a companion for ${s.preferredName || s.name.split(' ')[0]}</a></p>
            </li>`
          )}</ul>`
        : html`<p>Everyone has a companion right now.</p>`}
    </section>

    <section class="panel" aria-labelledby="matched-heading">
      <h2 id="matched-heading">Current matches (${matched.length})</h2>
      <ul class="plain-list">
        ${matched.map(
          ({ senior, volunteer }) => html`<li><a href="/seniors/${senior.id}">${senior.name}</a> with <a href="/volunteers/${volunteer.id}">${volunteer.name}</a> · <a href="/match?seniorId=${senior.id}">review match</a></li>`
        )}
      </ul>
    </section>
    ${howMatchingWorks()}`;
}

function howMatchingWorks() {
  return html`
    <section class="panel explain" aria-labelledby="how-heading">
      <h2 id="how-heading">How matching works</h2>
      <ol>
        <li><strong>Must-haves.</strong> A volunteer is only suggested if they have room for another senior, share at least one weekly time slot, and offer the senior's preferred way to connect.</li>
        <li><strong>Points.</strong> +${WEIGHTS.perSharedInterest} for each shared interest. +${WEIGHTS.perSharedSlot} for each shared time slot (up to ${WEIGHTS.maxCountedSlots}). +${WEIGHTS.newVolunteerBonus} if the volunteer has no seniors yet.</li>
        <li><strong>Ranking.</strong> Highest score first. Ties go to the volunteer with fewer seniors.</li>
      </ol>
    </section>`;
}

export function matchSeniorPage({ senior, currentMatch, currentVolunteer, ranking }) {
  const first = senior.preferredName || senior.name.split(' ')[0];
  return html`
    <p class="breadcrumb"><a href="/match">← All matches</a></p>
    <h1>Find a companion for ${senior.name}</h1>

    <section class="panel" aria-labelledby="senior-summary-heading">
      <h2 id="senior-summary-heading">${first} at a glance</h2>
      <p>Prefers <strong>${methodLabel(senior.contactMethod).toLowerCase()}s</strong>.</p>
      <h3>Interests</h3>
      ${chips(senior.interests)}
      <h3>Usually available</h3>
      ${slotList(senior.availability)}
    </section>

    ${currentMatch
      ? html`
        <section class="panel notice-panel" aria-labelledby="current-heading">
          <h2 id="current-heading">${first} is already matched with ${currentVolunteer.name}</h2>
          <p>To choose someone else, end the current match first. Past calls stay in the history.</p>
          <form method="post" action="/matches/${currentMatch.id}/end" class="inline-form">
            <button type="submit" class="button button-secondary">End match with ${currentVolunteer.name}</button>
          </form>
        </section>`
      : ''}

    <section aria-labelledby="suggestions-heading">
      <h2 id="suggestions-heading">Suggested companions (${ranking.eligible.length})</h2>
      ${ranking.eligible.length
        ? html`<ol class="match-list">${ranking.eligible.map(
            (r, i) => html`
            <li class="card match-card${i === 0 ? ' top-match' : ''}">
              <div class="match-head">
                <h3 class="card-title">${i === 0 ? html`<span class="badge badge-best">Best match</span> ` : ''}${r.volunteer.name}</h3>
                <p class="score"><span class="score-number">${r.score}</span> points</p>
              </div>
              <p class="card-meta">${r.volunteer.affiliation || 'Community volunteer'} · currently has ${r.currentLoad} of ${r.volunteer.maxSeniors}</p>
              <table class="breakdown">
                <caption class="visually-hidden">Why ${r.volunteer.name} scored ${r.score} points</caption>
                <thead><tr><th scope="col">Reason</th><th scope="col" class="num">Points</th></tr></thead>
                <tbody>
                  ${r.breakdown.map((b) => html`<tr><th scope="row">${b.label}<span class="detail">${b.detail}</span></th><td class="num">+${b.points}</td></tr>`)}
                </tbody>
                <tfoot><tr><th scope="row">Total</th><td class="num">${r.score}</td></tr></tfoot>
              </table>
              ${currentMatch
                ? ''
                : html`<form method="post" action="/matches" class="inline-form">
                    <input type="hidden" name="seniorId" value="${senior.id}">
                    <input type="hidden" name="volunteerId" value="${r.volunteer.id}">
                    <button type="submit" class="button">Match ${first} with ${r.volunteer.name.split(' ')[0]}</button>
                  </form>`}
            </li>`
          )}</ol>`
        : html`<p class="notice">No volunteer meets all the must-haves right now. Try adding availability, or recruit a volunteer who offers ${methodLabel(senior.contactMethod).toLowerCase()}s.</p>`}
    </section>

    ${ranking.ineligible.length
      ? html`
        <section class="panel" aria-labelledby="ineligible-heading">
          <h2 id="ineligible-heading">Not suggested (${ranking.ineligible.length})</h2>
          <ul class="plain-list">
            ${ranking.ineligible.map(
              (r) => html`<li><strong>${r.volunteer.name}</strong>: ${r.problems.join('; ')}.${r.sharedInterests.length ? ` (Would share ${r.sharedInterests.length} interest${r.sharedInterests.length === 1 ? '' : 's'}.)` : ''}</li>`
            )}
          </ul>
        </section>`
      : ''}
    ${howMatchingWorks()}`;
}
