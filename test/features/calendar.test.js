// Unit tests for the .ics builder. This file deliberately does NOT set
// process.env.TZ, so `TZ=UTC npm test` and `TZ=America/Los_Angeles npm test`
// prove the calendar times don't depend on the machine's clock.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalDateTime } from '../../src/tz.js';
import { buildCallIcs, escapeIcsText, foldLine, icsUtc } from '../../src/features/calendar.js';

const senior = {
  id: 's-test',
  name: 'Albert Smith',
  preferredName: 'Al, Jr; "Bud"',
  caregiver: { name: 'Carol Smith', relationship: 'Daughter, 317-555-0100' },
};
const volunteer = { id: 'v-test', name: 'Maya Patel' };
const call = (date, extra = {}) => ({
  id: 'c-test-1',
  seniorId: senior.id,
  volunteerId: volunteer.id,
  type: 'phone',
  status: 'scheduled',
  scheduledFor: parseLocalDateTime(date, '16:00').toISOString(),
  durationMinutes: null,
  notes: 'SECRET NOTE about the family',
  ...extra,
});
const now = new Date(Date.UTC(2026, 10, 3, 15, 4, 5));

test('UTC timestamps and text escaping follow RFC 5545', () => {
  assert.equal(icsUtc(new Date(Date.UTC(2027, 0, 15, 21, 0, 0))), '20270115T210000Z');
  assert.equal(escapeIcsText('Rosa, "Chispa"; a\\b\nnext\r\nline'), 'Rosa\\, "Chispa"\\; a\\\\b\\nnext\\nline');
});

test('long lines fold at 75 octets without breaking characters', () => {
  for (const line of ['DESCRIPTION:' + 'x'.repeat(200), 'SUMMARY:' + 'é✦'.repeat(60)]) {
    const folded = foldLine(line);
    const parts = folded.split('\r\n');
    assert.ok(parts.length > 1);
    for (const part of parts) assert.ok(new TextEncoder().encode(part).length <= 75, part);
    parts.slice(1).forEach((p) => assert.equal(p[0], ' '));
    assert.equal(folded.replace(/\r\n /g, ''), line);
  }
  assert.equal(foldLine('SHORT:line'), 'SHORT:line');
});

test('a 4:00 PM Carmel call is 21:00Z in January and 20:00Z in July', () => {
  const winter = buildCallIcs({ contact: call('2027-01-15'), senior, volunteer, now }).body;
  assert.match(winter, /\r\nDTSTART:20270115T210000Z\r\n/);
  assert.match(winter, /\r\nDTEND:20270115T213000Z\r\n/, 'default 30-minute length');

  const summer = buildCallIcs({ contact: call('2027-07-15', { durationMinutes: 45 }), senior, volunteer, now }).body;
  assert.match(summer, /\r\nDTSTART:20270715T200000Z\r\n/);
  assert.match(summer, /\r\nDTEND:20270715T204500Z\r\n/);
});

test('the calendar file is well formed, escaped, and private', () => {
  const { body, filename } = buildCallIcs({ contact: call('2027-01-15'), senior, volunteer, now });
  assert.ok(body.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(body.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n'));
  assert.doesNotMatch(body, /[^\r]\n/, 'every line ends with CRLF');
  assert.match(body, /\r\nUID:c-test-1@porchlight\r\n/);
  assert.match(body, /\r\nDTSTAMP:20261103T150405Z\r\n/);
  assert.match(body, /\r\nSUMMARY:PorchLight call with Al\\, Jr\\; "Bud"\r\n/);
  for (const secret of ['SECRET', 'Carol', '317-555-0100', 'Daughter']) assert.ok(!body.includes(secret), secret);
  assert.equal(filename, 'porchlight-call-al-jr-bud-2027-01-15.ics');

  const visit = buildCallIcs({ contact: call('2027-01-15', { type: 'visit' }), senior: { ...senior, preferredName: '' }, volunteer: null, now });
  assert.match(visit.body, /\r\nSUMMARY:PorchLight visit with Albert\r\n/);
  assert.match(visit.body, /\r\nDESCRIPTION:In-person visit with Albert\. Scheduled in PorchLight\.\r\n/);
});
