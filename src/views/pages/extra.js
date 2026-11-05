// Extra pages: the 2-minute demo tour for judges.
// Register routes here; never edit src/app.js. See the ctx contract in app.js.
//
// [v2 accounts] The coordinator's pages are under /admin and need the admin
// sign-in (README, "Demo accounts"), so step 1 starts at the sign-in page.
// Steps that show another person's view use the one-click demo buttons
// (POST /sign-in/demo). `href` is where a step goes; `demo` is the button
// that signs in first and then lands there.

import { html } from '../html.js';
import { backLink, tx } from '../components.js';
import { t } from '../../i18n/index.js'; // [v2 i18n]
import { COMMUNITY } from '../../community.js';

// Each step: what to open, and one sentence on what to notice there.
// [v2 i18n] title, notice and action are catalog keys (core.tour.stepN.*),
// read in the reader's language each time (outside a request: English).
const STEPS = [
  { href: '/admin/demo/reset' },
  { href: '/admin/dashboard' },
  { href: '/admin/attention' },
  { href: '/admin/match?seniorId=s-eugene' },
  { href: '/volunteers/v-ethan/week', demo: 'volunteer' },
  { href: '/seniors/s-harold#sparks' },
  { href: '/dashboard', demo: 'family' },
  { href: '/help' },
];
export const TOUR_STEPS = STEPS.map((step, i) => ({
  get title() { return t(`core.tour.step${i + 1}.title`); },
  get notice() { return t(`core.tour.step${i + 1}.notice`); },
  ...step,
  get action() { return t(`core.tour.step${i + 1}.action`); },
}));

// Step 1 goes through the sign-in page, which then opens the reset page.
export const stepHref = (step, i) => (i === 0 ? `/sign-in?next=${encodeURIComponent(step.href)}` : step.href);

export function tourPage({ textSize }) {
  const last = TOUR_STEPS.length;
  const xl = textSize === 'xlarge';
  return html`
    ${backLink('/', t('core.back.home'))}
    <h1>${tx('core.tour.title')}</h1>
    <p class="lead">${tx('core.tour.lead', { n: last, town: COMMUNITY.town, county: COMMUNITY.county })}</p>
    <ol class="tour-steps" role="list">
      ${TOUR_STEPS.map(
        (step, i) => html`
        <li class="card tour-step">
          <span class="step-number" aria-hidden="true">${i + 1}</span>
          <h2>${tx('core.tour.step', { n: i + 1, title: step.title })}</h2>
          <p><strong>${tx('core.tour.notice')}</strong> ${step.notice}</p>
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
                  <button type="submit" class="button button-secondary" name="size" value="${xl ? 'normal' : 'xlarge'}">${t(xl ? 'core.tour.textNormal' : 'core.tour.textLarge')}</button>
                </form>`
              : ''}
          </div>
        </li>`
      )}
    </ol>
    <p>${tx('core.tour.done')} <a href="/">${tx('core.tour.backHome')}</a></p>`;
}

export function registerDesignPages(router, ctx) {
  router.get('/tour', (req, res) => {
    ctx.render(req, res, {
      title: t('core.title.tour'),
      active: 'tour',
      body: tourPage({ textSize: req.cookies.textsize }),
    });
  });
}
