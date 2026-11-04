// Who is looking? The DEMO sign-in keeps one cookie, `viewer`:
//   coordinator            sees everything
//   volunteer:<id>         a volunteer
//   family:<seniorId>      the family contact saved on that senior's profile
//   senior:<id>            a senior
// No cookie means demo mode: everything is visible, exactly as before sign-in
// existed. A value that no longer matches a real person (for example after a
// demo reset deleted them) also falls back to demo mode, never to a crash.
//
// This is NOT security: there are no passwords, and anyone can pick anyone.
// A real launch needs real accounts with passwords, which aren't built yet.

export const VIEWER_COOKIE = 'viewer';
export const VIEWER_COOKIE_SECONDS = 8 * 60 * 60; // a demo session lasts a working day

const firstName = (p) => (p ? p.preferredName || String(p.name || '').split(' ')[0] : '');

// Never show a phone number, even one typed into a name or relationship field.
const PHONE = /\+?\(?\d[\d\s().-]{5,}\d/g;
export const noPhone = (text) => String(text ?? '').replace(PHONE, '[number hidden]').trim();

// "Son, lives in Phoenix" -> "son". Anything long, empty, or with digits -> "family".
export function relationWord(relationship) {
  const word = String(relationship ?? '').split(/[,;(]| - /)[0].trim();
  if (!word || word.length > 30 || /\d/.test(word)) return 'family';
  return word[0].toLowerCase() + word.slice(1);
}

const hasFamily = (senior) => Boolean(senior?.caregiver?.name && String(senior.caregiver.name).trim());

// Cookie value -> viewer object, or null for demo mode.
//   { kind, id, value, name, label, home, person }
export function viewerFromCookie(value, store) {
  if (typeof value !== 'string' || value.length > 120) return null;
  if (value === 'coordinator') {
    return { kind: 'coordinator', id: null, value, name: 'Coordinator', label: 'the coordinator', home: '/attention', person: null };
  }
  const colon = value.indexOf(':');
  if (colon < 1) return null;
  const kind = value.slice(0, colon);
  const id = value.slice(colon + 1);
  if (!id) return null;
  if (kind === 'volunteer') {
    const v = store.volunteer(id);
    if (!v) return null;
    return { kind, id, value, name: noPhone(v.name), label: `${noPhone(v.name)} (volunteer)`, home: `/volunteers/${encodeURIComponent(id)}/week`, person: v };
  }
  if (kind === 'family') {
    const s = store.senior(id);
    if (!hasFamily(s)) return null;
    const name = noPhone(s.caregiver.name);
    return {
      kind, id, value, name,
      label: `${name} (${noPhone(firstName(s))}'s family)`,
      home: '/dashboard',
      person: s,
    };
  }
  if (kind === 'senior') {
    const s = store.senior(id);
    if (!s) return null;
    return { kind, id, value, name: noPhone(s.name), label: noPhone(s.name), home: `/seniors/${encodeURIComponent(id)}`, person: s };
  }
  return null;
}

// Everything the sign-in page offers, A to Z. Labels never include phone numbers.
export function signInChoices(store) {
  const byLabel = (a, b) => a.label.localeCompare(b.label);
  return {
    volunteers: store.volunteers
      .map((v) => ({ value: `volunteer:${v.id}`, label: noPhone(v.name) }))
      .sort(byLabel),
    family: store.seniors
      .filter(hasFamily)
      .map((s) => ({
        value: `family:${s.id}`,
        label: `${noPhone(s.caregiver.name)} (${noPhone(firstName(s))}'s ${relationWord(s.caregiver.relationship)})`,
      }))
      .sort(byLabel),
    seniors: store.seniors
      .map((s) => ({ value: `senior:${s.id}`, label: noPhone(s.name) }))
      .sort(byLabel),
  };
}

// The pages a signed-in person can use, for the nav and the "not for you" page.
// `nav: false` items are listed on the "not for you" page only, so the nav never
// has two links marked as the current page.
export function pagesFor(viewer) {
  if (!viewer || viewer.kind === 'coordinator') return null;
  const id = encodeURIComponent(viewer.id);
  if (viewer.kind === 'volunteer') {
    return [
      { href: `/volunteers/${id}/week`, label: 'My week', key: 'volunteers' },
      { href: `/volunteers/${id}`, label: 'My profile', key: 'volunteers', nav: false },
      { href: '/contacts', label: 'Calls & Visits', key: 'contacts' },
      { href: '/help', label: 'Get help', key: 'help' },
    ];
  }
  const first = noPhone(firstName(viewer.person));
  if (viewer.kind === 'family') {
    return [
      { href: '/dashboard', label: 'Family Dashboard', key: 'dashboard' },
      { href: `/seniors/${id}`, label: `${first}'s page`, key: 'seniors' },
      { href: `/seniors/${id}/summary`, label: `${first}'s weekly summary`, key: 'dashboard', nav: false },
      { href: '/help', label: 'Get help', key: 'help' },
    ];
  }
  return [
    { href: `/seniors/${id}`, label: 'My page', key: 'seniors' },
    { href: '/help', label: 'Get help', key: 'help' },
  ];
}

// True when the person sees every page and every row (demo mode or coordinator).
export const seesEverything = (viewer) => !viewer || viewer.kind === 'coordinator';
