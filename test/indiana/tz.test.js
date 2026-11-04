// Time-zone tests for both Indiana zones. Deliberately does NOT set
// process.env.TZ: these must pass whatever the machine's zone is, so run them
// with `TZ=UTC npm test` and `TZ=America/Los_Angeles npm test` too.
//
// DST behavior under test (see the top of src/tz.js):
//   - Spring forward, Sunday March 8, 2026: 2:00-2:59 AM does not exist.
//     parseLocalDateTime() returns null; fromLocal() moves the time forward
//     by the gap (2:30 AM -> 3:30 AM daylight time).
//   - Fall back, Sunday November 1, 2026: 1:00-1:59 AM happens twice.
//     Both functions pick the first one (daylight time, the earlier instant).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as tz from '../../src/tz.js';
import { createClock } from '../../src/tz.js';
import { COMMUNITY, COMMUNITIES, INDIANA_CENTRAL_TIME, INDIANA_EASTERN_TIME } from '../../src/community.js';

const eastern = createClock(INDIANA_EASTERN_TIME);
const central = createClock(INDIANA_CENTRAL_TIME);
const iso = (d) => d.toISOString();

test('the plain tz.js exports are the clock for COMMUNITY (Carmel, Eastern time)', () => {
  assert.equal(tz.TIME_ZONE, COMMUNITY.timeZone);
  assert.equal(tz.TIME_ZONE, 'America/Indiana/Indianapolis');
  const when = new Date('2026-07-15T20:00:00Z');
  assert.deepEqual(tz.localParts(when), eastern.localParts(when));
  assert.equal(iso(tz.parseLocalDateTime('2026-01-15', '16:00')), '2026-01-15T21:00:00.000Z');
  assert.equal(tz.formatLocal(when, { hour: 'numeric', minute: '2-digit' }), '4:00 PM');
});

test('createClock returns the documented functions and reuses one clock per zone', () => {
  for (const key of ['localParts', 'fromLocal', 'parseLocalDateTime', 'formatLocal', 'localDateKey', 'startOfLocalDay']) {
    assert.equal(typeof central[key], 'function', key);
  }
  assert.equal(central.TIME_ZONE, 'America/Chicago');
  assert.equal(createClock('America/Chicago'), central);
  assert.throws(() => createClock('America/Nowhere'), RangeError);
});

test('4:00 PM in Carmel is 21:00 UTC in January and 20:00 UTC in July', () => {
  assert.equal(iso(eastern.parseLocalDateTime('2026-01-15', '16:00')), '2026-01-15T21:00:00.000Z');
  assert.equal(iso(eastern.parseLocalDateTime('2026-07-15', '16:00')), '2026-07-15T20:00:00.000Z');
  assert.equal(eastern.formatLocal('2026-01-15T21:00:00Z', { hour: 'numeric', minute: '2-digit' }), '4:00 PM');
  assert.equal(eastern.formatLocal('2026-07-15T20:00:00Z', { hour: 'numeric', minute: '2-digit' }), '4:00 PM');
});

test('the same wall-clock time on Central time is one hour later in UTC', () => {
  for (const [date, time] of [['2026-01-15', '16:00'], ['2026-07-15', '16:00'], ['2026-11-02', '00:00'], ['2026-03-09', '09:30']]) {
    const e = eastern.parseLocalDateTime(date, time);
    const c = central.parseLocalDateTime(date, time);
    assert.equal(c - e, 60 * 60 * 1000, `${date} ${time}`);
  }
  assert.equal(iso(central.parseLocalDateTime('2026-01-15', '16:00')), '2026-01-15T22:00:00.000Z');
  assert.equal(iso(central.parseLocalDateTime('2026-07-15', '16:00')), '2026-07-15T21:00:00.000Z');
});

test('spring forward (March 8, 2026): 2:30 AM does not exist, so it is rejected', () => {
  for (const clock of [eastern, central]) {
    assert.equal(clock.parseLocalDateTime('2026-03-08', '02:00'), null, clock.TIME_ZONE);
    assert.equal(clock.parseLocalDateTime('2026-03-08', '02:30'), null, clock.TIME_ZONE);
    assert.equal(clock.parseLocalDateTime('2026-03-08', '02:59'), null, clock.TIME_ZONE);
    // The minutes on either side of the gap are real.
    assert.notEqual(clock.parseLocalDateTime('2026-03-08', '01:59'), null);
    assert.notEqual(clock.parseLocalDateTime('2026-03-08', '03:00'), null);
    // The same time a day earlier or later is fine.
    assert.notEqual(clock.parseLocalDateTime('2026-03-07', '02:30'), null);
    assert.notEqual(clock.parseLocalDateTime('2026-03-09', '02:30'), null);
  }
  // Eastern: 1:59 AM EST is 06:59Z and 3:00 AM EDT is 07:00Z, one minute apart.
  assert.equal(iso(eastern.parseLocalDateTime('2026-03-08', '01:59')), '2026-03-08T06:59:00.000Z');
  assert.equal(iso(eastern.parseLocalDateTime('2026-03-08', '03:00')), '2026-03-08T07:00:00.000Z');
  // Central: the same change happens one hour later in UTC.
  assert.equal(iso(central.parseLocalDateTime('2026-03-08', '01:59')), '2026-03-08T07:59:00.000Z');
  assert.equal(iso(central.parseLocalDateTime('2026-03-08', '03:00')), '2026-03-08T08:00:00.000Z');
});

test('spring forward: fromLocal moves a skipped time forward by the gap (2:30 AM -> 3:30 AM)', () => {
  assert.equal(iso(eastern.fromLocal(2026, 3, 8, 2, 30)), '2026-03-08T07:30:00.000Z');
  assert.deepEqual(
    (({ hour, minute }) => ({ hour, minute }))(eastern.localParts(eastern.fromLocal(2026, 3, 8, 2, 30))),
    { hour: 3, minute: 30 }
  );
  assert.equal(iso(central.fromLocal(2026, 3, 8, 2, 30)), '2026-03-08T08:30:00.000Z');
});

test('fall back (November 1, 2026): 1:30 AM happens twice; we always pick the first (daylight time)', () => {
  // Eastern: first 1:30 AM is EDT (UTC-4) = 05:30Z; the second would be EST = 06:30Z.
  assert.equal(iso(eastern.parseLocalDateTime('2026-11-01', '01:30')), '2026-11-01T05:30:00.000Z');
  assert.equal(iso(eastern.fromLocal(2026, 11, 1, 1, 30)), '2026-11-01T05:30:00.000Z');
  // Central: first 1:30 AM is CDT (UTC-5) = 06:30Z; the second would be CST = 07:30Z.
  assert.equal(iso(central.parseLocalDateTime('2026-11-01', '01:30')), '2026-11-01T06:30:00.000Z');
  assert.equal(iso(central.fromLocal(2026, 11, 1, 1, 30)), '2026-11-01T06:30:00.000Z');
  // Consistent: asking again gives the same instant, and both instants read 1:30 AM.
  for (const clock of [eastern, central]) {
    const a = clock.parseLocalDateTime('2026-11-01', '01:30');
    assert.equal(iso(a), iso(clock.parseLocalDateTime('2026-11-01', '01:30')));
    const second = new Date(a.getTime() + 60 * 60 * 1000);
    assert.equal(clock.localParts(second).hour, 1);
    assert.equal(clock.localParts(second).minute, 30);
  }
  // The hours around it are unambiguous.
  assert.equal(iso(eastern.parseLocalDateTime('2026-11-01', '00:30')), '2026-11-01T04:30:00.000Z');
  assert.equal(iso(eastern.parseLocalDateTime('2026-11-01', '02:30')), '2026-11-01T07:30:00.000Z');
});

test('midnight boundaries: the local calendar day, not the UTC day', () => {
  // Midnight starting Nov 2, 2026 (standard time) in each zone.
  assert.equal(iso(eastern.parseLocalDateTime('2026-11-02', '00:00')), '2026-11-02T05:00:00.000Z');
  assert.equal(iso(central.parseLocalDateTime('2026-11-02', '00:00')), '2026-11-02T06:00:00.000Z');
  // 11:59 PM is still the same day; one minute later is the next day.
  assert.equal(eastern.localDateKey('2026-11-02T04:59:00Z'), '2026-11-01');
  assert.equal(eastern.localDateKey('2026-11-02T05:00:00Z'), '2026-11-02');
  assert.equal(central.localDateKey('2026-11-02T05:59:00Z'), '2026-11-01');
  assert.equal(central.localDateKey('2026-11-02T06:00:00Z'), '2026-11-02');
  // An 8 PM call in July is already the next day in UTC, but not locally.
  assert.equal(eastern.localDateKey('2026-07-16T00:00:00Z'), '2026-07-15');
  // New Year's Eve at 11:30 PM rolls over to the right year.
  const nye = eastern.parseLocalDateTime('2026-12-31', '23:30');
  assert.equal(iso(nye), '2027-01-01T04:30:00.000Z');
  assert.equal(eastern.localDateKey(nye), '2026-12-31');
  assert.deepEqual(eastern.localParts(nye).year, 2026);
});

test('startOfLocalDay steps by calendar days, even across DST', () => {
  // A week after spring forward, local midnight minus 7 days is still midnight (EST then, EDT now).
  assert.equal(iso(eastern.startOfLocalDay('2026-03-10T16:00:00Z')), '2026-03-10T04:00:00.000Z');
  assert.equal(iso(eastern.startOfLocalDay('2026-03-10T16:00:00Z', -7)), '2026-03-03T05:00:00.000Z');
  assert.equal(iso(central.startOfLocalDay('2026-11-03T18:00:00Z', -7)), '2026-10-27T05:00:00.000Z');
  // Nov 1, 2026 has 25 hours in both zones.
  const day = eastern.startOfLocalDay('2026-11-01T12:00:00Z');
  const next = eastern.startOfLocalDay('2026-11-01T12:00:00Z', 1);
  assert.equal(next - day, 25 * 60 * 60 * 1000);
});

test('impossible dates are rejected; Feb 29 only in leap years', () => {
  for (const clock of [eastern, central]) {
    assert.equal(clock.parseLocalDateTime('2026-02-31', '12:00'), null);
    assert.equal(clock.parseLocalDateTime('2026-02-29', '12:00'), null);
    assert.equal(clock.parseLocalDateTime('2026-04-31', '12:00'), null);
    assert.equal(clock.parseLocalDateTime('2026-13-01', '12:00'), null);
    assert.equal(clock.parseLocalDateTime('2026-00-10', '12:00'), null);
    assert.equal(clock.parseLocalDateTime('2026-06-10', '24:00'), null);
    assert.equal(clock.parseLocalDateTime('2026-06-10', '12:60'), null);
    assert.equal(clock.parseLocalDateTime('not-a-date', '12:00'), null);
    assert.equal(clock.parseLocalDateTime(undefined, '12:00'), null);
  }
  assert.equal(iso(eastern.parseLocalDateTime('2028-02-29', '12:00')), '2028-02-29T17:00:00.000Z');
  assert.equal(iso(central.parseLocalDateTime('2028-02-29', '12:00')), '2028-02-29T18:00:00.000Z');
});

test('the Evansville sample profile is on Central time', () => {
  const clock = createClock(COMMUNITIES.evansville.timeZone);
  assert.equal(clock.TIME_ZONE, 'America/Chicago');
  assert.equal(iso(clock.parseLocalDateTime('2026-01-15', '16:00')), '2026-01-15T22:00:00.000Z');
  assert.equal(iso(clock.parseLocalDateTime('2026-07-15', '16:00')), '2026-07-15T21:00:00.000Z');
  assert.equal(clock.formatLocal('2026-01-15T22:00:00Z', { hour: 'numeric', minute: '2-digit' }), '4:00 PM');
  // 9:30 PM in Evansville is 10:30 PM in Carmel.
  assert.equal(
    eastern.formatLocal(clock.parseLocalDateTime('2026-01-15', '21:30'), { hour: 'numeric', minute: '2-digit' }),
    '10:30 PM'
  );
});
