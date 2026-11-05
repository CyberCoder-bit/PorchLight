// Who may open the public website's pages (v2).
// Same row shape as src/roles/access.js: { method, path, roles, own? }.
// Roles: 'public' (signed out), 'senior', 'volunteer', 'family', 'pending'
// (a volunteer waiting for approval). Admin may open everything.
//
// "/" is not listed here: src/roles/access.js already has its row (signed-in
// people are sent on to their own home page; signed-out visitors see the
// public home).

export const EVERYONE = ['public', 'senior', 'volunteer', 'family', 'pending'];

export const SITE_RULES = Object.freeze([
  { method: 'GET', path: '/how-it-works', roles: EVERYONE, note: 'public website' },
  { method: 'GET', path: '/for-seniors', roles: EVERYONE, note: 'public website' },
  { method: 'GET', path: '/for-volunteers', roles: EVERYONE, note: 'public website' },
  { method: 'GET', path: '/for-families', roles: EVERYONE, note: 'public website' },
  { method: 'GET', path: '/languages', roles: EVERYONE, note: 'public website' },
  { method: 'GET', path: '/safety', roles: EVERYONE, note: 'public website' },
  { method: 'GET', path: '/about', roles: EVERYONE, note: 'public website' },
]);
