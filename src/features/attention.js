// The coordinator's "Needs attention" queue.
//
// Who is on it: needsAttention() in src/risk.js, the same rule Home and the
// Family Dashboard use for their counts:
//   - "Isolation risk" (at_risk)
//   - "Contact dropping" (the 4-week trend flag)
//   - "Needs a companion" (needs_match)
//   - a missed call in the last 14 days
//
// Order: the same as the Family Dashboard (dashboardSummary): Isolation risk,
// then Needs a companion, then Check in soon, then Connected; within a group,
// the longest time since the last check-in first.
//
// Each senior gets ONE suggested next step, picked by fixed rules (first match
// wins), so the same data always gives the same advice. No AI is used here.
//   1. No companion                         -> find a first / new companion
//   2. 2+ cancellations by the current      -> find a new companion (re-match)
//      companion in the last 2 weeks
//   3. Isolation risk, 2x the alert days,   -> get local help
//      and the senior didn't answer
//   4. The senior missed the latest call    -> let the family know
//   5. A past call with the companion was   -> ask the volunteer whether it
//      never marked                            happened, then log or mark it
//   6. Nothing scheduled                    -> schedule a call
//   7. A call is scheduled                  -> remind the volunteer

import { dashboardSummary, needsAttention, isUnmarkedPast, calendarDaysBetween } from '../risk.js';
import { methodLabel } from '../vocab.js';
import { COMMUNITY, localHelpFor } from '../community.js';
import { daysAgoText, formatDateTime, formatTime, plural } from '../views/html.js';
import { firstName, capitalize, missedCallsWithin, trendText } from './words.js';

const SENIOR_SIDE = new Set(['no_answer', 'senior_unavailable']);

// Kept for other modules and tests; the rule itself lives in src/risk.js.
export const isOnQueue = needsAttention;

// "a phone call", "an in-person visit"
const withArticle = (words) => `${/^[aeiou]/i.test(words) ? 'an' : 'a'} ${words}`;

// "today at 3:30 PM", "yesterday at 3:30 PM", or "Monday, November 2 at 3:30 PM".
function whenText(iso, now) {
  const days = calendarDaysBetween(iso, now);
  if (days === 0) return `today at ${formatTime(iso)}`;
  if (days === 1) return `yesterday at ${formatTime(iso)}`;
  return formatDateTime(iso);
}

// "No completed call or visit in 12 days; only 3 check-ins in the last 4
// weeks, down from 8 the 4 weeks before; 1 missed call in the last 2 weeks."
export function reasonText(a, { missed, hadCompanion }) {
  const parts = [];
  if (a.status === 'needs_match') {
    parts.push(hadCompanion ? 'no companion right now' : 'waiting for a first companion');
    parts.push(a.lastContact ? `last check-in was ${daysAgoText(a.daysSince)}` : `joined ${daysAgoText(a.daysSince)}`);
  } else if (!a.lastContact) {
    parts.push(`matched ${daysAgoText(a.daysSince)}, and no call has happened yet`);
  } else if (a.status === 'at_risk') {
    parts.push(`no completed call or visit in ${a.daysSince} days`);
  } else {
    parts.push(`last check-in was ${daysAgoText(a.daysSince)}`);
  }
  if (a.trend.dropping) parts.push(trendText(a.trend));
  if (missed.length) parts.push(`${plural(missed.length, 'missed call')} in the last 2 weeks`);
  return `${capitalize(parts.join('; '))}.`;
}

// Returns { kind, title, detail, href, linkText }.
export function suggestNextStep(a, { match, volunteer, missed, hadCompanion, thresholdDays, help, unmarked = [], now = new Date() }) {
  const id = a.senior.id;
  const name = firstName(a.senior);
  const vName = volunteer ? firstName(volunteer) : 'their companion';
  const caregiver = a.senior.caregiver?.name;

  if (a.status === 'needs_match' || !match) {
    return hadCompanion
      ? {
          kind: 'new_companion',
          title: 'Find a new companion',
          detail: `${name}'s last match has ended. Choose someone new. Past calls stay in the history.`,
          href: `/admin/match?seniorId=${id}`,
          linkText: `Find a new companion for ${name}`,
        }
      : {
          kind: 'first_companion',
          title: 'Find a first companion',
          detail: `${name} hasn't been matched with a volunteer yet.`,
          href: `/admin/match?seniorId=${id}`,
          linkText: `Find a companion for ${name}`,
        };
  }

  const conflicts = missed.filter((c) => c.missedReason === 'volunteer_conflict' && c.volunteerId === match.volunteerId).length;
  if (conflicts >= 2) {
    return {
      kind: 'rematch',
      title: 'Find a new companion',
      detail: `${vName} has had to cancel ${conflicts} times in the last 2 weeks. A companion with more free time may be a better fit.`,
      href: `/attention/${id}/rematch`,
      linkText: `Review ${name}'s match`,
    };
  }

  const latest = missed[0];
  const seniorMissed = latest && SENIOR_SIDE.has(latest.missedReason);
  if (seniorMissed && a.status === 'at_risk' && a.daysSince >= 2 * thresholdDays && help) {
    return {
      kind: 'local_help',
      title: 'Get local help',
      detail: `${name} couldn't be reached and has gone ${a.daysSince} days without a check-in. Let the family know, and call ${help.name}${help.phone ? ` (${help.phone})` : ''} to ask what local support could help. If someone may be in danger, call 911.`,
      href: '/help',
      linkText: 'See local help',
    };
  }
  if (seniorMissed) {
    return {
      kind: 'family',
      title: 'Let the family know',
      detail: `${name} couldn't be reached for the last call. Ask ${caregiver || 'their family'} to check in. The weekly summary has a message ready to copy.`,
      href: `/seniors/${id}/summary`,
      linkText: `Open ${name}'s weekly summary`,
    };
  }

  // A past call that nobody marked: find out what happened before planning more.
  const pending = unmarked.find((c) => c.volunteerId === match.volunteerId);
  if (pending) {
    const noun = pending.type === 'visit' ? 'visit' : 'call';
    return {
      kind: 'confirm',
      title: `Ask ${vName} about the last ${noun}`,
      detail: `${vName} had ${withArticle(methodLabel(pending.type).toLowerCase())} with ${name} ${whenText(pending.scheduledFor, now)}, and nobody has marked it yet. Ask whether it happened, then log it or mark it missed on ${vName}'s week.`,
      href: volunteer ? `/volunteers/${volunteer.id}/week` : `/contacts`,
      linkText: volunteer ? `Open ${vName}'s week` : 'Open Calls & Visits',
    };
  }

  if (!a.nextScheduled) {
    const noun = a.senior.contactMethod === 'visit' ? 'visit' : 'call';
    return {
      kind: 'schedule',
      title: `Schedule a ${noun}`,
      detail: `Nothing is on the calendar with ${vName}. Set up the next ${methodLabel(a.senior.contactMethod).toLowerCase()}.`,
      href: `/contacts?seniorId=${id}`,
      linkText: `Schedule a ${noun} with ${name}`,
    };
  }
  return {
    kind: 'remind',
    title: `Remind ${vName}`,
    detail: `${vName} has ${withArticle(methodLabel(a.nextScheduled.type).toLowerCase())} with ${name} ${calendarDaysBetween(a.nextScheduled.scheduledFor, now) === 0 ? `today at ${formatTime(a.nextScheduled.scheduledFor)}` : `on ${formatDateTime(a.nextScheduled.scheduledFor)}`}. A quick reminder helps it happen.`,
    href: volunteer ? `/volunteers/${volunteer.id}/week` : `/seniors/${id}`,
    linkText: volunteer ? `Open ${vName}'s week` : `Open ${name}'s profile`,
  };
}

// Everything the /attention page shows, most urgent first.
export function buildAttentionQueue(store, now) {
  const thresholdDays = store.settings.riskThresholdDays;
  const help = localHelpFor(COMMUNITY)[0] || null;
  const summary = dashboardSummary(store, now);
  const items = summary.filter(needsAttention).map((a) => {
    const match = store.activeMatchForSenior(a.senior.id);
    const volunteer = match ? store.volunteer(match.volunteerId) : null;
    const contacts = store.contactsForSenior(a.senior.id);
    const missed = missedCallsWithin(contacts, now);
    const unmarked = contacts
      .filter((c) => isUnmarkedPast(c, now))
      .sort((x, y) => new Date(y.scheduledFor) - new Date(x.scheduledFor));
    const hadCompanion = store.matches.some((m) => m.seniorId === a.senior.id && !m.active);
    const facts = { match, volunteer, missed, hadCompanion, thresholdDays, help, unmarked, now };
    return {
      assessment: a,
      senior: a.senior,
      match,
      volunteer,
      missed: missed.map((c) => ({ ...c, volunteer: store.volunteer(c.volunteerId) })),
      reason: reasonText(a, facts),
      step: suggestNextStep(a, facts),
    };
  });
  // Seniors who aren't on the queue yet but are getting close.
  const comingUp = summary.filter((a) => !needsAttention(a) && a.status === 'due_soon');
  return { items, comingUp, thresholdDays };
}
