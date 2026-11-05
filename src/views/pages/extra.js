// Extra pages: the 2-minute demo tour for judges.
// Register routes here; never edit src/app.js. See the ctx contract in app.js.
//
// [v2 accounts] The coordinator's pages are under /admin and need the admin
// sign-in (README, "Demo accounts"), so step 1 starts at the sign-in page.
// Steps that show another person's view use the one-click demo buttons
// (POST /sign-in/demo). `href` is where a step goes; `demo` is the button
// that signs in first and then lands there.

import { html } from '../html.js';
import { backLink } from '../components.js';
import { COMMUNITY } from '../../community.js';

// Each step: what to open, and one sentence on what to notice there.
export const TOUR_STEPS = [
  {
    title: 'Sign in as the coordinator, then reset the demo data',
    notice: 'Sign in with admin@porchlight.example and the demo password from the README. Then reset, so every date in the story lines up with today. After the reset, a link brings you back here.',
    href: '/admin/demo/reset',
    action: 'Sign in and reset demo data',
  },
  {
    title: 'Family Dashboard: Hal is flagged',
    notice: 'Harold ("Hal") shows "Isolation risk" and "Contact dropping", so his family sees the problem before it becomes a crisis.',
    href: '/admin/dashboard',
    action: 'Open the Family Dashboard',
  },
  {
    title: 'The Needs attention list',
    notice: "A coordinator sees everyone who needs help in one list, each with a plain reason and one suggested next step. For Hal, the step is to ask Ethan whether yesterday's visit happened.",
    href: '/admin/attention',
    action: 'Open Needs attention',
  },
  {
    title: 'Match Gene with a companion',
    notice: 'Sam scores highest for Eugene ("Gene"), and every volunteer who is left out is listed with the reason why.',
    href: '/admin/match?seniorId=s-eugene',
    action: 'Match Gene',
  },
  {
    title: "Ethan's week",
    notice: "This button signs you in as Ethan, a volunteer. You see his calls for the next 7 days, with one click to log a call or mark it missed. Hal's visit yesterday was never marked, so it waits under \"Did these calls happen?\". Log it.",
    href: '/volunteers/v-ethan/week',
    demo: 'volunteer',
    action: 'Sign in as Ethan, a volunteer',
  },
  {
    title: "Conversation sparks on Hal's profile",
    notice: "Still signed in as Ethan, press \"Get conversation sparks\" for three things to talk about, built from Hal's interests and labeled with where they came from. Ethan sees only what he needs: Hal's first name, interests, languages, and free times.",
    href: '/seniors/s-harold#sparks',
    action: "See Hal's sparks",
  },
  {
    title: "See it as Hal's family",
    notice: "This button signs you in as Mike Whitaker, Hal's son. He sees only his dad, never the volunteer's call notes, and other pages tell him they are not for his account.",
    href: '/dashboard',
    demo: 'family',
    action: "Sign in as Mike, Hal's son",
  },
  {
    title: 'Get help in Indiana, and the Accessibility menu',
    notice: 'Local help and Indiana 211 for this community. Then open Accessibility at the top of any page for bigger text, high contrast, or dark mode. Every page adapts.',
    href: '/help',
    action: 'Open Get help',
  },
];

// Step 1 goes through the sign-in page, which then opens the reset page.
export const stepHref = (step, i) => (i === 0 ? `/sign-in?next=${encodeURIComponent(step.href)}` : step.href);

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
            ${step.demo
              ? html`<form method="post" action="/sign-in/demo" class="inline-form">
                  <input type="hidden" name="as" value="${step.demo}">
                  <button type="submit" class="button button-secondary">${step.action}</button>
                </form>`
              : html`<a class="button${i === 0 ? '' : ' button-secondary'} print-url" href="${stepHref(step, i)}">${step.action}</a>`}
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
