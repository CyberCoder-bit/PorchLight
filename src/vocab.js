// Shared vocabularies. Seniors and volunteers pick interests and time slots
// from the same fixed lists, which makes matching exact and explainable
// ("you both chose Gardening") instead of guessing from free text.

import { localParts, fromLocal } from './tz.js';
import { t, withLang, DEFAULT_LANG } from './i18n/index.js'; // [v2 i18n]

// [v2 i18n] Data keeps the ids ('gardening', 'tue-afternoon'). The words live in
// src/i18n/en/core-features.js (core.interest.*, core.day.*, core.period.*,
// core.method.*, core.missed.*). `label` is a getter, so it is read in the
// request's language each time a page is drawn, never when something is saved.
function labelled(prefix, items) {
  for (const item of items) {
    Object.defineProperty(item, 'label', { get: () => t(`${prefix}.${item.id}`), enumerable: true });
  }
  return items;
}

export const INTERESTS = labelled('core.interest', [
  { id: 'gardening' },
  { id: 'baking' },
  { id: 'music' },
  { id: 'faith' },
  { id: 'history' },
  { id: 'travel' },
  { id: 'reading' },
  { id: 'crafts' },
  { id: 'games' },
  { id: 'puzzles' },
  { id: 'pets' },
  { id: 'birds' },
  { id: 'fishing' },
  { id: 'basketball' },
  { id: 'baseball' },
  { id: 'cars' },
  { id: 'veterans' },
  { id: 'family' },
  { id: 'movies' },
  { id: 'art' },
  { id: 'technology' },
]);

export const DAYS = labelled('core.day', [
  { id: 'mon' },
  { id: 'tue' },
  { id: 'wed' },
  { id: 'thu' },
  { id: 'fri' },
  { id: 'sat' },
  { id: 'sun' },
]);

// Each day is split into three blocks. A "slot" id looks like "tue-afternoon".
// `suggest` is the hour the call form fills in for that block.
export const PERIODS = labelled('core.period', [
  { id: 'morning', start: 9, end: 12, suggest: 10 },
  { id: 'afternoon', start: 12, end: 17, suggest: 16 },
  { id: 'evening', start: 17, end: 20, suggest: 18 },
]);
for (const p of PERIODS) Object.defineProperty(p, 'hours', { get: () => t(`core.periodHours.${p.id}`), enumerable: true });

export const SLOTS = DAYS.flatMap((d) =>
  PERIODS.map((p) => ({ id: `${d.id}-${p.id}`, day: d, period: p }))
);

export const CONTACT_METHODS = labelled('core.method', [
  { id: 'phone', icon: '☎' },
  { id: 'video', icon: '▶' },
  { id: 'visit', icon: '⌂' },
]);

const interestById = new Map(INTERESTS.map((i) => [i.id, i]));
const methodById = new Map(CONTACT_METHODS.map((m) => [m.id, m]));
const slotById = new Map(SLOTS.map((s) => [s.id, s]));

export const isInterest = (id) => interestById.has(id);
export const isSlot = (id) => slotById.has(id);
export const isMethod = (id) => methodById.has(id);

export const interestLabel = (id) => interestById.get(id)?.label ?? id;
export const methodLabel = (id) => methodById.get(id)?.label ?? id;
// "Tuesday afternoon": one key per time of day, so a language can order the words its own way.
export const slotLabel = (id) => {
  const s = slotById.get(id);
  return s ? t(`core.slot.${s.period.id}`, { day: s.day.label }) : id;
};

// English, whatever the reader's language: for text that is saved (spark
// "Based on" lines) or sent to the AI as a prompt.
export const interestLabelEn = (id) => withLang(DEFAULT_LANG, () => interestLabel(id));
export const methodLabelEn = (id) => withLang(DEFAULT_LANG, () => methodLabel(id));


// Which slot does a given date/time fall in? (null = outside 9 AM–8 PM)
export function slotForDate(date) {
  const { weekday, hour } = localParts(date);
  const day = DAYS[(weekday + 6) % 7]; // JS: Sunday=0, we start on Monday
  const period = PERIODS.find((p) => hour >= p.start && hour < p.end);
  return period ? `${day.id}-${period.id}` : null;
}

// The next time inside one of `slotIds` (e.g. a pair's shared free time), at
// least `leadMinutes` from `now`, looking up to two weeks ahead on the Carmel
// calendar. Returns a Date, or null if there are no usable slots.
export function nextSlotTime(slotIds, now = new Date(), { leadMinutes = 60 } = {}) {
  const wanted = new Set(slotIds.filter(isSlot));
  if (!wanted.size) return null;
  const earliest = new Date(now).getTime() + leadMinutes * 60 * 1000;
  const p = localParts(now);
  for (let d = 0; d < 15; d++) {
    for (const period of PERIODS) {
      const when = fromLocal(p.year, p.month, p.day + d, period.suggest);
      if (when.getTime() >= earliest && wanted.has(slotForDate(when))) return when;
    }
  }
  return null;
}

// Why a scheduled call was missed. Shown to coordinators; never sent to the AI.
export const MISSED_REASONS = labelled('core.missed', [
  { id: 'no_answer' },
  { id: 'senior_unavailable' },
  { id: 'volunteer_conflict' },
  { id: 'other' },
]);
export const isMissedReason = (id) => MISSED_REASONS.some((r) => r.id === id);
