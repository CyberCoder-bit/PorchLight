// Who may use messages, the phrase card, and the conversation helper (v2).
// Same row shape as src/roles/access.js:
// { method, path, roles, own? }. Admin may open everything.

export const TRANSLATE_RULES = Object.freeze([
  // e.g. { method: 'GET', path: '/messages/:matchId', roles: ['senior', 'volunteer'], own: isMyPair },
]);
