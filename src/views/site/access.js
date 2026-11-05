// Who may open the public website's pages (v2).
// Same row shape as src/roles/access.js: { method, path, roles, own? }.
// Roles: 'public' (signed out), 'senior', 'volunteer', 'family', 'pending'
// (a volunteer waiting for approval). Admin may open everything.

export const EVERYONE = ['public', 'senior', 'volunteer', 'family', 'pending'];

export const SITE_RULES = Object.freeze([
  // e.g. { method: 'GET', path: '/how-it-works', roles: EVERYONE },
]);
