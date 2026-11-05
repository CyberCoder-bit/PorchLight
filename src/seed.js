// Demo data. Every person here is FICTIONAL.
//
// Dates are generated relative to "now" every time the data is seeded, so
// the dashboard always tells the same story whenever the demo is run:
//   Dorothy: steady calls twice a week         -> "Connected"
//   Hal:     was twice a week, now 12 days quiet -> "Isolation risk" + "Contact dropping"
//            (his visit yesterday was never marked; logging it is a demo step)
//   Rosa:    weekly video calls, last one 5 days ago -> "Check in soon"
//   Eugene:  just signed up, no companion yet   -> "Needs a companion" (match him live!)
//
// [towns] Towns: Rosa lives in Westfield (also Hamilton County), so the town
// filter has something to show, and her companion Linda lives in Indianapolis
// (Marion County): video calls work statewide, but Linda is "too far for
// in-person visits" on Hal's match page. Dorothy, Hal, Eugene and their
// companions are in Carmel.
//
// [v2 accounts] Eight more seniors and six more volunteers live in other
// Eastern-time towns and speak a mix of languages. Each new pair talks
// steadily, so they are all "Connected" and the story above stays the same.
// Every new volunteer is already at capacity (or pending), so Sam is still
// the best match for Gene. Samira (Arabic) and Jordan (English) share no
// language: Jordan uses translate help. Noah is waiting for approval, and
// Ellen's link to her dad Walter is waiting too.

import { scorePair } from './matching.js';
import { localParts, fromLocal } from './tz.js';
import { buildDemoMessages } from './translate/demo.js'; // [v2] demo messages in two languages

// [v2 accounts] Every demo account shares one demo password (it is in the
// README, never in code). This is its stored form, made with
// `node scripts/hash-password.js '<password>'`. To keep the seed short, every
// account uses the SAME salt, so they all have the same hash. A real launch
// gives every account its own random salt (hashPassword() does that).
const DEMO_PASSWORD = Object.freeze({
  algo: 'pbkdf2-sha256',
  iterations: 40000,
  salt: 'ra5cSpCuzRpVOmlu1s6E2w==',
  hash: 'nICIhBxiD0RXOmcc31TM19HG995O9UEqFYp07jPOIO8=',
});

const lang = (code, level) => ({ code, level });

// `daysOffset` calendar days from today, at hour:minute local time.
// Counting on the calendar (not in 24-hour steps) keeps the story the same
// when "now" is just after midnight on a daylight-saving day, when
// now + 24 hours can land on the same calendar day.
function at(now, daysOffset, hour, minute = 0) {
  const p = localParts(now);
  return fromLocal(p.year, p.month, p.day + daysOffset, hour, minute).toISOString();
}

export function buildSeedData(now = new Date(), { riskThresholdDays = 7 } = {}) {
  const seniors = [
    {
      id: 's-dorothy',
      name: 'Dorothy Jensen',
      preferredName: 'Dorothy',
      age: 84,
      neighborhood: 'Old Town Carmel',
      town: 'Carmel', // [towns]
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
      town: 'Carmel', // [towns]
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
      neighborhood: 'Near Grand Park', // [towns]
      town: 'Westfield', // [towns]
      interests: ['crafts', 'travel', 'movies', 'pets', 'baking'],
      aboutMe:
        'Grew up in San Antonio and moved to Westfield to be near her son. Bilingual (English and Spanish). Knits baby blankets for a hospital NICU, loves classic movies, and has a cat named Chispa.',
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
      town: 'Carmel', // [towns]
      interests: ['fishing', 'baseball', 'cars', 'technology', 'history'],
      aboutMe:
        'Retired machinist and lifelong tinkerer who repairs old radios. Moved here from Kokomo last spring to be closer to his daughter and does not know many people in town yet.',
      availability: ['mon-afternoon', 'tue-afternoon', 'thu-afternoon', 'sat-morning', 'sat-afternoon'],
      contactMethod: 'phone',
      caregiver: { name: 'Grace Park', relationship: 'Daughter, lives in Carmel' },
      createdAt: at(now, -3, 13),
    },
    // ----- [v2 accounts] more seniors, all "Connected" -----
    {
      id: 's-samira',
      name: 'Samira Haddad',
      preferredName: 'Samira',
      age: 76,
      neighborhood: 'Near the Nickel Plate Trail',
      town: 'Fishers',
      interests: ['baking', 'family', 'gardening', 'faith', 'music'],
      aboutMe: 'Moved from Aleppo to be near her son. Grows mint and parsley on her balcony and loves to cook for guests. Is learning English one word at a time.',
      availability: ['mon-afternoon', 'wed-afternoon', 'fri-afternoon', 'sat-afternoon'],
      contactMethod: 'phone',
      caregiver: { name: 'Omar Haddad', relationship: 'Son, lives in Fishers' },
      createdAt: at(now, -62, 11),
    },
    {
      id: 's-thanh',
      name: 'Thanh Nguyen',
      preferredName: 'Thanh',
      age: 82,
      neighborhood: 'Old Town Greenwood',
      town: 'Greenwood',
      interests: ['gardening', 'baking', 'music', 'family', 'movies'],
      aboutMe: 'Ran a tailor shop for 30 years. Loves old Vietnamese love songs and grows bitter melon in her backyard.',
      availability: ['tue-morning', 'thu-morning', 'sat-morning'],
      contactMethod: 'phone',
      caregiver: { name: 'Linh Nguyen', relationship: 'Daughter, lives in Greenwood' },
      createdAt: at(now, -60, 10),
    },
    {
      id: 's-cing',
      name: 'Cing Sung',
      preferredName: 'Cing',
      age: 74,
      neighborhood: 'Southport',
      town: 'Indianapolis',
      interests: ['faith', 'music', 'family', 'baking'],
      aboutMe: 'Sings in a Chin church choir on the south side. Speaks Hakha Chin and Burmese and is proud of her six grandchildren.',
      availability: ['mon-evening', 'wed-evening', 'sun-afternoon'],
      contactMethod: 'phone',
      caregiver: { name: 'Ruth Sung', relationship: 'Daughter, lives in Indianapolis' },
      createdAt: at(now, -60, 12),
    },
    {
      id: 's-aung',
      name: 'Aung Min',
      preferredName: 'Aung',
      age: 80,
      neighborhood: 'Perry Township',
      town: 'Indianapolis',
      interests: ['history', 'reading', 'faith', 'games'],
      aboutMe: 'Taught high school history in Yangon. Plays chess every afternoon and likes to talk about the news.',
      availability: ['mon-evening', 'wed-evening', 'sat-afternoon'],
      contactMethod: 'phone',
      caregiver: { name: '', relationship: '' },
      createdAt: at(now, -60, 15),
    },
    {
      id: 's-mei',
      name: 'Mei Lin',
      preferredName: 'Mei',
      age: 85,
      neighborhood: 'Near Main Street',
      town: 'Zionsville',
      interests: ['art', 'reading', 'music', 'family'],
      aboutMe: 'A retired pharmacist who paints with brush and ink. Reads two mystery novels a week.',
      availability: ['tue-afternoon', 'thu-afternoon', 'sun-afternoon'],
      contactMethod: 'video',
      caregiver: { name: 'Ryan Lin', relationship: 'Grandson, lives in Zionsville' },
      createdAt: at(now, -60, 9),
    },
    {
      id: 's-marguerite',
      name: 'Marguerite Dubois',
      preferredName: 'Marguerite',
      age: 87,
      neighborhood: 'Near the courthouse square',
      town: 'Noblesville',
      interests: ['baking', 'travel', 'reading', 'music'],
      aboutMe: 'Grew up in Lyon, France, and taught French at a high school for 25 years. Bakes a lemon tart for every birthday on her street.',
      availability: ['mon-morning', 'wed-morning', 'fri-morning'],
      contactMethod: 'phone',
      caregiver: { name: 'Sophie Dubois', relationship: 'Niece, lives in Indianapolis' },
      createdAt: at(now, -60, 11),
    },
    {
      id: 's-helga',
      name: 'Helga Becker',
      preferredName: 'Helga',
      age: 90,
      neighborhood: 'Near the library',
      town: 'Lebanon',
      interests: ['gardening', 'baking', 'pets', 'history'],
      aboutMe: 'Came from Bavaria in 1958. Keeps two dachshunds and the best rose garden in Lebanon.',
      availability: ['mon-morning', 'wed-morning', 'fri-morning'],
      contactMethod: 'phone',
      caregiver: { name: 'Peter Becker', relationship: 'Son, lives in Lebanon' },
      createdAt: at(now, -60, 14),
    },
    {
      id: 's-walter',
      name: 'Walter Hayes',
      preferredName: 'Walt',
      age: 83,
      neighborhood: 'Near Forest Park',
      town: 'Noblesville',
      interests: ['fishing', 'cars', 'history', 'veterans'],
      aboutMe: 'Drove a delivery truck for 40 years and knows every back road in Hamilton County. Fishes at Morse Reservoir.',
      availability: ['mon-morning', 'wed-morning', 'fri-morning'],
      contactMethod: 'phone',
      caregiver: { name: 'Ellen Hayes', relationship: 'Daughter, lives in Carmel' },
      createdAt: at(now, -60, 16),
    },
  ];

  const volunteers = [
    {
      id: 'v-maya',
      name: 'Maya Patel',
      affiliation: 'Carmel High School junior, Key Club',
      town: 'Carmel', // [towns]
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
      town: 'Carmel', // [towns]
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
      town: 'Indianapolis', // [towns] video calls with Rosa work statewide
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
      town: 'Carmel', // [towns]
      interests: ['technology', 'fishing', 'cars', 'baseball', 'movies'],
      availability: ['tue-afternoon', 'thu-afternoon', 'sat-morning', 'sat-afternoon', 'sun-morning'],
      contactMethods: ['phone', 'video'],
      maxSeniors: 2,
      createdAt: at(now, -10, 17),
    },
    // ----- [v2 accounts] more volunteers, each already at capacity (or pending) -----
    {
      id: 'v-jordan',
      name: 'Jordan Lee',
      affiliation: 'Fishers High School junior, Interact Club',
      town: 'Fishers',
      interests: ['baking', 'music', 'gardening', 'family'],
      availability: ['mon-afternoon', 'wed-afternoon', 'sat-afternoon'],
      contactMethods: ['phone', 'video'],
      maxSeniors: 1,
      createdAt: at(now, -64, 16),
    },
    {
      id: 'v-kevin',
      name: 'Kevin Tran',
      affiliation: 'Center Grove High School senior',
      town: 'Greenwood',
      interests: ['music', 'baking', 'movies', 'technology'],
      availability: ['tue-morning', 'thu-morning', 'sat-morning'],
      contactMethods: ['phone'],
      maxSeniors: 1,
      createdAt: at(now, -62, 16),
    },
    {
      id: 'v-david',
      name: 'David Thang',
      affiliation: 'Chin community youth group',
      town: 'Greenwood',
      interests: ['faith', 'music', 'history', 'games'],
      availability: ['mon-evening', 'wed-evening', 'sat-afternoon', 'sun-afternoon'],
      contactMethods: ['phone'],
      maxSeniors: 2,
      createdAt: at(now, -62, 18),
    },
    {
      id: 'v-amy',
      name: 'Amy Zhou',
      affiliation: 'Zionsville Community High School, art club',
      town: 'Zionsville',
      interests: ['art', 'reading', 'music'],
      availability: ['tue-afternoon', 'thu-afternoon', 'sun-afternoon'],
      contactMethods: ['video', 'phone'],
      maxSeniors: 1,
      createdAt: at(now, -62, 17),
    },
    {
      id: 'v-olivia',
      name: 'Olivia Martin',
      affiliation: 'Retired nurse, library volunteer',
      town: 'Noblesville',
      interests: ['baking', 'reading', 'gardening', 'history', 'fishing'],
      availability: ['mon-morning', 'wed-morning', 'fri-morning'],
      contactMethods: ['phone', 'visit'],
      maxSeniors: 3,
      createdAt: at(now, -62, 10),
    },
    {
      id: 'v-noah',
      name: 'Noah Fischer',
      affiliation: 'Anderson University sophomore',
      town: 'Anderson',
      interests: ['basketball', 'history', 'games', 'cars'],
      availability: ['tue-afternoon', 'thu-afternoon', 'sat-afternoon'],
      contactMethods: ['phone', 'video'],
      maxSeniors: 1,
      createdAt: at(now, -2, 19),
    },
  ];

  // [v2 accounts] Languages, translate help, and family codes (no look-alike
  // characters). A volunteer is 'active' once a coordinator approved them.
  const SENIOR_EXTRAS = {
    's-dorothy': { languages: [lang('en', 'native')], familyCode: 'DRTH4M' },
    's-harold': { languages: [lang('en', 'native')], familyCode: 'HKW8PZ' },
    's-rosa': { languages: [lang('es', 'native'), lang('en', 'fluent')], translateHelp: true, familyCode: 'RSD5QT' },
    's-eugene': { languages: [lang('en', 'native')], familyCode: 'GNP3VB' },
    's-samira': { languages: [lang('ar', 'native'), lang('en', 'learning')], translateHelp: true, familyCode: 'SMH6RA' },
    's-thanh': { languages: [lang('vi', 'native'), lang('en', 'conversational')], translateHelp: true, familyCode: 'TNG2WE' },
    's-cing': { languages: [lang('cnh', 'native'), lang('my', 'fluent'), lang('en', 'learning')], translateHelp: true, familyCode: 'CSG9KD' },
    's-aung': { languages: [lang('my', 'native'), lang('en', 'conversational')], familyCode: 'AMN4XP' },
    's-mei': { languages: [lang('zh', 'native'), lang('en', 'fluent')], familyCode: 'MEZ7HC' },
    's-marguerite': { languages: [lang('fr', 'native'), lang('en', 'fluent')], familyCode: 'MDB3TF' },
    's-helga': { languages: [lang('de', 'native'), lang('en', 'fluent')], familyCode: 'HBK5YN' },
    's-walter': { languages: [lang('en', 'native')], familyCode: 'WHY8GS' },
  };
  for (const s of seniors) Object.assign(s, { translateHelp: false }, SENIOR_EXTRAS[s.id]);
  const VOLUNTEER_EXTRAS = {
    'v-maya': { languages: [lang('en', 'native'), lang('hi', 'conversational')] },
    'v-ethan': { languages: [lang('en', 'native')] },
    'v-linda': { languages: [lang('en', 'native'), lang('es', 'learning')], translateHelp: true },
    'v-sam': { languages: [lang('en', 'native'), lang('es', 'conversational')] },
    'v-jordan': { languages: [lang('en', 'native')], translateHelp: true },
    'v-kevin': { languages: [lang('en', 'native'), lang('vi', 'fluent')] },
    'v-david': { languages: [lang('cnh', 'native'), lang('my', 'fluent'), lang('en', 'fluent')] },
    'v-amy': { languages: [lang('en', 'native'), lang('zh', 'fluent')] },
    'v-olivia': { languages: [lang('en', 'native'), lang('fr', 'conversational'), lang('de', 'learning')] },
    'v-noah': { languages: [lang('en', 'native'), lang('de', 'conversational')], status: 'pending' },
  };
  for (const v of volunteers) Object.assign(v, { translateHelp: false, status: 'active' }, VOLUNTEER_EXTRAS[v.id]);

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
    // [v2 accounts]
    pair('m-samira-jordan', 's-samira', 'v-jordan', 58),
    pair('m-thanh-kevin', 's-thanh', 'v-kevin', 58),
    pair('m-cing-david', 's-cing', 'v-david', 58),
    pair('m-aung-david', 's-aung', 'v-david', 58),
    pair('m-mei-amy', 's-mei', 'v-amy', 58),
    pair('m-marguerite-olivia', 's-marguerite', 'v-olivia', 58),
    pair('m-helga-olivia', 's-helga', 'v-olivia', 58),
    pair('m-walter-olivia', 's-walter', 'v-olivia', 58),
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
    missedReason: 'volunteer_conflict',
    missedNote: null,
    createdAt: at(now, -9, 20),
  });

  // [v2 accounts] The new pairs talk twice a week, every week: "Connected".
  // Their ids start with c-v2-, so the c-seed- ids above never change.
  let v2n = 0;
  const steady = (seniorId, volunteerId, type, offset, hour, notes) => {
    for (const daysAgo of [1, 4, 8, 11, 15, 18, 22, 25, 29, 32, 36, 39, 43, 46, 50, 53]) {
      const when = at(now, -(daysAgo + offset), hour, 0);
      contacts.push({
        id: `c-v2-${++v2n}`,
        seniorId,
        volunteerId,
        type,
        status: 'completed',
        scheduledFor: when,
        completedAt: when,
        durationMinutes: 30,
        notes: notes[v2n % notes.length],
        createdAt: when,
      });
    }
  };
  steady('s-samira', 'v-jordan', 'phone', 0, 15, ['She taught me the Arabic word for mint.', 'Talked about her balcony garden.', '']);
  steady('s-thanh', 'v-kevin', 'phone', 0, 10, ['She sang part of an old song for me.', 'Talked about her tailor shop.', '']);
  steady('s-cing', 'v-david', 'phone', 0, 19, ['Talked about the choir concert.', 'She told me about her grandchildren.', '']);
  steady('s-aung', 'v-david', 'phone', 1, 19, ['He explained a chess opening.', 'Talked about the news.', '']);
  steady('s-mei', 'v-amy', 'video', 0, 15, ['She showed me a new ink painting.', 'We traded book ideas.', '']);
  steady('s-marguerite', 'v-olivia', 'phone', 0, 10, ['She shared her lemon tart recipe.', 'Talked about Lyon.', '']);
  steady('s-helga', 'v-olivia', 'phone', 1, 10, ['The roses are blooming.', 'Talked about her dachshunds.', '']);
  steady('s-walter', 'v-olivia', 'phone', 2, 10, ['He caught a bass at Morse Reservoir.', 'Talked about old delivery routes.', '']);

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

  // Ethan rescheduled the visit he missed for yesterday afternoon, but nobody
  // has marked whether it happened. Until someone does, it isn't contact, so
  // Hal stays "Isolation risk". Ethan's week asks "Did these calls happen?",
  // and the demo tour logs it with one click.
  contacts.push({
    id: `c-seed-${++n}`,
    seniorId: 's-harold',
    volunteerId: 'v-ethan',
    type: 'visit',
    status: 'scheduled',
    scheduledFor: at(now, -1, 15, 30),
    completedAt: null,
    durationMinutes: null,
    notes: 'Bring the box score from Friday night.',
    createdAt: at(now, -4, 18),
  });

  // [v2 accounts] Demo accounts, all @porchlight.example and all fictional.
  // Every one uses the shared demo password (see DEMO_PASSWORD above).
  const createdAt = at(now, -60, 9);
  const user = (first, name, role, more = {}) => ({
    id: `u-${first}`,
    email: `${first}@porchlight.example`,
    name,
    role,
    uiLanguage: 'en',
    password: { ...DEMO_PASSWORD },
    createdAt,
    ...more,
  });
  const users = [
    user('admin', 'Casey Reed', 'admin'),
    // seniors
    user('dorothy', 'Dorothy Jensen', 'senior', { seniorId: 's-dorothy' }),
    user('hal', 'Harold Whitaker', 'senior', { seniorId: 's-harold' }),
    user('rosa', 'Rosa Delgado', 'senior', { seniorId: 's-rosa', uiLanguage: 'es' }),
    user('eugene', 'Eugene Park', 'senior', { seniorId: 's-eugene' }),
    user('samira', 'Samira Haddad', 'senior', { seniorId: 's-samira', uiLanguage: 'ar' }),
    user('thanh', 'Thanh Nguyen', 'senior', { seniorId: 's-thanh' }),
    user('cing', 'Cing Sung', 'senior', { seniorId: 's-cing' }),
    user('aung', 'Aung Min', 'senior', { seniorId: 's-aung' }),
    user('mei', 'Mei Lin', 'senior', { seniorId: 's-mei' }),
    user('marguerite', 'Marguerite Dubois', 'senior', { seniorId: 's-marguerite' }),
    user('helga', 'Helga Becker', 'senior', { seniorId: 's-helga' }),
    user('walter', 'Walter Hayes', 'senior', { seniorId: 's-walter' }),
    // volunteers: maya@, ethan@, linda@, sam@, jordan@, kevin@, david@, amy@, olivia@, noah@
    ...volunteers.map((v) => user(v.name.split(' ')[0].toLowerCase(), v.name, 'volunteer', { volunteerId: v.id })),
    // family members
    user('mike', 'Mike Whitaker', 'family'),
    user('karen', 'Karen Jensen', 'family'),
    user('daniel', 'Daniel Delgado', 'family'),
    user('grace', 'Grace Park', 'family'),
    user('omar', 'Omar Haddad', 'family'),
    user('linh', 'Linh Nguyen', 'family'),
    user('ryan', 'Ryan Lin', 'family'),
    user('sophie', 'Sophie Dubois', 'family'),
    user('peter', 'Peter Becker', 'family'),
    user('ellen', 'Ellen Hayes', 'family'),
  ];
  const link = (first, seniorId, relationship, status = 'approved') => ({
    id: `fl-${first}`,
    userId: `u-${first}`,
    seniorId,
    relationship,
    status,
    createdAt,
    decidedAt: status === 'approved' ? createdAt : null,
  });
  const familyLinks = [
    link('mike', 's-harold', 'Son'),
    link('karen', 's-dorothy', 'Daughter'),
    link('daniel', 's-rosa', 'Son'),
    link('grace', 's-eugene', 'Daughter'),
    link('omar', 's-samira', 'Son'),
    link('linh', 's-thanh', 'Daughter'),
    link('ryan', 's-mei', 'Grandson'),
    link('sophie', 's-marguerite', 'Niece'),
    link('peter', 's-helga', 'Son'),
    link('ellen', 's-walter', 'Daughter', 'pending'), // waits on /admin/approvals
  ];

  return {
    meta: { schemaVersion: 2, seededAt: now.toISOString(), note: 'All people in this demo data are fictional.' },
    settings: { riskThresholdDays },
    seniors,
    volunteers,
    matches,
    contacts,
    sparkSets: [],
    // [v2] filled in by the accounts and translate modules (see src/store-core.js)
    users,
    sessions: [],
    familyLinks,
    messages: buildDemoMessages(now, matches),
    translations: {},
    usage: {},
  };
}
