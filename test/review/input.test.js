// Review: odd input, error pages, and small routing gaps.
// Each test FAILS on the current code and passes once the bug is fixed.

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
let store;
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

const get = (p, init = {}) => fetch(base + p, { redirect: 'manual', ...init });
const page = async (p) => (await get(p)).text();
const encode = (data) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  return params.toString();
};
const post = (p, data) =>
  fetch(base + p, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: encode(data),
  });
const SENIOR = { interests: ['gardening'], availability: ['mon-morning'], contactMethod: 'phone' };
const textSizeBack = (html) => html.match(/<form class="text-size"[\s\S]*?name="back" value="([^"]*)"/)[1].replace(/&amp;/g, '&');

test('B-10: pressing A++ on a form that came back with errors keeps the person on a working page', async () => {
  // Family dashboard: an out-of-range alert setting re-shows the dashboard at URL /settings.
  let res = await post('/settings', { riskThresholdDays: '0' });
  assert.equal(res.status, 200);
  let back = textSizeBack(await res.text());
  let target = await get(back);
  assert.equal(target.status, 200, `A++ on the dashboard error page goes to ${back}, which is a ${target.status}`);

  // Add a senior with a missing name: A++ should keep the form, not jump to the list.
  res = await post('/seniors', { ...SENIOR, name: '' });
  assert.equal(res.status, 200);
  back = textSizeBack(await res.text());
  target = await get(back);
  assert.equal(target.status, 200);
  assert.match(await target.text(), /<form method="post" action="\/seniors" class="stack-form"/, `A++ on the "Add a senior" error page goes to ${back}, which has no form`);
});

test('B-06: the family summary prints in full (the copy box is not cut off on paper)', async () => {
  const html = await page('/seniors/s-harold/summary');
  const area = html.match(/<textarea id="summary-text" rows="(\d+)"[^>]*>([\s\S]*?)<\/textarea>/);
  const rows = Number(area[1]);
  const text = area[2];
  const firstLine = text.split('\n')[0]; // "PorchLight weekly update: Hal (Harold Whitaker)": only in the message
  // Fixed either way: the text also appears outside the <textarea> (a print-only copy),
  // or the box has enough rows for its wrapped lines (about 55 characters fit per line when printed).
  const outside = html.replace(area[0], '').includes(firstLine);
  const wrappedLines = text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 55)), 0);
  assert.ok(outside || rows >= wrappedLines, `rows=${rows}, but the message needs about ${wrappedLines} printed lines`);
});

test('B-17: a malformed %-escape in the URL is a 404, not a 500', async () => {
  for (const p of ['/seniors/%E0%A4%A', '/volunteers/%ZZ', '/contacts/%/calendar.ics']) {
    const res = await get(p);
    assert.equal(res.status, 404, `${p} -> ${res.status}`);
  }
});

test('B-18: HEAD requests work like GET (link checkers and uptime monitors use them)', async () => {
  for (const p of ['/', '/dashboard', '/help']) {
    const res = await get(p, { method: 'HEAD' });
    assert.equal(res.status, 200, `HEAD ${p} -> ${res.status}`);
  }
});

test('B-19: numbers in hex or exponent form are not accepted as ages or alert days', async () => {
  let res = await post('/seniors', { ...SENIOR, name: 'Hex Age', age: '0x50' });
  assert.equal(res.status, 200, 'age "0x50" was saved as 80');
  for (const v of ['0x7', '1e1']) {
    res = await post('/settings', { riskThresholdDays: v });
    assert.equal(res.status, 200, `alert days "${v}" was accepted`);
  }
});

test('B-20: a name made only of invisible characters is rejected', async () => {
  for (const name of ['​', '​‌‍', '⁠﻿']) {
    const res = await post('/seniors', { ...SENIOR, name });
    assert.equal(res.status, 200, `invisible name ${JSON.stringify(name)} was saved`);
  }
});

test('B-21: "About them" counts characters as people do (emoji count once)', async () => {
  const aboutMe = '\u{1F44D}'.repeat(300); // 300 thumbs-up: 300 characters, 600 UTF-16 units
  const res = await post('/seniors', { ...SENIOR, name: 'Emoji Fan', aboutMe });
  assert.equal(res.status, 303, '300 emoji rejected as "more than 500 characters"');
});

test('B-22: with a 1-day alert setting the dashboard does not say "1 to 1 day"', async () => {
  const res = await post('/settings', { riskThresholdDays: '1' });
  assert.equal(res.status, 303);
  assert.doesNotMatch(await page('/dashboard'), /Getting close: 1 to 1 day/);
  await post('/settings', { riskThresholdDays: '7' });
});
