// Demo sign-in by role (no passwords): coordinator, volunteer, family member,
// or senior. See ./viewer.js for the cookie, ./access.js for the rules, and
// ./views.js for the screens.
//
//   GET  /sign-in    "Demo sign-in (no passwords)": pick a role and a person
//   POST /sign-in    sets the `viewer` cookie, then goes to that role's home page
//   POST /sign-out   clears it (demo mode again), then goes home
//
// registerRoles() must be the LAST registration in createApp(): it adds the
// routes above and then wraps every route handler with guard(), so each
// request is checked on the server before any page is built or data changes.
// Without a `viewer` cookie the guard does nothing at all: demo mode works
// exactly as before. No AI is involved anywhere in sign-in or access.

import { VIEWER_COOKIE, VIEWER_COOKIE_SECONDS, viewerFromCookie, signInChoices, seesEverything } from './viewer.js';
import { can } from './access.js';
import { stripBlocked } from './links.js';
import { signInPage, notAllowedPage } from './views.js';

export { can, ACCESS_RULES } from './access.js';
export { navFor, viewerLine } from './views.js';
export { viewerFromCookie, seesEverything } from './viewer.js';

// ----- data helpers for pages (each a no-op in demo mode) -----

// A family member or a senior: no call notes, no volunteer tools.
export const isFamilyOrSenior = (viewer) => viewer?.kind === 'family' || viewer?.kind === 'senior';

// Call notes and missed-call notes are for coordinators and volunteers only.
export function withoutPrivateNotes(viewer, contacts) {
  if (!isFamilyOrSenior(viewer)) return contacts;
  return contacts.map((c) => ({ ...c, notes: '', missedNote: null }));
}

// A family member's dashboard shows only their own senior.
export function seniorsVisibleTo(viewer, rows, seniorOf = (r) => r.senior) {
  if (!viewer || viewer.kind !== 'family') return rows;
  return rows.filter((r) => seniorOf(r)?.id === viewer.id);
}

// A volunteer's Calls & Visits page shows only their own pairs and calls
// (matches and contacts both carry volunteerId).
export function callsVisibleTo(viewer) {
  if (!viewer || viewer.kind !== 'volunteer') return () => true;
  return (item) => item.volunteerId === viewer.id;
}

// ----- the guard -----

async function guard(req, res, handler, ctx) {
  const { store } = ctx;
  const raw = req.cookies[VIEWER_COOKIE];
  req.viewer = raw ? viewerFromCookie(raw, store) : null;
  if (raw && !req.viewer) res.setCookie(VIEWER_COOKIE, '', 0); // stale or unknown: back to demo mode
  const viewer = req.viewer;
  if (seesEverything(viewer)) return handler(req, res);

  // Take links and forms this person can't use off every page they see.
  const sendHtml = res.html;
  res.html = (content, code) =>
    sendHtml(
      typeof content === 'string' && content.startsWith('<!DOCTYPE html>')
        ? stripBlocked(content, (method, path) => can(viewer, method, path, { store }))
        : content,
      code
    );

  if (req.method === 'GET' && req.path === '/') return res.redirect(viewer.home);
  if (!can(viewer, req.method, req.path, { store, body: req.body })) {
    return ctx.render(req, res, { title: 'This page is for coordinators', body: notAllowedPage({ viewer }), status: 403 });
  }
  return handler(req, res);
}

export function registerRoles(router, ctx) {
  const { store } = ctx;
  ctx.flashMessages.signed_in = 'Signed in for the demo. You see only your own pages now. Sign out at the top of any page to see everything.';
  ctx.flashMessages.signed_out = 'Signed out. Demo mode is back: every page is visible.';

  const showSignIn = (req, res, { error, status = 200 } = {}) =>
    ctx.render(req, res, {
      title: error ? 'Fix the form: Demo sign-in' : 'Demo sign-in',
      active: 'sign-in',
      status,
      flash: error ? false : undefined,
      body: signInPage({ viewer: req.viewer, choices: signInChoices(store), error }),
    });

  router.get('/sign-in', (req, res) => showSignIn(req, res));

  router.post('/sign-in', (req, res) => {
    const value = ctx.str(req.body.as);
    const viewer = viewerFromCookie(value, store); // only real ids are accepted
    if (!viewer) return showSignIn(req, res, { error: 'Choose a person from one of the lists.' });
    res.setCookie(VIEWER_COOKIE, viewer.value, VIEWER_COOKIE_SECONDS);
    res.redirect(`${viewer.home}?msg=signed_in`);
  });

  router.post('/sign-out', (req, res) => {
    res.setCookie(VIEWER_COOKIE, '', 0);
    res.redirect('/?msg=signed_out');
  });

  for (const route of router.routes) {
    const handler = route.handler;
    route.handler = (req, res) => guard(req, res, handler, ctx);
  }
}
