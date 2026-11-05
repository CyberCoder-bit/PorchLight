// Small shared helpers for the day-to-day features: names, missed-call
// reasons, and plain-English sentences about a senior's status.
// Everything here is deterministic. No AI is involved.
// [v2 i18n] The words come from t() (core.* keys in src/i18n/en/core-features.js).

import { calendarDaysBetween } from '../risk.js';
import { MISSED_REASONS } from '../vocab.js';
import { daysAgoText } from '../views/html.js';
import { t } from '../i18n/index.js';

// Same window as assessSenior().missedRecently in src/risk.js.
export const RECENT_MISSED_DAYS = 14;

export const firstName = (person) => (person ? person.preferredName || person.name.split(' ')[0] : '');

export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// A counted phrase: `${key}.one` for exactly 1, `${key}.other` otherwise. {count} is filled in.
export const tCount = (key, count, vars = {}) => t(`${key}.${count === 1 ? 'one' : 'other'}`, { ...vars, count });

// Looked up when shown, so the label is in the reader's language.
export const missedReasonLabel = (id) => MISSED_REASONS.find((r) => r.id === id)?.label || t('core.missed.none');

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
  if (trend.recent === 0) return t('core.trend.none', { previous: trend.previous });
  return tCount('core.trend.only', trend.recent, { previous: trend.previous });
}

// One or two sentences a family member would understand.
export function statusSentence(a, thresholdDays) {
  const name = firstName(a.senior);
  const when = daysAgoText(a.daysSince);
  let text;
  if (a.status === 'needs_match') {
    text = t('core.sentence.needsMatch', { name });
  } else if (!a.lastContact) {
    text = t('core.sentence.firstCall', { name, when });
  } else if (a.status === 'at_risk') {
    text = t('core.sentence.atRisk', { name, days: a.daysSince, threshold: thresholdDays });
  } else if (a.status === 'due_soon') {
    text = t('core.sentence.dueSoon', { name, when });
  } else if (a.trend.dropping) {
    // Recent contact, but fewer calls than before: don't call that "regular".
    text = t('core.sentence.dropping', { name, when });
  } else {
    text = t('core.sentence.ok', { name, when });
  }
  if (a.trend.dropping) text += ` ${t('core.sentence.droppingNote', { trend: trendText(a.trend) })}`;
  return text;
}
