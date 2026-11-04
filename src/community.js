// The community profile: everything that changes from one Indiana community to
// another lives here, so PorchLight can launch in a new town by adding a profile
// instead of editing code all over the app. Carmel (Hamilton County) is the
// first community and the demo data.
//
// LAUNCH PORCHLIGHT IN ANOTHER INDIANA TOWN
//   1. Copy the `evansville` profile below and give it a new key and id
//      (lowercase, no spaces), for example `kokomo`.
//   2. Fill in `town`, `county` (e.g. 'Howard County'), and `state`.
//   3. Set `timeZone` to timeZoneForCounty('<Name> County'). That gives
//      Central time (America/Chicago) for the 12 counties in
//      INDIANA_CENTRAL_TIME_COUNTIES and Eastern time
//      (America/Indiana/Indianapolis) everywhere else. Check the spelling
//      against the in.gov list cited below.
//   4. Fill in `help` with the county's Area Agency on Aging. Find it on the
//      state's list (AAA_DIRECTORY_URL), then copy its name, website, and phone
//      numbers from that official page or the agency's own site. Give every
//      entry a `source` URL and a `checked` date. If you can't verify a phone
//      number, leave it out. Never guess. Indiana 211, the statewide agency
//      list, and the 911 safety line are added for every community.
//   5. Optional: add a few `localTouches` (real, friendly, non-commercial local
//      places or events) for the offline conversation sparks. Leave it [] to
//      use the statewide Indiana touches in src/sparks/templates.js.
//   6. Point the app at it: export const COMMUNITY = COMMUNITIES.<key>;
//   7. Replace the demo people in src/seed.js (they are fictional and set in
//      Carmel), then run `npm test`.
//
// CONTRACT (other modules depend on this shape; add fields, don't rename them):
//   id            short id, e.g. 'carmel'
//   town          'Carmel'
//   county        'Hamilton County'
//   state         'Indiana'
//   timeZone      IANA zone used by src/tz.js for every date and time
//   localTouches  real local references the offline sparks can mention:
//                 [{ text, when, interest? }]. `when` is 'any', a season
//                 ('winter', 'spring', 'summer', 'fall'), or a month ('jan'...'dec').
//                 With `interest` (an id from src/vocab.js) the touch joins that
//                 interest's sparks; without it, the general sparks. {name} and
//                 {town} placeholders are filled in.
//   help          the community's own help resources (see localHelpFor)
//
// Everything below was checked on the official page named in its `source`.

export const CHECKED = '2026-11-03';

// ----- time zones -----

export const INDIANA_EASTERN_TIME = 'America/Indiana/Indianapolis';
export const INDIANA_CENTRAL_TIME = 'America/Chicago';

// The 12 Indiana counties on Central time. Every other county is on Eastern.
// Source: in.gov, "Indiana Time Zone Information" (page updated February 26,
// 2025), checked 2026-11-03. Other sites disagree about Perry vs. Pike County;
// in.gov lists Perry (and not Pike), so we follow in.gov.
export const INDIANA_TIME_ZONE_SOURCE =
  'https://faqs.in.gov/hc/en-us/articles/115005225448-Indiana-Time-Zone-Information';
export const INDIANA_CENTRAL_TIME_COUNTIES = Object.freeze([
  // Northwest Indiana
  'Jasper', 'Lake', 'LaPorte', 'Newton', 'Porter', 'Starke',
  // Southwest Indiana
  'Gibson', 'Perry', 'Posey', 'Spencer', 'Vanderburgh', 'Warrick',
]);

const countyKey = (county) => String(county).toLowerCase().replace(/\s+county$/, '').replace(/[^a-z]/g, '');
const CENTRAL_KEYS = new Set(INDIANA_CENTRAL_TIME_COUNTIES.map(countyKey));

// 'Vanderburgh County' -> 'America/Chicago'; 'Hamilton County' -> 'America/Indiana/Indianapolis'.
// Accepts 'LaPorte', 'La Porte', or 'LaPorte County'.
export function timeZoneForCounty(county) {
  return CENTRAL_KEYS.has(countyKey(county)) ? INDIANA_CENTRAL_TIME : INDIANA_EASTERN_TIME;
}

// ----- help resources -----
// Each entry:
//   { id, kind, name, shortName, description, situation, whenToUse, phone, phoneLabel, phones, textLine,
//     url, urlLabel, source, sources, checked }
//   shortName what to call it in a sentence ("Call CICOA at ...")
//   situation a short "when to call" line for the /help page's quick guide
//   urlLabel  optional link text for `url` (otherwise the site's name)
//   kind      'aaa' (the community's Area Agency on Aging), 'aaa-directory',
//             'info-line' (Indiana 211), or 'emergency' (911)
//   phone     the main number to call (display text), or null if none was verified
//   phones    every verified number: [{ label, number, source }]
//   textLine  optional plain-text instructions for texting
//   source    the official page the facts came from; sources lists every page used

// The FSSA list of Area Agencies on Aging. in.gov/fssa/da/area-agencies-on-aging/
// redirects here.
export const AAA_DIRECTORY_URL = 'https://www.in.gov/fssa/ddars/bba/area-agencies-on-aging/';
const INDIANA_211_SOURCE = 'https://www.in.gov/fssa/indiana-211/';
const TEXT_911_SOURCE = 'https://www.in911.net/text-for-911.html';

// Added for every Indiana community, after its own resources.
export const INDIANA_HELP = Object.freeze({
  in211: {
    id: 'in211',
    kind: 'info-line',
    name: 'Indiana 211',
    shortName: 'Indiana 211',
    description:
      'A free, confidential helpline from the State of Indiana (FSSA). A community navigator listens and points you to local help, such as food, housing and utility bills, health care, counseling and support groups, and legal aid.',
    situation: "You're not sure who to call, or you need help with food, bills, or housing.",
    whenToUse:
      "You're not sure who to call, or the need isn't only about aging, like food, bills, or housing. You can call any time, day or night.",
    phone: '211',
    phoneLabel: 'Dial 2-1-1 (24 hours a day, 7 days a week)',
    phones: [
      { label: 'Dial 2-1-1 (24 hours a day, 7 days a week)', number: '211', source: INDIANA_211_SOURCE },
      { label: 'Or call (24 hours a day, 7 days a week)', number: '866-211-9966', source: INDIANA_211_SOURCE },
    ],
    textLine: 'Text your ZIP code to 898-211 (Monday to Friday, 8 a.m. to 5 p.m.).',
    url: 'https://in211.org/',
    source: INDIANA_211_SOURCE,
    sources: [INDIANA_211_SOURCE],
    checked: CHECKED,
  },
  aaaDirectory: {
    id: 'in-aaa-directory',
    kind: 'aaa-directory',
    name: 'Find the Area Agency on Aging for any Indiana county',
    shortName: "the State of Indiana's toll-free line",
    description:
      "Indiana's Area Agencies on Aging help older adults and people with disabilities find services and plan care. The State of Indiana (FSSA) keeps a list that shows which agency serves each area.",
    situation: 'Your loved one lives in a different Indiana county.',
    whenToUse:
      'Your loved one lives in a different Indiana county, or you are not sure which agency serves their area.',
    phone: '800-713-9023',
    phoneLabel: 'FSSA toll-free line, to apply for services',
    phones: [{ label: 'FSSA toll-free line, to apply for services', number: '800-713-9023', source: AAA_DIRECTORY_URL }],
    textLine: null,
    url: AAA_DIRECTORY_URL,
    urlLabel: "The state's list of Area Agencies on Aging (in.gov)",
    source: AAA_DIRECTORY_URL,
    sources: [AAA_DIRECTORY_URL],
    checked: CHECKED,
  },
  emergency: {
    id: 'emergency-911',
    kind: 'emergency',
    name: 'Emergency: 911',
    shortName: '911',
    description: 'If someone may be in danger, call 911.',
    situation: 'Someone may be in danger right now.',
    whenToUse: 'Someone is hurt, very sick, missing, or not safe right now. Call first, then tell family and the coordinator.',
    phone: '911',
    phoneLabel: 'Call 911',
    phones: [{ label: 'Call 911', number: '911', source: null }],
    textLine:
      "Make a voice call when you can. If you can't, or if talking would put you in danger, you can text 911. Indiana's Statewide 911 Board says text-to-911 works in all 92 Indiana counties.",
    url: null,
    source: TEXT_911_SOURCE,
    sources: [TEXT_911_SOURCE],
    checked: CHECKED,
  },
});

// ----- communities -----

export const COMMUNITIES = {
  carmel: {
    id: 'carmel',
    town: 'Carmel',
    county: 'Hamilton County',
    state: 'Indiana',
    timeZone: INDIANA_EASTERN_TIME, // Hamilton County is not on the in.gov Central list
    localTouches: [
      { text: 'What do you think of the Monon Trail? Have you seen how busy it gets on nice days?', when: 'any' },
      { text: 'Have you ever been to a show at the Palladium? What would you love to see there?', when: 'any' },
      { text: 'Have you been to the Carmel Farmers Market? What would you buy first?', when: 'summer' },
      {
        text: 'The Christkindlmarkt in Carmel opens for the holidays soon. What holiday traditions did you love growing up?',
        when: 'nov',
      },
      {
        text: 'Have you been to the Christkindlmarkt in Carmel? What holiday traditions did you love growing up?',
        when: 'dec',
      },
      {
        text: 'Have you ever fished Morse or Geist Reservoir? How do they compare to where you grew up?',
        when: 'summer',
        interest: 'fishing',
      },
      {
        text: 'Have you been to the Carmel Arts & Design District? Which galleries are worth a visit?',
        when: 'any',
        interest: 'art',
      },
    ],
    help: [
      {
        id: 'cicoa',
        kind: 'aaa',
        name: 'CICOA Aging & In-Home Solutions',
        shortName: 'CICOA',
        // FSSA lists CICOA (Planning and Service Area 8) as covering these counties.
        counties: ['Marion', 'Boone', 'Hamilton', 'Hancock', 'Shelby', 'Johnson', 'Morgan', 'Hendricks'],
        description:
          'The Area Agency on Aging for Hamilton County and seven nearby counties. It helps older adults, people with disabilities, and caregivers with things like meals, rides, making a home safer, and care at home.',
        situation: 'An older adult in Hamilton County needs more help at home, like meals, rides, or care.',
        whenToUse:
          'An older adult needs more help than calls and visits can give: meals, rides, help at home, or advice about long-term care. Family members and caregivers can call too.',
        phone: '317-803-6131',
        phoneLabel: 'Resource Center: a free service to talk about long-term care needs',
        phones: [
          {
            label: 'Resource Center: a free service to talk about long-term care needs',
            number: '317-803-6131',
            source: 'https://cicoa.org/',
          },
          { label: 'Main office', number: '317-254-5465', source: AAA_DIRECTORY_URL },
          { label: 'Resource Center, toll-free', number: '800-432-2422', source: AAA_DIRECTORY_URL },
        ],
        textLine: null,
        url: 'https://cicoa.org/',
        source: AAA_DIRECTORY_URL,
        sources: [AAA_DIRECTORY_URL, 'https://cicoa.org/'],
        checked: CHECKED,
      },
    ],
  },

  // A second sample profile in a Central-time county. Data only: it is not
  // the default and has no demo data. Its sparks use the statewide Indiana
  // touches because localTouches is empty.
  // Evansville is in Vanderburgh County (https://www.evansvillegov.org/, the
  // City of Evansville and Vanderburgh County site), which in.gov lists as
  // Central time.
  evansville: {
    id: 'evansville',
    town: 'Evansville',
    county: 'Vanderburgh County',
    state: 'Indiana',
    timeZone: INDIANA_CENTRAL_TIME,
    localTouches: [],
    help: [
      {
        id: 'swirca',
        kind: 'aaa',
        name: 'SWIRCA & More',
        shortName: 'SWIRCA & More',
        // FSSA lists SWIRCA & More (Planning and Service Area 16) as covering these counties.
        counties: ['Gibson', 'Perry', 'Posey', 'Spencer', 'Vanderburgh', 'Warrick'],
        description:
          'The Area Agency on Aging for Vanderburgh County and five nearby counties. It helps older adults and people with disabilities find services and plan care.',
        situation: 'An older adult in Vanderburgh County needs more help at home or advice about care.',
        whenToUse:
          'An older adult needs more help than calls and visits can give, like help at home or advice about long-term care.',
        phone: '812-464-7800',
        phoneLabel: 'Main phone',
        phones: [
          { label: 'Main phone', number: '812-464-7800', source: AAA_DIRECTORY_URL },
          { label: 'Resource Center', number: '812-464-7817', source: 'https://swirca.org/' },
          { label: 'Toll-free', number: '800-253-2188', source: AAA_DIRECTORY_URL },
        ],
        textLine: null,
        url: 'https://swirca.org/',
        source: AAA_DIRECTORY_URL,
        sources: [AAA_DIRECTORY_URL, 'https://swirca.org/'],
        checked: CHECKED,
      },
    ],
  },
};

// The community this deployment serves.
export const COMMUNITY = COMMUNITIES.carmel;

// Help for a community, most specific first: its own Area Agency on Aging,
// then Indiana 211, the statewide agency list, and the 911 safety line.
// Each entry has { id, name, description, phone, url, source, checked } plus
// the extra fields described above. Filter on `kind` to pick some of them,
// e.g. kind !== 'emergency'. No AI is involved at run time: this is fixed
// data copied from the official pages cited with each entry.
export function localHelpFor(community = COMMUNITY) {
  return [...(community.help || []), INDIANA_HELP.in211, INDIANA_HELP.aaaDirectory, INDIANA_HELP.emergency];
}
