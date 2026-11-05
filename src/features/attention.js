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
//
// [v2 i18n] Every sentence is a core.attention.* key (src/i18n/en/core-features.js).
// The queue is built for each request, so the words are in the reader's language.

import { dashboardSummary, needsAttention, isUnmarkedPast, calendarDaysBetween } from '../risk.js';
import { methodLower, methodWithArticle } from '../vocab.js';
import { COMMUNITY, localHelpFor } from '../community.js';
import { daysAgoText, formatDateTime, formatTime } from '../views/html.js';
import { firstName, capitalize, missedCallsWithin, trendText, tCount } from './words.js';
import { t } from '../i18n/index.js';

const SENIOR_SIDE = new Set(['no_answer', 'senior_unavailable']);

// Kept for other modules and tests; the rule itself lives in src/risk.js.
export const isOnQueue = needsAttention;

// "today at 3:30 PM", "yesterday at 3:30 PM", or "Monday, November 2 at 3:30 PM".
function whenText(iso, now) {
  const days = calendarDaysBetween(iso, now);
  if (days === 0) return t('core.attention.todayAt', { time: formatTime(iso) });
  if (days === 1) return t('core.attention.yesterdayAt', { time: formatTime(iso) });
  return formatDateTime(iso);
}

// "No completed call or visit in 12 days; only 3 check-ins in the last 4
// weeks, down from 8 the 4 weeks before; 1 missed call in the last 2 weeks."
export function reasonText(a, { missed, hadCompanion }) {
  const parts = [];
  if (a.status === 'needs_match') {
    parts.push(hadCompanion ? t('core.attention.reason.noCompanion') : t('core.attention.reason.waitingFirst'));
    parts.push(a.lastContact
      ? t('core.attention.reason.lastCheckIn', { when: daysAgoText(a.daysSince) })
      : t('core.attention.reason.joined', { when: daysAgoText(a.daysSince) }));
  } else if (!a.lastContact) {
    parts.push(t('core.attention.reason.matchedNoCall', { when: daysAgoText(a.daysSince) }));
  } else if (a.status === 'at_risk') {
    parts.push(t('core.attention.reason.noContactDays', { days: a.daysSince }));
  } else {
    parts.push(t('core.attention.reason.lastCheckIn', { when: daysAgoText(a.daysSince) }));
  }
  if (a.trend.dropping) parts.push(trendText(a.trend));
  if (missed.length) parts.push(tCount('core.attention.reason.missed', missed.length));
  return t('core.attention.reason.sentence', { text: capitalize(parts.join(t('core.attention.reason.separator'))) });
}

// Returns { kind, title, detail, href, linkText }.
export function suggestNextStep(a, { match, volunteer, missed, hadCompanion, thresholdDays, help, unmarked = [], now = new Date() }) {
  const id = a.senior.id;
  const name = firstName(a.senior);
  const vName = volunteer ? firstName(volunteer) : t('core.attention.theirCompanion');
  const caregiver = a.senior.caregiver?.name;

  if (a.status === 'needs_match' || !match) {
    return hadCompanion
      ? {
          kind: 'new_companion',
          title: t('core.attention.step.newCompanion.title'),
          detail: t('core.attention.step.newCompanion.detail', { name }),
          href: `/admin/match?seniorId=${id}`,
          linkText: t('core.attention.step.newCompanion.link', { name }),
        }
      : {
          kind: 'first_companion',
          title: t('core.attention.step.firstCompanion.title'),
          detail: t('core.attention.step.firstCompanion.detail', { name }),
          href: `/admin/match?seniorId=${id}`,
          linkText: t('core.attention.step.firstCompanion.link', { name }),
        };
  }

  const conflicts = missed.filter((c) => c.missedReason === 'volunteer_conflict' && c.volunteerId === match.volunteerId).length;
  if (conflicts >= 2) {
    return {
      kind: 'rematch',
      title: t('core.attention.step.rematch.title'),
      detail: t('core.attention.step.rematch.detail', { volunteer: vName, count: conflicts }),
      href: `/attention/${id}/rematch`,
      linkText: t('core.attention.step.rematch.link', { name }),
    };
  }

  const latest = missed[0];
  const seniorMissed = latest && SENIOR_SIDE.has(latest.missedReason);
  if (seniorMissed && a.status === 'at_risk' && a.daysSince >= 2 * thresholdDays && help) {
    // The agency's name and phone number stay as they are.
    const agency = help.phone ? `${help.name} (${help.phone})` : help.name;
    return {
      kind: 'local_help',
      title: t('core.attention.step.localHelp.title'),
      detail: t('core.attention.step.localHelp.detail', { name, days: a.daysSince, agency }),
      href: '/help',
      linkText: t('core.attention.step.localHelp.link'),
    };
  }
  if (seniorMissed) {
    return {
      kind: 'family',
      title: t('core.attention.step.family.title'),
      detail: t('core.attention.step.family.detail', { name, who: caregiver || t('core.attention.theirFamily') }),
      href: `/seniors/${id}/summary`,
      linkText: t('core.attention.step.family.link', { name }),
    };
  }

  // A past call that nobody marked: find out what happened before planning more.
  const pending = unmarked.find((c) => c.volunteerId === match.volunteerId);
  if (pending) {
    const noun = pending.type === 'visit' ? 'visit' : 'call';
    return {
      kind: 'confirm',
      title: t(`core.attention.step.confirm.title.${noun}`, { volunteer: vName }),
      detail: t('core.attention.step.confirm.detail', {
        volunteer: vName,
        call: methodWithArticle(pending.type),
        name,
        when: whenText(pending.scheduledFor, now),
      }),
      href: volunteer ? `/volunteers/${volunteer.id}/week` : `/contacts`,
      linkText: volunteer ? t('core.attention.openWeek', { volunteer: vName }) : t('core.attention.openContacts'),
    };
  }

  if (!a.nextScheduled) {
    const noun = a.senior.contactMethod === 'visit' ? 'visit' : 'call';
    return {
      kind: 'schedule',
      title: t(`core.attention.step.schedule.title.${noun}`),
      detail: t('core.attention.step.schedule.detail', { volunteer: vName, method: methodLower(a.senior.contactMethod) }),
      href: `/contacts?seniorId=${id}`,
      linkText: t(`core.attention.step.schedule.link.${noun}`, { name }),
    };
  }
  const next = a.nextScheduled.scheduledFor;
  return {
    kind: 'remind',
    title: t('core.attention.step.remind.title', { volunteer: vName }),
    detail: t('core.attention.step.remind.detail', {
      volunteer: vName,
      call: methodWithArticle(a.nextScheduled.type),
      name,
      when: calendarDaysBetween(next, now) === 0
        ? t('core.attention.todayAt', { time: formatTime(next) })
        : t('core.attention.onDate', { date: formatDateTime(next) }),
    }),
    href: volunteer ? `/volunteers/${volunteer.id}/week` : `/seniors/${id}`,
    linkText: volunteer ? t('core.attention.openWeek', { volunteer: vName }) : t('core.attention.openProfile', { name }),
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
