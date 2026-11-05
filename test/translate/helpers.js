// Shared setup for the translate tests: an in-memory app, and a fake Gemini API.

import http from 'node:http';
import { BaseStore } from '../../src/store-core.js';
import { createApp } from '../../src/app.js';
import { createSparkService } from '../../src/sparks/index.js';
import { buildConfig } from '../../src/config.js';
import { sessionCookieFor } from '../helpers/server.js'; // [v2 accounts] real sessions

process.env.TZ = 'America/Indiana/Indianapolis';
export const NOW = new Date('2026-11-04T12:00:00');

export function memoryStore(now = NOW) {
  const store = new BaseStore({ read: () => null, write: () => {} });
  store.open(now);
  return store;
}

// mode 'mock' (default) or 'live' with a fake API at baseUrl.
export function makeApp({ live = false, baseUrl, env = {}, now = NOW } = {}) {
  const store = memoryStore(now);
  const config = buildConfig(live ? { GEMINI_API_KEY: 'gemini-test-key', GEMINI_BASE_URL: baseUrl, ...env } : env);
  const sparks = createSparkService(config, { effective: live ? 'live' : 'mock', reason: 'test', warning: null });
  const handle = createApp({ store, sparks, now: () => now });
  const request = async (method, path, { body, viewer } = {}) => {
    const headers = { 'content-type': 'application/x-www-form-urlencoded' };
    // [v2 accounts] `viewer` is 'coordinator', 'senior:<id>', 'volunteer:<id>',
    // 'family:<seniorId>', or 'public' (signed out). No viewer means the admin.
    if (viewer !== 'public') headers.cookie = await sessionCookieFor(store, viewer || 'admin');
    const res = await handle(new Request(`http://porchlight.test${path}`, { method, headers, body: body ? new URLSearchParams(body).toString() : undefined }));
    return { status: res.status, text: await res.text(), location: res.headers.get('location') };
  };
  return {
    store,
    get: (path, viewer) => request('GET', path, { viewer }),
    post: (path, body, viewer) => request('POST', path, { body, viewer }),
  };
}

// A local stand-in for the Gemini API. `reply(body, req)` returns { status, json } (or a promise of it).
export async function fakeGemini() {
  const received = [];
  const state = { reply: () => ({ status: 500, json: {} }) };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      received.push({ url: req.url, headers: req.headers, body, raw });
      // A reply may be a promise (one that never settles stands in for a hung model).
      Promise.resolve(state.reply(body, req)).then(({ status, json }) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(json));
      });
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    received,
    setReply: (fn) => (state.reply = fn),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// A generateContent reply whose text is `value` as JSON.
export const geminiReply = (value, overrides = {}) => ({
  status: 200,
  json: {
    candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(value) }] }, finishReason: 'STOP', index: 0 }],
    usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20 },
    modelVersion: 'gemini-test',
    ...overrides,
  },
});

// A reply whose text is the JSON { translation }.
export const translationReply = (translation) => geminiReply({ translation });

// The parts of a generateContent request the tests look at.
export const systemOf = (body) => body.systemInstruction.parts[0].text;
export const userOf = (body) => body.contents[0].parts[0].text;
export const schemaOf = (body) => body.generationConfig.responseJsonSchema;
