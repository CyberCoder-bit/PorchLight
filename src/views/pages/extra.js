// Extra pages: the 2-minute demo tour for judges.
// Register routes here; never edit src/app.js. See the ctx contract in app.js.
//
// The tour links to the fixed routes from the build plan, including ones other
// modules add (/attention, /volunteers/:id/week, /help).

import { html } from '../html.js';
import { backLink } from '../components.js';
import { COMMUNITY } from '../../community.js';

// Each step: what to open, and one sentence on what to notice there.
export const TOUR_STEPS = [
  {
    title: 'Reset the demo data',
    notice: 'Start fresh, so every date in the story lines up with today. After the reset, a link brings you back here.',
    href: '/demo/reset',
    action: 'Reset demo data',
  },
  {
    title: 'Family Dashboard: Hal is flagged',
    notice: 'Harold ("Hal") shows "Isolation risk" and "Contact dropping", so his family sees the problem before it becomes a crisis.',
    href: '/dashboard',
    action: 'Open the Family Dashboard',
  },
  {
    title: 'The Needs attention list',
    notice: 'A coordinator sees everyone who needs help in one list, each with a plain reason and one suggested next step.',
    href: '/attention',
    action: 'Open Needs attention',
  },
  {
    title: 'Match Gene with a companion',
    notice: 'Sam scores highest for Eugene ("Gene"), and every volunteer who is left out is listed with the reason why.',
    href: '/match?seniorId=s-eugene',
    action: 'Match Gene',
  },
  {
    title: "Ethan's week",
    notice: "A volunteer's calls for the next 7 days, with one click to log a call or mark it missed.",
    href: '/volunteers/v-ethan/week',
    action: "Open Ethan's week",
  },
  {
    title: "Conversation sparks on Hal's profile",
    notice: 'Press "Get conversation sparks" for three suggested things to talk about, built from Hal\'s interests and labeled with where they came from.',
    href: '/seniors/s-harold#sparks',
    action: "See Hal's sparks",
  },
  {
    title: 'Get help in Indiana, and bigger text',
    notice: 'Local help and Indiana 211 for this community. Then try A++ at the top of any page: every page grows with the text.',
    href: '/help',
    action: 'Open Get help',
  },
];

export function tourPage({ textSize }) {
  const last = TOUR_STEPS.length;
  const xl = textSize === 'xlarge';
  return html`
    ${backLink('/', 'home')}
    <h1>The 2-minute demo tour</h1>
    <p class="lead">${last} quick stops that show the whole PorchLight loop: Match, Connect, Spark, and Watch. The demo is set in ${COMMUNITY.town}, ${COMMUNITY.county}, and every person in it is made up. Use your browser's Back button to return here after each step.</p>
    <ol class="tour-steps" role="list">
      ${TOUR_STEPS.map(
        (step, i) => html`
        <li class="card tour-step">
          <span class="step-number" aria-hidden="true">${i + 1}</span>
          <h2>Step ${i + 1}: ${step.title}</h2>
          <p><strong>What to notice:</strong> ${step.notice}</p>
          <div class="button-row">
            <a class="button${i === 0 ? '' : ' button-secondary'} print-url" href="${step.href}">${step.action}</a>
            ${i === last - 1
              ? html`<form method="post" action="/prefs/text-size" class="inline-form">
                  <input type="hidden" name="back" value="/tour">
                  <button type="submit" class="button button-secondary" name="size" value="${xl ? 'normal' : 'xlarge'}">${xl ? 'Back to normal text (A)' : 'Make the text extra large (A++)'}</button>
                </form>`
              : ''}
          </div>
        </li>`
      )}
    </ol>
    <p>That's the loop. <a href="/">Back to the home page</a></p>`;
}

export function registerDesignPages(router, ctx) {
  router.get('/tour', (req, res) => {
    ctx.render(req, res, {
      title: '2-minute demo tour',
      active: 'tour',
      body: tourPage({ textSize: req.cookies.textsize }),
    });
  });
}
