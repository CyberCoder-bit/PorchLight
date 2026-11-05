// Home, "How the AI works", demo reset, and error pages.

import { html, plural } from '../html.js';
import { statusBadge, trendBadge, banner, backLink, emptyState } from '../components.js';
import { COMMUNITY } from '../../community.js';
import { attentionBreakdown, attentionReason } from '../../risk.js';

// One short reason per senior on the Needs attention list (the same rule as /attention).
function attentionRowText(r) {
  switch (attentionReason(r)) {
    case 'needs_match': return 'waiting for a companion';
    case 'at_risk': return `no call or visit in ${plural(r.daysSince, 'day')}`;
    case 'dropping': return `fewer calls lately (${r.trend.recent} in the last 4 weeks, down from ${r.trend.previous})`;
    default: return `${plural(r.missedRecently, 'missed call')} in the last 2 weeks`;
  }
}

// `attention`: the seniors on the Needs attention list (needsAttention() in src/risk.js).
export function homePage({ stats, attention }) {
  const { town, county } = COMMUNITY;
  const breakdown = attentionBreakdown(attention);
  return html`
    <section class="hero" aria-labelledby="hero-heading">
      <p class="eyebrow">Built for Indiana communities, starting in ${town}, ${county}</p>
      <h1 id="hero-heading">Leave the porch light on for older neighbors.</h1>
      <p class="lead">PorchLight pairs older adults with volunteer companions for weekly calls and visits. It gives volunteers easy things to talk about, and it shows families early when the calls start to fade.</p>
      <p class="hero-fact">Why it matters: by 2040, about one in five Hoosiers will be 65 or older (<a href="https://www.incontext.indiana.edu/2024/nov-dec/article1.asp">Indiana Business Research Center</a>), and being cut off from other people carries a health risk the U.S. Surgeon General compares to smoking up to 15 cigarettes a day (<a href="https://www.hhs.gov/sites/default/files/surgeon-general-social-connection-advisory.pdf">2023 advisory</a>).</p>
      <p class="button-row">
        <a class="button" href="/tour">Take the 2-minute demo tour <span aria-hidden="true">→</span></a>
        <a class="button button-secondary" href="/admin/dashboard">Open the Family Dashboard</a>
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
            (r) => html`<li>${statusBadge(r.status, r.info)} ${trendBadge(r.trend)} <a href="/seniors/${r.senior.id}">${r.senior.name}</a>: ${attentionRowText(r)}</li>`
          )}
        </ul>
        <p class="button-row">
          <a class="button button-secondary print-url" href="/admin/attention">Open the Needs attention list</a>
          <a class="button button-secondary" href="/admin/dashboard">Open the Family Dashboard</a>
        </p>
      </section>`
      : html`
      <section class="panel" aria-labelledby="attention-heading">
        <h2 id="attention-heading">Needs attention today</h2>
        ${emptyState(html`<p><strong>Nobody needs attention right now.</strong> Every senior has a companion, recent calls or visits, and no missed calls lately.</p>
          <p><a href="/admin/dashboard">See how everyone is doing on the Family Dashboard</a></p>`)}
      </section>`}

    <h2 class="section-heading">Who are you?</h2>
    <ul class="role-grid">
      <li class="card role-card">
        <h3 class="card-title">I'm a senior</h3>
        <p>See your companion and your next call in big, clear text.</p>
        <p><a class="button button-secondary" href="/sign-in#as-senior-heading">Find my page</a></p>
      </li>
      <li class="card role-card">
        <h3 class="card-title">I'm a volunteer</h3>
        <p>See your seniors and your week, get things to talk about, and write down your calls.</p>
        <p><a class="button button-secondary" href="/admin/volunteers">Go to volunteers</a></p>
      </li>
      <li class="card role-card">
        <h3 class="card-title">I'm family or a caregiver</h3>
        <p>See how often your loved one is getting calls and visits.</p>
        <p><a class="button button-secondary" href="/admin/dashboard">Open the dashboard</a></p>
      </li>
      <li class="card role-card">
        <h3 class="card-title">I'm a coordinator</h3>
        <p>See who needs help today, and pair new seniors with the volunteer who fits best.</p>
        <p><a class="button button-secondary" href="/admin/match">Match seniors</a></p>
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
    ${backLink('/', 'home')}
    <h1>How the AI works</h1>
    <p class="lead">PorchLight uses AI for one small job: suggesting three things a volunteer could talk about on the next call. People make every other decision.</p>
    <section class="panel ${live && !fellBack ? 'mode-panel-live' : 'mode-panel-mock'}" aria-labelledby="mode-heading">
      <h2 id="mode-heading">Right now: ${fellBack ? 'Offline ideas (live AI is set up but was unavailable)' : live ? 'Live AI (Claude)' : 'Offline mode (built-in templates)'}</h2>
      ${fellBack
        ? html`<p>The last request to Claude didn't work (${lastFallback.reason}), so PorchLight used the built-in ideas instead. It tries Claude again the next time someone asks for sparks.</p>`
        : ''}
      <p class="muted">Technical detail: ${modeInfo.reason}.</p>
      ${modeInfo.warning ? banner({ kind: 'warning', text: modeInfo.warning }) : ''}
    </section>
    <section class="panel" aria-labelledby="what-heading">
      <h2 id="what-heading">What "conversation sparks" are</h2>
      <p>Many volunteers are teenagers. Starting a conversation with someone 60 years older can feel awkward, and awkward calls are calls that stop happening. Sparks give the volunteer three warm, personal openers built from the senior's own interests and the time since their last talk. After a long gap, the first spark is a warm reconnect, like "I've missed our chats!", where the volunteer owns the gap, so the senior never feels guilty.</p>
      <p>Sparks are always labeled as suggestions, with where they came from.</p>
      <h3>Offline mode (the default, no internet needed)</h3>
      <p>Sparks come from a hand-written set of ideas for each interest, with seasonal touches and local touches for ${COMMUNITY.town}. The same details always give the same sparks, and "Show different sparks" picks a new set. No internet or API key is needed. (In the code this is called MOCK mode.)</p>
      <h3>Live mode (with a Claude API key)</h3>
      <p>Sparks are written by Claude (${model}) through Anthropic's official software kit. If Claude can't be reached, PorchLight uses the offline ideas instead, so a volunteer is never left empty-handed. The page says so with a short note, and those sparks are labeled "live AI was unavailable". The README explains how to turn this on. (In the code this is called LIVE mode.)</p>
      <h3>What the AI never sees</h3>
      <p>Only the senior's preferred first name, interests, "about me" text, days since the last contact, and today's date are sent to the AI. Family contacts, call notes, and reasons for missed calls are never sent. If someone types a phone number or email address into "about me", PorchLight removes it before the text is sent.</p>
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
    <form method="post" action="/admin/demo/reset" class="button-row">
      <button type="submit" class="button button-danger">Yes, reset the demo data</button>
      <a class="button button-secondary" href="/">No, go back home</a>
    </form>`;
}

// What to do next, by kind of error, so an error page is never a dead end.
const BACK = "your browser's Back button";
const ERROR_HELP = {
  400: { title: "That didn't work", help: `Go back to the form (${BACK}), fix the choice, and try again.` },
  404: { title: 'Page not found', help: 'The link may be old, for example from before the demo data was reset. Start again from one of these pages.' },
  409: { title: "That didn't work", help: `The page you came from may be out of date. Go back (${BACK}), reload the page to see the latest, and try again.` },
  413: { title: 'That was too much to save', help: `Go back (${BACK}), shorten the longest text box, and try again.` },
};

export function errorPage({ status, message }) {
  const spec = ERROR_HELP[status] || { title: 'Something went wrong', help: 'Please try again in a minute. If it keeps happening, start again from one of these pages.' };
  return html`
    <h1>${spec.title}</h1>
    ${banner({ kind: 'error', text: message, role: 'alert' })}
    <p>${spec.help}</p>
    <p class="button-row">
      <a class="button" href="/">Go to the home page</a>
      <a class="button button-secondary" href="/admin/attention">Open Needs attention</a>
      <a class="button button-secondary" href="/contacts">Open Calls &amp; Visits</a>
      <a class="button button-secondary" href="/tour">Open the demo tour</a>
    </p>`;
}
