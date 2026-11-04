// Home, "How the AI works", demo reset, and error pages.

import { html, plural } from '../html.js';
import { statusBadge, banner, backLink, emptyState } from '../components.js';
import { COMMUNITY } from '../../community.js';

// "1 at isolation risk, 1 waiting for a companion": every flagged number says
// exactly what it counts.
function attentionBreakdown(attention) {
  const atRisk = attention.filter((r) => r.status === 'at_risk').length;
  const waiting = attention.filter((r) => r.status === 'needs_match').length;
  const parts = [];
  if (atRisk) parts.push(`${atRisk} at isolation risk`);
  if (waiting) parts.push(`${waiting} waiting for a companion`);
  return parts.join(', ');
}

export function homePage({ stats, attention }) {
  const { town, county } = COMMUNITY;
  const breakdown = attentionBreakdown(attention);
  return html`
    <section class="hero" aria-labelledby="hero-heading">
      <p class="eyebrow">Built for Indiana communities, starting in ${town}, ${county}</p>
      <h1 id="hero-heading">Leave the porch light on for older neighbors.</h1>
      <p class="lead">PorchLight pairs older adults with volunteer companions for weekly calls and visits. It gives volunteers easy things to talk about, and it shows families early when the calls start to fade.</p>
      <p class="button-row">
        <a class="button" href="/tour">Take the 2-minute demo tour <span aria-hidden="true">→</span></a>
        <a class="button button-secondary" href="/dashboard">Open the Family Dashboard</a>
      </p>
    </section>

    <section aria-labelledby="loop-heading">
      <h2 id="loop-heading">How PorchLight works, in 4 steps</h2>
      <ol class="loop" role="list">
        <li class="loop-step">
          <h3><span class="loop-number" aria-hidden="true">1</span> Match</h3>
          <p>A coordinator pairs each senior with a volunteer who shares their interests and free time.</p>
        </li>
        <li class="loop-step">
          <h3><span class="loop-number" aria-hidden="true">2</span> Connect</h3>
          <p>The volunteer schedules a call or visit every week and writes down each one.</p>
        </li>
        <li class="loop-step">
          <h3><span class="loop-number" aria-hidden="true">3</span> Spark</h3>
          <p>Before each call, PorchLight suggests three friendly things to talk about.</p>
        </li>
        <li class="loop-step">
          <h3><span class="loop-number" aria-hidden="true">4</span> Watch</h3>
          <p>The Family Dashboard raises a flag when calls drop off, so someone reaches out early.</p>
        </li>
      </ol>
    </section>

    <h2 class="section-heading" id="today-heading">Today in the demo</h2>
    <section class="summary-tiles" aria-labelledby="today-heading">
      <div class="tile"><p class="tile-value">${stats.seniors}</p><p class="tile-label">${stats.seniors === 1 ? 'senior' : 'seniors'} in the program</p></div>
      <div class="tile"><p class="tile-value">${stats.activeMatches}</p><p class="tile-label">${stats.activeMatches === 1 ? 'senior has' : 'seniors have'} a companion</p></div>
      <div class="tile"><p class="tile-value">${stats.checkInsThisWeek}</p><p class="tile-label">${stats.checkInsThisWeek === 1 ? 'call or visit' : 'calls and visits'} in the last 7 days</p></div>
      <div class="tile${stats.flagged ? ' tile-at_risk' : ''}">
        <p class="tile-value">${stats.flagged}</p>
        <p class="tile-label">${stats.flagged === 1 ? 'senior needs' : 'seniors need'} attention</p>
        ${breakdown ? html`<p class="tile-detail">${breakdown}</p>` : ''}
      </div>
    </section>

    ${attention.length
      ? html`
      <section class="panel notice-panel" aria-labelledby="attention-heading">
        <h2 id="attention-heading">Needs attention today: ${plural(attention.length, 'senior')}</h2>
        <p>${breakdown}.</p>
        <ul class="plain-list">
          ${attention.map(
            (r) => html`<li>${statusBadge(r.status, r.info)} <a href="/seniors/${r.senior.id}">${r.senior.name}</a>: ${r.status === 'needs_match' ? 'waiting for a companion' : `no call or visit in ${plural(r.daysSince, 'day')}`}</li>`
          )}
        </ul>
        <p class="button-row">
          <a class="button button-secondary print-url" href="/attention">Open the Needs attention list</a>
          <a class="button button-secondary" href="/dashboard">Open the Family Dashboard</a>
        </p>
      </section>`
      : html`
      <section class="panel" aria-labelledby="attention-heading">
        <h2 id="attention-heading">Needs attention today</h2>
        ${emptyState(html`<p><strong>Nobody needs attention right now.</strong> Every senior has a companion and a recent call or visit.</p>
          <p><a href="/dashboard">See how everyone is doing on the Family Dashboard</a></p>`)}
      </section>`}

    <h2 class="section-heading">Who are you?</h2>
    <ul class="role-grid">
      <li class="card role-card">
        <h3 class="card-title">I'm a senior</h3>
        <p>See your companion and your next call in big, clear text.</p>
        <p><a class="button button-secondary" href="/seniors">Find my page</a></p>
      </li>
      <li class="card role-card">
        <h3 class="card-title">I'm a volunteer</h3>
        <p>See your seniors and your week, get things to talk about, and write down your calls.</p>
        <p><a class="button button-secondary" href="/volunteers">Go to volunteers</a></p>
      </li>
      <li class="card role-card">
        <h3 class="card-title">I'm family or a caregiver</h3>
        <p>See how often your loved one is getting calls and visits.</p>
        <p><a class="button button-secondary" href="/dashboard">Open the dashboard</a></p>
      </li>
      <li class="card role-card">
        <h3 class="card-title">I'm a coordinator</h3>
        <p>See who needs help today, and pair new seniors with the volunteer who fits best.</p>
        <p><a class="button button-secondary" href="/match">Match seniors</a></p>
      </li>
    </ul>`;
}

export function aboutAiPage({ modeInfo, model }) {
  const live = modeInfo.effective === 'live';
  return html`
    ${backLink('/', 'home')}
    <h1>How the AI works</h1>
    <p class="lead">PorchLight uses AI for one small job: suggesting three things a volunteer could talk about on the next call. People make every other decision.</p>
    <section class="panel ${live ? 'mode-panel-live' : 'mode-panel-mock'}" aria-labelledby="mode-heading">
      <h2 id="mode-heading">Right now: ${live ? 'Live AI (Claude)' : 'Offline mode (built-in templates)'}</h2>
      <p class="muted">Technical detail: ${modeInfo.reason}.</p>
      ${modeInfo.warning ? banner({ kind: 'warning', text: modeInfo.warning }) : ''}
    </section>
    <section class="panel" aria-labelledby="what-heading">
      <h2 id="what-heading">What "conversation sparks" are</h2>
      <p>Many volunteers are teenagers. Starting a conversation with someone 60 years older can feel awkward, and awkward calls are calls that stop happening. Sparks give the volunteer three warm, personal openers built from the senior's own interests and the time since their last talk. A long gap gets a "so glad to catch up" opener that never makes the senior feel guilty.</p>
      <p>Sparks are always labeled as suggestions, with where they came from.</p>
      <h3>Offline mode (the default, no internet needed)</h3>
      <p>Sparks come from a hand-written set of ideas for each interest, with seasonal touches and local touches for ${COMMUNITY.town}. The same details always give the same sparks, and "Show different sparks" picks a new set. No internet or API key is needed. (In the code this is called MOCK mode.)</p>
      <h3>Live mode (with a Claude API key)</h3>
      <p>Sparks are written by Claude (${model}) through Anthropic's official software kit. If Claude can't be reached, PorchLight quietly uses the offline ideas instead, so a volunteer is never left empty-handed. The README explains how to turn this on. (In the code this is called LIVE mode.)</p>
      <h3>What the AI never sees</h3>
      <p>Only the senior's preferred first name, interests, "about me" text, days since the last contact, and today's date are sent to the AI. Family contacts, phone numbers, call notes, and reasons for missed calls are never sent.</p>
      <h3>What the AI never decides</h3>
      <p>Matching, the isolation-risk flags, the Needs attention list, and local help are plain rules you can read in the code. AI plays no part in them.</p>
    </section>`;
}

export function resetConfirmPage() {
  return html`
    ${backLink('/tour', 'the demo tour')}
    <h1>Reset demo data?</h1>
    <p class="lead">This puts back the original made-up seniors, volunteers, matches, and calls, with dates moved so the story starts today. Use it before recording or judging a demo.</p>
    ${banner({ kind: 'warning', text: 'This erases every change made since the last reset. It cannot be undone.' })}
    <form method="post" action="/demo/reset" class="button-row">
      <button type="submit" class="button button-danger">Yes, reset the demo data</button>
      <a class="button button-secondary" href="/">No, go back home</a>
    </form>`;
}

export function errorPage({ status, message }) {
  return html`
    <h1>${status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
    ${banner({ kind: 'error', text: message, role: 'alert' })}
    <p class="button-row">
      <a class="button" href="/">Go to the home page</a>
      <a class="button button-secondary" href="/tour">Open the demo tour</a>
    </p>`;
}
