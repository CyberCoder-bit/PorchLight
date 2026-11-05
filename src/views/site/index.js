// The public website (v2): what a signed-out visitor sees.
// Routes: /, /how-it-works, /for-seniors, /for-volunteers,
// /for-families, /languages, /safety, /about. Who may open them is in
// ./access.js (everyone, signed in or not).
//
// registerSite() is called in createApp() after the app's own routes and
// before registerRoles() (which must stay last).

import { html } from '../html.js';
import { t } from '../../i18n/index.js';

export function registerSite(router, ctx) {
  // TEMPORARY placeholder until the public home is built. The public website
  // replaces this. [v2 accounts] Signed out, it must never show coordinator
  // data, so only an admin still gets the coordinator home here.
  router.get('/', (req, res) => {
    if (req.viewer?.kind === 'coordinator') return ctx.coordinatorHome(req, res);
    ctx.render(req, res, {
      title: t('auth.placeholderHome.title'),
      active: 'home',
      body: html`<h1>${t('auth.placeholderHome.title')}</h1>
        <p class="lead">${t('auth.placeholderHome.lead')}</p>
        <p class="button-row"><a class="button" href="/sign-in">${t('auth.signIn.link')}</a> <a class="button button-secondary" href="/sign-up">${t('auth.signUp.link')}</a> <a class="button button-secondary" href="/tour">2-minute demo tour</a></p>`,
    });
  });
}
