import { test } from 'node:test';
import assert from 'node:assert/strict';
import { riskStatus, contactTrend, weeklyCounts, calendarDaysBetween, assessSenior, dashboardSummary } from '../src/risk.js';
import { Store } from '../src/store.js';
import { buildSeedData } from '../src/seed.js';

process.env.TZ = 'America/Indiana/Indianapolis'; // test dates use the app's Carmel clock (src/tz.js)
const NOW = new Date('2026-11-02T12:00:00');
const daysAgo = (n, hour = 15) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const done = (n) => ({ status: 'completed', completedAt: daysAgo(n), scheduledFor: daysAgo(n) });

test('calendar days: yesterday evening counts as 1 day even if fewer than 24 hours ago', () => {
  assert.equal(calendarDaysBetween(daysAgo(1, 23), NOW), 1);
  assert.equal(calendarDaysBetween(daysAgo(0, 1), NOW), 0);
});

test('risk status thresholds (threshold = 7)', () => {
  const t = 7;
  assert.equal(riskStatus({ hasCompanion: false, daysSince: 0, thresholdDays: t }), 'needs_match');
  assert.equal(riskStatus({ hasCompanion: true, daysSince: 4, thresholdDays: t }), 'ok');
  assert.equal(riskStatus({ hasCompanion: true, daysSince: 5, thresholdDays: t }), 'due_soon');
  assert.equal(riskStatus({ hasCompanion: true, daysSince: 7, thresholdDays: t }), 'due_soon');
  assert.equal(riskStatus({ hasCompanion: true, daysSince: 8, thresholdDays: t }), 'at_risk');
});

test('a new match with no call yet is "Check in soon", not "Connected"', () => {
  assert.equal(riskStatus({ hasCompanion: true, daysSince: 0, thresholdDays: 7, firstCallPending: true }), 'due_soon');
  assert.equal(riskStatus({ hasCompanion: true, daysSince: 9, thresholdDays: 7, firstCallPending: true }), 'at_risk');
});

test('a tiny threshold still has a sensible "check in soon" window', () => {
  assert.equal(riskStatus({ hasCompanion: true, daysSince: 0, thresholdDays: 1 }), 'ok');
  assert.equal(riskStatus({ hasCompanion: true, daysSince: 1, thresholdDays: 1 }), 'due_soon');
  assert.equal(riskStatus({ hasCompanion: true, daysSince: 2, thresholdDays: 1 }), 'at_risk');
});

test('trend flags a drop to half or less of the previous 4 weeks', () => {
  const steady = [2, 9, 16, 23, 30, 37, 44, 51].map(done);
  assert.equal(contactTrend(steady, NOW).dropping, false);
  const fading = [12, 19, 30, 33, 37, 40, 44, 47].map(done);
  const t = contactTrend(fading, NOW);
  assert.deepEqual([t.recent, t.previous, t.dropping], [2, 6, true]);
  // Not enough history to call it a trend
  assert.equal(contactTrend([done(40)], NOW).dropping, false);
});

test('only completed contacts count', () => {
  const contacts = [
    { status: 'missed', scheduledFor: daysAgo(1), completedAt: null },
    { status: 'scheduled', scheduledFor: daysAgo(-1), completedAt: null },
    done(10),
  ];
  const a = assessSenior({ id: 's', name: 'S', createdAt: daysAgo(60) }, { contacts, activeMatch: { createdAt: daysAgo(50) }, thresholdDays: 7, now: NOW });
  assert.equal(a.daysSince, 10);
  assert.equal(a.status, 'at_risk');
  assert.equal(a.missedRecently, 1);
});

test('a match with no calls yet is counted from the match date', () => {
  const a = assessSenior({ id: 's', name: 'S', createdAt: daysAgo(30) }, { contacts: [], activeMatch: { createdAt: daysAgo(9) }, thresholdDays: 7, now: NOW });
  assert.equal(a.since.kind, 'match');
  assert.equal(a.status, 'at_risk');
});

test('weekly buckets: 8 weeks, oldest first, newest = last 7 days', () => {
  const weeks = weeklyCounts([0, 6, 7, 55, 56].map(done), NOW, 8);
  assert.equal(weeks.length, 8);
  assert.equal(weeks[7].count, 2); // days 0 and 6
  assert.equal(weeks[6].count, 1); // day 7
  assert.equal(weeks[0].count, 1); // day 55 (day 56 is outside the window)
});

test('seed data tells the intended story', () => {
  const store = new Store('/dev/null');
  store.data = buildSeedData(NOW);
  const byId = Object.fromEntries(dashboardSummary(store, NOW).map((r) => [r.senior.id, r]));
  assert.equal(byId['s-harold'].status, 'at_risk');
  assert.equal(byId['s-harold'].daysSince, 12);
  assert.equal(byId['s-harold'].trend.dropping, true);
  assert.equal(byId['s-eugene'].status, 'needs_match');
  assert.equal(byId['s-rosa'].status, 'due_soon');
  assert.equal(byId['s-dorothy'].status, 'ok');
  // Most urgent first
  assert.equal(dashboardSummary(store, NOW)[0].senior.id, 's-harold');
  // Lowering the threshold to 4 days flips Rosa to "Isolation risk"
  store.data.settings.riskThresholdDays = 4;
  assert.equal(dashboardSummary(store, NOW).find((r) => r.senior.id === 's-rosa').status, 'at_risk');
});
