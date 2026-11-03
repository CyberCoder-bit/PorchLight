// Local data storage: one JSON file (data/db.json).
//
// Why a JSON file instead of a database? For a prototype with a few dozen
// records it is the most reliable option. There's nothing to install, judges
// can open the file and read it, and the code is easy to follow. Every change
// is written to a temp file first and then renamed over the real file, so a
// crash mid-write can never leave a half-written (corrupted) database.
// On Cloudflare, worker.js uses the same BaseStore with Durable Object storage.

import fs from 'node:fs';
import path from 'node:path';
import { BaseStore } from './store-core.js';

export { SCHEMA_VERSION } from './store-core.js';

export class Store extends BaseStore {
  constructor(filePath, options) {
    super(
      {
        read: () => {
          if (!fs.existsSync(filePath)) return null;
          try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
          } catch (err) {
            console.warn(`[store] Could not read ${filePath} (${err.message}); re-seeding demo data.`);
            // Keep the broken file for inspection instead of silently deleting it.
            fs.renameSync(filePath, `${filePath}.broken-${Date.now()}`);
            return null;
          }
        },
        write: (data) => {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          const tmp = `${filePath}.${process.pid}.tmp`;
          fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
          fs.renameSync(tmp, filePath);
        },
      },
      options
    );
    this.filePath = filePath;
  }
}
