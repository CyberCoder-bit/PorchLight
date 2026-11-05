// Account routes (v2). Registered by registerRoles() (src/roles/index.js),
// so the guard checks each one like any other route.
//
//   GET/POST /sign-in          email and password
//   POST     /sign-in/demo     one-click demo accounts (never an admin)
//   POST     /sign-out         ends the session
//   GET      /sign-up          pick senior, volunteer, or family
//   GET/POST /sign-up/senior   (?helper=1: a family member signs up a senior they help)
//   GET/POST /sign-up/volunteer, /sign-up/family
//   GET/POST /account          name, interface language, spoken languages
//   GET      /home             your home page, or "waiting for approval"
//   GET      /admin/approvals  approve or decline volunteers and family links
//   POST     /admin/approvals/volunteers/:id, /admin/approvals/family/:id
//
// A role never comes from the form: each sign-up page makes one kind of
// account, and nothing here can make an admin. No AI is involved.

import { hashPassword, verifyPassword, wasteTime } from './password.js';
import { SESSION_COOKIE, createSession, endSession, sessionCookie, clearSessionCookie } from './session.js';
import { createLimits, clientIp } from './limits.js';
import { normalizeEmail, checkEmail, checkPassword, passwordFrom } from './validate.js';
import {
  signInPage, tooManyPage, signUpChoicePage, seniorSignUpPage, volunteerSignUpPage, familySignUpPage,
  accountPage, waitingPage, approvalsPage,
} from './views.js';
import { viewerFromUser } from '../roles/viewer.js';
import { can } from '../roles/access.js';
import { t, setCurrentLang, currentLang, isUiLanguage } from '../i18n/index.js';
import { languageFieldset, readLanguages, languagesOf } from '../i18n/fields.js';

export const DEMO_ACCOUNTS = Object.freeze({
  senior: 'hal@porchlight.example',
  'senior-ar': 'samira@porchlight.example',
  volunteer: 'ethan@porchlight.example',
  'volunteer-translate': 'jordan@porchlight.example',
  family: 'mike@porchlight.example',
});
export const SEED_ADMIN_EMAIL = 'admin@porchlight.example';

// Family codes: no look-alike characters (no I, L, O, 0, or 1).
export const FAMILY_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const normalizeFamilyCode = (v) => (typeof v === 'string' ? v.toUpperCase().replace(/[\s-]/g, '') : '');
export function newFamilyCode(store) {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const code = [...bytes].map((b) => FAMILY_CODE_ALPHABET[b % FAMILY_CODE_ALPHABET.length]).join('');
    if (!store.seniors.some((s) => s.familyCode === code)) return code;
  }
}

// The language fields come from src/i18n/fields.js.
// While they draw nothing, saving a form must not wipe the languages we have.
const languageFieldsReady = () => String(languageFieldset({ values: {}, errors: {} }) || '').trim() !== '';

export function registerAuth(router, ctx) {
  const { store, render, str, safeBack, chars, isInvisible } = ctx;
  const limits = createLimits();

  // Flash messages, looked up when shown so they follow the reader's language.
  for (const [key, textKey] of Object.entries({
    signed_in: 'auth.flash.signedIn', signed_out: 'auth.flash.signedOut', signed_up: 'auth.flash.signedUp',
    account_saved: 'auth.flash.accountSaved', approved: 'auth.flash.approved', declined: 'auth.flash.declined',
  })) {
    Object.defineProperty(ctx.flashMessages, key, { get: () => t(textKey), enumerable: true, configurable: true });
  }

  const tooMany = (req, res, kind) =>
    render(req, res, { title: t('auth.tooMany.title'), body: tooManyPage({ kind }), status: 429 });

  // Sign this person in: end any old session first, then start a new one.
  async function startSession(req, res, user) {
    const old = req.cookies[SESSION_COOKIE];
    if (old) await endSession(store, old);
    sessionCookie(res, req, await createSession(store, user.id));
    setCurrentLang(user.uiLanguage);
    return viewerFromUser(user, store);
  }

  // ?next= must be a plain path on this site that this person may open.
  const nextFor = (viewer, value) => {
    const next = safeBack(value);
    if (!next) return null;
    return can(viewer, 'GET', next.split('#')[0].split('?')[0], { store }) ? next : null;
  };

  const nameError = (value, errors, field) => {
    if (isInvisible(value)) errors[field] = t('auth.errors.nameMissing');
    else if (chars(value) > 80) errors[field] = t('auth.errors.nameLong');
  };

  // ----- sign in and out -----

  const showSignIn = (req, res, { values = {}, errors = {} } = {}) =>
    render(req, res, {
      title: Object.keys(errors).length ? t('auth.fixForm', { title: t('auth.signIn.title') }) : t('auth.signIn.title'),
      active: 'sign-in',
      flash: Object.keys(errors).length ? false : undefined,
      body: signInPage({ viewer: req.viewer, values, errors, next: safeBack(values.next ?? req.query.next) }),
    });

  router.get('/sign-in', (req, res) => showSignIn(req, res));

  router.post('/sign-in', async (req, res) => {
    const email = normalizeEmail(str(req.body.email));
    const password = passwordFrom(req.body.password);
    const values = { email, next: str(req.body.next) };
    const key = `${email}|${clientIp(req)}`;
    if (limits.signIn.blocked(key)) return tooMany(req, res, 'signIn');
    // Count the try BEFORE the slow password check (an await), so many tries
    // arriving at once can't all slip under the limit (V2-B-03). A right
    // password clears the count.
    limits.signIn.hit(key);
    const user = store.userByEmail(email);
    const ok = user ? await verifyPassword(password, user.password) : await wasteTime(password);
    if (!ok || !viewerFromUser(user, store)) {
      return showSignIn(req, res, { values, errors: { email: t('auth.errors.wrongPassword') } });
    }
    limits.signIn.clear(key);
    const viewer = await startSession(req, res, user);
    res.redirect(nextFor(viewer, values.next) || `${viewer.home}?msg=signed_in`);
  });

  router.post('/sign-in/demo', async (req, res) => {
    const email = DEMO_ACCOUNTS[str(req.body.as)];
    const user = email ? store.userByEmail(email) : null;
    if (!user || user.role === 'admin') return showSignIn(req, res, { errors: { email: t('auth.errors.demoMissing') } });
    const viewer = await startSession(req, res, user);
    res.redirect(`${viewer.home}?msg=signed_in`);
  });

  router.post('/sign-out', async (req, res) => {
    await endSession(store, req.cookies[SESSION_COOKIE]);
    clearSessionCookie(res, req);
    res.redirect('/?msg=signed_out');
  });

  router.get('/home', (req, res) => {
    const viewer = req.viewer;
    if (!viewer) return res.redirect('/sign-in');
    if (!viewer.pending) return res.redirect(viewer.home);
    const declined =
      viewer.kind === 'volunteer'
        ? viewer.person?.status === 'declined'
        : store.familyLinksForUser(viewer.userId).every((l) => l.status === 'declined');
    render(req, res, { title: t('auth.waiting.title'), active: 'home', body: waitingPage({ viewer, declined }) });
  });

  // ----- sign up -----

  router.get('/sign-up', (req, res) => render(req, res, { title: t('auth.signUp.title'), body: signUpChoicePage() }));

  // Email and password checks shared by every sign-up form.
  function checkAccount(body, errors, { emailField = 'email', passwordField = 'password' } = {}) {
    const email = normalizeEmail(str(body[emailField]));
    const password = passwordFrom(body[passwordField]);
    checkEmail(email, errors, emailField);
    if (!errors[emailField] && store.userByEmail(email)) errors[emailField] = t('auth.errors.emailTaken');
    checkPassword(password, email, errors, passwordField);
    return { email, password };
  }

  const newUser = async ({ email, name, role, password, ...links }) => ({
    id: store.newId('u'),
    email,
    name,
    role,
    ...links,
    uiLanguage: currentLang(),
    password: await hashPassword(password),
    createdAt: ctx.now().toISOString(),
  });

  const showSenior = (req, res, { values = {}, errors = {}, helper }) =>
    render(req, res, {
      title: Object.keys(errors).length ? t('auth.fixForm', { title: t('auth.signUp.seniorTitle') }) : t(helper ? 'auth.signUp.helperTitle' : 'auth.signUp.seniorTitle'),
      flash: Object.keys(errors).length ? false : undefined,
      body: seniorSignUpPage({ values, errors, helper }),
    });

  router.get('/sign-up/senior', (req, res) => showSenior(req, res, { helper: req.query.helper === '1' }));

  router.post('/sign-up/senior', async (req, res) => {
    const ip = clientIp(req);
    if (limits.signUp.blocked(ip)) return tooMany(req, res, 'signUp');
    const body = req.body;
    const helper = str(body.helper) === '1';
    const { values, errors } = ctx.validateSenior({ ...body, caregiverName: '', caregiverRelationship: '' });
    const { email, password } = checkAccount(body, errors);
    const langs = readLanguages(body);
    Object.assign(errors, langs.errors);
    const extra = { email, languages: langs.languages, translateHelp: langs.translateHelp };
    let helperAccount = null;
    if (helper) {
      extra.helperName = str(body.helperName);
      extra.relationship = str(body.relationship);
      extra.consent = str(body.consent) === 'yes';
      nameError(extra.helperName, errors, 'helperName');
      helperAccount = checkAccount(body, errors, { emailField: 'helperEmail', passwordField: 'helperPassword' });
      extra.helperEmail = helperAccount.email;
      if (!errors.helperEmail && helperAccount.email === email) errors.helperEmail = t('auth.errors.helperSameEmail');
      if (isInvisible(extra.relationship)) errors.relationship = t('auth.errors.relationshipMissing');
      else if (chars(extra.relationship) > 80) errors.relationship = t('auth.errors.relationshipLong');
      if (!extra.consent) errors.consent = t('auth.errors.consentMissing');
    }
    if (Object.keys(errors).length) return showSenior(req, res, { values: { ...values, ...extra }, errors, helper });
    limits.signUp.hit(ip); // counted before any await, so sign-ups arriving at once can't all slip under the limit (V2-B-03)

    const nowIso = ctx.now().toISOString();
    const senior = {
      id: store.newId('s'),
      ...values,
      caregiver: helper ? { name: extra.helperName, relationship: extra.relationship } : { name: '', relationship: '' },
      languages: langs.languages,
      translateHelp: langs.translateHelp,
      familyCode: newFamilyCode(store),
      createdAt: nowIso,
    };
    const seniorUser = await newUser({ email, name: values.name, role: 'senior', password, seniorId: senior.id });
    store.seniors.push(senior);
    store.users.push(seniorUser);
    let signInAs = seniorUser;
    if (helper) {
      const familyUser = await newUser({ email: helperAccount.email, name: extra.helperName, role: 'family', password: helperAccount.password });
      store.users.push(familyUser);
      store.familyLinks.push({ id: store.newId('fl'), userId: familyUser.id, seniorId: senior.id, relationship: extra.relationship, status: 'pending', createdAt: nowIso, decidedAt: null });
      signInAs = familyUser;
    }
    store.save();
    const viewer = await startSession(req, res, signInAs);
    res.redirect(`${viewer.home}?msg=signed_up`);
  });

  const showVolunteer = (req, res, { values = {}, errors = {} } = {}) =>
    render(req, res, {
      title: Object.keys(errors).length ? t('auth.fixForm', { title: t('auth.signUp.volunteerTitle') }) : t('auth.signUp.volunteerTitle'),
      flash: Object.keys(errors).length ? false : undefined,
      body: volunteerSignUpPage({ values, errors }),
    });

  router.get('/sign-up/volunteer', (req, res) => showVolunteer(req, res));

  router.post('/sign-up/volunteer', async (req, res) => {
    const ip = clientIp(req);
    if (limits.signUp.blocked(ip)) return tooMany(req, res, 'signUp');
    const { values, errors } = ctx.validateVolunteer({ ...req.body, maxSeniors: '1' });
    const { email, password } = checkAccount(req.body, errors);
    const langs = readLanguages(req.body);
    Object.assign(errors, langs.errors);
    if (Object.keys(errors).length) {
      return showVolunteer(req, res, { values: { ...values, email, languages: langs.languages, translateHelp: langs.translateHelp }, errors });
    }
    limits.signUp.hit(ip); // before any await (V2-B-03)
    // Pending until a coordinator approves: no matches, and no seniors to see.
    const volunteer = { id: store.newId('v'), ...values, languages: langs.languages, translateHelp: langs.translateHelp, status: 'pending', createdAt: ctx.now().toISOString() };
    const user = await newUser({ email, name: values.name, role: 'volunteer', password, volunteerId: volunteer.id });
    store.volunteers.push(volunteer);
    store.users.push(user);
    store.save();
    const viewer = await startSession(req, res, user);
    res.redirect(`${viewer.home}?msg=signed_up`);
  });

  const showFamily = (req, res, { values = {}, errors = {} } = {}) =>
    render(req, res, {
      title: Object.keys(errors).length ? t('auth.fixForm', { title: t('auth.signUp.familyTitle') }) : t('auth.signUp.familyTitle'),
      flash: Object.keys(errors).length ? false : undefined,
      body: familySignUpPage({ values, errors }),
    });

  router.get('/sign-up/family', (req, res) => showFamily(req, res));

  router.post('/sign-up/family', async (req, res) => {
    const ip = clientIp(req);
    if (limits.signUp.blocked(ip)) return tooMany(req, res, 'signUp');
    const errors = {};
    const values = { name: str(req.body.name), familyCode: normalizeFamilyCode(str(req.body.familyCode)), relationship: str(req.body.relationship) };
    nameError(values.name, errors, 'name');
    const { email, password } = checkAccount(req.body, errors);
    values.email = email;
    const senior = values.familyCode ? store.seniors.find((s) => s.familyCode === values.familyCode) : null;
    if (!values.familyCode) errors.familyCode = t('auth.errors.familyCodeMissing');
    else if (!senior) {
      errors.familyCode = t('auth.errors.familyCodeUnknown');
      limits.signUp.hit(ip); // wrong codes count too, so nobody can guess codes all day
    }
    if (isInvisible(values.relationship)) errors.relationship = t('auth.errors.relationshipMissing');
    else if (chars(values.relationship) > 80) errors.relationship = t('auth.errors.relationshipLong');
    if (Object.keys(errors).length) return showFamily(req, res, { values, errors });
    limits.signUp.hit(ip); // before any await (V2-B-03)

    const user = await newUser({ email, name: values.name, role: 'family', password });
    store.users.push(user);
    store.familyLinks.push({ id: store.newId('fl'), userId: user.id, seniorId: senior.id, relationship: values.relationship, status: 'pending', createdAt: ctx.now().toISOString(), decidedAt: null });
    store.save();
    const viewer = await startSession(req, res, user);
    res.redirect(`${viewer.home}?msg=signed_up`);
  });

  // ----- my account -----

  // Spoken languages live on the senior's or volunteer's profile; family
  // members and the coordinator keep them on their account.
  const languageHolder = (viewer, user) => (viewer.kind === 'senior' || viewer.kind === 'volunteer' ? viewer.person : user);

  const showAccount = (req, res, { values, errors = {} } = {}) => {
    const viewer = req.viewer;
    const user = store.user(viewer.userId);
    const holder = languageHolder(viewer, user);
    const shown = values || {
      name: user.name,
      uiLanguage: user.uiLanguage || currentLang(),
      languages: languagesOf(holder),
      translateHelp: Boolean(holder?.translateHelp),
    };
    render(req, res, {
      title: Object.keys(errors).length ? t('auth.fixForm', { title: t('auth.account.title') }) : t('auth.account.title'),
      active: 'account',
      flash: Object.keys(errors).length ? false : undefined,
      body: accountPage({
        viewer,
        values: shown,
        errors,
        familyCode: viewer.kind === 'senior' ? viewer.person.familyCode : null,
        showLanguages: languageFieldsReady(),
      }),
    });
  };

  router.get('/account', (req, res) => showAccount(req, res));

  router.post('/account', (req, res) => {
    const viewer = req.viewer;
    const user = store.user(viewer.userId);
    const holder = languageHolder(viewer, user);
    const errors = {};
    const values = { name: str(req.body.name), uiLanguage: str(req.body.uiLanguage) };
    nameError(values.name, errors, 'name');
    if (!isUiLanguage(values.uiLanguage)) errors.uiLanguage = t('auth.errors.uiLanguage');
    const ready = languageFieldsReady();
    const langs = ready ? readLanguages(req.body) : { languages: languagesOf(holder), translateHelp: Boolean(holder?.translateHelp), errors: {} };
    Object.assign(errors, langs.errors);
    if (Object.keys(errors).length) {
      return showAccount(req, res, { values: { ...values, languages: langs.languages, translateHelp: langs.translateHelp }, errors });
    }
    user.name = values.name;
    user.uiLanguage = values.uiLanguage;
    if (viewer.kind === 'senior' || viewer.kind === 'volunteer') viewer.person.name = values.name;
    if (ready && holder) Object.assign(holder, { languages: langs.languages, translateHelp: langs.translateHelp });
    store.save();
    setCurrentLang(user.uiLanguage);
    res.redirect('/account?msg=account_saved');
  });

  // ----- coordinator: approvals -----

  router.get('/admin/approvals', (req, res) => {
    const volunteers = store.volunteers
      .filter((v) => v.status === 'pending')
      .map((volunteer) => ({ volunteer, email: store.users.find((u) => u.volunteerId === volunteer.id)?.email || '' }));
    const links = store.familyLinks
      .filter((l) => l.status === 'pending')
      .map((link) => ({ link, user: store.user(link.userId), senior: store.senior(link.seniorId) }))
      .filter((r) => r.user && r.senior);
    render(req, res, { title: t('auth.approvals.title'), active: 'approvals', body: approvalsPage({ volunteers, links }) });
  });

  const decision = (req) => {
    const d = str(req.body.decision);
    if (d !== 'approve' && d !== 'decline') throw ctx.httpError(400, t('auth.errors.decision'));
    return d;
  };

  router.post('/admin/approvals/volunteers/:id', (req, res) => {
    const d = decision(req);
    const volunteer = store.volunteer(req.params.id);
    if (!volunteer || volunteer.status !== 'pending') throw ctx.httpError(404, t('auth.errors.nothingWaiting'));
    volunteer.status = d === 'approve' ? 'active' : 'declined';
    volunteer.decidedAt = ctx.now().toISOString();
    store.save();
    res.redirect(`/admin/approvals?msg=${d === 'approve' ? 'approved' : 'declined'}`);
  });

  router.post('/admin/approvals/family/:id', (req, res) => {
    const d = decision(req);
    const link = store.familyLinks.find((l) => l.id === req.params.id && l.status === 'pending');
    if (!link) throw ctx.httpError(404, t('auth.errors.nothingWaiting'));
    link.status = d === 'approve' ? 'approved' : 'declined';
    link.decidedAt = ctx.now().toISOString();
    store.save();
    res.redirect(`/admin/approvals?msg=${d === 'approve' ? 'approved' : 'declined'}`);
  });
}
