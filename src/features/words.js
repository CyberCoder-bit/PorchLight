// Small shared helpers for the day-to-day features: names, missed-call
// reasons, and plain-English sentences about a senior's status.
// Everything here is deterministic. No AI is involved.

import { calendarDaysBetween } from '../risk.js';
import { MISSED_REASONS } from '../vocab.js';
import { daysAgoText, plural } from '../views/html.js';

// Same window as assessSenior().missedRecently in src/risk.js.
export const RECENT_MISSED_DAYS = 14;

export const firstName = (person) => (person ? person.preferredName || person.name.split(' ')[0] : '');

export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const reasonById = new Map(MISSED_REASONS.map((r) => [r.id, r.label]));
export const missedReasonLabel = (id) => reasonById.get(id) || 'No reason recorded';

// Missed calls whose scheduled day is within the last `days` calendar days,
// newest first. A call can only be marked missed once its time has come, so a
// missed call dated in the future (old data) is never counted as "recent".
export function missedCallsWithin(contacts, now, days = RECENT_MISSED_DAYS) {
  return contacts
    .filter((c) => {
      if (c.status !== 'missed') return false;
      const daysAgo = calendarDaysBetween(c.scheduledFor, now);
      return daysAgo >= 0 && daysAgo <= days;
    })
    .sort((a, b) => new Date(b.scheduledFor) - new Date(a.scheduledFor));
}

// "only 3 check-ins in the last 4 weeks, down from 8 the 4 weeks before"
export function trendText(trend) {
  const recent = trend.recent === 0 ? 'no check-ins' : `only ${plural(trend.recent, 'check-in')}`;
  return `${recent} in the last 4 weeks, down from ${trend.previous} the 4 weeks before`;
}

// One or two sentences a family member would understand.
export function statusSentence(a, thresholdDays) {
  const name = firstName(a.senior);
  let text;
  if (a.status === 'needs_match') {
    text = `${name} doesn't have a volunteer companion right now and is waiting to be matched.`;
  } else if (!a.lastContact) {
    text = `${name} was matched ${daysAgoText(a.daysSince)}, and the first call is still to come.`;
  } else if (a.status === 'at_risk') {
    text = `${name} has had no completed call or visit in ${a.daysSince} days. That is longer than the ${thresholdDays}-day alert setting.`;
  } else if (a.status === 'due_soon') {
    text = `${name}'s last check-in was ${daysAgoText(a.daysSince)}. A call in the next day or two keeps things on track.`;
  } else if (a.trend.dropping) {
    // Recent contact, but fewer calls than before: don't call that "regular".
    text = `${name}'s last check-in was ${daysAgoText(a.daysSince)}.`;
  } else {
    text = `${name} is hearing from their companion regularly. The last check-in was ${daysAgoText(a.daysSince)}.`;
  }
  if (a.trend.dropping) text += ` Contact is dropping: ${trendText(a.trend)}.`;
  return text;
}
