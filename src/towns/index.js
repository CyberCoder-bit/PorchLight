// Towns: PorchLight statewide, filtered by town.
//
// Every senior and volunteer has an optional `town` (a name from TOWNS below).
// Old data without one counts as COMMUNITY.town (Carmel for the demo), so
// existing data files keep working with no schema change.
//
// ONE TIME ZONE PER DEPLOYMENT (why the town list is filtered)
//   Every date and time in PorchLight goes through one clock, src/tz.js, set
//   from COMMUNITY.timeZone. "4:00 PM" typed into a form means 4:00 PM in that
//   zone. Indiana has two zones: 80 counties use Eastern time and 12 use
//   Central time (INDIANA_CENTRAL_TIME_COUNTIES in src/community.js, from
//   in.gov). So one deployment can serve every town whose county shares its
//   zone, and no others:
//     - the Carmel deployment (Eastern) serves towns in the 80 Eastern counties;
//     - a second deployment with a Central-time profile (for example the
//       `evansville` profile in src/community.js) serves the 12 Central counties.
//   So the time-zone design covers all 92 counties with two deployments. The
//   town LIST is not complete yet: it has 66 towns in 52 counties, and adding a
//   town is one line below (check its county on in.gov first). The town picker and the town filter
//   only offer DEPLOYMENT_TOWNS: the towns whose county is in this deployment's
//   zone, decided by timeZoneForCounty(). A town on the other zone is rejected
//   by the form, never silently saved with the wrong clock.
//
// THE TOWN LIST
//   A few dozen well-known Indiana cities and towns, in both time zones. Most
//   are county seats, checked against the Indiana Historical Bureau's county
//   table on in.gov (TOWN_SOURCES.countySeats). The four Hamilton County cities
//   are checked against Visit Hamilton County, the county's tourism bureau
//   (TOWN_SOURCES.hamiltonCounty). The rest are large cities whose county is
//   not in doubt. To add a town: add { name, county } with the county spelled
//   'Name County' and checked on an official page. Leave out anything you
//   can't verify. No AI is involved: this is fixed data.

import { COMMUNITY, timeZoneForCounty } from '../community.js';
import { t } from '../i18n/index.js'; // [v2 i18n]

export const TOWNS_CHECKED = '2026-11-04';
export const TOWN_SOURCES = Object.freeze({
  countySeats:
    'https://www.in.gov/history/about-indiana-history-and-trivia/explore-indiana-history-by-topic/origin-of-indiana-county-names/',
  hamiltonCounty: 'https://visithamiltoncounty.com/cities/',
});

// { name, county }. `seat: true` marks a county seat (checked on the in.gov table).
export const TOWNS = Object.freeze(
  [
    // ----- Hamilton County (the demo community) -----
    { name: 'Carmel', county: 'Hamilton County' },
    { name: 'Fishers', county: 'Hamilton County' },
    { name: 'Noblesville', county: 'Hamilton County', seat: true },
    { name: 'Westfield', county: 'Hamilton County' },

    // ----- Eastern time: central Indiana -----
    { name: 'Indianapolis', county: 'Marion County', seat: true },
    { name: 'Zionsville', county: 'Boone County' },
    { name: 'Lebanon', county: 'Boone County', seat: true },
    { name: 'Greenwood', county: 'Johnson County' },
    { name: 'Franklin', county: 'Johnson County', seat: true },
    { name: 'Plainfield', county: 'Hendricks County' },
    { name: 'Danville', county: 'Hendricks County', seat: true },
    { name: 'Greenfield', county: 'Hancock County', seat: true },
    { name: 'Shelbyville', county: 'Shelby County', seat: true },
    { name: 'Martinsville', county: 'Morgan County', seat: true },
    { name: 'Anderson', county: 'Madison County', seat: true },
    { name: 'Muncie', county: 'Delaware County', seat: true },
    { name: 'Kokomo', county: 'Howard County', seat: true },
    { name: 'Frankfort', county: 'Clinton County', seat: true },
    { name: 'New Castle', county: 'Henry County', seat: true },
    { name: 'Lafayette', county: 'Tippecanoe County', seat: true },
    { name: 'West Lafayette', county: 'Tippecanoe County' },
    { name: 'Crawfordsville', county: 'Montgomery County', seat: true },
    { name: 'Greencastle', county: 'Putnam County', seat: true },
    { name: 'Terre Haute', county: 'Vigo County', seat: true },
    { name: 'Richmond', county: 'Wayne County', seat: true },

    // ----- Eastern time: northern Indiana -----
    { name: 'Fort Wayne', county: 'Allen County', seat: true },
    { name: 'South Bend', county: 'St. Joseph County', seat: true },
    { name: 'Mishawaka', county: 'St. Joseph County' },
    { name: 'Elkhart', county: 'Elkhart County' },
    { name: 'Goshen', county: 'Elkhart County', seat: true },
    { name: 'Warsaw', county: 'Kosciusko County', seat: true },
    { name: 'Auburn', county: 'DeKalb County', seat: true },
    { name: 'Angola', county: 'Steuben County', seat: true },
    { name: 'Huntington', county: 'Huntington County', seat: true },
    { name: 'Wabash', county: 'Wabash County', seat: true },
    { name: 'Marion', county: 'Grant County', seat: true },
    { name: 'Peru', county: 'Miami County', seat: true },
    { name: 'Logansport', county: 'Cass County', seat: true },

    // ----- Eastern time: southern Indiana -----
    { name: 'Bloomington', county: 'Monroe County', seat: true },
    { name: 'Columbus', county: 'Bartholomew County', seat: true },
    { name: 'Greensburg', county: 'Decatur County', seat: true },
    { name: 'Bedford', county: 'Lawrence County', seat: true },
    { name: 'Madison', county: 'Jefferson County', seat: true },
    { name: 'Lawrenceburg', county: 'Dearborn County', seat: true },
    { name: 'Jeffersonville', county: 'Clark County', seat: true },
    { name: 'New Albany', county: 'Floyd County', seat: true },
    { name: 'Vincennes', county: 'Knox County', seat: true },
    { name: 'Washington', county: 'Daviess County', seat: true },
    // Jasper the city is in Dubois County (Eastern), not Jasper County (Central).
    { name: 'Jasper', county: 'Dubois County', seat: true },

    // ----- Central time: northwest Indiana -----
    { name: 'Gary', county: 'Lake County' },
    { name: 'Hammond', county: 'Lake County' },
    { name: 'Crown Point', county: 'Lake County', seat: true },
    { name: 'Valparaiso', county: 'Porter County', seat: true },
    { name: 'Portage', county: 'Porter County' },
    { name: 'Michigan City', county: 'LaPorte County' },
    { name: 'La Porte', county: 'LaPorte County', seat: true },
    { name: 'Knox', county: 'Starke County', seat: true },
    { name: 'Rensselaer', county: 'Jasper County', seat: true },
    { name: 'Kentland', county: 'Newton County', seat: true },

    // ----- Central time: southwest Indiana -----
    { name: 'Evansville', county: 'Vanderburgh County', seat: true },
    { name: 'Boonville', county: 'Warrick County', seat: true },
    { name: 'Newburgh', county: 'Warrick County' },
    { name: 'Princeton', county: 'Gibson County', seat: true },
    { name: 'Mount Vernon', county: 'Posey County', seat: true },
    { name: 'Rockport', county: 'Spencer County', seat: true },
    { name: 'Tell City', county: 'Perry County', seat: true },
  ].map((t) => Object.freeze({ ...t, timeZone: timeZoneForCounty(t.county) }))
);

const byName = (a, b) => a.name.localeCompare(b.name);
const key = (name) => String(name ?? '').trim().toLowerCase();
const townIndex = new Map(TOWNS.map((t) => [key(t.name), t]));

// The town record for a name ('westfield' or 'Westfield'), or null.
export function townByName(name) {
  return townIndex.get(key(name)) || null;
}

// 'Westfield' -> 'Hamilton County'. Null for a name that isn't on the list.
export function countyOf(name) {
  return townByName(name)?.county || null;
}

// Every listed town whose county uses `zone`, A to Z.
export function townsForTimeZone(zone) {
  return TOWNS.filter((t) => t.timeZone === zone).sort(byName);
}

// The towns THIS deployment serves: the ones on its clock (see the top of this file).
export const DEPLOYMENT_TOWNS = Object.freeze(townsForTimeZone(COMMUNITY.timeZone));
const deploymentIndex = new Map(DEPLOYMENT_TOWNS.map((t) => [key(t.name), t]));

export function deploymentTownByName(name) {
  return deploymentIndex.get(key(name)) || null;
}

// A person's town. Old data without a `town` belongs to the community's own town.
export function townOf(person) {
  return (person && typeof person.town === 'string' && person.town.trim()) || COMMUNITY.town;
}

// A person's county, or null if their town isn't on the list.
export function countyOfPerson(person) {
  return countyOf(townOf(person));
}

// 'Westfield (Hamilton County)', or just the town if its county is unknown.
export function townLabel(person) {
  const town = townOf(person);
  const county = countyOf(town);
  return county ? `${town} (${county})` : town;
}

// 'Near the Monon Trail, Carmel', or 'Carmel' with no neighborhood.
export function placeText(person) {
  const town = townOf(person);
  const hood = person && typeof person.neighborhood === 'string' ? person.neighborhood.trim() : '';
  return hood ? `${hood}, ${town}` : town;
}

// ----- forms and filters -----

const firstString = (v) => (typeof v === 'string' ? v.trim() : Array.isArray(v) ? String(v[0] ?? '').trim() : '');

// For validateSenior / validateVolunteer. Adds `values.town`, or `errors.town`
// for a town this deployment doesn't serve. A form without a town field (an old
// form) changes nothing, so the saved town (or the default) is kept.
export function checkTown(body, values, errors) {
  const raw = firstString(body?.town);
  if (!raw) return;
  const town = deploymentTownByName(raw);
  if (town) values.town = town.name;
  else errors.town = t('core.towns.chooseFromList');
}

// ?town=Westfield -> 'Westfield'. Anything not on this deployment's list is
// ignored (null), so a mistyped or hostile value just shows every town.
export function townFromQuery(query) {
  return deploymentTownByName(firstString(query?.town))?.name || null;
}

// Keep the rows whose person lives in `town` (all rows when town is null).
export function rowsInTown(rows, town, personOf = (r) => r) {
  if (!town) return rows;
  return rows.filter((r) => key(townOf(personOf(r))) === key(town));
}
