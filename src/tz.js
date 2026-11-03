// PorchLight's clock: every date and time is shown and interpreted in Carmel,
// Indiana time, no matter where the server runs. This matters on Cloudflare
// Workers, whose clock is always UTC: without this, "4:00 PM" typed into the
// call form would be saved as 11 AM in Carmel.

export const TIME_ZONE = 'America/Indiana/Indianapolis';

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Calendar fields of `date` in Carmel. month is 1-12; weekday is 0 (Sunday) to 6.
export function localParts(date) {
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

// The moment when the Carmel wall clock reads the given date and time (DST-safe).
export function fromLocal(year, month, day, hour = 0, minute = 0) {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p = localParts(guess);
    guess += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  return new Date(guess);
}

// Parses form values "YYYY-MM-DD" and "HH:MM" as Carmel time. Returns null for
// impossible dates like February 31.
export function parseLocalDateTime(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const when = fromLocal(year, month, day, hour, minute);
  const back = localParts(when);
  const real = back.year === year && back.month === month && back.day === day && hour < 24 && minute < 60;
  return real && !Number.isNaN(when.getTime()) ? when : null;
}

export function formatLocal(date, options) {
  return new Date(date).toLocaleString('en-US', { timeZone: TIME_ZONE, ...options });
}
