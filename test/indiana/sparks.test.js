// Localized sparks: Carmel touches come from the Carmel profile; any other
// community gets statewide Indiana touches and never Carmel text.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMockSparks, touchesFor } from '../../src/sparks/mock.js';
import { OPENERS, INTEREST_SPARKS, GENERAL_SPARKS, INDIANA_TOUCHES } from '../../src/sparks/templates.js';
import { systemPromptFor, SYSTEM_PROMPT } from '../../src/sparks/live.js';
import { buildSparkInput } from '../../src/sparks/index.js';
import { COMMUNITY, COMMUNITIES } from '../../src/community.js';
import { INTERESTS } from '../../src/vocab.js';
import { fromLocal } from '../../src/tz.js';
import { buildSeedData } from '../../src/seed.js';

const CARMEL_ONLY = /Carmel|Monon|Palladium|Christkindl|Arts & Design|Morse|Geist|Farmers Market/i;
const IDS = INTERESTS.map((i) => i.id);
const KOKOMO = { id: 'kokomo-test', town: 'Kokomo', county: 'Howard County', state: 'Indiana', timeZone: 'America/Indiana/Indianapolis', localTouches: [], help: [] };

// Many inputs: every month, several gaps, interest mixes, and variants.
function* inputs() {
  for (let month = 1; month <= 12; month++) {
    const now = fromLocal(2026, month, 15, 12);
    for (let k = 0; k < IDS.length; k++) {
      for (const interests of [[], [IDS[k]], [IDS[k], IDS[(k + 1) % IDS.length]], [IDS[k], IDS[(k + 4) % IDS.length], IDS[(k + 9) % IDS.length]]]) {
        for (const daysSince of [null, 2, 7, 14]) {
          for (let variant = 0; variant < 3; variant++) {
            yield [{ seniorId: `s-${k}`, name: 'Pat', interests, daysSince, lastContactDay: daysSince == null ? null : '2026-10-30', now }, variant];
          }
        }
      }
    }
  }
}

test('no shared template names Carmel or a Carmel-only place', () => {
  const all = [
    ...Object.values(OPENERS).flat(),
    ...Object.values(INTEREST_SPARKS).flatMap((e) => Object.values(e).flat()),
    ...Object.values(GENERAL_SPARKS).flat(),
    ...INDIANA_TOUCHES.map((t) => t.text),
  ];
  for (const text of all) assert.doesNotMatch(text, CARMEL_ONLY, text);
});

test('a non-Carmel profile never produces Carmel text', () => {
  const carmelTexts = COMMUNITIES.carmel.localTouches.map((t) => t.text);
  for (const community of [COMMUNITIES.evansville, KOKOMO]) {
    let townMentions = 0;
    for (const [input, variant] of inputs()) {
      const { sparks } = generateMockSparks(input, variant, community);
      assert.equal(sparks.length, 3);
      for (const s of sparks) {
        assert.doesNotMatch(s.text, CARMEL_ONLY, `${community.town}: ${s.text}`);
        assert.ok(!carmelTexts.includes(s.text));
        assert.doesNotMatch(s.text, /\{\w+\}/, 'no unfilled placeholders');
        if (s.text.includes(community.town)) townMentions++;
      }
    }
    assert.ok(townMentions > 0, `${community.town} sparks use the profile's town name`);
  }
});

test('a community with no local touches falls back to statewide Indiana touches', () => {
  assert.equal(touchesFor(COMMUNITIES.evansville), INDIANA_TOUCHES);
  assert.equal(touchesFor(COMMUNITIES.carmel), COMMUNITIES.carmel.localTouches);
  const seen = new Set();
  for (const [input, variant] of inputs()) {
    for (const s of generateMockSparks(input, variant, COMMUNITIES.evansville).sparks) seen.add(s.text);
  }
  const used = INDIANA_TOUCHES.filter((t) => [...seen].some((text) => text === t.text.replace('{town}', 'Evansville')));
  assert.ok(used.length >= 3, `statewide touches show up (${used.length})`);
});

test('Carmel still gets its local touches, from the profile', () => {
  let local = 0;
  for (const [input, variant] of inputs()) {
    for (const s of generateMockSparks(input, variant, COMMUNITIES.carmel).sparks) if (CARMEL_ONLY.test(s.text)) local++;
  }
  assert.ok(local > 0);
  // The default community is Carmel, so the 2-argument call is unchanged.
  const [input] = inputs().next().value;
  assert.deepEqual(generateMockSparks(input, 0), generateMockSparks(input, 0, COMMUNITY));
});

test('localized MOCK sparks are deterministic and keep the gap-aware opener', () => {
  const ev = COMMUNITIES.evansville;
  const input = { seniorId: 's-x', name: 'Hal', interests: ['basketball', 'history'], daysSince: 12, lastContactDay: '2026-10-21', now: fromLocal(2026, 11, 2, 12) };
  assert.deepEqual(generateMockSparks(input, 0, ev), generateMockSparks(input, 0, ev));
  assert.match(generateMockSparks(input, 0, ev).sparks[0].basedOn, /12 days since last contact, warm reconnect/);
  assert.equal(generateMockSparks({ ...input, daysSince: null, lastContactDay: null }, 0, ev).sparks[0].basedOn, 'First conversation');
});

test('the LIVE system prompt names the community, and Carmel keeps its wording', () => {
  assert.match(SYSTEM_PROMPT, /a program in Carmel, Indiana that pairs/);
  assert.match(SYSTEM_PROMPT, /exactly 3 conversation starters/);
  const ev = systemPromptFor(COMMUNITIES.evansville);
  assert.match(ev, /a program in Evansville, Indiana that pairs/);
  assert.match(ev, /something local to Evansville/);
  assert.doesNotMatch(ev, /Carmel/);
  // The privacy rules are the same for every town.
  assert.equal(ev.replaceAll('Evansville', 'Carmel'), SYSTEM_PROMPT);
});

test('lastContactDay is the local calendar day, even for an evening call', () => {
  // 8:30 PM in Carmel on July 15 is already July 16 in UTC.
  const completedAt = fromLocal(2026, 7, 15, 20, 30).toISOString();
  assert.equal(completedAt, '2026-07-16T00:30:00.000Z');
  const senior = { id: 's-test', name: 'Test Senior', interests: ['music'], contactMethod: 'phone' };
  const input = buildSparkInput(senior, [{ status: 'completed', completedAt, type: 'phone' }], fromLocal(2026, 7, 20, 12));
  assert.equal(input.lastContactDay, '2026-07-15');
  assert.equal(input.daysSince, 5);
});

test('the seeded demo story still reads the same in the sparks', () => {
  const now = fromLocal(2026, 11, 2, 12);
  const db = buildSeedData(now);
  const hal = db.seniors.find((s) => s.id === 's-harold');
  const input = buildSparkInput(hal, db.contacts.filter((c) => c.seniorId === hal.id), now);
  assert.equal(input.daysSince, 12);
  assert.match(generateMockSparks(input, 0).sparks[0].basedOn, /12 days since last contact, warm reconnect/);
});
