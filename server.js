// PorchLight entry point. Run with:  npm start
//
// On first run this creates data/db.json with fictional demo data.

import { loadDotEnv, buildConfig } from './src/config.js';
import { Store } from './src/store.js';
import { createApp } from './src/app.js';
import { resolveSparkMode, createSparkService } from './src/sparks/index.js';

loadDotEnv();
const config = buildConfig();

const store = new Store(config.dataFile, { defaultThreshold: config.riskThresholdDays });
const { seeded } = store.open();

const modeInfo = await resolveSparkMode(config);
const sparks = createSparkService(config, modeInfo);

const server = createApp({ store, sparks });

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${config.port} is already in use. Try:  PORT=3001 npm start\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(config.port, config.host, () => {
  const url = `http://localhost:${server.address().port}`;
  console.log('');
  console.log('  PorchLight is running.');
  console.log(`  Open ${url} in your browser.`);
  console.log('');
  console.log(`  Data:  ${config.dataFile}${seeded ? ' (created with demo data)' : ''}`);
  console.log(`  AI:    ${modeInfo.effective.toUpperCase()} mode. ${modeInfo.reason}`);
  if (modeInfo.warning) console.log(`  Note:  ${modeInfo.warning}`);
  console.log('  Stop:  press Ctrl+C');
  console.log('');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  });
}
