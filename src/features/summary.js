// The weekly family summary: counts and dates only. Volunteer call notes and
// missed-call notes are never included, on the page or in the copy text.

import { methodLabel } from '../vocab.js';
import { formatLongDate, formatDateTime, daysAgoText } from '../views/html.js';
import { firstName, missedCallsWithin, missedReasonLabel, statusSentence } from './words.js';

const FOUR_WEEKS_LAST_DAY = 27; // "last 4 weeks" = today and the 27 days before (as in risk.js)

export function buildFamilySummary({ senior, assessment: a, volunteer, contacts, thresholdDays, now }) {
  const name = firstName(senior);
  const missed = missedCallsWithin(contacts, now, FOUR_WEEKS_LAST_DAY).map((c) => ({
    date: c.scheduledFor,
    type: c.type,
    reason: missedReasonLabel(c.missedReason),
  }));
  const facts = {
    last7: a.weekly[a.weekly.length - 1].count, // week 0: today and the 6 days before
    last28: a.trend.recent,
    previous28: a.trend.previous,
    lastContact: a.lastContact ? { date: a.lastContact.completedAt, type: a.lastContact.type, daysAgo: a.daysSince } : null,
    next: a.nextScheduled ? { date: a.nextScheduled.scheduledFor, type: a.nextScheduled.type } : null,
    companion: volunteer ? volunteer.name : null,
  };
  const sentence = statusSentence(a, thresholdDays);
  const labels = [a.info.label, a.trend.dropping ? 'Contact dropping' : null].filter(Boolean).join(', ');
  const fullName = name === senior.name.split(' ')[0] ? senior.name : `${name} (${senior.name})`;

  const lines = [
    `PorchLight weekly update: ${fullName}`,
    `Week ending ${formatLongDate(now)}`,
    '',
    `Status: ${labels}`,
    sentence,
    '',
    `Check-ins in the last 7 days: ${facts.last7}`,
    `Check-ins in the last 4 weeks: ${facts.last28}`,
    `Last contact: ${facts.lastContact
      ? `${formatLongDate(facts.lastContact.date)} (${daysAgoText(facts.lastContact.daysAgo)}), ${methodLabel(facts.lastContact.type).toLowerCase()}`
      : 'none yet'}`,
    `Next call or visit: ${facts.next ? `${formatDateTime(facts.next.date)} (${methodLabel(facts.next.type).toLowerCase()})` : 'none scheduled yet'}`,
    `Companion: ${facts.companion || 'not matched yet'}`,
    `Missed calls in the last 4 weeks: ${missed.length}`,
    ...missed.map((m) => `- ${formatLongDate(m.date)}: ${methodLabel(m.type).toLowerCase()} (reason: ${m.reason.toLowerCase()})`),
    '',
    'Counts and dates only. Call notes stay private.',
  ];

  return { senior, assessment: a, sentence, facts, missed, now, text: lines.join('\n') };
}
