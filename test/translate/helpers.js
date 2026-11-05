// Shared setup for the translate tests: an in-memory app, and a fake Claude API.

import http from 'node:http';
import { BaseStore } from '../../src/store-core.js';
import { createApp } from '../../src/app.js';
import { createSparkService } from '../../src/sparks/index.js';
import { buildConfig } from '../../src/config.js';

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
  const config = buildConfig(live ? { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_BASE_URL: baseUrl, ...env } : env);
  const sparks = createSparkService(config, { effective: live ? 'live' : 'mock', reason: 'test', warning: null });
  const handle = createApp({ store, sparks, now: () => now });
  const request = async (method, path, { body, viewer } = {}) => {
    const headers = { 'content-type': 'application/x-www-form-urlencoded' };
    if (viewer) headers.cookie = `viewer=${encodeURIComponent(viewer)}`;
    const res = await handle(new Request(`http://porchlight.test${path}`, { method, headers, body: body ? new URLSearchParams(body).toString() : undefined }));
    return { status: res.status, text: await res.text(), location: res.headers.get('location') };
  };
  return {
    store,
    get: (path, viewer) => request('GET', path, { viewer }),
    post: (path, body, viewer) => request('POST', path, { body, viewer }),
  };
}

// A local stand-in for the Claude API. `reply(body)` returns { status, json }.
export async function fakeClaude() {
  const received = [];
  const state = { reply: () => ({ status: 500, json: {} }) };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      received.push({ url: req.url, headers: req.headers, body, raw });
      const { status, json } = state.reply(body);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(json));
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

// A Messages API reply whose text is the JSON { translation }.
export const translationReply = (translation) => ({
  status: 200,
  json: {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    content: [{ type: 'text', text: JSON.stringify({ translation }) }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 50, output_tokens: 20 },
  },
});
