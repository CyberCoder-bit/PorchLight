// Demo data. Every person here is FICTIONAL.
//
// Dates are generated relative to "now" every time the data is seeded, so
// the dashboard always tells the same story whenever the demo is run:
//   Dorothy: steady calls twice a week         -> "Connected"
//   Hal:     was twice a week, now 12 days quiet -> "Isolation risk" + "Contact dropping"
//   Rosa:    weekly video calls, last one 5 days ago -> "Check in soon"
//   Eugene:  just signed up, no companion yet   -> "Needs a companion" (match him live!)

import { scorePair } from './matching.js';
import { localParts, fromLocal } from './tz.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// `daysOffset` days from now, at hour:minute Carmel time.
function at(now, daysOffset, hour, minute = 0) {
  const p = localParts(now.getTime() + daysOffset * DAY_MS);
  return fromLocal(p.year, p.month, p.day, hour, minute).toISOString();
}

export function buildSeedData(now = new Date(), { riskThresholdDays = 7 } = {}) {
  const seniors = [
    {
      id: 's-dorothy',
      name: 'Dorothy Jensen',
      preferredName: 'Dorothy',
      age: 84,
      neighborhood: 'Old Town Carmel',
      interests: ['gardening', 'baking', 'faith', 'music', 'family'],
      aboutMe:
        'Retired first-grade teacher. Sang in her church choir for 40 years. Grows tomatoes and zinnias in raised beds and is proud of her sugar cream pie.',
      availability: ['mon-morning', 'mon-afternoon', 'wed-morning', 'wed-afternoon', 'fri-morning', 'sat-morning'],
      contactMethod: 'phone',
      caregiver: { name: 'Karen Jensen', relationship: 'Daughter, lives in Chicago' },
      createdAt: at(now, -75, 11),
    },
    {
      id: 's-harold',
      name: 'Harold Whitaker',
      preferredName: 'Hal',
      age: 88,
      neighborhood: 'Near the Monon Trail',
      interests: ['basketball', 'history', 'veterans', 'cars', 'games'],
      aboutMe:
        'Army veteran who ran a hardware store on Main Street for 35 years. Lifelong Indiana basketball fan. Widowed in 2024 and misses having someone to talk sports with.',
      availability: ['tue-afternoon', 'thu-afternoon', 'sat-afternoon', 'sun-afternoon'],
      contactMethod: 'visit',
      caregiver: { name: 'Mike Whitaker', relationship: 'Son, lives in Phoenix' },
      createdAt: at(now, -75, 14),
    },
    {
      id: 's-rosa',
      name: 'Rosa Delgado',
      preferredName: 'Rosa',
      age: 79,
      neighborhood: 'Village of WestClay',
      interests: ['crafts', 'travel', 'movies', 'pets', 'baking'],
      aboutMe:
        'Grew up in San Antonio and moved to Carmel to be near her son. Bilingual (English and Spanish). Knits baby blankets for a hospital NICU, loves classic movies, and has a cat named Chispa.',
      availability: ['tue-morning', 'tue-evening', 'thu-morning', 'thu-evening', 'sun-evening'],
      contactMethod: 'video',
      caregiver: { name: 'Daniel Delgado', relationship: 'Son, lives in Westfield' },
      createdAt: at(now, -65, 10),
    },
    {
      id: 's-eugene',
      name: 'Eugene Park',
      preferredName: 'Gene',
      age: 81,
      neighborhood: 'East Carmel',
      interests: ['fishing', 'baseball', 'cars', 'technology', 'history'],
      aboutMe:
        'Retired machinist and lifelong tinkerer who repairs old radios. Moved here from Kokomo last spring to be closer to his daughter and does not know many people in town yet.',
      availability: ['mon-afternoon', 'tue-afternoon', 'thu-afternoon', 'sat-morning', 'sat-afternoon'],
      contactMethod: 'phone',
      caregiver: { name: 'Grace Park', relationship: 'Daughter, lives in Carmel' },
      createdAt: at(now, -3, 13),
    },
  ];

  const volunteers = [
    {
      id: 'v-maya',
      name: 'Maya Patel',
      affiliation: 'Carmel High School junior, Key Club',
      interests: ['baking', 'music', 'gardening', 'reading'],
      availability: ['mon-afternoon', 'wed-afternoon', 'sat-morning', 'sat-afternoon', 'sun-afternoon'],
      contactMethods: ['phone', 'video'],
      maxSeniors: 2,
      createdAt: at(now, -80, 16),
    },
    {
      id: 'v-ethan',
      name: 'Ethan Brooks',
      affiliation: 'Carmel High School senior, JV basketball',
      interests: ['basketball', 'cars', 'history', 'games', 'baseball'],
      availability: ['tue-afternoon', 'thu-afternoon', 'sat-afternoon', 'sun-afternoon'],
      contactMethods: ['visit', 'phone'],
      maxSeniors: 1,
      createdAt: at(now, -80, 16),
    },
    {
      id: 'v-linda',
      name: 'Linda Okafor',
      affiliation: 'Retired librarian, church outreach team',
      interests: ['reading', 'crafts', 'travel', 'movies', 'faith'],
      availability: ['tue-morning', 'tue-evening', 'wed-evening', 'thu-morning', 'sun-evening'],
      contactMethods: ['video', 'phone', 'visit'],
      maxSeniors: 3,
      createdAt: at(now, -70, 9),
    },
    {
      id: 'v-sam',
      name: 'Sam Rivera',
      affiliation: 'Carmel High School sophomore, robotics team',
      interests: ['technology', 'fishing', 'cars', 'baseball', 'movies'],
      availability: ['tue-afternoon', 'thu-afternoon', 'sat-morning', 'sat-afternoon', 'sun-morning'],
      contactMethods: ['phone', 'video'],
      maxSeniors: 2,
      createdAt: at(now, -10, 17),
    },
  ];

  // Existing matches (scores computed with the same rules as the Match page).
  const pair = (id, seniorId, volunteerId, daysAgo) => ({
    id,
    seniorId,
    volunteerId,
    score: scorePair(seniors.find((s) => s.id === seniorId), volunteers.find((v) => v.id === volunteerId), 0).score,
    active: true,
    createdAt: at(now, -daysAgo, 12),
    endedAt: null,
  });
  const matches = [
    pair('m-dorothy-maya', 's-dorothy', 'v-maya', 70),
    pair('m-harold-ethan', 's-harold', 'v-ethan', 70),
    pair('m-rosa-linda', 's-rosa', 'v-linda', 60),
  ];

  const contacts = [];
  let n = 0;
  const completed = (seniorId, volunteerId, type, daysAgoList, hour, notes, duration) => {
    daysAgoList.forEach((daysAgo, i) => {
      const when = at(now, -daysAgo, hour, 30);
      contacts.push({
        id: `c-seed-${++n}`,
        seniorId,
        volunteerId,
        type,
        status: 'completed',
        scheduledFor: when,
        completedAt: when,
        durationMinutes: duration[i % duration.length],
        notes: notes[i % notes.length],
        createdAt: when,
      });
    });
  };

  completed(
    's-dorothy', 'v-maya', 'phone',
    [2, 5, 9, 12, 16, 19, 23, 26, 30, 33, 37, 40, 44, 47, 51, 54, 58, 61],
    16,
    [
      'Talked about her zinnias and the choir concert coming up.',
      'She walked me through her sugar cream pie recipe.',
      'Shared stories about her first year of teaching.',
      'Her granddaughter visited last weekend. She was beaming.',
      '',
    ],
    [30, 25, 40, 35]
  );
  completed(
    's-harold', 'v-ethan', 'visit',
    [12, 19, 23, 30, 33, 37, 40, 44, 47, 51, 54, 58, 61],
    15,
    [
      'Watched the second half of the game together.',
      'He showed me his old store ledger from 1979.',
      'Played gin rummy. He won again.',
      'Talked about his Army days. He asked me to come back Thursday.',
    ],
    [60, 45, 50]
  );
  completed(
    's-rosa', 'v-linda', 'video',
    [5, 12, 19, 26, 33, 40, 47, 54],
    18,
    [
      'Showed me the blanket she is knitting. Chispa walked across the keyboard!',
      'We traded favorite Audrey Hepburn movies.',
      'Talked about her trip to Mexico City in 1975.',
    ],
    [30, 40]
  );

  // A missed visit: the volunteer's schedule got busy. This is exactly the
  // kind of quiet drift the dashboard is designed to catch.
  contacts.push({
    id: `c-seed-${++n}`,
    seniorId: 's-harold',
    volunteerId: 'v-ethan',
    type: 'visit',
    status: 'missed',
    scheduledFor: at(now, -5, 15, 30),
    completedAt: null,
    durationMinutes: null,
    notes: 'Ethan had to cancel because basketball practice ran late.',
    createdAt: at(now, -9, 20),
  });

  // Upcoming scheduled calls
  contacts.push({
    id: `c-seed-${++n}`,
    seniorId: 's-dorothy',
    volunteerId: 'v-maya',
    type: 'phone',
    status: 'scheduled',
    scheduledFor: at(now, 2, 16, 0),
    completedAt: null,
    durationMinutes: null,
    notes: 'Ask how the choir concert went.',
    createdAt: at(now, -1, 19),
  });
  contacts.push({
    id: `c-seed-${++n}`,
    seniorId: 's-rosa',
    volunteerId: 'v-linda',
    type: 'video',
    status: 'scheduled',
    scheduledFor: at(now, 3, 18, 30),
    completedAt: null,
    durationMinutes: null,
    notes: '',
    createdAt: at(now, -1, 9),
  });

  return {
    meta: { schemaVersion: 1, seededAt: now.toISOString(), note: 'All people in this demo data are fictional.' },
    settings: { riskThresholdDays },
    seniors,
    volunteers,
    matches,
    contacts,
    sparkSets: [],
  };
}
