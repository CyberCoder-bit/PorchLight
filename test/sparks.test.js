import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMockSparks, gapBucket, seasonOf } from '../src/sparks/mock.js';
import { resolveSparkMode, buildSparkInput, createSparkService } from '../src/sparks/index.js';
import { buildConfig } from '../src/config.js';
import { buildSeedData } from '../src/seed.js';
import { interestLabel } from '../src/vocab.js';

process.env.TZ = 'America/Indiana/Indianapolis'; // test dates use the app's Carmel clock (src/tz.js)
const NOW = new Date('2026-11-02T12:00:00');
const db = buildSeedData(NOW);
const inputFor = (id) => {
  const senior = db.seniors.find((s) => s.id === id);
  return buildSparkInput(senior, db.contacts.filter((c) => c.seniorId === id), NOW);
};

test('always exactly 3 non-empty sparks, each with a "based on" label', () => {
  for (const s of db.seniors) {
    for (let v = 0; v < 5; v++) {
      const { sparks, tip } = generateMockSparks(inputFor(s.id), v);
      assert.equal(sparks.length, 3);
      for (const spark of sparks) {
        assert.ok(spark.text.length > 10);
        assert.ok(spark.basedOn.length > 0);
        assert.doesNotMatch(spark.text, /\{\w+\}/, 'no unfilled placeholders');
      }
      assert.ok(tip);
    }
  }
});

test('deterministic: same input gives the same output', () => {
  assert.deepEqual(generateMockSparks(inputFor('s-dorothy'), 0), generateMockSparks(inputFor('s-dorothy'), 0));
});

test('varied: different seniors and different variants give different output', () => {
  const a = generateMockSparks(inputFor('s-dorothy'), 0).sparks.map((s) => s.text);
  const b = generateMockSparks(inputFor('s-harold'), 0).sparks.map((s) => s.text);
  assert.notDeepEqual(a, b);
  const variants = new Set([0, 1, 2, 3].map((v) => JSON.stringify(generateMockSparks(inputFor('s-rosa'), v).sparks)));
  assert.ok(variants.size >= 3, 'clicking "Show different sparks" changes the output');
});

test('sparks 2 and 3 use two different interests the senior actually has', () => {
  const input = inputFor('s-harold');
  const { sparks } = generateMockSparks(input, 0);
  const labels = sparks.slice(1).map((s) => s.basedOn.replace(/^Interest: /, '').replace(/ \(.*\)$/, ''));
  assert.notEqual(labels[0], labels[1]);
  for (const label of labels) assert.ok(input.interests.map(interestLabel).includes(label), label);
});

test('the opener fits the gap since last contact', () => {
  assert.equal(gapBucket(null), 'first');
  assert.equal(gapBucket(2), 'recent');
  assert.equal(gapBucket(7), 'week');
  assert.equal(gapBucket(12), 'long');
  assert.match(generateMockSparks(inputFor('s-harold'), 0).sparks[0].basedOn, /12 days since last contact, warm reconnect/);
  assert.equal(generateMockSparks(inputFor('s-eugene'), 0).sparks[0].basedOn, 'First conversation');
});

test('seniors with fewer than two interests get general prompts', () => {
  const input = { seniorId: 'x', name: 'Pat', interests: [], daysSince: 3, lastContactDay: '2026-10-30', now: NOW };
  const { sparks } = generateMockSparks(input, 0);
  assert.equal(sparks.length, 3);
  assert.notEqual(sparks[1].text, sparks[2].text);
});

test('season detection', () => {
  assert.equal(seasonOf(new Date('2026-11-02')), 'fall');
  assert.equal(seasonOf(new Date('2026-01-15')), 'winter');
  assert.equal(seasonOf(new Date('2026-05-20')), 'spring');
  assert.equal(seasonOf(new Date('2026-07-04')), 'summer');
});

test('mode selection: auto without a key is MOCK; SPARK_MODE=live without a key warns and uses MOCK', async () => {
  const auto = await resolveSparkMode(buildConfig({}));
  assert.equal(auto.effective, 'mock');
  assert.equal(auto.warning, null);
  const live = await resolveSparkMode(buildConfig({ SPARK_MODE: 'live' }));
  assert.equal(live.effective, 'mock');
  assert.match(live.warning, /ANTHROPIC_API_KEY/);
  const forcedMock = await resolveSparkMode(buildConfig({ SPARK_MODE: 'mock', ANTHROPIC_API_KEY: 'sk-test' }));
  assert.equal(forcedMock.effective, 'mock');
});

test('mock service returns mode "mock" and no notice', async () => {
  const service = createSparkService(buildConfig({}), { effective: 'mock', reason: 'test' });
  const result = await service.generate(inputFor('s-rosa'), 0);
  assert.equal(result.mode, 'mock');
  assert.equal(result.sparks.length, 3);
  assert.equal(result.notice, null);
});
