// Who may use messages, the phrase card, and the conversation helper (v2).
// Same row shape as src/roles/access.js:
// { method, path, roles, own? }. Admin may open everything.
//
// Messages belong to one ACTIVE match: only its senior and its volunteer
// (and the admin) may read or write them. The routes check this again
// (canUseThread) in case a row is ever changed by mistake.

// The active match with this id, or null.
const activeMatch = (store, matchId) =>
  store.matches.find((m) => m.id === matchId && m.active) || null;

// Is this person the senior or the volunteer in this active match?
export function isInPair(viewer, match) {
  if (!viewer || !match || !match.active) return false;
  if (viewer.kind === 'senior') return match.seniorId === viewer.id;
  if (viewer.kind === 'volunteer') return match.volunteerId === viewer.id;
  return false;
}

// ----- ownership test: ({ viewer, params, store }) => boolean -----
export const isMyPair = ({ viewer, params, store }) => isInPair(viewer, activeMatch(store, params.matchId));

// The second check, inside the route. Demo mode (no viewer) and the admin
// see every pair; everyone else only their own active pair.
export function canUseThread(viewer, match) {
  if (!match) return false;
  if (!viewer || viewer.kind === 'coordinator' || viewer.kind === 'admin') return true;
  return isInPair(viewer, match);
}

const PAIR = ['senior', 'volunteer'];

export const TRANSLATE_RULES = Object.freeze([
  { method: 'GET', path: '/messages', roles: PAIR, note: 'only my own pairs' },
  { method: 'GET', path: '/messages/:matchId', roles: PAIR, own: isMyPair },
  { method: 'POST', path: '/messages/:matchId', roles: PAIR, own: isMyPair },
  { method: 'GET', path: '/translate', roles: PAIR },
  { method: 'POST', path: '/translate', roles: PAIR },
  { method: 'GET', path: '/phrases', roles: [...PAIR, 'family'] },
]);
