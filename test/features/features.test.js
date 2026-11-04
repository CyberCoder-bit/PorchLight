// End-to-end tests for the day-to-day features: the "Needs attention" queue,
// the re-match flow, a volunteer's "My week", the weekly family summary, and
// the calendar file. Same harness as test/app.test.js: the real app on a
// temporary data file, served by the Node server on a random port.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../../src/store.js';
import { createApp } from '../../src/app.js';
import { createNodeServer } from '../../src/node-server.js';
import { createSparkService } from '../../src/sparks/index.js';
import { buildConfig, ROOT_DIR } from '../../src/config.js';
import { localParts, fromLocal } from '../../src/tz.js';
import { toDateInput, escapeHtml } from '../../src/views/html.js';

process.env.TZ = 'America/Indiana/Indianapolis'; // test dates use the app's Carmel clock (src/tz.js)

let server;
let base;
let store;
let tmpDir;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-features-'));
  store = new Store(path.join(tmpDir, 'db.json'));
  store.open();
  const sparks = createSparkService(buildConfig({}), { effective: 'mock', reason: 'test', warning: null });
  server = createNodeServer({ handle: createApp({ store, sparks }), publicDir: path.join(ROOT_DIR, 'public') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Every test starts from the seeded demo story.
beforeEach(() => store.reset(new Date()));

const get = (p) => fetch(base + p);
const page = async (p) => {
  const res = await get(p);
  assert.equal(res.status, 200, p);
  const body = await res.text();
  assert.equal((body.match(/<h1[\s>]/g) || []).length, 1, `${p} has exactly one h1`);
  return body;
};
const encode = (data) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  return params.toString();
};
const post = (p, data = {}) =>
  fetch(base + p, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: encode(data),
  });
// The moment `offset` days from today at hour:minute on the Carmel clock (DST-safe).
const localAt = (offset, hour, minute = 0) => {
  const p = localParts(new Date());
  return fromLocal(p.year, p.month, p.day + offset, hour, minute);
};
// YYYY-MM-DD for `offset` days from today, on the Carmel calendar.
const localDay = (offset) => toDateInput(localAt(offset, 12));
// The ids of the queue cards, in order.
const queueOrder = (html) => [...html.matchAll(/<li class="card dash-card dash-\w+" id="senior-([\w-]+)"/g)].map((m) => m[1]);
// One queue card's HTML, from its <li> to the end of its actions.
const card = (html, seniorId) => {
  const id = html.indexOf(`id="senior-${seniorId}"`);
  assert.ok(id > 0, `card for ${seniorId}`);
  const start = html.lastIndexOf('<li', id);
  return html.slice(start, html.indexOf('</p>\n    </li>', id));
};

// ---------- Needs attention ----------

test('queue lists Hal then Eugene for the seed, with reasons and one next step each', async () => {
  const html = await page('/attention');
  assert.match(html, /<title>Needs attention · PorchLight<\/title>/);
  assert.deepEqual(queueOrder(html), ['s-harold', 's-eugene']);
  assert.match(html, /Most urgent first:<\/strong> Isolation risk, then Needs a companion/);

  const hal = card(html, 's-harold');
  assert.match(hal, /Isolation risk/);
  assert.match(hal, /Contact dropping/);
  assert.match(hal, /No completed call or visit in 12 days; only 3 check-ins in the last 4 weeks, down from 8 the 4 weeks before; 1 missed call in the last 2 weeks\./);
  // The seed's visit yesterday was never marked: first find out whether it happened.
  assert.match(hal, /Suggested next step: Ask Ethan about the last visit/);
  assert.match(hal, /Ethan had an in-person visit with Hal yesterday at 3:30\sPM, and nobody has marked it yet\./);
  assert.match(hal, /<a class="button" href="\/volunteers\/v-ethan\/week">Open Ethan&#39;s week<\/a>/);
  assert.match(hal, /href="\/contacts\?seniorId=s-harold"/, 'scheduling is still offered');
  assert.match(hal, /href="\/attention\/s-harold\/rematch"/);
  assert.equal((hal.match(/Suggested next step/g) || []).length, 1);

  const gene = card(html, 's-eugene');
  assert.match(gene, /Waiting for a first companion; joined 3 days ago\./);
  assert.match(gene, /Suggested next step: Find a first companion/);
  assert.match(gene, /<a class="button" href="\/match\?seniorId=s-eugene">/);

  // Dorothy (Connected) and Rosa (Check in soon) are not queue cards.
  assert.doesNotMatch(html, /id="senior-s-dorothy"/);
  assert.doesNotMatch(html, /id="senior-s-rosa"/);
  assert.match(html, /Not on the list yet, but due soon[\s\S]*Rosa Delgado/);
});

test('once Hal\'s unmarked visit is logged, the next step is to schedule another', async () => {
  const visit = store.contacts.find((c) => c.seniorId === 's-harold' && c.status === 'scheduled');
  const res = await post(`/contacts/${visit.id}/complete`, { back: '/volunteers/v-ethan/week' });
  assert.equal(res.status, 303);
  const hal = card(await page('/attention'), 's-harold');
  assert.match(hal, /Contact dropping/, 'still on the list: 4 check-ins in 4 weeks, down from 8');
  assert.match(hal, /Suggested next step: Schedule a visit/);
  assert.match(hal, /<a class="button" href="\/contacts\?seniorId=s-harold">/);
});

test('missed-call reasons show their labels (and notes) in the queue', async () => {
  const missed = store.contacts.find((c) => c.seniorId === 's-harold' && c.status === 'missed');
  missed.missedReason = 'volunteer_conflict';
  missed.missedNote = 'Practice ran late';
  store.save();
  const hal = card(await page('/attention'), 's-harold');
  assert.match(hal, /Reason: Volunteer had a conflict\./);
  assert.match(hal, /Practice ran late/);

  // Two cancellations by the same companion in two weeks -> suggest a re-match.
  store.contacts.push({ ...missed, id: 'c-test-missed-2', scheduledFor: new Date(Date.now() - 2 * 86400000).toISOString() });
  store.save();
  const again = card(await page('/attention'), 's-harold');
  assert.match(again, /Suggested next step: Find a new companion/);
  assert.match(again, /Ethan has had to cancel 2 times/);
  assert.match(again, /<a class="button" href="\/attention\/s-harold\/rematch">/);
});

test('a senior who missed the call points to the family, then to local help after a long silence', async () => {
  const missed = store.contacts.find((c) => c.seniorId === 's-harold' && c.status === 'missed');
  missed.missedReason = 'no_answer';
  store.save();
  let hal = card(await page('/attention'), 's-harold');
  assert.match(hal, /Suggested next step: Let the family know/);
  assert.match(hal, /Ask Mike Whitaker to check in/);
  assert.match(hal, /<a class="button" href="\/seniors\/s-harold\/summary">/);

  // 14+ days without contact (2x the 7-day setting) and no answer -> local help.
  store.settings.riskThresholdDays = 6;
  store.save();
  hal = card(await page('/attention'), 's-harold');
  assert.match(hal, /Suggested next step: Get local help/);
  // The community's own Area Agency on Aging comes first (CICOA for Carmel).
  assert.match(hal, /CICOA Aging &amp; In-Home Solutions/);
  assert.match(hal, /If someone may be in danger, call 911\./);
  assert.match(hal, /<a class="button" href="\/help">/);
});

test('empty queue says everyone has had a recent check-in', async () => {
  store.data.seniors = store.seniors.filter((s) => s.id === 's-dorothy');
  store.save();
  const html = await page('/attention');
  assert.deepEqual(queueOrder(html), []);
  assert.match(html, /Everyone has had a recent check-in\./);
});

test('re-match flow for Hal: confirm, end the match (history kept), choose again, log a call', async () => {
  const historyBefore = store.contactsForSenior('s-harold').length;

  const confirm = await page('/attention/s-harold/rematch');
  assert.match(confirm, /Find a new companion for Harold Whitaker\?/);
  assert.match(confirm, /Current companion: Ethan Brooks/);
  assert.match(confirm, /Nothing is deleted\./);
  assert.match(confirm, /<form method="post" action="\/matches\/m-harold-ethan\/end"/);
  assert.match(confirm, /href="\/attention">Keep Ethan/);

  let res = await post('/matches/m-harold-ethan/end');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/match?seniorId=s-harold&msg=match_ended');
  const matchPage = await page(res.headers.get('location'));
  assert.match(matchPage, /Match ended\. You can now choose a new companion\./);
  assert.match(matchPage, /Find a companion for Harold Whitaker/);

  const ended = store.matches.find((m) => m.id === 'm-harold-ethan');
  assert.equal(ended.active, false);
  assert.ok(ended.endedAt);
  assert.equal(store.contactsForSenior('s-harold').length, historyBefore, 'history is kept');

  // The queue now says Hal needs a NEW companion.
  let hal = card(await page('/attention'), 's-harold');
  assert.match(hal, /Needs a companion/);
  assert.match(hal, /No companion right now; last check-in was 12 days ago/);
  assert.match(hal, /Suggested next step: Find a new companion/);
  assert.match(hal, /<a class="button" href="\/match\?seniorId=s-harold">/);
  // The confirm page no longer offers to end anything.
  assert.match(await page('/attention/s-harold/rematch'), /Harold Whitaker has no companion right now/);

  // Ethan is the only volunteer who offers visits in Hal's free time.
  res = await post('/matches', { seniorId: 's-harold', volunteerId: 'v-ethan' });
  assert.equal(res.status, 303);
  const match = store.activeMatchForSenior('s-harold');
  res = await post('/contacts', { matchId: match.id, action: 'log', type: 'visit', date: localDay(-1), time: '14:00', durationMinutes: '45' });
  assert.equal(res.status, 303);

  // Status improves: no longer "Isolation risk" or "Needs a companion".
  hal = card(await page('/attention'), 's-harold');
  assert.match(hal, /dash-ok/);
  assert.match(hal, /Connected/);
  assert.doesNotMatch(hal, /Isolation risk/);
  assert.match(hal, /Last check-in was yesterday/);
});

test('attention pages escape names and return 404 for unknown seniors', async () => {
  const res = await post('/seniors', {
    name: '<script>alert(1)</script>',
    interests: 'gardening',
    availability: 'sat-morning',
    contactMethod: 'phone',
  });
  assert.equal(res.status, 303);
  const id = res.headers.get('location').split('/')[2].split('?')[0];
  for (const p of ['/attention', `/attention/${id}/rematch`]) {
    const html = await page(p);
    assert.doesNotMatch(html, /<script>alert/, p);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, p);
  }
  assert.equal((await get('/attention/nobody/rematch')).status, 404);
});

// ---------- My week ----------

const addCall = (fields) => {
  const call = {
    id: `c-test-${Math.random().toString(36).slice(2, 8)}`,
    seniorId: 's-dorothy',
    volunteerId: 'v-maya',
    type: 'phone',
    status: 'scheduled',
    completedAt: null,
    durationMinutes: null,
    notes: '',
    createdAt: new Date().toISOString(),
    ...fields,
  };
  store.contacts.push(call);
  store.save();
  return call;
};
const dorothyCall = () => store.contacts.find((c) => c.seniorId === 's-dorothy' && c.status === 'scheduled');

test('My week shows the next 7 days in Carmel time, with saved sparks inline and no AI call on load', async () => {
  addCall({ scheduledFor: localAt(10, 15).toISOString() }); // outside the 7-day window
  let html = await page('/volunteers/v-maya/week');
  assert.match(html, /<title>My week: Maya Patel · PorchLight<\/title>/);
  assert.match(html, /<a href="\/volunteers" aria-current="page">/);
  assert.match(html, /Times are Carmel, Indiana time \((EST|EDT)\)\./);
  const call = dorothyCall();
  assert.match(html, new RegExp(`id="call-${call.id}"`));
  assert.match(html, /<strong>4:00 PM<\/strong>: Phone call with <a href="\/seniors\/s-dorothy">Dorothy Jensen<\/a>/);
  assert.match(html, /1 more call is scheduled after this week/);
  assert.doesNotMatch(html, /Did these calls happen\?/);

  // No saved sparks yet: offer the existing sparks form, and don't make any.
  assert.match(html, /<form method="post" action="\/seniors\/s-dorothy\/sparks"/);
  assert.match(html, /Get conversation sparks for Dorothy/);
  assert.equal(store.sparkSets.length, 0, 'loading My week never generates sparks');

  // Dorothy's call is in 2 days: it can't be logged or marked missed yet, and the page says when it can.
  assert.doesNotMatch(html, new RegExp(`action="/contacts/${call.id}/(complete|missed)"`));
  assert.match(html, /You can log this call on \w+day, \w+ \d+, once it has happened\./);

  // A call from earlier today that nobody marked: one click to log it, back to this page.
  const due = addCall({ scheduledFor: new Date(Date.now() - 2 * 3600000).toISOString() });
  html = await page('/volunteers/v-maya/week');
  assert.match(html, new RegExp(`<form method="post" action="/contacts/${due.id}/complete" class="inline-form">\\s*<input type="hidden" name="back" value="/volunteers/v-maya/week">`));
  assert.match(html, /Log this call<span class="visually-hidden"> with Dorothy on/);
  // Mark missed: labeled reason select and note.
  assert.match(html, new RegExp(`<label for="reason-${due.id}">Why was it missed\\?</label>`));
  assert.match(html, /<option value="volunteer_conflict">Volunteer had a conflict<\/option>/);
  assert.match(html, new RegExp(`<label for="note-${due.id}">Short note \\(optional\\)</label>`));
  assert.match(html, /name="reasonNote" maxlength="200"/);

  // After sparks are saved, they show inline with their source.
  const res = await post('/seniors/s-dorothy/sparks', { variant: '0' });
  assert.equal(res.status, 303);
  const saved = store.latestSparkSet('s-dorothy');
  html = await page('/volunteers/v-maya/week');
  assert.ok(html.includes(escapeHtml(saved.sparks[0].text)));
  assert.match(html, /Suggestions only\. From the built-in ideas \(offline mode\)/);
  assert.doesNotMatch(html, /MOCK mode/, 'no developer jargon on a volunteer\'s screen');
  assert.doesNotMatch(html, /Get conversation sparks for Dorothy/);
  assert.equal(store.sparkSets.length, 1);
});

test('My week: log and missed actions redirect back to the week', async () => {
  const overdue = addCall({ scheduledFor: new Date(Date.now() - 3 * 3600000).toISOString() });
  let html = await page('/volunteers/v-maya/week');
  const panel = html.slice(html.indexOf('Did these calls happen?'), html.indexOf('id="week-heading"'));
  assert.match(panel, new RegExp(`id="call-${overdue.id}"`));
  assert.doesNotMatch(panel, /\/sparks"/, 'no spark form for past calls');

  let res = await post(`/contacts/${overdue.id}/complete`, { back: '/volunteers/v-maya/week' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/volunteers/v-maya/week?msg=completed');
  html = await page(res.headers.get('location'));
  assert.match(html, /Marked as completed\./);
  assert.doesNotMatch(html, /Did these calls happen\?/);
  assert.equal(store.contacts.find((c) => c.id === overdue.id).status, 'completed');

  // A call that hasn't happened yet can't be marked missed (B-09).
  res = await post(`/contacts/${dorothyCall().id}/missed`, { reason: 'senior_unavailable', back: '/volunteers/v-maya/week' });
  assert.equal(res.status, 409);

  const call = addCall({ scheduledFor: new Date(Date.now() - 2 * 3600000).toISOString() });
  res = await post(`/contacts/${call.id}/missed`, { reason: 'senior_unavailable', reasonNote: 'At the doctor', back: '/volunteers/v-maya/week' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/volunteers/v-maya/week?msg=missed');
  assert.match(await page(res.headers.get('location')), /Marked as missed\./);
  const saved = store.contacts.find((c) => c.id === call.id);
  assert.equal(saved.missedReason, 'senior_unavailable');
  assert.equal(saved.missedNote, 'At the doctor');

  // The reason now shows in the coordinator queue, with a family next step.
  const dorothy = card(await page('/attention'), 's-dorothy');
  assert.match(dorothy, /Reason: Senior was unavailable\./);
  assert.match(dorothy, /Suggested next step: Let the family know/);

  // Too-long notes are rejected by the existing handler.
  const another = addCall({ scheduledFor: new Date(Date.now() + 86400000).toISOString() });
  res = await post(`/contacts/${another.id}/missed`, { reason: 'other', reasonNote: 'x'.repeat(201), back: '/volunteers/v-maya/week' });
  assert.equal(res.status, 400);
});

test('My week empty states, and 404 for an unknown volunteer', async () => {
  const ethan = await page('/volunteers/v-ethan/week');
  assert.match(ethan, /Nothing scheduled in the next 7 days\./);
  assert.match(ethan, /<a class="button" href="\/contacts\?matchId=m-harold-ethan">Schedule a visit with Hal<\/a>/);

  const sam = await page('/volunteers/v-sam/week');
  assert.match(sam, /Nothing scheduled in the next 7 days\./);
  assert.match(sam, /<a class="button" href="\/match">/);

  assert.equal((await get('/volunteers/nobody/week')).status, 404);
});

// ---------- Weekly family summary ----------

const textareaText = (html) => {
  const m = html.match(/<textarea id="summary-text"[^>]*readonly[^>]*>([\s\S]*?)<\/textarea>/);
  assert.ok(m, 'read-only summary textarea');
  return m[1];
};

test('weekly family summary: counts, status in words, missed reasons, and no notes', async () => {
  const missed = store.contacts.find((c) => c.seniorId === 's-harold' && c.status === 'missed');
  missed.missedReason = 'volunteer_conflict';
  missed.missedNote = 'Practice ran late';
  store.save();

  const html = await page('/seniors/s-harold/summary');
  assert.match(html, /<title>Weekly summary: Harold Whitaker · PorchLight<\/title>/);
  assert.match(html, /← Back to Harold Whitaker/);
  assert.match(html, /Hal has had no completed call or visit in 12 days\./);
  assert.match(html, /Check-ins in the last 7 days<\/dt><dd>0<\/dd>/);
  assert.match(html, /Check-ins in the last 4 weeks<\/dt><dd>3 /);
  assert.match(html, /Missed calls in the last 4 weeks \(1\)/);
  assert.match(html, /Reason: Volunteer had a conflict\./);
  assert.match(html, /<label for="summary-text">Message to copy<\/label>/);

  const text = textareaText(html);
  assert.match(text, /^PorchLight weekly update: Hal \(Harold Whitaker\)\n/);
  assert.match(text, /\nStatus: Isolation risk, Contact dropping\n/);
  assert.match(text, /\nCheck-ins in the last 7 days: 0\n/);
  assert.match(text, /\nCheck-ins in the last 4 weeks: 3\n/);
  assert.match(text, /\nLast contact: \w+day, \w+ \d+ \(12 days ago\), in-person visit\n/);
  assert.match(text, /\nNext call or visit: none scheduled yet\n/);
  assert.match(text, /\n- \w+day, \w+ \d+: in-person visit \(reason: volunteer had a conflict\)\n/);

  // Counts and dates only: no call notes, no missed-call notes, no family contacts.
  for (const secret of ['Practice ran late', 'Ethan had to cancel', 'store ledger', 'gin rummy', 'Mike Whitaker', 'Phoenix']) {
    assert.ok(!html.includes(secret), `summary leaks "${secret}"`);
  }
});

test('family summary shows the next scheduled call and works for an unmatched senior', async () => {
  const dorothy = await page('/seniors/s-dorothy/summary');
  const text = textareaText(dorothy);
  assert.match(text, /\nCheck-ins in the last 7 days: 2\n/);
  assert.match(text, /\nCheck-ins in the last 4 weeks: 8\n/);
  assert.match(text, /\nLast contact: \w+day, \w+ \d+ \(2 days ago\), phone call\n/);
  assert.match(text, /\nNext call or visit: \w+day, \w+ \d+ at 4:00\sPM \(phone call\)\n/);
  assert.match(text, /\nMissed calls in the last 4 weeks: 0\n/);
  assert.ok(!dorothy.includes('choir concert'), 'no notes on the scheduled call');

  const gene = textareaText(await page('/seniors/s-eugene/summary'));
  assert.match(gene, /\nStatus: Needs a companion\n/);
  assert.match(gene, /\nCompanion: not matched yet\n/);

  assert.equal((await get('/seniors/nobody/summary')).status, 404);
});

// ---------- Add to calendar (.ics) ----------

// The next Month 15 that is still ahead on the Carmel calendar, as YYYY-MM-DD.
const nextFifteenth = (month) => {
  const p = localParts(new Date());
  const year = p.month < month || (p.month === month && p.day < 15) ? p.year : p.year + 1;
  return `${year}-${String(month).padStart(2, '0')}-15`;
};
const scheduleDorothy = async (date, time = '16:00') => {
  const res = await post('/contacts', { matchId: 'm-dorothy-maya', action: 'schedule', type: 'phone', date, time, notes: 'Secret note, do not share' });
  assert.equal(res.status, 303);
  return store.contacts.filter((c) => c.seniorId === 's-dorothy' && c.status === 'scheduled').at(-1);
};

test('calendar file: a 4:00 PM Carmel call is 21:00Z in January and 20:00Z in July', async () => {
  for (const [month, utcHour] of [[1, '21'], [7, '20']]) {
    const date = nextFifteenth(month);
    const call = await scheduleDorothy(date);
    const res = await get(`/contacts/${call.id}/calendar.ics`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/calendar; charset=utf-8');
    assert.equal(res.headers.get('content-disposition'), `attachment; filename="porchlight-call-dorothy-${date}.ics"`);
    const body = await res.text();
    const ymd = date.replaceAll('-', '');
    assert.match(body, new RegExp(`\\r\\nDTSTART:${ymd}T${utcHour}0000Z\\r\\n`), date);
    assert.match(body, new RegExp(`\\r\\nDTEND:${ymd}T${utcHour}3000Z\\r\\n`), date);
    assert.match(body, /\r\nSUMMARY:PorchLight call with Dorothy\r\n/);
    assert.match(body, new RegExp(`\\r\\nUID:${call.id}@porchlight\\r\\n`));
    assert.match(body, /\r\nDTSTAMP:\d{8}T\d{6}Z\r\n/);
    assert.doesNotMatch(body, /[^\r]\n/, 'CRLF line endings');
    for (const secret of ['Secret note', 'Karen', 'Chicago']) assert.ok(!body.includes(secret), secret);
  }
});

test('calendar file: 404 for an unknown call, 409 for one already marked', async () => {
  assert.equal((await get('/contacts/nobody/calendar.ics')).status, 404);
  const done = store.contacts.find((c) => c.status === 'completed');
  assert.equal((await get(`/contacts/${done.id}/calendar.ics`)).status, 409);
});

// ---------- Escaping across every feature page ----------

test('a senior named <script> is escaped on every feature page', async () => {
  const name = '<script>alert(1)</script>';
  let res = await post('/seniors', { name, interests: 'gardening', availability: 'sat-morning', contactMethod: 'phone' });
  assert.equal(res.status, 303);
  const id = res.headers.get('location').split('/')[2].split('?')[0];
  res = await post('/matches', { seniorId: id, volunteerId: 'v-maya' });
  assert.equal(res.status, 303);
  const match = store.activeMatchForSenior(id);
  res = await post('/contacts', { matchId: match.id, action: 'schedule', type: 'phone', date: localDay(1), time: '10:00' });
  assert.equal(res.status, 303);
  const call = store.contacts.find((c) => c.seniorId === id && c.status === 'scheduled');
  // Make sure the senior is on the queue (a missed call) and has saved sparks.
  addCall({ seniorId: id, status: 'missed', missedReason: 'other', missedNote: '<img src=x onerror=alert(2)>', scheduledFor: localAt(-1, 10).toISOString() });
  await post(`/seniors/${id}/sparks`, { variant: '0' });

  for (const p of ['/attention', `/attention/${id}/rematch`, '/volunteers/v-maya/week', `/seniors/${id}/summary`]) {
    const html = await page(p);
    assert.doesNotMatch(html, /<script>alert/, p);
    assert.doesNotMatch(html, /<img src=x/, p);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, p);
  }
  const ics = await (await get(`/contacts/${call.id}/calendar.ics`)).text();
  assert.match(ics, /\r\nSUMMARY:PorchLight call with <script>alert\(1\)<\/script>\r\n/, 'plain text in .ics (not HTML)');
});
