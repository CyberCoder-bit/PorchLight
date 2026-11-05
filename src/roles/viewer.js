// Who is looking? (v2) Built from the signed-in account (src/auth), never
// from anything the browser can choose. No account means signed out: the
// visitor sees only the public website.
//
//   viewerFromUser(user, store) ->
//     { kind, id, name, label, home, person, userId, pending }
//   kind: 'coordinator' (an admin), 'senior', 'volunteer', or 'family'
//   id:   the senior's or volunteer's id; for family, their linked senior's id
//   pending: a volunteer not approved yet, or a family member whose link is
//            not approved yet. They get the 'pending' role (see ./access.js).

import { t } from '../i18n/index.js';

export const firstName = (p) => (p ? p.preferredName || String(p.name || '').split(' ')[0] : '');

// Never show a phone number, even one typed into a name or relationship field.
const PHONE = /\+?\(?\d[\d\s().-]{5,}\d/g;
export const noPhone = (text) => String(text ?? '').replace(PHONE, '[number hidden]').trim();

// "Son, lives in Phoenix" -> "son". Anything long, empty, or with digits -> "family".
export function relationWord(relationship) {
  const word = String(relationship ?? '').split(/[,;(]| - /)[0].trim();
  if (!word || word.length > 30 || /\d/.test(word)) return 'family';
  return word[0].toLowerCase() + word.slice(1);
}

export const PENDING_HOME = '/home';

export function viewerFromUser(user, store) {
  if (!user) return null;
  const base = { userId: user.id, name: noPhone(user.name), pending: false };
  if (user.role === 'admin') {
    return { ...base, kind: 'coordinator', id: null, label: t('auth.viewer.coordinator', { name: base.name }), home: '/admin', person: null };
  }
  if (user.role === 'volunteer') {
    const v = store.volunteer(user.volunteerId);
    if (!v) return null;
    const pending = (v.status || 'active') !== 'active';
    const id = v.id;
    return {
      ...base, kind: 'volunteer', id, person: v, pending,
      name: noPhone(v.name),
      label: t('auth.viewer.volunteer', { name: noPhone(v.name) }),
      home: pending ? PENDING_HOME : `/volunteers/${encodeURIComponent(id)}/week`,
    };
  }
  if (user.role === 'family') {
    const links = store.familyLinksForUser(user.id);
    const approved = links.find((l) => l.status === 'approved' && store.senior(l.seniorId));
    const link = approved || links.find((l) => l.status === 'pending') || links[0] || null;
    const s = link ? store.senior(link.seniorId) : null;
    const pending = !approved;
    return {
      ...base, kind: 'family', id: s ? s.id : null, person: s, pending,
      label: s
        ? t('auth.viewer.family', { name: base.name, senior: noPhone(firstName(s)) })
        : t('auth.viewer.familyNoSenior', { name: base.name }),
      home: pending ? PENDING_HOME : '/dashboard',
    };
  }
  if (user.role === 'senior') {
    const s = store.senior(user.seniorId);
    if (!s) return null;
    return {
      ...base, kind: 'senior', id: s.id, person: s,
      name: noPhone(s.name),
      label: noPhone(s.name),
      home: `/seniors/${encodeURIComponent(s.id)}`,
    };
  }
  return null;
}

// The pages a signed-in person can use, for the nav and the "not for you" page.
// `nav: false` items are listed on the "not for you" page only, so the nav never
// has two links marked as the current page.
export function pagesFor(viewer) {
  if (!viewer || viewer.kind === 'coordinator') return null;
  const account = { href: '/account', label: t('auth.nav.account'), key: 'account' };
  if (viewer.pending) {
    return [{ href: PENDING_HOME, label: t('auth.nav.waiting'), key: 'home' }, account, { href: '/help', label: 'Get help', key: 'help' }];
  }
  const id = encodeURIComponent(viewer.id);
  if (viewer.kind === 'volunteer') {
    return [
      { href: `/volunteers/${id}/week`, label: 'My week', key: 'volunteers' },
      { href: `/volunteers/${id}`, label: 'My profile', key: 'volunteers', nav: false },
      { href: '/contacts', label: 'Calls & Visits', key: 'contacts' },
      { href: '/messages', label: t('auth.nav.messages'), key: 'messages' },
      account,
      { href: '/help', label: 'Get help', key: 'help' },
    ];
  }
  const first = noPhone(firstName(viewer.person));
  if (viewer.kind === 'family') {
    return [
      { href: '/dashboard', label: 'Family Dashboard', key: 'dashboard' },
      { href: `/seniors/${id}`, label: `${first}'s page`, key: 'seniors' },
      { href: `/seniors/${id}/summary`, label: `${first}'s weekly summary`, key: 'dashboard', nav: false },
      account,
      { href: '/help', label: 'Get help', key: 'help' },
    ];
  }
  return [
    { href: `/seniors/${id}`, label: 'My page', key: 'seniors' },
    { href: '/messages', label: t('auth.nav.messages'), key: 'messages' },
    account,
    { href: '/help', label: 'Get help', key: 'help' },
  ];
}

// True for the coordinator (an admin), who sees every page and every row.
export const seesEverything = (viewer) => viewer?.kind === 'coordinator';
