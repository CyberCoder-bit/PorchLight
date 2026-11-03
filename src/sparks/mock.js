// MOCK_MODE: offline, deterministic conversation sparks (no network, no API key).
//
// "Deterministic" means the same inputs always give the same output, so the
// demo is repeatable and testable. Different seniors, interests, contact gaps,
// seasons, or a "Show different sparks" click (variant + 1) produce different
// output. How it works:
//   1. Hash the inputs into a number (FNV-1a hash).
//   2. Use that number to seed a small pseudo-random generator (mulberry32).
//   3. Use the generator to pick templates from templates.js.
// Spark 1 always fits the time since the last contact. Sparks 2 and 3 come
// from two DIFFERENT interests (or general prompts if there aren't enough).

import { OPENERS, INTEREST_SPARKS, GENERAL_SPARKS, VOLUNTEER_TIPS } from './templates.js';
import { interestLabel } from '../vocab.js';

// FNV-1a: a simple, well-known string hash.
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: a tiny seeded pseudo-random number generator (returns 0..1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function seasonOf(date) {
  const m = date.getMonth(); // 0 = January
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'fall';
}

export function gapBucket(daysSince) {
  if (daysSince === null || daysSince === undefined) return 'first';
  if (daysSince <= 3) return 'recent';
  if (daysSince <= 10) return 'week';
  return 'long';
}

export function gapPhrase(days) {
  if (days <= 5) return 'a few days';
  if (days <= 8) return 'about a week';
  if (days <= 11) return 'over a week';
  if (days <= 16) return 'about two weeks';
  if (days <= 27) return 'a few weeks';
  return 'over a month';
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];

function shuffle(rand, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Combine general, seasonal, and month-specific templates. Seasonal ones are
// listed twice so they show up more often when they apply.
function poolFor(entry, season, monthKey) {
  const seasonal = [...(entry[season] || []), ...(entry[monthKey] || [])];
  return { all: [...entry.any, ...seasonal, ...seasonal], seasonal };
}

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

/**
 * @param {object} input
 * @param {string} input.seniorId
 * @param {string} input.name           preferred first name
 * @param {string[]} input.interests    interest ids
 * @param {number|null} input.daysSince days since last completed contact (null = never)
 * @param {string|null} input.lastContactDay  YYYY-MM-DD of the last contact (part of the seed)
 * @param {Date} input.now
 * @param {number} variant              0, 1, 2, ... ("Show different sparks")
 */
export function generateMockSparks(input, variant = 0) {
  const now = input.now || new Date();
  const season = seasonOf(now);
  const monthKey = MONTH_KEYS[now.getMonth()];
  const interests = [...(input.interests || [])].sort();
  const seedText = [input.seniorId, interests.join(','), input.lastContactDay || 'never', season, monthKey, variant].join('|');
  const rand = mulberry32(fnv1a(seedText));
  const vars = { name: input.name, gap: input.daysSince != null ? gapPhrase(input.daysSince) : '' };

  const sparks = [];

  // Spark 1: opener matched to the time since last contact.
  const bucket = gapBucket(input.daysSince);
  const basedOnGap =
    bucket === 'first'
      ? 'First conversation'
      : `${input.daysSince} day${input.daysSince === 1 ? '' : 's'} since last contact${bucket === 'long' ? ', warm reconnect' : ''}`;
  sparks.push({ text: fill(pick(rand, OPENERS[bucket]), vars), basedOn: basedOnGap });

  // Sparks 2 and 3: two different interests, in a seeded random order.
  const usable = shuffle(rand, interests.filter((id) => INTEREST_SPARKS[id]));
  for (const id of usable.slice(0, 2)) {
    const { all, seasonal } = poolFor(INTEREST_SPARKS[id], season, monthKey);
    const template = pick(rand, all);
    sparks.push({
      text: fill(template, vars),
      basedOn: `Interest: ${interestLabel(id)}${seasonal.includes(template) ? ` (${season})` : ''}`,
    });
  }

  // Not enough interests? Fill with general prompts, with no repeats.
  const general = poolFor(GENERAL_SPARKS, season, monthKey);
  const generalChoices = shuffle(rand, [...new Set(general.all)]);
  while (sparks.length < 3) {
    const template = generalChoices.shift();
    sparks.push({
      text: fill(template, vars),
      basedOn: general.seasonal.includes(template) ? `Local and seasonal (${season})` : 'General',
    });
  }

  return { sparks, tip: pick(rand, VOLUNTEER_TIPS) };
}

export function pickTip(seedText) {
  const rand = mulberry32(fnv1a(seedText));
  return pick(rand, VOLUNTEER_TIPS);
}
