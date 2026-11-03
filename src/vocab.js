// Shared vocabularies. Seniors and volunteers pick interests and time slots
// from the same fixed lists, which makes matching exact and explainable
// ("you both chose Gardening") instead of guessing from free text.

import { localParts } from './tz.js';

export const INTERESTS = [
  { id: 'gardening', label: 'Gardening' },
  { id: 'baking', label: 'Cooking & baking' },
  { id: 'music', label: 'Music & singing' },
  { id: 'faith', label: 'Faith & church' },
  { id: 'history', label: 'History' },
  { id: 'travel', label: 'Travel' },
  { id: 'reading', label: 'Books & reading' },
  { id: 'crafts', label: 'Crafts & knitting' },
  { id: 'games', label: 'Cards & board games' },
  { id: 'puzzles', label: 'Puzzles & trivia' },
  { id: 'pets', label: 'Pets & animals' },
  { id: 'birds', label: 'Birdwatching & nature' },
  { id: 'fishing', label: 'Fishing & the outdoors' },
  { id: 'basketball', label: 'Basketball' },
  { id: 'baseball', label: 'Baseball' },
  { id: 'cars', label: 'Cars & racing' },
  { id: 'veterans', label: 'Military service' },
  { id: 'family', label: 'Family & grandkids' },
  { id: 'movies', label: 'Movies & TV' },
  { id: 'art', label: 'Art & painting' },
  { id: 'technology', label: 'Technology & gadgets' },
];

export const DAYS = [
  { id: 'mon', label: 'Monday' },
  { id: 'tue', label: 'Tuesday' },
  { id: 'wed', label: 'Wednesday' },
  { id: 'thu', label: 'Thursday' },
  { id: 'fri', label: 'Friday' },
  { id: 'sat', label: 'Saturday' },
  { id: 'sun', label: 'Sunday' },
];

// Each day is split into three blocks. A "slot" id looks like "tue-afternoon".
export const PERIODS = [
  { id: 'morning', label: 'Morning', hours: '9 AM–noon', start: 9, end: 12 },
  { id: 'afternoon', label: 'Afternoon', hours: 'noon–5 PM', start: 12, end: 17 },
  { id: 'evening', label: 'Evening', hours: '5–8 PM', start: 17, end: 20 },
];

export const SLOTS = DAYS.flatMap((d) =>
  PERIODS.map((p) => ({ id: `${d.id}-${p.id}`, day: d, period: p }))
);

export const CONTACT_METHODS = [
  { id: 'phone', label: 'Phone call', icon: '☎' },
  { id: 'video', label: 'Video call', icon: '▶' },
  { id: 'visit', label: 'In-person visit', icon: '⌂' },
];

const interestById = new Map(INTERESTS.map((i) => [i.id, i]));
const methodById = new Map(CONTACT_METHODS.map((m) => [m.id, m]));
const slotById = new Map(SLOTS.map((s) => [s.id, s]));

export const isInterest = (id) => interestById.has(id);
export const isSlot = (id) => slotById.has(id);
export const isMethod = (id) => methodById.has(id);

export const interestLabel = (id) => interestById.get(id)?.label ?? id;
export const methodLabel = (id) => methodById.get(id)?.label ?? id;
export const slotLabel = (id) => {
  const s = slotById.get(id);
  return s ? `${s.day.label} ${s.period.label.toLowerCase()}` : id;
};

// Which slot does a given date/time fall in? (null = outside 9 AM–8 PM)
export function slotForDate(date) {
  const { weekday, hour } = localParts(date);
  const day = DAYS[(weekday + 6) % 7]; // JS: Sunday=0, we start on Monday
  const period = PERIODS.find((p) => hour >= p.start && hour < p.end);
  return period ? `${day.id}-${period.id}` : null;
}
