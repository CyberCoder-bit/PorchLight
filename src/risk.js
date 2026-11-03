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

const DAY_MS = 24 * 60 * 60 * 1000;

export const STATUS_INFO = {
  at_risk: {
    label: 'Isolation risk',
    icon: '⚠',
    severity: 4,
    advice: 'No recent contact. Reach out to the senior and their companion today.',
  },
  needs_match: {
    label: 'Needs a companion',
    icon: '✚',
    severity: 3,
    advice: 'Not matched with a volunteer yet. Use the Match page to find a companion.',
  },
  due_soon: {
    label: 'Check in soon',
    icon: '◷',
    severity: 2,
    advice: 'Getting close to the contact threshold. A call in the next day or two keeps things on track.',
  },
  ok: {
    label: 'Connected',
    icon: '✓',
    severity: 1,
    advice: 'Regular contact is happening.',
  },
};

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
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
  const today = startOfDay(now);
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date(today.getTime() - i * 7 * DAY_MS); // last day in this bucket
    const start = new Date(end.getTime() - 6 * DAY_MS);
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
      ? { ...STATUS_INFO.due_soon, advice: 'Newly matched! Schedule the first call soon.' }
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
    missedRecently: contacts.filter(
      (c) => c.status === 'missed' && calendarDaysBetween(c.scheduledFor, now) <= 14
    ).length,
  };
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
