// The weekly family summary: counts and dates only. Volunteer call notes and
// missed-call notes are never included, on the page or in the copy text.
//
// [v2 i18n] The page is in the reader's language (t() in the view). The
// "Message to copy" text is written in English on purpose, like the .ics file:
// it is a message the family pastes and sends on, so it stays as it was, and
// its labels are read in English (withLang) instead of the reader's language.

import { methodLabel } from '../vocab.js';
import { formatLongDate, formatDateTime, daysAgoText } from '../views/html.js';
import { firstName, missedCallsWithin, missedReasonLabel, statusSentence } from './words.js';
import { withLang, DEFAULT_LANG } from '../i18n/index.js';

const FOUR_WEEKS_LAST_DAY = 27; // "last 4 weeks" = today and the 27 days before (as in risk.js)

export function buildFamilySummary({ senior, assessment: a, volunteer, contacts, thresholdDays, now }) {
  const missedContacts = missedCallsWithin(contacts, now, FOUR_WEEKS_LAST_DAY);
  const missed = missedContacts.map((c) => ({
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
  const text = withLang(DEFAULT_LANG, () => messageText({ senior, a, facts, missedContacts, thresholdDays, now }));
  return { senior, assessment: a, sentence, facts, missed, now, text };
}

// The plain-text message (English; see the note at the top).
function messageText({ senior, a, facts, missedContacts, thresholdDays, now }) {
  const name = firstName(senior);
  const sentence = statusSentence(a, thresholdDays);
  const missed = missedContacts.map((c) => ({ date: c.scheduledFor, type: c.type, reason: missedReasonLabel(c.missedReason) }));
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
  return lines.join('\n');
}
