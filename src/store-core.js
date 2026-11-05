// Data storage, independent of where the data lives.
//
// All data is one JSON document held in memory. A "backend" loads and saves it:
//   - store.js keeps it in data/db.json (running locally with `npm start`)
//   - worker.js keeps it in Durable Object storage (running on Cloudflare)

import { buildSeedData } from './seed.js';

// v2 (accounts, languages, messages) changed the shape, so data saved by v1,
// or by an early v2 build (version 2), is replaced with fresh demo data the
// first time this version starts.
export const SCHEMA_VERSION = 3;

// Collections added in v2. open() makes sure each exists.
//   users[]        { id, email (lowercase), name, role: 'admin'|'senior'|'volunteer'|'family',
//                    seniorId?, volunteerId?, uiLanguage, password: { algo, iterations, salt, hash }, createdAt }
//   sessions[]     { tokenHash, userId, createdAt, expiresAt }
//   familyLinks[]  { id, userId, seniorId, relationship, status: 'pending'|'approved'|'declined', createdAt, decidedAt }
//   messages[]     { id, matchId, fromUserId, text, lang, createdAt }
//   translations{} cache: key -> { text, createdAt }
//   usage{}        daily translate counts: { day, total, byUser: { userId: n } }
const V2_DEFAULTS = { users: () => [], sessions: () => [], familyLinks: () => [], messages: () => [], translations: () => ({}), usage: () => ({}) };

export class BaseStore {
  // backend.read() -> saved data or null; backend.write(data) persists it.
  constructor(backend, { defaultThreshold = 7 } = {}) {
    this.backend = backend;
    this.defaultThreshold = defaultThreshold;
    this.data = null;
  }

  // Load saved data, or create demo data on first run.
  open(now = new Date()) {
    const saved = this.backend.read();
    // A file with no accounts can't be signed in to (not even to reset it), so
    // it gets fresh demo data too (for example, a data file from an earlier build).
    const hasAccounts = Array.isArray(saved?.users) && saved.users.some((u) => u.role === 'admin');
    if (saved && saved.meta && saved.meta.schemaVersion === SCHEMA_VERSION && hasAccounts) {
      this.data = saved;
      this.fillDefaults();
      return { seeded: false };
    }
    if (saved) console.warn('[store] Saved data has an unknown format; re-seeding demo data.');
    this.reset(now);
    return { seeded: true };
  }

  // Replace everything with fresh demo data, with dates relative to `now`.
  reset(now = new Date()) {
    this.data = buildSeedData(now, { riskThresholdDays: this.defaultThreshold });
    this.fillDefaults();
    this.save();
  }

  fillDefaults() {
    for (const [key, make] of Object.entries(V2_DEFAULTS)) if (this.data[key] == null) this.data[key] = make();
  }

  save() {
    this.backend.write(this.data);
  }

  newId(prefix) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }

  // ----- convenience lookups -----
  get seniors() { return this.data.seniors; }
  get volunteers() { return this.data.volunteers; }
  get matches() { return this.data.matches; }
  get contacts() { return this.data.contacts; }
  get sparkSets() { return this.data.sparkSets; }
  get settings() { return this.data.settings; }

  // [v2]
  get users() { return this.data.users; }
  get sessions() { return this.data.sessions; }
  get familyLinks() { return this.data.familyLinks; }
  get messages() { return this.data.messages; }
  get translations() { return this.data.translations; }
  get usage() { return this.data.usage; }

  user(id) { return this.data.users.find((u) => u.id === id) || null; }
  userByEmail(email) {
    const wanted = String(email ?? '').trim().toLowerCase();
    return wanted ? this.data.users.find((u) => u.email === wanted) || null : null;
  }
  messagesForMatch(matchId) { return this.data.messages.filter((m) => m.matchId === matchId); }
  familyLinksForSenior(seniorId) { return this.data.familyLinks.filter((l) => l.seniorId === seniorId); }
  familyLinksForUser(userId) { return this.data.familyLinks.filter((l) => l.userId === userId); }

  senior(id) { return this.data.seniors.find((s) => s.id === id) || null; }
  volunteer(id) { return this.data.volunteers.find((v) => v.id === id) || null; }

  activeMatchForSenior(seniorId) {
    return this.data.matches.find((m) => m.seniorId === seniorId && m.active) || null;
  }

  activeMatchesForVolunteer(volunteerId) {
    return this.data.matches.filter((m) => m.volunteerId === volunteerId && m.active);
  }

  contactsForSenior(seniorId) {
    return this.data.contacts.filter((c) => c.seniorId === seniorId);
  }

  latestSparkSet(seniorId) {
    const sets = this.data.sparkSets.filter((s) => s.seniorId === seniorId);
    return sets.length ? sets[sets.length - 1] : null;
  }
}
