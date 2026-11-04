// WHO MAY OPEN WHAT, when someone uses the demo sign-in.
//
// One table, checked on the SERVER before every route handler runs (see
// guardRoutes in ./index.js). Hiding links is only a courtesy on top of this.
//
//   - No cookie (demo mode) and the coordinator: every route, as before.
//   - Everyone else: only the rows below. Anything else gets a friendly
//     "This page is for coordinators" page with status 403.
//
// Paths use the router's :param syntax; a trailing * matches the rest of the
// path. `own` is an extra test on the person and the request, e.g. "is this
// call one of mine?". When checking a link or form on a page (not a real
// request) there is no form body yet, so body-based tests pass and the real
// request is checked again when it arrives.

const SIGNED_IN = ['volunteer', 'family', 'senior'];

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
  // ----- every signed-in person -----
  { method: 'GET', path: '/', roles: SIGNED_IN, note: "sends you to your own home page" },
  { method: 'GET', path: '/sign-in', roles: SIGNED_IN },
  { method: 'POST', path: '/sign-in', roles: SIGNED_IN },
  { method: 'POST', path: '/sign-out', roles: SIGNED_IN },
  { method: 'GET', path: '/help', roles: SIGNED_IN },
  { method: 'GET', path: '/about-ai', roles: SIGNED_IN },
  { method: 'GET', path: '/tour', roles: SIGNED_IN }, // the judges' tour signs in as family at step 7
  { method: 'GET', path: '/healthz', roles: SIGNED_IN },
  { method: '*', path: '/prefs', roles: SIGNED_IN }, // text size and other display settings
  { method: '*', path: '/prefs/*', roles: SIGNED_IN },

  // ----- volunteer: my pages, my seniors, my calls -----
  { method: 'GET', path: '/volunteers/:id', roles: ['volunteer'], own: isSelf },
  { method: 'GET', path: '/volunteers/:id/week', roles: ['volunteer'], own: isSelf },
  { method: 'GET', path: '/seniors/:id', roles: ['volunteer'], own: isMySenior },
  { method: 'POST', path: '/seniors/:id/sparks', roles: ['volunteer'], own: isMySenior },
  { method: 'GET', path: '/contacts', roles: ['volunteer'], note: 'only my pairs and calls' },
  { method: 'POST', path: '/contacts', roles: ['volunteer'], own: postsToMyPair },
  { method: 'POST', path: '/contacts/:id/complete', roles: ['volunteer'], own: isMyCall },
  { method: 'POST', path: '/contacts/:id/missed', roles: ['volunteer'], own: isMyCall },
  { method: 'GET', path: '/contacts/:id/calendar.ics', roles: ['volunteer'], own: isMyCall },

  // ----- family member of senior S (viewer.id is S) -----
  { method: 'GET', path: '/dashboard', roles: ['family'], note: 'only S' },
  { method: 'GET', path: '/seniors/:id/summary', roles: ['family'], own: isSelf },

  // ----- family member of S, and senior S -----
  { method: 'GET', path: '/seniors/:id', roles: ['family', 'senior'], own: isSelf, note: 'call notes hidden' },
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

// May `viewer` make this request? `body` is the parsed form for a real POST,
// or null when checking a link or form on a page.
export function can(viewer, method, pathname, { store, body = null } = {}) {
  if (!viewer || viewer.kind === 'coordinator') return true;
  const verb = method === 'HEAD' ? 'GET' : method; // HEAD asks for the same page as GET
  return COMPILED.some((rule) => {
    if (rule.method !== '*' && rule.method !== verb) return false;
    if (!rule.roles.includes(viewer.kind)) return false;
    const params = paramsFor(rule, pathname);
    if (!params) return false;
    return rule.own ? rule.own({ viewer, params, body, store }) : true;
  });
}
