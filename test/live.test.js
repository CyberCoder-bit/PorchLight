// LIVE_MODE tests. A tiny local HTTP server stands in for the Claude API, so
// these run offline with no API key. They check that we send a correct
// request through the official SDK, parse the reply, and fall back to MOCK
// sparks on errors and refusals.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadSdk } from '../src/sparks/live.js';
import { createSparkService, buildSparkInput } from '../src/sparks/index.js';
import { buildConfig } from '../src/config.js';
import { buildSeedData } from '../src/seed.js';

const sdk = await loadSdk();
const skip = sdk ? false : 'run `npm install` to test LIVE mode (needs @anthropic-ai/sdk)';

let server;
let baseUrl;
let nextReply; // (req, body) => { status, json }
const received = [];

before(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      received.push({ url: req.url, headers: req.headers, body });
      const { status, json } = nextReply(req, body);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(json));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const NOW = new Date('2026-11-02T12:00:00');
const db = buildSeedData(NOW);
const hal = db.seniors.find((s) => s.id === 's-harold');
const input = buildSparkInput(hal, db.contacts.filter((c) => c.seniorId === hal.id), NOW);

const message = (overrides) => ({
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  model: 'claude-sonnet-5-5',
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        sparks: [
          { text: "Hal, it's been almost two weeks and I've missed our talks! What's been keeping you busy?", based_on: '12 days since last contact' },
          { text: 'Who was the best Indiana high school player you ever saw in person?', based_on: 'Interest: Basketball' },
          { text: 'What was the busiest week you remember at the hardware store?', based_on: 'About: hardware store' },
        ],
      }),
    },
  ],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 300, output_tokens: 120 },
  ...overrides,
});

const service = () =>
  createSparkService(
    buildConfig({ ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_BASE_URL: baseUrl }),
    { effective: 'live', reason: 'test' }
  );

test('sends a well-formed Messages API request and parses 3 sparks', { skip }, async () => {
  received.length = 0;
  nextReply = () => ({ status: 200, json: message() });
  const result = await service().generate(input, 0);

  assert.equal(result.mode, 'live');
  assert.equal(result.model, 'claude-sonnet-5-5');
  assert.equal(result.sparks.length, 3);
  assert.equal(result.sparks[1].basedOn, 'Interest: Basketball');
  assert.equal(result.notice, null);

  const { url, headers, body } = received[0];
  assert.equal(url, '/v1/messages');
  // SDK 1.x sends the key as a Bearer token; older SDKs used x-api-key.
  assert.ok(headers.authorization === 'Bearer sk-ant-test' || headers['x-api-key'] === 'sk-ant-test', 'API key is sent');
  assert.ok(headers['anthropic-version']);
  assert.equal(body.model, 'claude-sonnet-5-5');
  assert.equal(body.output_config.effort, 'low');
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.ok(body.output_config.format.schema.properties.sparks);
  assert.equal(body.temperature, undefined, 'Sonnet 5.5 rejects non-default temperature');
  assert.equal(body.thinking, undefined, 'adaptive thinking is the default');
  assert.match(body.system, /exactly 3 conversation starters/);

  // Privacy: profile basics are sent; caregiver details and call notes are not.
  const userText = body.messages[0].content;
  assert.match(userText, /Hal/);
  assert.match(userText, /Basketball/);
  assert.match(userText, /12 days ago/);
  assert.doesNotMatch(userText, /Mike Whitaker|Phoenix/);
  assert.doesNotMatch(userText, /gin rummy|practice ran late/);
});

test('a rejected API key falls back to MOCK sparks with a clear notice', { skip }, async () => {
  nextReply = () => ({ status: 401, json: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } });
  const result = await service().generate(input, 0);
  assert.equal(result.mode, 'mock-fallback');
  assert.equal(result.sparks.length, 3);
  assert.match(result.notice, /API key was rejected/);
});

test('a refusal falls back to MOCK sparks', { skip }, async () => {
  nextReply = () => ({ status: 200, json: message({ content: [], stop_reason: 'refusal' }) });
  const result = await service().generate(input, 0);
  assert.equal(result.mode, 'mock-fallback');
  assert.match(result.notice, /declined/);
});

test('malformed or short output falls back to MOCK sparks', { skip }, async () => {
  nextReply = () => ({ status: 200, json: message({ content: [{ type: 'text', text: '{"sparks":[{"text":"Only one","based_on":"x"}]}' }] }) });
  const result = await service().generate(input, 0);
  assert.equal(result.mode, 'mock-fallback');
  assert.match(result.notice, /fewer than 3/);
});

test('thinking blocks before the text are ignored (read blocks by type)', { skip }, async () => {
  const base = message();
  nextReply = () => ({ status: 200, json: { ...base, content: [{ type: 'thinking', thinking: '', signature: 'x' }, ...base.content] } });
  const result = await service().generate(input, 0);
  assert.equal(result.mode, 'live');
  assert.equal(result.sparks.length, 3);
});

test('an unreachable API falls back to MOCK sparks', { skip }, async () => {
  const offline = createSparkService(
    buildConfig({ ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9' }),
    { effective: 'live', reason: 'test' }
  );
  const result = await offline.generate(input, 0);
  assert.equal(result.mode, 'mock-fallback');
  assert.match(result.notice, /could not reach|timed out/);
});
