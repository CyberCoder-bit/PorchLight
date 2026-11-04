// The community profile: everything that changes from one Indiana community to
// another lives here, so PorchLight can launch in a new town by adding a profile
// instead of editing code all over the app.
//
// CONTRACT (other modules depend on this shape; add fields, don't rename them):
//   id          short id, e.g. 'carmel'
//   town        'Carmel'
//   county      'Hamilton County'
//   state       'Indiana'
//   timeZone    IANA zone used by src/tz.js for every date and time
//   localTouches  short, real local references the offline sparks can mention
//   help        local help resources (see localHelpFor)

export const COMMUNITIES = {
  carmel: {
    id: 'carmel',
    town: 'Carmel',
    county: 'Hamilton County',
    state: 'Indiana',
    timeZone: 'America/Indiana/Indianapolis',
    localTouches: [],
    help: [],
  },
};

// The community this deployment serves.
export const COMMUNITY = COMMUNITIES.carmel;

// Local help for a community, most specific first. Each entry:
//   { id, name, description, phone, url, source, checked }
// STUB: to be replaced with verified, cited resources.
export function localHelpFor(community = COMMUNITY) {
  return [
    ...community.help,
    {
      id: 'in211',
      name: 'Indiana 211',
      description: 'Free, confidential help finding local services anywhere in Indiana.',
      phone: '211',
      url: null,
      source: null,
      checked: null,
    },
  ];
}
