// PorchLight's clock: every date and time is shown and interpreted in the
// community's own time zone (src/community.js), no matter where the server
// runs. This matters on Cloudflare Workers, whose clock is always UTC: without
// this, "4:00 PM" typed into the call form would be saved as 11 AM in Carmel.
//
// Indiana has two time zones. Most counties use Eastern time
// (America/Indiana/Indianapolis); 12 counties use Central time (America/Chicago).
// createClock(timeZone) builds a clock for either one. The plain exports below
// (localParts, fromLocal, ...) are the clock for this deployment's COMMUNITY.
//
// Daylight saving time (both Indiana zones change at 2:00 AM local time):
//   - Spring forward (2026: Sunday, March 8): the clock jumps from 1:59 AM to
//     3:00 AM, so 2:00-2:59 AM does not exist that day.
//       parseLocalDateTime() returns null for those times (a form shows an
//       error, the same as for February 31).
//       fromLocal() moves them forward by the gap, so 2:30 AM becomes 3:30 AM
//       daylight time (the rule JavaScript's Temporal API calls "compatible").
//   - Fall back (2026: Sunday, November 1): 1:00-1:59 AM happens twice.
//       Both functions pick the FIRST one (still daylight time, the earlier
//       instant). For Carmel, 1:30 AM on Nov 1, 2026 is 05:30 UTC, not 06:30.
//
// Never use the machine's local time (getHours, setDate, ...) or
// toISOString().slice(0, 10) for calendar dates; use these helpers instead.

import { COMMUNITY } from './community.js';
import { currentLang } from './i18n/index.js'; // [v2 i18n] display only
import { localeOf } from './i18n/languages.js'; // [v2 i18n] display only

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const pad = (n) => String(n).padStart(2, '0');

const clocks = new Map();

/**
 * A clock for one IANA time zone, e.g. 'America/Indiana/Indianapolis' or
 * 'America/Chicago'. Throws a RangeError for an unknown zone, so a typo in a
 * community profile fails loudly at startup instead of silently using UTC.
 *
 * Returns { localParts, fromLocal, parseLocalDateTime, formatLocal, formatIn,
 *           localDateKey, startOfLocalDay, TIME_ZONE }.
 */
export function createClock(timeZone) {
  if (clocks.has(timeZone)) return clocks.get(timeZone);

  const partsFormat = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  // Calendar fields of `date` in this zone. month is 1-12; weekday is 0 (Sunday) to 6.
  function localParts(date) {
    const p = Object.fromEntries(partsFormat.formatToParts(new Date(date)).map((x) => [x.type, x.value]));
    return {
      year: Number(p.year),
      month: Number(p.month),
      day: Number(p.day),
      hour: Number(p.hour),
      minute: Number(p.minute),
      weekday: WEEKDAY_INDEX[p.weekday],
    };
  }

  // The wall clock at instant `ms`, written as if it were a UTC time.
  function wallAt(ms) {
    const p = localParts(ms);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  // How far the wall clock is ahead of UTC at instant `ms` (negative in the US).
  function offsetAt(ms) {
    return wallAt(ms) - Math.floor(ms / MINUTE_MS) * MINUTE_MS;
  }

  // The moment when this zone's wall clock reads the given date and time.
  // The day may be out of range and rolls over like Date.UTC, so
  // fromLocal(y, m, d + 7) means "a week later on the calendar", even across
  // a daylight-saving change. See the top of this file for the DST rules.
  function fromLocal(year, month, day, hour = 0, minute = 0) {
    const wall = Date.UTC(year, month - 1, day, hour, minute);
    if (Number.isNaN(wall)) return new Date(NaN);
    // The offsets a day before and a day after cover any single DST change.
    const offsetBefore = offsetAt(wall - DAY_MS);
    const offsetAfter = offsetAt(wall + DAY_MS);
    const candidates = [wall - offsetBefore, wall - offsetAfter].filter((t) => wallAt(t) === wall);
    if (candidates.length) return new Date(Math.min(...candidates)); // repeated hour: the earlier one
    return new Date(wall - offsetBefore); // skipped hour: move forward by the gap
  }

  // Parses form values "YYYY-MM-DD" and "HH:MM" as local time. Returns null for
  // impossible dates like February 31, and for times skipped when the clocks
  // spring forward (2:30 AM on March 8, 2026).
  function parseLocalDateTime(dateStr, timeStr) {
    if (typeof dateStr !== 'string' || typeof timeStr !== 'string') return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    if (![year, month, day, hour, minute].every(Number.isInteger)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    const when = fromLocal(year, month, day, hour, minute);
    if (Number.isNaN(when.getTime())) return null;
    const back = localParts(when);
    const real =
      back.year === year && back.month === month && back.day === day && back.hour === hour && back.minute === minute;
    return real ? when : null;
  }

  // For people to read: words and order follow the reader's language
  // (currentLang(), e.g. "miércoles, 4 de noviembre" in Spanish), but the
  // clock is always this zone's. Only display goes through here. Parsing
  // (localParts above) always reads en-US parts, whatever the language.
  function formatIn(locale, date, options) {
    return new Date(date).toLocaleString(locale, { timeZone, ...options });
  }
  function formatLocal(date, options) {
    return formatIn(localeOf(currentLang()), date, options);
  }

  // "YYYY-MM-DD" for the local calendar day of `date` (not the UTC day).
  function localDateKey(date) {
    const p = localParts(date);
    return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  }

  // Local midnight at the start of the calendar day of `date`, optionally
  // `offsetDays` calendar days later (or earlier, if negative).
  function startOfLocalDay(date, offsetDays = 0) {
    const p = localParts(date);
    return fromLocal(p.year, p.month, p.day + offsetDays);
  }

  const clock = Object.freeze({
    localParts,
    fromLocal,
    parseLocalDateTime,
    formatLocal,
    formatIn,
    localDateKey,
    startOfLocalDay,
    TIME_ZONE: timeZone,
  });
  clocks.set(timeZone, clock);
  return clock;
}

// ----- this deployment's clock (America/Indiana/Indianapolis for Carmel) -----

const communityClock = createClock(COMMUNITY.timeZone);

export const TIME_ZONE = communityClock.TIME_ZONE;
export const {
  localParts,
  fromLocal,
  parseLocalDateTime,
  formatLocal,
  formatIn,
  localDateKey,
  startOfLocalDay,
} = communityClock;
