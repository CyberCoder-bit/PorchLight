// LIVE_MODE tests. A tiny local HTTP server stands in for the Gemini API, so
// these run offline with no API key. They check that we send a correct
// generateContent request, parse the reply, try the next model when one is
// busy, and fall back to MOCK sparks on errors and refusals.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSparkService, buildSparkInput, resolveSparkMode } from '../src/sparks/index.js';
import { buildConfig } from '../src/config.js';
import { buildSeedData } from '../src/seed.js';
import { DEFAULT_GEMINI_MODELS, parseModels } from '../src/ai/index.js';
import { fakeGemini, geminiReply, systemOf, userOf, schemaOf } from './translate/helpers.js';

let api;
before(async () => { api = await fakeGemini(); });
after(() => api.close());

process.env.TZ = 'America/Indiana/Indianapolis'; // test dates use the app's Carmel clock (src/tz.js)
const NOW = new Date('2026-11-02T12:00:00');
const db = buildSeedData(NOW);
const hal = db.seniors.find((s) => s.id === 's-harold');
const input = buildSparkInput(hal, db.contacts.filter((c) => c.seniorId === hal.id), NOW);

const SPARKS = {
  sparks: [
    { text: "Hal, it's been almost two weeks and I've missed our talks! What's been keeping you busy?", based_on: '12 days since last contact' },
    { text: 'Who was the best Indiana high school player you ever saw in person?', based_on: 'Interest: Basketball' },
    { text: 'What was the busiest week you remember at the hardware store?', based_on: 'About: hardware store' },
  ],
};

const service = (env = {}) =>
  createSparkService(
    buildConfig({ GEMINI_API_KEY: 'gemini-test-key', GEMINI_BASE_URL: api.baseUrl, ...env }),
    { effective: 'live', reason: 'test' }
  );

test('sends a well-formed generateContent request and parses 3 sparks', async () => {
  api.received.length = 0;
  api.setReply(() => geminiReply(SPARKS, { modelVersion: 'gemini-3.5-flash-lite' }));
  const result = await service().generate(input, 0);

  assert.equal(result.mode, 'live');
  assert.equal(result.model, 'gemini-3.5-flash-lite');
  assert.equal(result.sparks.length, 3);
  assert.equal(result.sparks[1].basedOn, 'Interest: Basketball');
  assert.equal(result.notice, null);

  assert.equal(api.received.length, 1);
  const { url, headers, body } = api.received[0];
  assert.equal(url, `/v1beta/models/${DEFAULT_GEMINI_MODELS[0]}:generateContent`);
  assert.equal(headers['x-goog-api-key'], 'gemini-test-key');
  assert.ok(!url.includes('key='), 'the key goes in a header, never in the URL');
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.ok(schemaOf(body).properties.sparks);
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'low');
  assert.match(systemOf(body), /exactly 3 conversation starters/);

  // Privacy: profile basics are sent; caregiver details and call notes are not.
  const userText = userOf(body);
  assert.match(userText, /Hal/);
  assert.match(userText, /Basketball/);
  assert.match(userText, /12 days ago/);
  assert.doesNotMatch(userText, /Mike Whitaker|Phoenix/);
  assert.doesNotMatch(userText, /gin rummy|practice ran late/);
});

test('a busy model is skipped: the next model in GEMINI_MODEL answers', async () => {
  api.received.length = 0;
  api.setReply((body, req) => (req.url.includes('/busy:')
    ? { status: 503, json: { error: { code: 503, status: 'UNAVAILABLE', message: 'This model is currently experiencing high demand.' } } }
    : geminiReply(SPARKS)));
  const result = await service({ GEMINI_MODEL: 'busy, models/backup' }).generate(input, 0);
  assert.equal(result.mode, 'live');
  assert.deepEqual(api.received.map((r) => r.url), ['/v1beta/models/busy:generateContent', '/v1beta/models/backup:generateContent']);
});

test('a rejected API key falls back to MOCK sparks with a clear notice, without trying other models', async () => {
  api.received.length = 0;
  api.setReply(() => ({ status: 400, json: { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.', details: [{ reason: 'API_KEY_INVALID' }] } } }));
  const result = await service().generate(input, 0);
  assert.equal(result.mode, 'mock-fallback');
  assert.equal(result.sparks.length, 3);
  assert.match(result.notice, /API key was rejected/);
  assert.equal(api.received.length, 1);
});

test('when every model is busy, MOCK sparks say the service was busy', async () => {
  api.setReply(() => ({ status: 503, json: { error: { code: 503, status: 'UNAVAILABLE', message: 'high demand' } } }));
  const result = await service().generate(input, 0);
  assert.equal(result.mode, 'mock-fallback');
  assert.match(result.notice, /busy/);
});

test('a refusal falls back to MOCK sparks', async () => {
  api.setReply(() => ({ status: 200, json: { promptFeedback: { blockReason: 'SAFETY' }, candidates: [] } }));
  const result = await service().generate(input, 0);
  assert.equal(result.mode, 'mock-fallback');
  assert.match(result.notice, /declined/);

  api.setReply(() => geminiReply(SPARKS, { candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }] }));
  assert.match((await service().generate(input, 0)).notice, /declined/);
});

test('malformed or short output falls back to MOCK sparks', async () => {
  api.setReply(() => geminiReply({ sparks: [{ text: 'Only one', based_on: 'x' }] }));
  const result = await service().generate(input, 0);
  assert.equal(result.mode, 'mock-fallback');
  assert.match(result.notice, /fewer than 3/);
});

test('thought parts before the answer are ignored', async () => {
  const reply = geminiReply(SPARKS);
  reply.json.candidates[0].content.parts.unshift({ text: 'Let me think about Hal...', thought: true });
  api.setReply(() => reply);
  const result = await service().generate(input, 0);
  assert.equal(result.mode, 'live');
  assert.equal(result.sparks.length, 3);
});

test('an unreachable API falls back to MOCK sparks', async () => {
  const offline = createSparkService(
    buildConfig({ GEMINI_API_KEY: 'gemini-test-key', GEMINI_BASE_URL: 'http://127.0.0.1:9' }),
    { effective: 'live', reason: 'test' }
  );
  const result = await offline.generate(input, 0);
  assert.equal(result.mode, 'mock-fallback');
  assert.match(result.notice, /could not reach|timed out/);
});

test('LIVE needs only GEMINI_API_KEY; GEMINI_MODEL lists the models in order', async () => {
  assert.equal((await resolveSparkMode(buildConfig({}))).effective, 'mock');
  assert.match((await resolveSparkMode(buildConfig({}))).reason, /no GEMINI_API_KEY is set/);
  assert.equal((await resolveSparkMode(buildConfig({ GEMINI_API_KEY: 'k' }))).effective, 'live');
  assert.equal((await resolveSparkMode(buildConfig({ GEMINI_API_KEY: 'k', SPARK_MODE: 'mock' }))).effective, 'mock');
  assert.deepEqual(parseModels(''), [...DEFAULT_GEMINI_MODELS]);
  assert.deepEqual(parseModels(' a, models/b ,,'), ['a', 'b']);
});

test('a model that hangs is given up on in time for the next one to answer', async () => {
  api.received.length = 0;
  api.setReply((body, req) => (req.url.includes('/slow:') ? new Promise(() => {}) : geminiReply(SPARKS)));
  const started = Date.now();
  const result = await service({ GEMINI_MODEL: 'slow,backup' }).generate(input, 0);
  assert.equal(result.mode, 'live');
  assert.ok(Date.now() - started < 7000, `took ${Date.now() - started} ms`);
  assert.equal(api.received.length, 2);
});

// ---------- Cloudflare Workers AI backup ----------

// A stand-in for the Worker's AI binding (env.AI).
function fakeWorkersAi(answer = SPARKS) {
  const calls = [];
  return {
    calls,
    run: async (model, inputs) => {
      calls.push({ model, inputs });
      if (answer instanceof Error) throw answer;
      return { choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(answer) } }] };
    },
  };
}

const BUSY = () => ({ status: 503, json: { error: { code: 503, status: 'UNAVAILABLE', message: 'high demand' } } });
const BAD_KEY = () => ({ status: 400, json: { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid.', details: [{ reason: 'API_KEY_INVALID' }] } } });

test('when every Gemini model is busy, Cloudflare Workers AI answers with the same schema', async () => {
  api.received.length = 0;
  api.setReply(BUSY);
  const AI = fakeWorkersAi();
  const result = await service({ AI }).generate(input, 0);
  assert.equal(result.mode, 'live');
  assert.equal(result.provider, 'workers-ai');
  assert.equal(result.model, '@cf/google/gemma-4-26b-a4b-it');
  assert.equal(api.received.length, DEFAULT_GEMINI_MODELS.length, 'every Gemini model was tried first');
  const { inputs } = AI.calls[0];
  assert.equal(inputs.response_format.type, 'json_schema');
  assert.equal(inputs.chat_template_kwargs.enable_thinking, false);
  assert.ok(inputs.response_format.json_schema.schema.properties.sparks);
  assert.match(inputs.messages[0].content, /exactly 3 conversation starters/);
  assert.match(inputs.messages[1].content, /Basketball/);
  assert.doesNotMatch(JSON.stringify(inputs), /Mike Whitaker|gin rummy/);
});

test('a bad Gemini key skips the other Gemini models but still tries the backup', async () => {
  api.received.length = 0;
  api.setReply(BAD_KEY);
  const result = await service({ AI: fakeWorkersAi() }).generate(input, 0);
  assert.equal(result.provider, 'workers-ai');
  assert.equal(api.received.length, 1);

  // Both fail: the bad key is the reason people see.
  const both = await service({ AI: fakeWorkersAi(new Error('5xx')) }).generate(input, 0);
  assert.equal(both.mode, 'mock-fallback');
  assert.match(both.notice, /API key was rejected/);
});

test('with only the Workers AI binding (no Gemini key), LIVE mode uses Workers AI', async () => {
  const config = buildConfig({ AI: fakeWorkersAi() });
  const mode = await resolveSparkMode(config);
  assert.equal(mode.effective, 'live');
  assert.match(mode.reason, /Cloudflare Workers AI/);
  const result = await createSparkService(config, mode).generate(input, 0);
  assert.equal(result.provider, 'workers-ai');
  // Locally (Node) there is no binding: a string env var named AI is not one.
  assert.equal(buildConfig({ AI: 'yes' }).workersAi, null);
});

test('a used-up Workers AI allowance falls back to MOCK with a clear reason', async () => {
  const config = buildConfig({ AI: fakeWorkersAi(new Error('4006: you have used up your daily free allocation of 10,000 neurons')) });
  const result = await createSparkService(config, { effective: 'live', reason: 'test' }).generate(input, 0);
  assert.equal(result.mode, 'mock-fallback');
  assert.match(result.notice, /free Workers AI allowance is used up/);
});

test('translations use the backup too, and a backup spark set is labeled as Cloudflare', async () => {
  const { translateLive } = await import('../src/translate/live.js');
  const { sparkSourceLabel } = await import('../src/views/components.js');
  api.setReply(BUSY);
  const svc = service({ AI: fakeWorkersAi({ translation: '¡Gracias!' }) });
  const out = await translateLive({ text: 'Thanks!', fromName: 'English', toName: 'Spanish' }, svc.liveOptions());
  assert.equal(out.text, '¡Gracias!');
  assert.match(sparkSourceLabel({ mode: 'live', provider: 'workers-ai', model: '@cf/google/gemma-4-26b-a4b-it' }), /Cloudflare Workers AI/);
  assert.match(sparkSourceLabel({ mode: 'live', provider: 'gemini', model: 'gemini-3.5-flash-lite' }), /Gemini/);
});
