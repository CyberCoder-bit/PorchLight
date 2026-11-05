// WHO MAY OPEN WHAT (v2, real accounts).
//
// One table, checked on the SERVER before every route handler runs (see
// guard() in ./index.js). Hiding links is only a courtesy on top of this.
//
//   - An admin (viewer.kind 'coordinator'): every route.
//   - Everyone else, by role: only the rows below that list their role.
//       'public'    signed out
//       'senior', 'volunteer', 'family'
//       'pending'   a volunteer not approved yet, or a family member whose
//                   link to a senior is not approved yet
//   - Signed out and not allowed: 303 to /sign-in?next=<the page>.
//   - Signed in and not allowed: the friendly "not for you" page, status 403.
//
// Paths use the router's :param syntax; a trailing * matches the rest of the
// path. `own` is an extra test on the person and the request, e.g. "is this
// call one of mine?". When checking a link or form on a page (not a real
// request) there is no form body yet, so body-based tests pass and the real
// request is checked again when it arrives.

import { SITE_RULES } from '../views/site/access.js'; // [v2] public website rows
import { TRANSLATE_RULES } from '../translate/access.js'; // [v2] messages and translate rows

const MEMBERS = ['senior', 'volunteer', 'family'];
const SIGNED_IN = [...MEMBERS, 'pending'];
export const EVERYONE = ['public', ...SIGNED_IN];

// The old coordinator addresses (before /admin). Their handlers send an admin
// to the new page and everyone else to the sign-in page (see src/app.js).
export const OLD_ADMIN_PATHS = Object.freeze({
  '/seniors': '/admin/seniors',
  '/seniors/new': '/admin/seniors/new',
  '/volunteers': '/admin/volunteers',
  '/volunteers/new': '/admin/volunteers/new',
  '/match': '/admin/match',
  '/attention': '/admin/attention',
  '/demo/reset': '/admin/demo/reset',
});

// ----- ownership tests: ({ viewer, params, body, store }) => boolean -----
const isSelf = ({ viewer, params }) => params.id === viewer.id;
const isMySenior = ({ viewer, params, store }) =>
  store.activeMatchesForVolunteer(viewer.id).some((m) => m.seniorId === params.id);
const isMyCall = ({ viewer, params, store }) =>
  store.contacts.some((c) => c.id === params.id && c.volunteerId === viewer.id);
// Scheduling or logging: the chosen pair must be one of mine. An empty or
// unknown pair is left to the form's own "Choose who this call is for" error.
const postsToMyPair = ({ viewer, body, store }) => {
  if (body == null) return true;
  if (Array.isArray(body.matchId)) return false; // a repeated field is never "my pair"
  const matchId = typeof body.matchId === 'string' ? body.matchId.trim() : '';
  const match = store.matches.find((m) => m.id === matchId && m.active);
  return !match || match.volunteerId === viewer.id;
};

export const ACCESS_RULES = Object.freeze([
  // ----- everyone, signed in or not -----
  { method: 'GET', path: '/', roles: EVERYONE, note: 'the public website; signed in, it sends you to your own home page' },
  { method: 'GET', path: '/sign-in', roles: EVERYONE },
  { method: 'POST', path: '/sign-in', roles: EVERYONE },
  { method: 'POST', path: '/sign-in/demo', roles: EVERYONE },
  { method: 'GET', path: '/sign-up', roles: EVERYONE },
  { method: '*', path: '/sign-up/*', roles: EVERYONE },
  { method: 'GET', path: '/help', roles: EVERYONE },
  { method: 'GET', path: '/about-ai', roles: EVERYONE },
  { method: 'GET', path: '/tour', roles: EVERYONE },
  { method: 'GET', path: '/healthz', roles: EVERYONE },
  { method: '*', path: '/prefs', roles: EVERYONE }, // text size and other display settings
  { method: '*', path: '/prefs/*', roles: EVERYONE },
  ...Object.keys(OLD_ADMIN_PATHS).map((path) => ({ method: 'GET', path, roles: EVERYONE, note: 'old address: admin to /admin, others to /sign-in' })),

  // ----- every signed-in person, approved or not -----
  { method: 'POST', path: '/sign-out', roles: SIGNED_IN },
  { method: 'GET', path: '/home', roles: SIGNED_IN, note: 'your home page, or "waiting for approval"' },
  { method: 'GET', path: '/account', roles: SIGNED_IN },
  { method: 'POST', path: '/account', roles: SIGNED_IN },

  // ----- volunteer: my pages, my seniors, my calls -----
  { method: 'GET', path: '/volunteers/:id', roles: ['volunteer'], own: isSelf },
  { method: 'GET', path: '/volunteers/:id/week', roles: ['volunteer'], own: isSelf },
  { method: 'GET', path: '/seniors/:id', roles: ['volunteer'], own: isMySenior, note: 'first name, interests, languages, times, sparks' },
  { method: 'POST', path: '/seniors/:id/sparks', roles: ['volunteer'], own: isMySenior },
  { method: 'GET', path: '/contacts', roles: ['volunteer'], note: 'only my pairs and calls' },
  { method: 'POST', path: '/contacts', roles: ['volunteer'], own: postsToMyPair },
  { method: 'POST', path: '/contacts/:id/complete', roles: ['volunteer'], own: isMyCall },
  { method: 'POST', path: '/contacts/:id/missed', roles: ['volunteer'], own: isMyCall },
  { method: 'GET', path: '/contacts/:id/calendar.ics', roles: ['volunteer'], own: isMyCall },

  // ----- family member of senior S (viewer.id is S, link approved) -----
  { method: 'GET', path: '/dashboard', roles: ['family'], note: 'only S' },
  { method: 'GET', path: '/seniors/:id/summary', roles: ['family'], own: isSelf },

  // ----- family member of S, and senior S -----
  { method: 'GET', path: '/seniors/:id', roles: ['family', 'senior'], own: isSelf, note: 'call notes hidden' },

  // ----- [v2] rows owned by other modules -----
  ...SITE_RULES,
  ...TRANSLATE_RULES,
]);

// '/seniors/:id' -> { regex, keys }. Same matching as the router (src/http.js),
// including an optional trailing slash, with regex characters escaped.
function compile(path) {
  const keys = [];
  let source = '';
  for (const part of path.split('/').slice(1)) {
    source += '/';
    if (part === '*') source += '.*';
    else if (part.startsWith(':')) {
      keys.push(part.slice(1));
      source += '([^/]+)';
    } else source += part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  if (path === '/') source = '';
  return { regex: new RegExp(`^${source}/?$`), keys };
}

const COMPILED = ACCESS_RULES.map((rule) => ({ ...rule, ...compile(rule.path) }));

function paramsFor(rule, pathname) {
  const m = rule.regex.exec(pathname);
  if (!m) return null;
  const params = {};
  try {
    rule.keys.forEach((key, i) => {
      params[key] = decodeURIComponent(m[i + 1]);
    });
  } catch {
    return null; // a malformed %-escape never matches
  }
  return params;
}

// Which rows apply: 'admin', 'public', 'pending', or the person's kind.
export function roleOf(viewer) {
  if (!viewer) return 'public';
  if (viewer.kind === 'coordinator') return 'admin';
  return viewer.pending ? 'pending' : viewer.kind;
}

// May `viewer` make this request? `body` is the parsed form for a real POST,
// or null when checking a link or form on a page.
export function can(viewer, method, pathname, { store, body = null } = {}) {
  const role = roleOf(viewer);
  if (role === 'admin') return true;
  const verb = method === 'HEAD' ? 'GET' : method; // HEAD asks for the same page as GET
  return COMPILED.some((rule) => {
    if (rule.method !== '*' && rule.method !== verb) return false;
    if (!rule.roles.includes(role)) return false;
    const params = paramsFor(rule, pathname);
    if (!params) return false;
    return rule.own ? rule.own({ viewer, params, body, store }) : true;
  });
}
