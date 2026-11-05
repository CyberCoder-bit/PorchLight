// Conversation sparks in two languages, when the senior's main language
// differs from the volunteer's.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { OPENERS, INTEREST_SPARKS, VOLUNTEER_TIPS, SPARK_TEMPLATE_KEYS } from '../../src/sparks/templates.js';
import { EN, tIn } from '../../src/i18n/index.js';
import { generateMockSparks } from '../../src/sparks/mock.js';
import { buildSparkInput } from '../../src/sparks/index.js';
import { generateLiveSparks, SPARK_SCHEMA } from '../../src/sparks/live.js';
import { sparkTemplateKey, sparkTextIn } from '../../src/translate/mock.js';
import { sparkLanguages } from '../../src/translate/views.js';
import { COMMUNITY } from '../../src/community.js';
import { makeApp, memoryStore, fakeGemini, geminiReply, systemOf, schemaOf, NOW } from './helpers.js';

let api;
before(async () => { api = await fakeGemini(); });
after(() => api.close());

test('every spark template has a translate.spark.* key in the English catalog', () => {
  assert.equal(EN['translate.spark.opener.first.0'], OPENERS.first[0]);
  assert.equal(EN['translate.spark.interest.gardening.any.0'], INTEREST_SPARKS.gardening.any[0]);
  assert.equal(EN['translate.spark.tip.0'], VOLUNTEER_TIPS[0]);
  assert.equal(EN['translate.spark.gap.aboutWeek'], 'about a week');
  const keys = Object.keys(EN).filter((k) => k.startsWith('translate.spark.'));
  assert.ok(keys.length > 100, `only ${keys.length} spark keys`);
  for (const [key, text] of SPARK_TEMPLATE_KEYS) assert.equal(EN[key], text);
});

test('MOCK: a stored spark is traced back to its template and re-written with tIn', () => {
  const store = memoryStore();
  const rosa = store.senior('s-rosa');
  for (let variant = 0; variant < 6; variant++) {
    const input = buildSparkInput(rosa, store.contactsForSenior('s-rosa'), NOW);
    const { sparks } = generateMockSparks(input, variant);
    const vars = { name: input.name, town: COMMUNITY.town, daysSince: input.daysSince };
    // The opener always comes from the templates.
    const found = sparkTemplateKey(sparks[0].text, vars);
    assert.ok(found, `opener not found: ${sparks[0].text}`);
    assert.equal(tIn('en', found.key, { name: vars.name, town: vars.town, gap: found.gap }), sparks[0].text);
    assert.equal(sparkTextIn(sparks[0], 'en', vars), sparks[0].text);
    // A language with no catalog gives no version, never English posing as it.
    assert.equal(sparkTextIn(sparks[0], 'cnh', vars), null);
    // Spanish has a catalog: a real Spanish version that differs from the English.
    const es = sparkTextIn(sparks[0], 'es', vars);
    assert.ok(es && es !== sparks[0].text, 'Spanish spark');
  }
});

test('both languages only when the senior and the volunteer speak different main languages', () => {
  const en = { languages: [{ code: 'en', level: 'native' }] };
  const ar = { languages: [{ code: 'ar', level: 'native' }, { code: 'en', level: 'learning' }] };
  assert.deepEqual(sparkLanguages(ar, en), ['ar']);
  assert.deepEqual(sparkLanguages(en, en), []);
  assert.deepEqual(sparkLanguages({}, {}), [], 'old data counts as English');
  assert.deepEqual(sparkLanguages(ar, null), []);
});

test('the senior page shows the second language with each spark (MOCK)', async () => {
  const app = makeApp();
  app.store.senior('s-rosa').languages = [{ code: 'es', level: 'native' }, { code: 'en', level: 'fluent' }];
  const res = await app.post('/seniors/s-rosa/sparks', { variant: '0' });
  assert.equal(res.status, 303);
  const page = await app.get('/seniors/s-rosa');
  assert.doesNotMatch(page.text, /Not ready in Español/);
  assert.equal((page.text.match(/<p class="spark-text" lang="es" dir="ltr">/g) || []).length, 3, 'each spark has a Spanish version');
  // Same language: nothing extra.
  await app.post('/seniors/s-dorothy/sparks', { variant: '0' });
  assert.doesNotMatch((await app.get('/seniors/s-dorothy')).text, /Not ready in/);
});

test('LIVE: Gemini writes each spark in both languages; old fields stay', async () => {
  api.received.length = 0;
  api.setReply(() => geminiReply({ sparks: [
    { text: 'How is Chispa doing?', based_on: 'Interest: Pets', text_senior_language: '¿Cómo está Chispa?' },
    { text: 'What are you knitting now?', based_on: 'Interest: Crafts', text_senior_language: '¿Qué estás tejiendo ahora?' },
    { text: 'Seen any good movies?', based_on: 'Interest: Movies', text_senior_language: '¿Has visto alguna buena película?' },
  ] }));
  const app = makeApp({ live: true, baseUrl: api.baseUrl });
  app.store.senior('s-rosa').languages = [{ code: 'es', level: 'native' }];
  assert.equal((await app.post('/seniors/s-rosa/sparks', { variant: '0' })).status, 303);
  const { body } = api.received[0];
  assert.ok(schemaOf(body).properties.sparks.items.properties.text_senior_language);
  assert.match(systemOf(body), /exactly 3 conversation starters/);
  assert.match(systemOf(body), /main language is Spanish/);
  const saved = app.store.latestSparkSet('s-rosa');
  assert.equal(saved.mode, 'live');
  assert.equal(saved.sparks[0].text, 'How is Chispa doing?');
  assert.equal(saved.sparks[0].basedOn, 'Interest: Pets');
  assert.deepEqual(saved.sparks[0].translations, { es: '¿Cómo está Chispa?' });
  const page = await app.get('/seniors/s-rosa');
  assert.match(page.text, /lang="es" dir="ltr"><span class="visually-hidden">In Español \(Spanish\): <\/span>¿Cómo está Chispa\?/);

  // An English-speaking senior gets the old request and the old schema.
  api.received.length = 0;
  const store = memoryStore();
  const hal = store.senior('s-harold');
  await generateLiveSparks(buildSparkInput(hal, store.contactsForSenior('s-harold'), NOW), { apiKey: 'gemini-test-key', models: ['gemini-test'], baseURL: api.baseUrl });
  assert.deepEqual(schemaOf(api.received[0].body), SPARK_SCHEMA);
  assert.doesNotMatch(systemOf(api.received[0].body), /main language/);
});
