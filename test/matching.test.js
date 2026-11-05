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

test('score = 3 per shared interest + 2 per shared slot + 1 new-volunteer bonus', () => {
  const r = scorePair(senior, vol({ interests: ['gardening', 'music'], availability: ['mon-morning'] }), 0);
  assert.equal(r.eligible, true);
  assert.equal(r.score, 2 * WEIGHTS.perSharedInterest + 1 * WEIGHTS.perSharedSlot + WEIGHTS.newVolunteerBonus);
  assert.deepEqual(r.sharedInterests, ['gardening', 'music']);
});

test('no new-volunteer bonus once the volunteer has a senior', () => {
  const r = scorePair(senior, vol({ interests: ['gardening'], availability: ['mon-morning'] }), 1);
  assert.equal(r.score, 3 + 2);
});

test('shared slots are capped so availability cannot swamp interests', () => {
  const big = { ...senior, availability: ['mon-morning', 'mon-afternoon', 'tue-morning', 'tue-afternoon', 'wed-morning', 'wed-afternoon', 'thu-morning'] };
  const r = scorePair(big, vol({ availability: big.availability }), 1);
  assert.equal(r.sharedSlots.length, 7);
  assert.equal(r.score, WEIGHTS.maxCountedSlots * WEIGHTS.perSharedSlot);
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
  const { eligible, ineligible } = rankVolunteers(eugene, db.volunteers.filter((v) => v.status === 'active'), db.matches); // [v2 accounts] only approved volunteers are ranked
  assert.equal(eligible[0].volunteer.id, 'v-sam');
  assert.equal(eligible[0].score, 21);
  // [v2 accounts] The new volunteers are all at capacity; of the story's four, Ethan and Linda are out.
  assert.deepEqual(ineligible.map((r) => r.volunteer.id).filter((id) => ['v-maya', 'v-ethan', 'v-linda', 'v-sam'].includes(id)).sort(), ['v-ethan', 'v-linda']);
});
