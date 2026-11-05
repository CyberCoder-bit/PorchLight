// Accounts and roles (v2): who is signed in, and what they may open.
//
//   src/auth/       passwords, sessions, rate limits, and the sign-in,
//                   sign-up, and account pages
//   ./access.js     the one table of who may open what
//   ./viewer.js     the signed-in person, as pages see them (req.viewer)
//   ./links.js      takes links someone can't use off their pages
//   ./views.js      the header line, the nav, and the "not for you" page
//
// registerRoles() must be the LAST registration in createApp(): it adds the
// account routes and then wraps every route handler with guard(), so each
// request is checked on the server before any page is built or data changes.
// Signed out, a visitor may open only the public rows of the table. No AI is
// involved anywhere in sign-in or access.

import { viewerFromUser, seesEverything } from './viewer.js';
import { can } from './access.js';
import { stripBlocked } from './links.js';
import { notAllowedPage } from './views.js';
import { SESSION_COOKIE, userForToken, clearSessionCookie } from '../auth/session.js';
import { registerAuth } from '../auth/routes.js';
import { setCurrentLang, t } from '../i18n/index.js';

export { can, ACCESS_RULES, roleOf, OLD_ADMIN_PATHS } from './access.js';
export { navFor, viewerLine } from './views.js';
export { viewerFromUser, seesEverything, firstName } from './viewer.js';

// ----- data helpers for pages -----

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

// What a volunteer may know about a senior: first name, interests,
// languages, times, and how they like to connect. No last name, no family
// contact, no age or neighborhood, no notes about them.
export function seniorForVolunteer(senior) {
  if (!senior) return senior;
  const first = String(senior.preferredName || String(senior.name || '').split(' ')[0]);
  return {
    id: senior.id,
    name: first,
    preferredName: first,
    interests: senior.interests || [],
    languages: senior.languages,
    translateHelp: senior.translateHelp,
    availability: senior.availability || [],
    contactMethod: senior.contactMethod,
    town: senior.town,
    caregiver: { name: '', relationship: '' },
    aboutMe: '',
    neighborhood: '',
    age: null,
  };
}

// What a family member or senior may know about the companion: first name.
export function volunteerFirstNameOnly(volunteer) {
  if (!volunteer) return volunteer;
  const first = String(volunteer.name || '').split(' ')[0];
  return { id: volunteer.id, name: first, interests: volunteer.interests || [], availability: [], contactMethods: volunteer.contactMethods || [], affiliation: '', town: volunteer.town, languages: volunteer.languages };
}

// The signed-in person for this request, or null. A stale or unknown session
// cookie counts as signed out, and the cookie is cleared.
export async function viewerForRequest(req, res, store) {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const user = await userForToken(store, token);
  const viewer = user ? viewerFromUser(user, store) : null;
  if (!viewer) {
    clearSessionCookie(res, req);
    return null;
  }
  setCurrentLang(user.uiLanguage); // the profile's language wins over the cookie and the browser
  return viewer;
}

// ----- the guard -----

async function guard(req, res, handler, ctx) {
  const { store } = ctx;
  req.viewer = await viewerForRequest(req, res, store);
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

  const method = req.method === 'HEAD' ? 'GET' : req.method; // HEAD answers like GET
  if (viewer && method === 'GET' && req.path === '/') return res.redirect(viewer.home);
  if (!can(viewer, method, req.path, { store, body: req.body })) {
    if (!viewer) {
      const query = new URLSearchParams(req.query).toString();
      const next = ctx.safeBack(`${req.path}${query ? `?${query}` : ''}`);
      return res.redirect(next && method === 'GET' ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in');
    }
    return ctx.render(req, res, { title: t('auth.notAllowed.title'), body: notAllowedPage({ viewer }), status: 403 });
  }
  return handler(req, res);
}

export function registerRoles(router, ctx) {
  registerAuth(router, ctx);
  for (const route of router.routes) {
    const handler = route.handler;
    route.handler = (req, res) => guard(req, res, handler, ctx);
  }
}
