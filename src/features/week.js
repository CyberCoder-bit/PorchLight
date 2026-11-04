// A volunteer's "My week": scheduled calls from now through the 7th calendar
// day (Carmel time), plus past calls that were never marked.
//
// Sparks shown here are the latest SAVED set for each senior. Loading this
// page never calls the AI.

import { calendarDaysBetween } from '../risk.js';
import { localParts, fromLocal, formatLocal } from '../tz.js';
import { toDateInput } from '../views/html.js';

export const WEEK_DAYS = 7;

// "EST", "CDT", ... for the community's zone at `date`.
export function zoneAbbreviation(date) {
  return formatLocal(date, { hour: 'numeric', timeZoneName: 'short' }).split(' ').pop();
}

export function buildWeek(store, volunteer, now) {
  const p = localParts(now);
  const lastDay = fromLocal(p.year, p.month, p.day + WEEK_DAYS - 1, 12); // noon avoids DST edges
  const withSenior = (c) => ({ ...c, senior: store.senior(c.seniorId) });
  const scheduled = store.contacts
    .filter((c) => c.volunteerId === volunteer.id && c.status === 'scheduled')
    .map(withSenior)
    .filter((c) => c.senior)
    .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));

  const isPast = (c) => new Date(c.scheduledFor) < now;
  const dayOffset = (c) => calendarDaysBetween(now, c.scheduledFor);
  const overdue = scheduled.filter(isPast);
  const thisWeek = scheduled.filter((c) => !isPast(c) && dayOffset(c) <= WEEK_DAYS - 1);
  const later = scheduled.filter((c) => !isPast(c) && dayOffset(c) > WEEK_DAYS - 1);

  // Group this week's calls by Carmel calendar day.
  const days = [];
  for (const c of thisWeek) {
    const key = toDateInput(c.scheduledFor);
    let day = days.find((d) => d.key === key);
    if (!day) {
      day = { key, offset: dayOffset(c), date: c.scheduledFor, calls: [] };
      days.push(day);
    }
    day.calls.push({ ...c, sparkSet: store.latestSparkSet(c.seniorId) });
  }

  const assigned = store
    .activeMatchesForVolunteer(volunteer.id)
    .map((match) => ({ match, senior: store.senior(match.seniorId) }))
    .filter((a) => a.senior)
    .sort((a, b) => a.senior.name.localeCompare(b.senior.name));
  const plannedIds = new Set(thisWeek.map((c) => c.seniorId));
  const unplanned = assigned.filter((a) => !plannedIds.has(a.senior.id));

  return {
    volunteer,
    days,
    overdue,
    later,
    assigned,
    unplanned,
    callCount: thisWeek.length,
    lastDay,
    zone: zoneAbbreviation(now),
    back: `/volunteers/${volunteer.id}/week`,
  };
}
