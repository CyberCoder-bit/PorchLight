// Review: open-redirect attempts through every `back` field.
// Each test FAILS on the current code and passes once the bug is fixed.
// Findings B-01, B-02, B-16.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../../src/store.js';
import { createApp } from '../../src/app.js';
import { createNodeServer } from '../../src/node-server.js';
import { createSparkService } from '../../src/sparks/index.js';
import { buildConfig, ROOT_DIR } from '../../src/config.js';
import { fetchAs } from '../helpers/server.js'; // [v2 accounts] signed in as the coordinator

let server;
let base;
let store;
// [v2 accounts] Every request is signed in as the coordinator (admin) unless it
// carries its own session cookie. Signed out, a visitor sees only the public site.
const fetch = fetchAs(() => store);
let tmpDir;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-review-'));
  store = new Store(path.join(tmpDir, 'db.json'));
  store.open();
  const sparks = createSparkService(buildConfig({}), { effective: 'mock', reason: 'test', warning: null });
  server = createNodeServer({ handle: createApp({ store, sparks }), publicDir: path.join(ROOT_DIR, 'public') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const post = (p, data) =>
  fetch(base + p, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data).toString(),
  });

// Resolve a Location header the way a browser does (WHATWG URL parser: tabs and
// newlines are removed, and "\" counts as "/"), then check it stays on this site.
const SITE = 'http://porchlight.test/some/page';
const staysOnSite = (location) => new URL(location, SITE).host === 'porchlight.test';

// Payloads that browsers turn into "//evil.example" (protocol-relative, off-site).
const ATTACKS = ['/\\evil.example', '/\\/evil.example', '/\t/evil.example', '/\t\\evil.example'];

test('B-01: the text-size form never redirects to another site', async () => {
  for (const back of ATTACKS) {
    const res = await post('/prefs/text-size', { size: 'large', back });
    assert.equal(res.status, 303, JSON.stringify(back));
    const location = res.headers.get('location');
    assert.ok(staysOnSite(location), `back=${JSON.stringify(back)} redirects to ${JSON.stringify(location)}`);
  }
});

test('B-02: safeBack() blocks tab tricks on sparks, complete, and missed', async () => {
  for (const back of ATTACKS) {
    let res = await post('/seniors/s-dorothy/sparks', { variant: '0', back });
    assert.equal(res.status, 303, `sparks ${JSON.stringify(back)}`);
    assert.ok(staysOnSite(res.headers.get('location')), `sparks back=${JSON.stringify(back)} -> ${res.headers.get('location')}`);

    for (const action of ['complete', 'missed']) {
      const call = store.contacts.find((c) => c.status === 'scheduled');
      assert.ok(call, 'a scheduled call to mark');
      // Since B-09, only a call whose time has come can be marked, so make this one an hour ago.
      call.scheduledFor = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      res = await post(`/contacts/${call.id}/${action}`, { back });
      assert.equal(res.status, 303, `${action} ${JSON.stringify(back)}`);
      assert.ok(staysOnSite(res.headers.get('location')), `${action} back=${JSON.stringify(back)} -> ${res.headers.get('location')}`);
      store.reset(); // put the scheduled calls back
    }
  }
});

test('B-16: a back value with a line break is ignored instead of crashing (500)', async () => {
  for (const [route, data] of [
    ['/prefs/text-size', { size: 'large' }],
    ['/seniors/s-dorothy/sparks', { variant: '0' }],
  ]) {
    const res = await post(route, { ...data, back: '/ok\r\nSet-Cookie: injected=1' });
    assert.notEqual(res.status, 500, `${route} answers 500 for a back value with CR/LF`);
    assert.ok(!(res.headers.get('set-cookie') || '').includes('injected'), 'no header injection');
  }
});
