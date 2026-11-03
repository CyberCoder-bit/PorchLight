// Data storage: one JSON file (data/db.json).
//
// Why a JSON file instead of a database? For a prototype with a few dozen
// records it is the most reliable option. There's nothing to install, judges
// can open the file and read it, and the code is easy to follow. Every change
// is written to a temp file first and then renamed over the real file, so a
// crash mid-write can never leave a half-written (corrupted) database.
// Swapping this module for SQLite/Postgres is listed in README "Future work".

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildSeedData } from './seed.js';

export const SCHEMA_VERSION = 1;

export class Store {
  constructor(filePath, { defaultThreshold = 7 } = {}) {
    this.filePath = filePath;
    this.defaultThreshold = defaultThreshold;
    this.data = null;
  }

  // Load the file, or create it with demo data on first run.
  open(now = new Date()) {
    if (fs.existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        if (parsed && parsed.meta && parsed.meta.schemaVersion === SCHEMA_VERSION) {
          this.data = parsed;
          return { seeded: false };
        }
        console.warn(`[store] ${this.filePath} has an unknown format; re-seeding demo data.`);
      } catch (err) {
        console.warn(`[store] Could not read ${this.filePath} (${err.message}); re-seeding demo data.`);
        // Keep the broken file for inspection instead of silently deleting it.
        fs.renameSync(this.filePath, `${this.filePath}.broken-${Date.now()}`);
      }
    }
    this.reset(now);
    return { seeded: true };
  }

  // Replace everything with fresh demo data, with dates relative to `now`.
  reset(now = new Date()) {
    this.data = buildSeedData(now, { riskThresholdDays: this.defaultThreshold });
    this.save();
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.filePath);
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
