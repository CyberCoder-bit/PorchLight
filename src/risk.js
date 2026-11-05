// Isolation-risk signals for the caregiver dashboard.
//
// This is the core "CS for good" mechanism. Families usually don't notice
// that social contact is fading until it becomes a crisis. PorchLight watches
// the check-in log and raises a flag early. Rules, in order:
//
//   1. No active companion                      -> "Needs a companion"
//   2. Days since last contact > threshold      -> "Isolation risk"
//   3. Days since last contact >= threshold - 2 -> "Check in soon" (early warning)
//      ...or newly matched, with the first call still to come
//   4. Otherwise                                -> "Connected"
//
// Separately, a TREND flag ("Contact dropping") compares the last 4 weeks
// with the 4 weeks before. If check-ins fell by half or more, we flag it even
// when the threshold hasn't been crossed yet. That catches the slow fade.
//
// Only COMPLETED contacts count. A scheduled or missed call isn't contact.
// "Days since" uses calendar days ("yesterday" = 1), the way people talk.

import { startOfLocalDay } from './tz.js';
import { t } from './i18n/index.js'; // [v2 i18n]

const DAY_MS = 24 * 60 * 60 * 1000;

// [v2 i18n] `label` and `advice` are getters (core.status.<id>.label/.advice in
// src/i18n/en/core-features.js), read in the reader's language when a page is
// drawn. Saved data only ever holds the id ('at_risk').
const statusInfo = (id, icon, severity, adviceKey = `core.status.${id}.advice`) => ({
  get label() { return t(`core.status.${id}.label`); },
  icon,
  severity,
  get advice() { return t(adviceKey); },
});

export const STATUS_INFO = {
  at_risk: statusInfo('at_risk', '⚠', 4),
  needs_match: statusInfo('needs_match', '✚', 3),
  due_soon: statusInfo('due_soon', '◷', 2),
  ok: statusInfo('ok', '✓', 1),
};
// "Check in soon", with the advice for a new match whose first call is still to come.
const NEWLY_MATCHED = statusInfo('due_soon', '◷', 2, 'core.status.due_soon.adviceNew');

// Local midnight (Carmel time for the demo) on the same calendar day.
export function startOfDay(date) {
  return startOfLocalDay(date);
}

// Whole calendar days from `earlier` to `later` (Math.round absorbs daylight-saving shifts).
export function calendarDaysBetween(earlier, later) {
  return Math.round((startOfDay(later) - startOfDay(earlier)) / DAY_MS);
}

export function completedContacts(contacts) {
  return contacts
    .filter((c) => c.status === 'completed' && c.completedAt)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
}

export function lastCompletedContact(contacts) {
  return completedContacts(contacts)[0] || null;
}

// Check-ins per week for the chart, oldest week first.
// Week 0 is the most recent 7 calendar days (today and the 6 days before).
export function weeklyCounts(contacts, now = new Date(), weeks = 8) {
  const done = completedContacts(contacts);
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    // Step back on the calendar, not in 24-hour steps: in the week after the
    // clocks spring forward, "midnight minus 7 x 24 hours" is 11 PM the day before.
    const end = startOfLocalDay(now, -i * 7); // last day in this bucket
    const start = startOfLocalDay(now, -i * 7 - 6);
    const count = done.filter((c) => {
      const daysAgo = calendarDaysBetween(c.completedAt, now);
      return daysAgo >= i * 7 && daysAgo <= i * 7 + 6;
    }).length;
    buckets.push({ start, end, count });
  }
  return buckets;
}

// Compare the last 28 days with the 28 days before that.
export function contactTrend(contacts, now = new Date()) {
  let recent = 0;
  let previous = 0;
  for (const c of completedContacts(contacts)) {
    const daysAgo = calendarDaysBetween(c.completedAt, now);
    if (daysAgo >= 0 && daysAgo <= 27) recent++;
    else if (daysAgo >= 28 && daysAgo <= 55) previous++;
  }
  const dropping = previous >= 2 && recent <= previous * 0.5;
  return { recent, previous, dropping };
}

export function riskStatus({ hasCompanion, daysSince, thresholdDays, firstCallPending = false }) {
  if (!hasCompanion) return 'needs_match';
  if (daysSince > thresholdDays) return 'at_risk';
  if (daysSince >= Math.max(1, thresholdDays - 2)) return 'due_soon';
  if (firstCallPending) return 'due_soon'; // matched, but nobody has talked yet
  return 'ok';
}

// Everything the dashboard needs to know about one senior.
export function assessSenior(senior, { contacts, activeMatch, thresholdDays, now = new Date() }) {
  const last = lastCompletedContact(contacts);
  // Count from the last real contact. If there has never been one, count
  // from when they were matched (or signed up), so a brand-new match with
  // no calls still gets flagged after the threshold.
  const since = last
    ? { kind: 'contact', date: last.completedAt }
    : activeMatch
      ? { kind: 'match', date: activeMatch.createdAt }
      : { kind: 'signup', date: senior.createdAt };
  const daysSince = Math.max(0, calendarDaysBetween(since.date, now));
  const firstCallPending = Boolean(activeMatch) && !last;
  const status = riskStatus({ hasCompanion: Boolean(activeMatch), daysSince, thresholdDays, firstCallPending });
  const info =
    firstCallPending && status === 'due_soon'
      ? NEWLY_MATCHED
      : STATUS_INFO[status];

  const upcoming = contacts
    .filter((c) => c.status === 'scheduled' && new Date(c.scheduledFor) >= now)
    .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));

  return {
    senior,
    status,
    info,
    daysSince,
    since,
    lastContact: last,
    nextScheduled: upcoming[0] || null,
    trend: contactTrend(contacts, now),
    weekly: weeklyCounts(contacts, now, 8),
    // Missed calls whose day is within the last 14 days (a call can only be
    // marked missed once its time has come, so none should be in the future).
    missedRecently: contacts.filter((c) => {
      if (c.status !== 'missed') return false;
      const daysAgo = calendarDaysBetween(c.scheduledFor, now);
      return daysAgo >= 0 && daysAgo <= 14;
    }).length,
  };
}

// ----- the "Needs attention" list -----
// ONE rule decides who is on it. Home, the Family Dashboard, and /attention all
// use it, so the number is the same on every page. A senior is on the list if
// any of these is true (from assessSenior; no AI):
//   - "Isolation risk" (at_risk)
//   - "Needs a companion" (needs_match)
//   - "Contact dropping" (the 4-week trend flag)
//   - a missed call in the last 14 days
export function needsAttention(a) {
  return a.status === 'at_risk' || a.status === 'needs_match' || a.trend.dropping || a.missedRecently > 0;
}

// The main reason a senior is on the list (one per senior, so the breakdown
// adds up to the total), or null if they aren't on it.
export function attentionReason(a) {
  if (a.status === 'at_risk') return 'at_risk';
  if (a.status === 'needs_match') return 'needs_match';
  if (a.trend.dropping) return 'dropping';
  if (a.missedRecently > 0) return 'missed';
  return null;
}

// [v2 i18n] Each reason is a whole phrase with its number: core.attentionReason.<id>.
export const ATTENTION_REASONS = ['at_risk', 'needs_match', 'dropping', 'missed'];

// "1 at isolation risk, 1 waiting for a companion": every number says what it counts.
export function attentionBreakdown(assessments) {
  const counts = new Map();
  for (const a of assessments) {
    const reason = attentionReason(a);
    if (reason) counts.set(reason, (counts.get(reason) || 0) + 1);
  }
  return ATTENTION_REASONS
    .filter((k) => counts.has(k))
    .map((k) => t(`core.attentionReason.${k}`, { count: counts.get(k) }))
    .join(t('core.words.listSeparator'));

}

// ----- when a scheduled call can be marked -----
// A call counts as "in progress" for an hour after its start time, so a call
// set for right now isn't asked about ("Did this happen?") straight away.
export const CALL_GRACE_MINUTES = 60;

// Still scheduled, and its time (plus the grace hour) has passed without anyone marking it.
export function isUnmarkedPast(c, now = new Date()) {
  return c.status === 'scheduled' && new Date(c.scheduledFor).getTime() + CALL_GRACE_MINUTES * 60 * 1000 < new Date(now).getTime();
}

// "Log this call" / "Mark as done" work for calls on today's date (Carmel
// calendar) or earlier. A Thursday visit can't be logged on Tuesday.
export function canLogNow(c, now = new Date()) {
  return c.status === 'scheduled' && calendarDaysBetween(c.scheduledFor, now) >= 0;
}

// "Mark missed" works once the call's start time has come.
export function canMarkMissedNow(c, now = new Date()) {
  return c.status === 'scheduled' && new Date(c.scheduledFor) <= new Date(now);
}

// All seniors, most urgent first.
export function dashboardSummary(store, now = new Date()) {
  const thresholdDays = store.settings.riskThresholdDays;
  return store.seniors
    .map((s) =>
      assessSenior(s, {
        contacts: store.contactsForSenior(s.id),
        activeMatch: store.activeMatchForSenior(s.id),
        thresholdDays,
        now,
      })
    )
    .sort(
      (a, b) =>
        b.info.severity - a.info.severity ||
        b.daysSince - a.daysSince ||
        a.senior.name.localeCompare(b.senior.name)
    );
}
