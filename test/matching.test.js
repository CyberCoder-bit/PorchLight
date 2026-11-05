import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePair, rankVolunteers, WEIGHTS } from '../src/matching.js';
import { buildSeedData } from '../src/seed.js';

process.env.TZ = 'America/Indiana/Indianapolis'; // test dates use the app's Carmel clock (src/tz.js)

const senior = {
  id: 's1', name: 'Test Senior', contactMethod: 'phone',
  interests: ['gardening', 'music', 'baseball'],
  availability: ['mon-morning', 'tue-afternoon', 'wed-afternoon'],
};
const vol = (over) => ({
  id: 'v', name: 'Vol', interests: [], availability: [], contactMethods: ['phone'], maxSeniors: 2, ...over,
});

// Everyone here has no `languages` (older data), so both count as English,
// native: every eligible pair also gets the +4 shared-language points.
const L = WEIGHTS.sharedLanguage;

test('score = 3 per shared interest + 2 per shared slot + 4 shared language + 1 new-volunteer bonus', () => {
  const r = scorePair(senior, vol({ interests: ['gardening', 'music'], availability: ['mon-morning'] }), 0);
  assert.equal(r.eligible, true);
  assert.equal(r.score, 2 * WEIGHTS.perSharedInterest + 1 * WEIGHTS.perSharedSlot + L + WEIGHTS.newVolunteerBonus);
  assert.deepEqual(r.sharedInterests, ['gardening', 'music']);
});

test('no new-volunteer bonus once the volunteer has a senior', () => {
  const r = scorePair(senior, vol({ interests: ['gardening'], availability: ['mon-morning'] }), 1);
  assert.equal(r.score, 3 + 2 + L);
});

test('shared slots are capped so availability cannot swamp interests', () => {
  const big = { ...senior, availability: ['mon-morning', 'mon-afternoon', 'tue-morning', 'tue-afternoon', 'wed-morning', 'wed-afternoon', 'thu-morning'] };
  const r = scorePair(big, vol({ availability: big.availability }), 1);
  assert.equal(r.sharedSlots.length, 7);
  assert.equal(r.score, WEIGHTS.maxCountedSlots * WEIGHTS.perSharedSlot + L);
});

test('hard rules: capacity, overlapping time, and contact method', () => {
  const full = scorePair(senior, vol({ availability: ['mon-morning'], maxSeniors: 1 }), 1);
  assert.equal(full.eligible, false);
  assert.match(full.problems.join(), /At capacity/);

  const noTime = scorePair(senior, vol({ availability: ['sun-evening'] }), 0);
  assert.equal(noTime.eligible, false);
  assert.match(noTime.problems.join(), /No overlapping availability/);

  const noPhone = scorePair(senior, vol({ availability: ['mon-morning'], contactMethods: ['visit'] }), 0);
  assert.equal(noPhone.eligible, false);
  assert.match(noPhone.problems.join(), /phone call/);
});

test('ranking sorts by score, then by lighter load, then by name', () => {
  const volunteers = [
    vol({ id: 'a', name: 'Zed', interests: ['gardening'], availability: ['mon-morning'] }), // 3+2+1 = 6 (load 0)
    vol({ id: 'b', name: 'Amy', interests: ['gardening', 'music'], availability: ['mon-morning'] }), // 6+2 = 8 (load 1)
    vol({ id: 'c', name: 'Bea', interests: ['gardening'], availability: ['mon-morning'] }), // 6 (load 0) -> ties with Zed, wins on name
    vol({ id: 'd', name: 'Cal', interests: ['gardening'], availability: ['mon-morning'], maxSeniors: 1 }), // full
  ];
  const matches = [
    { active: true, volunteerId: 'b' },
    { active: true, volunteerId: 'd' },
    { active: false, volunteerId: 'a' }, // ended matches don't count toward load
  ];
  const { eligible, ineligible } = rankVolunteers(senior, volunteers, matches);
  assert.deepEqual(eligible.map((r) => r.volunteer.name), ['Amy', 'Bea', 'Zed']);
  assert.deepEqual(ineligible.map((r) => r.volunteer.name), ['Cal']);
});

test('seed data: Sam is the best match for Eugene; Ethan (full) and Linda (no overlap) are excluded', () => {
  const db = buildSeedData(new Date('2026-11-02T12:00:00'));
  const eugene = db.seniors.find((s) => s.id === 's-eugene');
  const { eligible, ineligible } = rankVolunteers(eugene, db.volunteers, db.matches);
  assert.equal(eligible[0].volunteer.id, 'v-sam');
  assert.equal(eligible[0].score, 21 + L); // 21 before v2, plus the shared language
  assert.deepEqual(ineligible.map((r) => r.volunteer.id).sort(), ['v-ethan', 'v-linda']);
});

// ----- [v2] languages and approval -----

const speaks = (...pairs) => pairs.map(([code, level]) => ({ code, level }));
const rosa = { ...senior, id: 's-r', name: 'Rosa Alvarez', languages: speaks(['es', 'fluent'], ['en', 'learning']) };

test('a shared language is +4, and the breakdown names it with both levels', () => {
  const linda = vol({ name: 'Linda Park', availability: ['mon-morning'], languages: speaks(['en', 'native'], ['es', 'conversational']) });
  const r = scorePair(rosa, linda, 1);
  assert.equal(r.eligible, true);
  assert.deepEqual(r.sharedLanguage, { code: 'es', seniorLevel: 'fluent', volunteerLevel: 'conversational' });
  const row = r.breakdown.find((b) => b.kind === 'language');
  assert.equal(row.label, 'Shared language: Spanish (Rosa fluent, Linda conversational)');
  assert.equal(row.points, WEIGHTS.sharedLanguage);
  assert.equal(r.score, WEIGHTS.perSharedSlot + WEIGHTS.sharedLanguage);
  assert.equal(r.usesTranslateHelp, false);
});

test('"learning" is not enough to share a language; no shared language means not eligible', () => {
  // Rosa is only learning English, so an English-only volunteer doesn't share a language with her.
  const sam = vol({ name: 'Sam Rivera', availability: ['mon-morning'], languages: speaks(['en', 'native']) });
  const r = scorePair(rosa, sam, 0);
  assert.equal(r.eligible, false);
  assert.deepEqual(r.problems, ['No shared language']);
  assert.equal(r.sharedLanguage, null);
  // Both sides must be at least conversational.
  const learner = vol({ availability: ['mon-morning'], languages: speaks(['en', 'native'], ['es', 'learning']) });
  assert.deepEqual(scorePair(rosa, learner, 0).problems, ['No shared language']);
});

test('no shared language is fine when BOTH use translate help: eligible, 0 language points, and labeled', () => {
  const samira = { ...senior, name: 'Samira Haddad', languages: speaks(['ar', 'native'], ['en', 'learning']), translateHelp: true };
  const jordan = vol({ name: 'Jordan Lee', availability: ['mon-morning'], languages: speaks(['en', 'native']), translateHelp: true });
  const r = scorePair(samira, jordan, 1);
  assert.equal(r.eligible, true);
  assert.equal(r.usesTranslateHelp, true);
  assert.equal(r.sharedLanguage, null);
  const row = r.breakdown.find((b) => b.kind === 'translateHelp');
  assert.equal(row.label, 'No shared language: both use translate help');
  assert.equal(row.points, 0);
  assert.equal(r.score, WEIGHTS.perSharedSlot);
  // Only one of them opted in: still not eligible.
  assert.deepEqual(scorePair(samira, { ...jordan, translateHelp: false }, 1).problems, ['No shared language']);
  assert.deepEqual(scorePair({ ...samira, translateHelp: false }, jordan, 1).problems, ['No shared language']);
});

test('a shared language always beats translate help when both are possible', () => {
  const both = vol({ availability: ['mon-morning'], languages: speaks(['es', 'native']), translateHelp: true });
  const r = scorePair({ ...rosa, translateHelp: true }, both, 1);
  assert.equal(r.usesTranslateHelp, false);
  assert.equal(r.sharedLanguage.code, 'es');
});

test('the best shared language is named when they share more than one, and it counts once', () => {
  const v = vol({ name: 'Ana Ruiz', availability: ['mon-morning'], languages: speaks(['en', 'conversational'], ['es', 'native']) });
  const s = { ...senior, name: 'Luis Gomez', languages: speaks(['en', 'fluent'], ['es', 'native']) };
  const r = scorePair(s, v, 1);
  assert.equal(r.sharedLanguage.code, 'es');
  assert.equal(r.breakdown.filter((b) => b.kind === 'language').length, 1);
  assert.equal(r.score, WEIGHTS.perSharedSlot + WEIGHTS.sharedLanguage);
});

test('a pending volunteer is not eligible: "Waiting for coordinator approval"', () => {
  const r = scorePair(senior, vol({ availability: ['mon-morning'], status: 'pending' }), 0);
  assert.equal(r.eligible, false);
  assert.deepEqual(r.problems, ['Waiting for coordinator approval']);
  assert.equal(scorePair(senior, vol({ availability: ['mon-morning'], status: 'active' }), 0).eligible, true);
  assert.equal(scorePair(senior, vol({ availability: ['mon-morning'] }), 0).eligible, true, 'no status = active');
});

test('seed story with languages: Eugene still has eligible volunteers, all sharing a language', () => {
  const db = buildSeedData(new Date('2026-11-02T12:00:00'));
  const eugene = db.seniors.find((s) => s.id === 's-eugene');
  const { eligible } = rankVolunteers(eugene, db.volunteers, db.matches);
  assert.ok(eligible.length >= 1);
  for (const r of eligible) assert.ok(r.sharedLanguage || r.usesTranslateHelp, r.volunteer.id);
});
