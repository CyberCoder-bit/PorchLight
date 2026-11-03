// npm run reset: replace data/db.json with fresh demo data dated from today.
// Run this right before recording a demo video.

import { loadDotEnv, buildConfig } from '../src/config.js';
import { Store } from '../src/store.js';

loadDotEnv();
const config = buildConfig();
const store = new Store(config.dataFile, { defaultThreshold: config.riskThresholdDays });
store.reset(new Date());
console.log(`Demo data reset: ${config.dataFile}`);
console.log('If the server is running, restart it (Ctrl+C, then npm start) or use "Reset demo data" in the page footer.');
