// Bugs found in the final v2 review (B1, F2, F4), each as a test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from '../helpers/server.js';
import { BaseStore, SCHEMA_VERSION } from '../../src/store-core.js';
import { buildSeedData } from '../../src/seed.js';

test('B1: "Hi Hal!" is shown to Hal only, not to his volunteer, the coordinator, or his family', async () => {
  const app = await startApp();
  try {
    const welcome = /class="panel welcome"/;
    assert.match(await (await app.get('/seniors/s-harold', { as: 'senior:s-harold' })).text(), welcome);
    for (const who of ['volunteer:v-ethan', 'admin', 'family:s-harold']) {
      assert.doesNotMatch(await (await app.get('/seniors/s-harold', { as: who })).text(), welcome, who);
    }
  } finally {
    app.close();
  }
});

test('F2: a saved file with no accounts (from an earlier build) gets fresh demo data, so sign-in works', () => {
  const old = buildSeedData(new Date());
  old.users = [];
  for (const version of [1, 2, SCHEMA_VERSION]) {
    let written = null;
    const store = new BaseStore({ read: () => ({ ...old, meta: { ...old.meta, schemaVersion: version } }), write: (d) => (written = d) });
    const { seeded } = store.open();
    assert.equal(seeded, true, `version ${version}`);
    assert.ok(store.userByEmail('admin@porchlight.example'), `version ${version}: the admin account exists again`);
    assert.ok(written, 'the fresh data was saved');
  }
});
