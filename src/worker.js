// Cloudflare Workers entry (`npm run deploy`).
//
// Files in /public (styles.css, app.js, favicon.svg) are served by Workers
// Static Assets before this code runs. Every page request goes to one
// Durable Object, a single always-consistent instance that holds the data in
// its built-in storage and runs exactly the same app as `npm start`.

import { DurableObject } from 'cloudflare:workers';
import { BaseStore } from './store-core.js';
import { createApp } from './app.js';
import { buildAppConfig } from './app-config.js';
import { resolveSparkMode, createSparkService } from './sparks/index.js';

export class PorchLightData extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get('db');
      const config = buildAppConfig(env);
      // The app saves synchronously. Durable Objects hold each response until
      // its storage writes are confirmed, so an un-awaited put() is still safe.
      const store = new BaseStore(
        { read: () => saved ?? null, write: (data) => ctx.storage.put('db', data) },
        { defaultThreshold: config.riskThresholdDays }
      );
      store.open();
      const modeInfo = await resolveSparkMode(config);
      this.handle = createApp({ store, sparks: createSparkService(config, modeInfo) });
    });
  }

  fetch(request) {
    return this.handle(request);
  }
}

export default {
  fetch(request, env) {
    return env.PORCHLIGHT.get(env.PORCHLIGHT.idFromName('main')).fetch(request);
  },
};
