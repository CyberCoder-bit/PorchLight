// Checks for the review fixes that the other review tests don't cover
// (B-05 details, B-11 notes, B-22, B-24, B-26, B-27, B-28, and the
// fact-check items), plus unit checks for the new helpers. The app runs on a
// fixed clock (Tuesday, November 3, 2026 at noon in Carmel), so every date
// here is the same on any day and in any TZ.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../../src/store.js';
import { createApp } from '../../src/app.js';
import { createNodeServer } from '../../src/node-server.js';
import { createSparkService } from '../../src/sparks/index.js';
import { loadSdk, redactContactDetails } from '../../src/sparks/live.js';
import { buildConfig, ROOT_DIR } from '../../src/config.js';
import { fromLocal, localDateKey } from '../../src/tz.js';
import { nextSlotTime, slotForDate } from '../../src/vocab.js';
import { formatLongDate, setDisplayClock } from '../../src/views/html.js';
import { needsAttention, attentionBreakdown, dashboardSummary } from '../../src/risk.js';

const NOW = fromLocal(2026, 11, 3, 12, 0); // Tuesday, Nov 3, 2026, 12:00 PM in Carmel
const servers = [];
const tmpDirs = [];
let base;
let store;

async function startApp({ sparks }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'porchlight-fixes-'));
  tmpDirs.push(dir);
  const s = new Store(path.join(dir, 'db.json'));
  s.open(NOW);
  const server = createNodeServer({ handle: createApp({ store: s, sparks, now: () => NOW }), publicDir: path.join(ROOT_DIR, 'public') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  return { store: s, base: `http://127.0.0.1:${server.address().port}` };
}

before(async () => {
  ({ store, base } = await startApp({ sparks: createSparkService(buildConfig({}), { effective: 'mock', reason: 'test', warning: null }) }));
});

after(() => {
  for (const s of servers) s.close();
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

beforeEach(() => store.reset(NOW));

const page = async (p, b = base) => {
  const res = await fetch(b + p);
  assert.equal(res.status, 200, p);
  const body = await res.text();
  assert.equal((body.match(/<h1[\s>]/g) || []).length, 1, `${p} has exactly one h1`);
  return body;
};
const post = (p, data = {}, b = base) =>
  fetch(b + p, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data).toString(),
  });
const card = (html, seniorId) => {
  const id = html.indexOf(`id="senior-${seniorId}"`);
  assert.ok(id > 0, `card for ${seniorId}`);
  return html.slice(html.lastIndexOf('<li', id), html.indexOf('</li>', html.indexOf('Suggested next step', id)));
};
const scheduled = (seniorId) => store.contacts.find((c) => c.seniorId === seniorId && c.status === 'scheduled');

// ---------- B-03 / B-28: the tour story after a reset ----------

test('after a reset, /attention asks about Hal\'s unmarked visit, and Ethan\'s week can log it', async () => {
  const hal = card(await page('/attention'), 's-harold');
  assert.match(hal, /Suggested next step: Ask Ethan about the last visit/);
  assert.match(hal, /Ethan had an in-person visit with Hal yesterday at 3:30\sPM, and nobody has marked it yet\./);
  assert.doesNotMatch(hal, /Nothing is on the calendar/);

  const week = await page('/volunteers/v-ethan/week');
  assert.match(week, /Did these calls happen\?/);
  assert.match(week, /<strong>Monday, November 2 at 3:30\sPM<\/strong>: In-person visit with <a href="\/seniors\/s-harold">/);
  assert.match(week, /<button type="submit" class="button">Log this visit/);

  // The story on the dashboard is unchanged until someone logs it.
  const rows = dashboardSummary(store, NOW);
  assert.deepEqual(rows.map((r) => r.status), ['at_risk', 'needs_match', 'due_soon', 'ok']);
});

test('a call set for right now stays under "Coming up" for an hour, not "Did these happen?" (B-28)', async () => {
  const res = await post('/contacts', { matchId: 'm-rosa-linda', action: 'schedule', type: 'video', date: '2026-11-03', time: '12:00' });
  assert.equal(res.status, 303);
  const call = store.contacts.find((c) => c.seniorId === 's-rosa' && c.status === 'scheduled' && c.scheduledFor === NOW.toISOString());
  const contacts = await page('/contacts');
  const upcoming = contacts.split('id="upcoming-heading"')[1];
  assert.ok(upcoming.includes(`/contacts/${call.id}/calendar.ics`), 'listed under Coming up');
  const overdue = contacts.split('id="overdue-heading"')[1]?.split('id="form-heading"')[0] || '';
  assert.ok(!overdue.includes(`/contacts/${call.id}/`), 'not under "Did these happen?"');
  const week = await page('/volunteers/v-linda/week');
  assert.doesNotMatch(week, /Did these calls happen\?/);
  assert.match(week, /Today, Tuesday, November 3/);
  assert.match(week, new RegExp(`action="/contacts/${call.id}/complete"`));
  assert.match(week, new RegExp(`action="/contacts/${call.id}/missed"`), 'its start time has come, so it can be marked missed');
});

// ---------- Fact-check #2 and B-09: only on its day, never before it happens ----------

test('a Thursday call can\'t be logged or marked missed on Tuesday, and the pages say when it can', async () => {
  const thursday = scheduled('s-dorothy'); // seeded for Thursday, Nov 5 at 4:00 PM
  assert.equal(localDateKey(thursday.scheduledFor), '2026-11-05');

  let res = await post(`/contacts/${thursday.id}/complete`, { back: '/volunteers/v-maya/week' });
  assert.equal(res.status, 409);
  let text = await res.text();
  assert.match(text, /That call is set for Thursday, November 5 at 4:00\sPM\. You can mark it done on that day, once it has happened\./);
  assert.match(text, /href="\/contacts"/, 'the error page offers a way on');

  res = await post(`/contacts/${thursday.id}/missed`, { reason: 'no_answer' });
  assert.equal(res.status, 409);
  assert.match(await res.text(), /hasn’t been missed yet/);
  assert.equal(store.contacts.find((c) => c.id === thursday.id).status, 'scheduled');

  const week = await page('/volunteers/v-maya/week');
  assert.match(week, /You can log this call on Thursday, November 5, once it has happened\./);
  assert.doesNotMatch(week, new RegExp(`action="/contacts/${thursday.id}/(complete|missed)"`));
  const contacts = await page('/contacts');
  assert.match(contacts, /You can mark this call done on Thursday, November 5, once it has happened\./);
  assert.doesNotMatch(contacts, new RegExp(`action="/contacts/${thursday.id}/(complete|missed)"`));
});

test('a call later today can be logged (counted as now), but not marked missed before it starts', async () => {
  let res = await post('/contacts', { matchId: 'm-dorothy-maya', action: 'schedule', type: 'phone', date: '2026-11-03', time: '16:00' });
  assert.equal(res.status, 303);
  const later = store.contacts.filter((c) => c.seniorId === 's-dorothy' && c.status === 'scheduled').find((c) => localDateKey(c.scheduledFor) === '2026-11-03');
  const week = await page('/volunteers/v-maya/week');
  assert.match(week, /If it doesn(&#39;|')t happen, you can mark it missed after 4:00\sPM\./);
  res = await post(`/contacts/${later.id}/missed`, {});
  assert.equal(res.status, 409);
  res = await post(`/contacts/${later.id}/complete`, {});
  assert.equal(res.status, 303);
  assert.equal(store.contacts.find((c) => c.id === later.id).completedAt, NOW.toISOString());
});

// ---------- B-05: ending a match cancels its planned calls ----------

test('ending a match cancels the pair\'s planned calls everywhere, and keeps them in the history', async () => {
  const rosaCall = scheduled('s-rosa');
  const res = await post('/matches/m-rosa-linda/end');
  assert.equal(res.status, 303);
  const saved = store.contacts.find((c) => c.id === rosaCall.id);
  assert.equal(saved.status, 'cancelled');
  assert.equal(saved.cancelReason, 'match_ended');

  for (const action of ['complete', 'missed']) {
    const r = await post(`/contacts/${rosaCall.id}/${action}`);
    assert.equal(r.status, 409, action);
    assert.match(await r.text(), /cancelled when the match ended/);
  }
  assert.equal((await fetch(`${base}/contacts/${rosaCall.id}/calendar.ics`)).status, 409);

  const dash = await page('/dashboard');
  const rosa = dash.slice(dash.indexOf('href="/seniors/s-rosa"'), dash.indexOf('</dl>', dash.indexOf('href="/seniors/s-rosa"')));
  assert.match(rosa, /Next call or visit<\/dt>\s*<dd><strong>Nothing scheduled<\/strong>/);
  assert.match(await page('/contacts'), /Cancelled \(the match ended\)/);
  assert.match(await page('/match?seniorId=s-rosa&msg=match_ended'), /Calls they had planned were taken off the calendar\./);
});

// ---------- B-11: a match that no longer fits is never silent ----------

test('after an edit breaks a match, both profiles explain what no longer fits', async () => {
  const maya = store.volunteer('v-maya');
  const params = new URLSearchParams({ name: maya.name, affiliation: maya.affiliation, maxSeniors: String(maya.maxSeniors) });
  for (const i of maya.interests) params.append('interests', i);
  params.append('availability', 'sun-morning');
  params.append('contactMethods', 'video');
  const res = await fetch(`${base}/volunteers/v-maya`, {
    method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: params.toString(),
  });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/volunteers/v-maya?msg=volunteer_saved&warn=match_misfit');
  const vol = await page(res.headers.get('location'));
  assert.match(vol, /Saved, but the current match no longer fits\./);
  assert.match(vol, /Dorothy(&#39;|')s match with Maya Patel no longer fits: No overlapping availability; Does not offer phone calls\./);
  const dorothy = await page('/seniors/s-dorothy');
  assert.match(dorothy, /Dorothy(&#39;|')s match with Maya Patel no longer fits/);
  assert.match(dorothy, /href="\/attention\/s-dorothy\/rematch"/);
  // A fitting pair shows no such note.
  assert.doesNotMatch(await page('/seniors/s-rosa'), /no longer fits/);
});

// ---------- B-26: the current companion is not "Not suggested" ----------

test('a matched senior\'s own companion is not listed as "At capacity" on the Match page', async () => {
  const html = await page('/match?seniorId=s-harold');
  assert.match(html, /Hal is already matched with Ethan Brooks/);
  const lists = html.slice(html.indexOf('id="suggestions-heading"'));
  assert.doesNotMatch(lists, /Ethan Brooks/);
});

// ---------- B-27: error pages say what to do next ----------

test('error pages are not dead ends', async () => {
  assert.equal((await post('/matches', { seniorId: 's-eugene', volunteerId: 'v-sam' })).status, 303);
  const res = await post('/matches', { seniorId: 's-eugene', volunteerId: 'v-sam' });
  assert.equal(res.status, 409);
  const html = await res.text();
  assert.match(html, /<h1>That didn(&#39;|')t work<\/h1>/);
  assert.match(html, /reload the page to see the latest/);
  assert.match(html, /href="\/attention"/);
});

// ---------- B-22 ----------

test('the "Getting close" range reads naturally for small alert settings', async () => {
  await post('/settings', { riskThresholdDays: '2' });
  assert.match(await page('/dashboard'), /Getting close: 1 to 2 days since the last call or visit/);
  await post('/settings', { riskThresholdDays: '1' });
  assert.match(await page('/dashboard'), /Getting close: 1 day since the last call or visit/);
});

// ---------- B-04: the breakdown names every reason ----------

test('a senior on the list only for a missed call is counted, in words, on Home and the dashboard', async () => {
  store.contacts.push({
    id: 'c-fix-missed', seniorId: 's-dorothy', volunteerId: 'v-maya', type: 'phone', status: 'missed',
    scheduledFor: fromLocal(2026, 11, 2, 10).toISOString(), completedAt: null, durationMinutes: null, notes: '',
    missedReason: 'other', missedNote: null, createdAt: NOW.toISOString(),
  });
  store.save();
  const words = '1 at isolation risk, 1 waiting for a companion, 1 with a recent missed call';
  assert.equal(attentionBreakdown(dashboardSummary(store, NOW).filter(needsAttention)), words);
  assert.match(await page('/admin'), new RegExp(`<p class="tile-value">3</p>\\s*<p class="tile-label">seniors need attention</p>\\s*<p class="tile-detail">${words}</p>`));
  assert.match(await page('/dashboard'), new RegExp(`Right now, 3 seniors need attention: ${words}\\.`));
  assert.equal((await page('/attention')).match(/<li class="card dash-card/g).length, 3);
});

// ---------- Fact-check #3: no "regularly" next to "Contact dropping" ----------

test('the weekly summary never says "regularly" for a senior whose contact is dropping', async () => {
  const res = await post(`/contacts/${scheduled('s-harold').id}/complete`);
  assert.equal(res.status, 303);
  const html = await page('/seniors/s-harold/summary');
  assert.match(html, /Contact dropping/);
  assert.doesNotMatch(html, /regularly/);
  assert.match(html, /Hal(&#39;|')s last check-in was yesterday\. Contact is dropping: only 4 check-ins in the last 4 weeks, down from 8 the 4 weeks before\./);
  // A senior who really is in regular touch still reads that way.
  assert.match(await page('/seniors/s-dorothy/summary'), /Dorothy is hearing from their companion regularly\./);
});

// ---------- Fact-check #1, #4, #5: wording that is true ----------

test('spark source labels match on the profile and My week, in plain words', async () => {
  assert.equal((await post('/seniors/s-dorothy/sparks', { variant: '0' })).status, 303);
  const label = 'Suggestions only. From the built-in ideas (offline mode)';
  assert.ok((await page('/seniors/s-dorothy')).includes(label));
  assert.ok((await page('/volunteers/v-maya/week')).includes(label));
});

test('the missed-call note hint and /about-ai say only what is true', async () => {
  const week = await page('/volunteers/v-ethan/week');
  // Round 2: coordinators also see the note on the senior's page, so the hint says so.
  assert.match(week, /Only coordinators see it \(on the Needs attention list and the senior(&#39;|')s page\)\. Family members and the senior never see it, and it is never sent to the AI\./);
  assert.doesNotMatch(week, /Only coordinators see it\./); // the old, untrue round-1 wording
  const about = await page('/about-ai');
  assert.doesNotMatch(about, /quietly/);
  assert.match(about, /The page says so with a short note/);
  assert.match(about, /removes it before the text is sent/);
  assert.match(await page('/seniors/s-harold/edit'), /Please leave out phone numbers, emails, and addresses/);
});

// ---------- B-15 ----------

test('a double-submitted schedule form says it was already saved', async () => {
  const form = { matchId: 'm-rosa-linda', action: 'schedule', type: 'video', date: '2026-11-05', time: '10:00' }; // Thursday morning: free for both
  assert.equal((await post('/contacts', form)).headers.get('location'), '/contacts?msg=scheduled');
  const again = await post('/contacts', form);
  assert.equal(again.headers.get('location'), '/contacts?msg=duplicate');
  assert.match(await page('/contacts?msg=duplicate'), /That call was already saved, so it was not added twice\./);
});

// ---------- units: B-07, B-08, B-12 ----------

test('dates show the year only when it is another year and more than two months away (B-07)', () => {
  try {
    setDisplayClock(() => fromLocal(2027, 1, 2, 12)); // January 2, 2027
    assert.equal(formatLongDate(fromLocal(2026, 12, 21, 12)), 'Monday, December 21');
    assert.equal(formatLongDate(fromLocal(2026, 6, 1, 12)), 'Monday, June 1, 2026');
    setDisplayClock(() => NOW);
    assert.equal(formatLongDate(fromLocal(2027, 11, 3, 12)), 'Wednesday, November 3, 2027');
    assert.equal(formatLongDate(fromLocal(2026, 11, 5, 12)), 'Thursday, November 5');
  } finally {
    setDisplayClock(() => NOW);
  }
});

test('the call form suggests the pair\'s next shared free time (B-08)', async () => {
  assert.equal(nextSlotTime(['tue-afternoon', 'thu-afternoon'], NOW).getTime(), fromLocal(2026, 11, 3, 16).getTime());
  assert.equal(nextSlotTime(['mon-morning'], NOW).getTime(), fromLocal(2026, 11, 9, 10).getTime());
  assert.equal(nextSlotTime([], NOW), null);
  // Dorothy and Maya share Monday and Wednesday afternoons and Saturday morning.
  const html = await page('/contacts?seniorId=s-dorothy');
  const date = html.match(/name="date" type="date" value="([^"]*)"/)[1];
  const time = html.match(/name="time" type="time" value="([^"]*)"/)[1];
  assert.equal(`${date} ${time}`, '2026-11-04 16:00');
  assert.equal(slotForDate(fromLocal(2026, 11, 4, 16)), 'wed-afternoon');
});

test('phone numbers and emails are removed from "about me" text, and nothing else is (B-12)', () => {
  assert.equal(
    redactContactDetails('Call Karen at 317-555-0142, (317) 555-0199, +1 317 555 0100, or karen.j@example.com.'),
    'Call Karen at [contact removed], [contact removed], [contact removed], or [contact removed].'
  );
  const story = 'Sang in the choir for 40 years, from 1975 to 2015. Ran the store in 1979-1985. Widowed in 2024.';
  assert.equal(redactContactDetails(story), story);
});

// ---------- B-24: the AI badge tells the truth after a LIVE fallback ----------

const skip = (await loadSdk()) ? false : 'run `npm install` to test LIVE mode (needs @anthropic-ai/sdk)';

test('when LIVE falls back, the header and /about-ai say offline, and the profile says it once', { skip }, async () => {
  const fakeApi = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }));
    });
  });
  await new Promise((resolve) => fakeApi.listen(0, '127.0.0.1', resolve));
  servers.push(fakeApi);
  const live = await startApp({
    sparks: createSparkService(
      buildConfig({ ANTHROPIC_API_KEY: 'sk-ant-bad', ANTHROPIC_BASE_URL: `http://127.0.0.1:${fakeApi.address().port}` }),
      { effective: 'live', reason: 'test', warning: null }
    ),
  });
  assert.match(await page('/', live.base), /AI: Live \(Claude\)/);

  const res = await post('/seniors/s-harold/sparks', { variant: '0' }, live.base);
  assert.equal(res.headers.get('location'), '/seniors/s-harold?warn=live_fallback#sparks');
  const profile = await page('/seniors/s-harold?warn=live_fallback', live.base);
  assert.equal(profile.match(/Live AI was unavailable/g).length, 1, 'one banner, not two');
  assert.match(profile, /AI: Offline mode/);
  assert.doesNotMatch(profile, /AI: Live \(Claude\)/);
  const about = await page('/about-ai', live.base);
  assert.match(about, /Right now: Offline ideas \(live AI is set up but was unavailable\)/);
  assert.match(about, /the API key was rejected/);
});
