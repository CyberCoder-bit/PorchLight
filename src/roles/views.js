// Demo sign-in screens: the sign-in page, the "This page is for coordinators"
// page, the header line ("Signed in as ... · Sign out"), and the nav for each
// role. All text goes through html``, so names are always escaped.

import { html } from '../views/html.js';
import { banner, backLink } from '../views/components.js';
import { pagesFor } from './viewer.js';

// The main nav for this person. Demo mode and the coordinator get `all`
// (the normal nav) unchanged.
export function navFor(viewer, all) {
  const pages = pagesFor(viewer);
  return pages ? pages.filter((p) => p.nav !== false) : all;
}

const signOutForm = (extraClass = 'button-small') => html`
  <form method="post" action="/sign-out" class="inline-form">
    <button type="submit" class="button button-secondary${extraClass ? ` ${extraClass}` : ''}">Sign out</button>
  </form>`;

// The line under the header. Demo mode says so and offers the sign-in.
export function viewerLine(viewer) {
  if (!viewer) {
    return html`<div class="viewer-line"><p>Demo mode: everything is visible. <a href="/sign-in">Try the demo sign-in</a></p></div>`;
  }
  return html`
    <div class="viewer-line">
      <p>Signed in as <strong>${viewer.label}</strong> <span class="viewer-note">(demo, no password)</span> · <a href="/sign-in">Switch</a></p>
      ${signOutForm()}
    </div>`;
}

function choiceForm({ id, legend, label, options, button, hint }) {
  return html`
    <section class="panel" aria-labelledby="${id}-heading">
      <h2 id="${id}-heading">${legend}</h2>
      <p>${hint}</p>
      ${options.length
        ? html`
          <form method="post" action="/sign-in" class="stack-form">
            <div class="field">
              <label for="${id}">${label}</label>
              <select id="${id}" name="as">
                ${options.map((o) => html`<option value="${o.value}">${o.label}</option>`)}
              </select>
            </div>
            <button type="submit" class="button button-secondary">${button}</button>
          </form>`
        : html`<p class="muted">Nobody to choose yet.</p>`}
    </section>`;
}

export function signInPage({ viewer, choices, error }) {
  return html`
    ${backLink('/', 'home')}
    <h1>Demo sign-in (no passwords)</h1>
    ${error ? banner({ kind: 'error', text: error }) : ''}
    ${banner({
      kind: 'warning',
      text: "This is a demo. Anyone can pick anyone, and there are no passwords. A real launch needs real accounts with passwords, which aren't built yet.",
    })}
    <p class="lead">Pick who you are to see PorchLight the way they would. Each person sees only their own pages. Sign out at the top of any page to see everything again.</p>
    ${viewer
      ? html`<section class="panel notice-panel" aria-labelledby="now-heading">
          <h2 id="now-heading">You're signed in as ${viewer.label}</h2>
          <p class="actions"><a class="button" href="${viewer.home}">Go to my pages</a></p>
          ${signOutForm('')}
        </section>`
      : ''}

    <section class="panel" aria-labelledby="coordinator-heading">
      <h2 id="coordinator-heading">Coordinator</h2>
      <p>Sees every senior, volunteer, match, and call, the same as demo mode.</p>
      <form method="post" action="/sign-in" class="inline-form">
        <input type="hidden" name="as" value="coordinator">
        <button type="submit" class="button button-secondary">Sign in as the coordinator</button>
      </form>
    </section>
    ${choiceForm({
      id: 'as-volunteer',
      legend: 'Volunteer',
      label: 'Which volunteer are you?',
      hint: 'Sees their own week, their seniors, and their own calls.',
      options: choices.volunteers,
      button: 'Sign in as this volunteer',
    })}
    ${choiceForm({
      id: 'as-family',
      legend: 'Family member',
      label: 'Whose family are you?',
      hint: "Sees one senior's dashboard card, profile, and weekly summary. Call notes stay private.",
      options: choices.family,
      button: 'Sign in as this family member',
    })}
    ${choiceForm({
      id: 'as-senior',
      legend: 'Senior',
      label: 'Which senior are you?',
      hint: 'Sees their own page: their companion and their next call, in big, clear text.',
      options: choices.seniors,
      button: 'Sign in as this senior',
    })}`;
}

// Status 403: friendly, with a way forward.
export function notAllowedPage({ viewer }) {
  const pages = pagesFor(viewer) || [];
  return html`
    <h1>This page is for coordinators</h1>
    <p class="lead">You're signed in as ${viewer.label}, so PorchLight shows you only your own pages.</p>
    <section class="panel" aria-labelledby="your-pages-heading">
      <h2 id="your-pages-heading">Your pages</h2>
      <ul class="plain-list">
        ${pages.map((p) => html`<li><a href="${p.href}">${p.label}</a></li>`)}
      </ul>
    </section>
    <section class="panel" aria-labelledby="switch-heading">
      <h2 id="switch-heading">Need to see everything?</h2>
      <p>Sign out to go back to demo mode, where every page is visible, or <a href="/sign-in">sign in as someone else</a>.</p>
      ${signOutForm('')}
    </section>`;
}
