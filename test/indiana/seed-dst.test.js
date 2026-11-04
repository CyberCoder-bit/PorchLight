// The seeded demo story must read the same whenever "Reset demo data" is
// pressed, including late at night on the days around a daylight-saving
// change. (Before the calendar-day fix in src/seed.js, a reset between 11 PM
// and midnight from Nov 1 to Nov 12, 2026 showed Hal at 11 days and could show
// Rosa as "Connected" instead of "Check in soon".)
// Does not set process.env.TZ: run under TZ=UTC and TZ=America/Los_Angeles too.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BaseStore } from '../../src/store-core.js';
import { dashboardSummary, weeklyCounts } from '../../src/risk.js';
import { fromLocal, localDateKey, formatLocal } from '../../src/tz.js';

function storyAt(now) {
  const store = new BaseStore({ read: () => null, write: () => {} });
  store.reset(now);
  const rows = dashboardSummary(store, now);
  const by = Object.fromEntries(rows.map((r) => [r.senior.id, r]));
  return {
    order: rows.map((r) => r.status).join(','),
    hal: [by['s-harold'].status, by['s-harold'].trend.dropping, by['s-harold'].daysSince],
    rosa: [by['s-rosa'].status, by['s-rosa'].daysSince],
    eugene: by['s-eugene'].status,
    dorothy: by['s-dorothy'].status,
  };
}

const EXPECTED = {
  order: 'at_risk,needs_match,due_soon,ok',
  hal: ['at_risk', true, 12],
  rosa: ['due_soon', 5],
  eugene: 'needs_match',
  dorothy: 'ok',
};

test('the demo story holds at the times that used to break (11:30 PM tonight, 12:30 AM after spring forward)', () => {
  for (const now of [
    new Date('2026-11-03T04:30:00Z'), // Mon Nov 2, 2026, 11:30 PM in Carmel
    new Date('2026-11-04T04:00:00Z'), // Tue Nov 3, 2026, 11:00 PM in Carmel
    new Date('2026-03-09T04:30:00Z'), // Mon Mar 9, 2026, 12:30 AM in Carmel
  ]) {
    assert.deepEqual(storyAt(now), EXPECTED, now.toISOString());
  }
});

test('the demo story holds late at night, after midnight, and at noon for two weeks after each 2026 DST change', () => {
  for (const [month, day] of [[3, 8], [11, 1]]) {
    for (let d = 0; d < 14; d++) {
      for (const hour of [0, 12, 23]) {
        const now = fromLocal(2026, month, day + d, hour, 30);
        assert.deepEqual(storyAt(now), EXPECTED, `${formatLocal(now)} (${now.toISOString()})`);
      }
    }
  }
});

test('weekly chart buckets start and end on local midnights, a week apart on the calendar', () => {
  const now = fromLocal(2026, 3, 12, 9); // the week after spring forward
  const weeks = weeklyCounts([], now, 8);
  assert.equal(weeks.length, 8);
  assert.equal(localDateKey(weeks[7].end), '2026-03-12');
  assert.equal(localDateKey(weeks[7].start), '2026-03-06');
  assert.equal(localDateKey(weeks[6].end), '2026-03-05');
  for (const w of weeks) {
    assert.equal(formatLocal(w.start, { hour: 'numeric', hourCycle: 'h23' }), '00');
    assert.equal(formatLocal(w.end, { hour: 'numeric', hourCycle: 'h23' }), '00');
  }
});
