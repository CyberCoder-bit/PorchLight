// Data storage, independent of where the data lives.
//
// All data is one JSON document held in memory. A "backend" loads and saves it:
//   - store.js keeps it in data/db.json (running locally with `npm start`)
//   - worker.js keeps it in Durable Object storage (running on Cloudflare)

import { buildSeedData } from './seed.js';

export const SCHEMA_VERSION = 1;

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
    if (saved && saved.meta && saved.meta.schemaVersion === SCHEMA_VERSION) {
      this.data = saved;
      return { seeded: false };
    }
    if (saved) console.warn('[store] Saved data has an unknown format; re-seeding demo data.');
    this.reset(now);
    return { seeded: true };
  }

  // Replace everything with fresh demo data, with dates relative to `now`.
  reset(now = new Date()) {
    this.data = buildSeedData(now, { riskThresholdDays: this.defaultThreshold });
    this.save();
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
