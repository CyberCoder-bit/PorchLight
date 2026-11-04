// Crawls every internal link reachable from the home page and the demo tour,
// starting from fresh demo data, and checks that nothing is broken: no 404 or
// 500, and no "undefined", "NaN", or "[object Object]" leaking into a page.

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

let server;
let base;
let tmpDir;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-links-'));
  const store = new Store(path.join(tmpDir, 'db.json'));
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

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

function internalLinks(htmlText) {
  const out = new Set();
  for (const m of htmlText.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
    const href = decode(m[1]).split('#')[0];
    if (href.startsWith('/') && !href.startsWith('//')) out.add(href);
  }
  // GET forms (POST forms change data, so the crawler doesn't submit them)
  for (const m of htmlText.matchAll(/<form\b([^>]*)>/g)) {
    const attrs = m[1];
    const method = /method="([^"]+)"/i.exec(attrs)?.[1]?.toLowerCase() || 'get';
    const action = /action="([^"]+)"/.exec(attrs)?.[1];
    if (method === 'get' && action && action.startsWith('/')) out.add(decode(action).split('#')[0]);
  }
  return out;
}

test('every internal link works, starting from fresh demo data', async () => {
  const seen = new Map(); // path -> status
  const queue = ['/', '/tour', '/dashboard', '/attention', '/help'];
  const problems = [];
  while (queue.length && seen.size < 400) {
    const p = queue.shift();
    if (seen.has(p)) continue;
    const res = await fetch(base + p, { redirect: 'manual' });
    seen.set(p, res.status);
    const type = res.headers.get('content-type') || '';
    if (res.status >= 400) {
      problems.push(`${p} -> ${res.status}`);
      continue;
    }
    if (!type.includes('text/html')) continue;
    const body = await res.text();
    const text = body.replace(/<[^>]+>/g, ' ');
    for (const bad of ['undefined', 'NaN', '[object Object]']) {
      if (new RegExp(`(^|[^A-Za-z])${bad.replace(/[[\]]/g, '\\$&')}([^A-Za-z]|$)`).test(text)) problems.push(`${p} shows "${bad}"`);
    }
    for (const link of internalLinks(body)) if (!seen.has(link)) queue.push(link);
  }
  // Routes the tour depends on must exist.
  for (const required of ['/', '/dashboard']) assert.equal(seen.get(required), 200, `${required} should load`);
  assert.deepEqual(problems, [], `Broken pages:\n${problems.join('\n')}`);
  assert.ok(seen.size > 10, `crawled ${seen.size} pages`);
});
