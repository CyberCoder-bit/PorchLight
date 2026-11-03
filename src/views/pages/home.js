// Home, "How the AI works", demo reset, and error pages.

import { html, plural } from '../html.js';
import { statusBadge } from '../components.js';

export function homePage({ stats, attention }) {
  return html`
    <section class="hero" aria-labelledby="hero-heading">
      <h1 id="hero-heading">Leave the porch light on for Carmel's seniors.</h1>
      <p class="lead">PorchLight pairs older adults with volunteer companions for regular calls and visits. It gives volunteers easy conversation starters and lets families see early when contact is fading.</p>
    </section>

    <section class="summary-tiles" aria-label="Program at a glance">
      <div class="tile"><p class="tile-value">${stats.seniors}</p><p class="tile-label">Seniors enrolled</p></div>
      <div class="tile"><p class="tile-value">${stats.activeMatches}</p><p class="tile-label">Active companions</p></div>
      <div class="tile"><p class="tile-value">${stats.checkInsThisWeek}</p><p class="tile-label">Check-ins in the last 7 days</p></div>
      <div class="tile${stats.flagged ? ' tile-at_risk' : ''}"><p class="tile-value">${stats.flagged}</p><p class="tile-label">Need attention</p></div>
    </section>

    ${attention.length
      ? html`
      <section class="panel notice-panel" aria-labelledby="attention-heading">
        <h2 id="attention-heading">Needs attention today</h2>
        <ul class="plain-list">
          ${attention.map(
            (r) => html`<li>${statusBadge(r.status, r.info)} <a href="/seniors/${r.senior.id}">${r.senior.name}</a>: ${r.status === 'needs_match' ? 'waiting for a companion' : `no contact in ${plural(r.daysSince, 'day')}`}</li>`
          )}
        </ul>
        <p><a href="/dashboard">Open the Family Dashboard</a></p>
      </section>`
      : ''}

    <h2 class="section-heading">Who are you?</h2>
    <ul class="role-grid">
      <li class="card role-card">
        <h3 class="card-title">I'm a senior</h3>
        <p>See your companion and your next call in big, clear text.</p>
        <p><a class="button" href="/seniors">Find my profile</a></p>
      </li>
      <li class="card role-card">
        <h3 class="card-title">I'm a volunteer</h3>
        <p>See your seniors, get conversation sparks, and log your calls.</p>
        <p><a class="button" href="/volunteers">Go to volunteers</a></p>
      </li>
      <li class="card role-card">
        <h3 class="card-title">I'm family or a caregiver</h3>
        <p>See how often your loved one is getting calls and visits.</p>
        <p><a class="button" href="/dashboard">Open the dashboard</a></p>
      </li>
      <li class="card role-card">
        <h3 class="card-title">I'm a coordinator</h3>
        <p>Pair new seniors with the volunteer who fits them best.</p>
        <p><a class="button" href="/match">Match seniors</a></p>
      </li>
    </ul>

    <section class="panel explain" aria-labelledby="loop-heading">
      <h2 id="loop-heading">How PorchLight works</h2>
      <ol class="steps">
        <li><strong>Match.</strong> Seniors and volunteers are paired by shared interests and overlapping free time.</li>
        <li><strong>Connect.</strong> Volunteers schedule and log weekly calls or visits.</li>
        <li><strong>Spark.</strong> Before each call, AI suggests three personal conversation starters.</li>
        <li><strong>Watch.</strong> The Family Dashboard flags anyone whose contact is dropping off.</li>
      </ol>
    </section>`;
}

export function aboutAiPage({ modeInfo, model }) {
  const live = modeInfo.effective === 'live';
  return html`
    <h1>How the AI works</h1>
    <section class="panel ${live ? 'mode-panel-live' : 'mode-panel-mock'}" aria-labelledby="mode-heading">
      <h2 id="mode-heading">Current mode: ${live ? 'LIVE (Claude)' : 'MOCK (offline)'}</h2>
      <p>${modeInfo.reason}.</p>
      ${modeInfo.warning ? html`<p class="notice">${modeInfo.warning}</p>` : ''}
    </section>
    <section class="panel" aria-labelledby="what-heading">
      <h2 id="what-heading">What "conversation sparks" are</h2>
      <p>Many volunteers are teenagers. Starting a conversation with someone 60 years older can feel awkward, and awkward calls are calls that stop happening. Sparks give the volunteer three warm, personal openers built from the senior's own interests and the time since their last talk. A long gap gets a "so glad to catch up" opener that never makes the senior feel guilty.</p>
      <h3>MOCK mode (default, works offline)</h3>
      <p>Sparks come from a hand-written bank of templates for each interest, with seasonal and Carmel-specific touches. The same inputs always give the same sparks, and "Show different sparks" picks a new set. No internet or API key is needed.</p>
      <h3>LIVE mode (with a Claude API key)</h3>
      <p>Sparks are written by Claude (${model}) through the official Anthropic SDK. If the API can't be reached, PorchLight quietly falls back to the offline templates, so a volunteer is never left empty-handed. See the README to turn this on.</p>
      <h3>Privacy</h3>
      <p>Only the senior's preferred first name, interests, "about me" text, days since the last contact, and today's date are sent to the AI. Family contacts, phone numbers, and volunteer call notes are never sent.</p>
    </section>`;
}

export function resetConfirmPage() {
  return html`
    <h1>Reset demo data?</h1>
    <p class="lead">This replaces every senior, volunteer, match, and call with the original demo data, with dates moved so the story starts "today." Use it before recording a demo.</p>
    <form method="post" action="/demo/reset" class="inline-form">
      <button type="submit" class="button button-danger">Yes, reset the demo data</button>
      <a href="/">Cancel</a>
    </form>`;
}

export function errorPage({ status, message }) {
  return html`
    <h1>${status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
    <p class="lead">${message}</p>
    <p><a class="button" href="/">Go to the home page</a></p>`;
}
