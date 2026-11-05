// Account screens shared by every page: the header line ("Signed in as ...
// · Sign out"), the nav for each role, and the "not for you" page. All text
// goes through html``, so names are always escaped.

import { html } from '../views/html.js';
import { t } from '../i18n/index.js';
import { pagesFor } from './viewer.js';

// The main nav for this person. The coordinator gets `all` (the admin nav).
// Signed out, there is no app nav: the public website has its own links.
export function navFor(viewer, all) {
  if (!viewer) return [];
  const pages = pagesFor(viewer);
  return pages ? pages.filter((p) => p.nav !== false) : all;
}

export const signOutForm = (extraClass = 'button-small') => html`
  <form method="post" action="/sign-out" class="inline-form">
    <button type="submit" class="button button-secondary${extraClass ? ` ${extraClass}` : ''}">${t('auth.signOut.button')}</button>
  </form>`;

// The line under the header.
export function viewerLine(viewer) {
  if (!viewer) {
    return html`<div class="viewer-line"><p><a href="/sign-in">${t('auth.signIn.link')}</a> · <a href="/sign-up">${t('auth.signUp.link')}</a></p></div>`;
  }
  return html`
    <div class="viewer-line">
      <p>${t('auth.viewerLine.signedInAs')} <strong>${viewer.label}</strong> · <a href="/account">${t('auth.nav.account')}</a></p>
      ${signOutForm()}
    </div>`;
}

// Status 403: friendly, with a way forward.
export function notAllowedPage({ viewer }) {
  const pages = pagesFor(viewer) || [];
  return html`
    <h1>${t('auth.notAllowed.title')}</h1>
    <p class="lead">${t('auth.notAllowed.lead', { label: viewer.label })}</p>
    <section class="panel" aria-labelledby="your-pages-heading">
      <h2 id="your-pages-heading">${t('auth.notAllowed.yourPages')}</h2>
      <ul class="plain-list">
        ${pages.map((p) => html`<li><a href="${p.href}">${p.label}</a></li>`)}
      </ul>
    </section>
    <section class="panel" aria-labelledby="switch-heading">
      <h2 id="switch-heading">${t('auth.notAllowed.switchTitle')}</h2>
      <p>${t('auth.notAllowed.switchText')}</p>
      ${signOutForm('')}
    </section>`;
}
