// All routes. createApp() returns a Web-standard handler, (Request) => Response,
// so the same app runs under Node (node-server.js) and on Cloudflare Workers
// (worker.js), and tests can run it against a temporary data file.

import { Router, createHandler, httpError } from './http.js';
import { parseLocalDateTime, startOfLocalDay } from './tz.js';
import { isInterest, isSlot, isMethod, slotForDate, isMissedReason, nextSlotTime } from './vocab.js';
import { rankVolunteers, scorePair } from './matching.js';
import {
  assessSenior, dashboardSummary, calendarDaysBetween, needsAttention, isUnmarkedPast, canLogNow, canMarkMissedNow,
} from './risk.js';
import { buildSparkInput } from './sparks/index.js';
import { layout, PREFS } from './views/layout.js';
import { toDateInput, toTimeInput, formatDateTime, formatLongDate, formatTime, setDisplayClock } from './views/html.js';
import { homePage, aboutAiPage, resetConfirmPage, errorPage } from './views/pages/home.js';
import { seniorsListPage, seniorProfilePage, seniorFormPage } from './views/pages/seniors.js';
import { volunteersListPage, volunteerProfilePage, volunteerFormPage } from './views/pages/volunteers.js';
import { matchIndexPage, matchSeniorPage } from './views/pages/match.js';
import { contactsPage } from './views/pages/contacts.js';
import { dashboardPage } from './views/pages/dashboard.js';
import { registerFeatures } from './features/index.js';
import { registerIndiana } from './indiana/index.js';
import { registerDesignPages } from './views/pages/extra.js';
import { registerSite } from './views/site/index.js'; // [v2] public website
import { registerTranslate } from './translate/index.js'; // [v2] messages, phrase card, conversation helper
import { checkTown, townFromQuery, rowsInTown } from './towns/index.js'; // [towns]
import { townFilter } from './towns/views.js'; // [towns]
import { registerI18n } from './i18n/routes.js'; // [v2 i18n] POST /prefs/language
import { readLanguages } from './i18n/fields.js'; // [v2 i18n] spoken languages on profiles
import {
  registerRoles, withoutPrivateNotes, seniorsVisibleTo, callsVisibleTo, seesEverything, isFamilyOrSenior, viewerForRequest,
  OLD_ADMIN_PATHS, seniorForVolunteer, volunteerFirstNameOnly, storeSeenBy,
} from './roles/index.js'; // [roles]
import { createSession, sessionCookie } from './auth/session.js'; // [v2 accounts]
import { SEED_ADMIN_EMAIL } from './auth/routes.js'; // [v2 accounts]
import { t } from './i18n/index.js'; // [v2 i18n]

// [v2 accounts] Only approved volunteers can be matched.
const isActiveVolunteer = (v) => (v.status || 'active') === 'active';

// Short messages shown after a form is submitted (?msg=...).
// [v2 i18n] Each value is read in the reader's language (catalog keys
// core.flash.* and core.warn.*). Modules may still add plain keys:
// ctx.flashMessages.my_key = 'Text' (or a getter, as src/auth does).
const translated = (table) => {
  const out = {};
  for (const [name, key] of Object.entries(table)) {
    Object.defineProperty(out, name, {
      get: () => t(key),
      set: (value) => Object.defineProperty(out, name, { value, writable: true, enumerable: true, configurable: true }),
      enumerable: true,
      configurable: true,
    });
  }
  return out;
};
const FLASH = translated({
  senior_added: 'core.flash.seniorAdded',
  senior_saved: 'core.flash.seniorSaved',
  volunteer_added: 'core.flash.volunteerAdded',
  volunteer_saved: 'core.flash.volunteerSaved',
  matched: 'core.flash.matched',
  match_ended: 'core.flash.matchEnded',
  duplicate: 'core.flash.duplicate',
  scheduled: 'core.flash.scheduled',
  logged: 'core.flash.logged',
  completed: 'core.flash.completed',
  missed: 'core.flash.missed',
  sparks: 'core.flash.sparks',
  threshold: 'core.flash.threshold',
  reset: 'core.flash.reset',
});
const WARN = translated({
  outside_hours: 'core.warn.outsideHours',
  live_fallback: 'core.warn.liveFallback',
  match_misfit: 'core.warn.matchMisfit',
});

const toArray = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const str = (v) => (typeof v === 'string' ? v.trim() : Array.isArray(v) ? String(v[0] ?? '').trim() : '');

// Optional `back` (a path on this site) returns the user to the page they came from.
// Only a plain path is allowed: "/" followed by something other than "/" or "\",
// with no backslash, space, or control character anywhere. Browsers drop tabs and
// line breaks and read "\" as "/", so "/\evil.example" or "/<TAB>/evil.example"
// would leave the site. Anything else is ignored (null), and the caller picks a default.
function safeBack(v) {
  const back = str(v);
  if (!/^\/(?:[^/\\]|$)/.test(back)) return null;
  if (!/^[\u0021-\u007e]+$/.test(back) || back.includes('\\')) return null;
  try {
    // Belt and braces: it must resolve to this site.
    if (new URL(back, 'http://porchlight.invalid').origin !== 'http://porchlight.invalid') return null;
  } catch {
    return null;
  }
  return back;
}

function flashFrom(req) {
  if (req.query.warn && WARN[req.query.warn]) return { kind: 'warning', text: WARN[req.query.warn] };
  if (req.query.msg && FLASH[req.query.msg]) return { kind: 'success', text: FLASH[req.query.msg] };
  return null;
}

// ---------- validation ----------
// Each returns { values, errors }. Errors are keyed by field name so the
// form can show them next to the right input and in the error summary.

// Characters as people count them: an emoji is 1, not 2 (UTF-16) units.
// Characters as people count them: "👍🏽" and "e + accent" are one each (grapheme clusters).
const GRAPHEMES = new Intl.Segmenter('en', { granularity: 'grapheme' });
// A "character" may not hide thousands of combining marks (V2-B-09): every 4
// UTF-16 units count as at least one, which leaves real text (an emoji with a
// skin tone is 4 units) alone.
const chars = (s) => { let n = 0; for (const _ of GRAPHEMES.segment(s)) n++; return Math.max(n, Math.ceil(s.length / 4)); };
// True if the text has nothing you can see: spaces, zero-width characters, lone accents,
// or "blank" letters such as the Hangul fillers and the Braille blank.
const BLANK_LOOKING = /[\s\p{Cf}\p{Z}\p{M}\u115F\u1160\u3164\uFFA0\u2800]/gu;
const isInvisible = (s) => !s.replace(BLANK_LOOKING, '');
// Whole numbers typed as plain digits only: "80", not "0x50", "8e1", or "80.0".
const wholeNumber = (s) => (/^\d{1,4}$/.test(s) ? Number(s) : NaN);

// [v2 i18n] Spoken languages and translate help (src/i18n/fields.js). A form
// without the language fields (an older page) keeps what is saved.
function addLanguages(body, values, errors) {
  const spoken = readLanguages(body);
  if (!spoken.present) return;
  values.languages = spoken.languages;
  values.translateHelp = spoken.translateHelp;
  Object.assign(errors, spoken.errors);
}

function validateSenior(body) {
  const errors = {};
  const values = {
    name: str(body.name),
    preferredName: str(body.preferredName),
    age: str(body.age),
    neighborhood: str(body.neighborhood),
    interests: toArray(body.interests).filter(isInterest),
    aboutMe: str(body.aboutMe),
    availability: toArray(body.availability).filter(isSlot),
    contactMethod: str(body.contactMethod),
    caregiver: { name: str(body.caregiverName), relationship: str(body.caregiverRelationship) },
  };
  if (isInvisible(values.preferredName)) values.preferredName = '';
  if (isInvisible(values.name)) errors.name = t('core.validate.seniorName');
  else if (chars(values.name) > 80) errors.name = t('core.validate.nameLength');
  if (chars(values.preferredName) > 40) errors.preferredName = t('core.validate.preferredNameLength');
  if (values.age) {
    const n = wholeNumber(values.age);
    if (!Number.isInteger(n) || n < 50 || n > 120) errors.age = t('core.validate.age');
    else values.age = n;
  } else {
    values.age = null;
  }
  if (chars(values.neighborhood) > 80) errors.neighborhood = t('core.validate.neighborhoodLength');
  if (!values.interests.length) errors.interests = t('core.validate.interests');
  if (chars(values.aboutMe) > 500) errors.aboutMe = t('core.validate.aboutMeLength', { n: chars(values.aboutMe) });
  if (!values.availability.length) errors.availability = t('core.validate.availability');
  if (!isMethod(values.contactMethod)) errors.contactMethod = t('core.validate.contactMethod');
  if (chars(values.caregiver.name) > 80) errors.caregiverName = t('core.validate.nameLength');
  if (chars(values.caregiver.relationship) > 80) errors.caregiverRelationship = t('core.validate.relationshipLength');
  checkTown(body, values, errors); // [towns] only towns on this deployment's list
  addLanguages(body, values, errors); // [v2 i18n]
  return { values, errors };
}

function validateVolunteer(body) {
  const errors = {};
  const values = {
    name: str(body.name),
    affiliation: str(body.affiliation),
    interests: toArray(body.interests).filter(isInterest),
    availability: toArray(body.availability).filter(isSlot),
    contactMethods: toArray(body.contactMethods).filter(isMethod),
    maxSeniors: wholeNumber(str(body.maxSeniors) || '1'),
  };
  if (isInvisible(values.name)) errors.name = t('core.validate.volunteerName');
  else if (chars(values.name) > 80) errors.name = t('core.validate.nameLength');
  if (chars(values.affiliation) > 100) errors.affiliation = t('core.validate.affiliationLength');
  if (!values.interests.length) errors.interests = t('core.validate.interests');
  if (!values.availability.length) errors.availability = t('core.validate.availability');
  if (!values.contactMethods.length) errors.contactMethods = t('core.validate.contactMethods');
  if (!Number.isInteger(values.maxSeniors) || values.maxSeniors < 1 || values.maxSeniors > 5) {
    errors.maxSeniors = t('core.validate.maxSeniors');
  }
  checkTown(body, values, errors); // [towns] only towns on this deployment's list
  addLanguages(body, values, errors); // [v2 i18n]
  return { values, errors };
}

function validateContact(body, store, now) {
  const errors = {};
  const form = {
    matchId: str(body.matchId),
    action: str(body.action) === 'log' ? 'log' : 'schedule',
    type: str(body.type),
    date: str(body.date),
    time: str(body.time),
    durationMinutes: str(body.durationMinutes),
    notes: str(body.notes),
  };
  const match = store.matches.find((m) => m.id === form.matchId && m.active);
  if (!match) errors.matchId = t('core.validate.matchId');
  if (!isMethod(form.type)) errors.type = t('core.validate.type');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) errors.date = t('core.validate.date');
  if (!/^\d{2}:\d{2}$/.test(form.time)) errors.time = t('core.validate.time');
  let when = null;
  if (!errors.date && !errors.time) {
    when = parseLocalDateTime(form.date, form.time); // Carmel time, even on a UTC server
    const [hour, minute] = form.time.split(':').map(Number);
    if (!when && !parseLocalDateTime(form.date, '12:00')) {
      errors.date = t('core.validate.realDate');
    } else if (!when && (hour > 23 || minute > 59)) {
      errors.time = t('core.validate.realTime');
    } else if (!when) {
      // The date is real, so the time was skipped when the clocks sprang forward.
      errors.time = t('core.validate.skippedTime');
    } else if (form.action === 'schedule' && when < new Date(now.getTime() - 5 * 60 * 1000)) {
      errors.date = t('core.validate.scheduleInPast');
    } else if (form.action === 'log' && when > new Date(now.getTime() + 5 * 60 * 1000)) {
      errors.date = t('core.validate.logInFuture');
    } else if (Math.abs(calendarDaysBetween(when, now)) > 366) {
      errors.date = t('core.validate.dateRange');
    }
  }
  let duration = null;
  if (form.durationMinutes) {
    duration = wholeNumber(form.durationMinutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 480) {
      errors.durationMinutes = t('core.validate.duration');
    }
  }
  if (chars(form.notes) > 500) errors.notes = t('core.validate.notesLength');
  return { form, errors, match, when, duration };
}

// ---------- app ----------
// Note: when a form has errors we re-show it with status 200 (not 422) so the
// browser console stays clean during demos; the error summary tells the user.

export function createApp({ store, sparks, now = () => new Date() }) {
  const router = new Router();
  setDisplayClock(now); // dates show their year based on the app's own "today"

  // The header's AI badge shows what is really happening: "Offline" if LIVE is
  // set up but the last request fell back (see currentModeInfo in src/sparks).
  const shownSparks = () => (sparks.currentModeInfo ? { ...sparks, modeInfo: sparks.currentModeInfo() } : sparks);
  // [v2] Every /admin page is kept out of search engines (meta tag and header).
  const render = (req, res, { title, active, body, status = 200, wide = false, flash }) => {
    const noindex = /^\/admin(\/|$)/.test(req.path);
    if (noindex) res.header('X-Robots-Tag', 'noindex, nofollow');
    res.html(String(layout({ title, active, body, req, ctx: { sparks: shownSparks() }, flash: flash ?? flashFrom(req), wide, noindex })), status);
  };

  const renderError = async (req, res, status, message) => {
    // [roles] Pages that never reached a route (404, 413) still show the signed-in person's own header.
    if (req.viewer === undefined) req.viewer = await viewerForRequest(req, res, store);
    return renderErrorPage(req, res, status, message);
  };
  const renderErrorPage = (req, res, status, message) =>
    render(req, res, {
      title: t(status === 404 ? 'core.title.notFound' : 'core.title.error'),
      body: errorPage({
        status,
        message: status === 413 ? t('core.http.tooLarge') : message,
      }),
      status,
    });

  const seniorOr404 = (id) => {
    const s = store.senior(id);
    if (!s) throw httpError(404, t('core.http.noSenior'));
    return s;
  };
  const volunteerOr404 = (id) => {
    const v = store.volunteer(id);
    if (!v) throw httpError(404, t('core.http.noVolunteer'));
    return v;
  };
  const assess = (senior) =>
    assessSenior(senior, {
      contacts: store.contactsForSenior(senior.id),
      activeMatch: store.activeMatchForSenior(senior.id),
      thresholdDays: store.settings.riskThresholdDays,
      now: now(),
    });
  const withPeople = (c, seen = store) => ({ ...c, senior: seen.senior(c.seniorId), volunteer: store.volunteer(c.volunteerId) });
  // What no longer fits between a matched pair (no shared time, or a way of
  // connecting the volunteer doesn't offer), using the Match page's own rules.
  // Capacity is left out: the pair already counts toward it.
  const misfitOf = (senior, volunteer) => (senior && volunteer ? scorePair(senior, volunteer, 0).problems : []);

  // ----- coordinator home -----
  // [v2] Moved from / to /admin. The public website owns / (src/views/site/).
  const coordinatorHome = (req, res) => {
    const summary = dashboardSummary(store, now());
    const stats = {
      seniors: store.seniors.length,
      activeMatches: store.matches.filter((m) => m.active).length,
      checkInsThisWeek: store.contacts.filter(
        (c) => c.status === 'completed' && calendarDaysBetween(c.completedAt, now()) <= 6
      ).length,
      flagged: summary.filter(needsAttention).length,
    };
    const attention = summary.filter(needsAttention); // the same list as /admin/attention
    render(req, res, { title: t('core.title.home'), active: 'home', body: homePage({ stats, attention }) });
  };
  router.get('/admin', coordinatorHome);

  // [v2] The old coordinator addresses: an admin goes to the new page (with
  // the same ?query), everyone else to the sign-in page.
  for (const [oldPath, newPath] of Object.entries(OLD_ADMIN_PATHS)) {
    router.get(oldPath, (req, res) => {
      const query = new URLSearchParams(req.query).toString();
      const target = `${newPath}${query ? `?${query}` : ''}`;
      if (seesEverything(req.viewer)) return res.redirect(target);
      res.redirect(req.viewer ? '/sign-in' : `/sign-in?next=${encodeURIComponent(target)}`);
    });
  }

  router.get('/about-ai', (req, res) => {
    render(req, res, {
      title: t('core.title.aboutAi'),
      body: aboutAiPage({ modeInfo: sparks.modeInfo, model: sparks.model, backupModel: sparks.backupModel || null, lastFallback: sparks.lastFallback || null }),
    });
  });

  router.get('/healthz', (req, res) => res.json({ ok: true, sparkMode: sparks.modeInfo.effective }));

  // ----- seniors -----
  router.get('/admin/seniors', (req, res) => {
    const town = townFromQuery(req.query); // [towns]
    const all = [...store.seniors]; // [towns]
    const rows = rowsInTown(all, town) // [towns]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((senior) => {
        const m = store.activeMatchForSenior(senior.id);
        return { senior, assessment: assess(senior), volunteer: m ? store.volunteer(m.volunteerId) : null };
      });
    const filter = townFilter({ action: '/admin/seniors', town, asked: req.query.town, shown: rows.length, total: all.length }); // [towns]
    render(req, res, { title: t('core.title.seniors'), active: 'seniors', body: seniorsListPage({ rows, townFilter: filter, townName: town }) }); // [towns]
  });

  router.get('/admin/seniors/new', (req, res) => {
    render(req, res, { title: t('core.title.addSenior'), active: 'seniors', body: seniorFormPage({ isNew: true }) });
  });

  router.post('/admin/seniors', (req, res) => {
    const { values, errors } = validateSenior(req.body);
    if (Object.keys(errors).length) {
      return render(req, res, {
        title: t('core.title.fixForm', { title: t('core.title.addSenior') }), active: 'seniors', status: 200,
        body: seniorFormPage({ senior: values, errors, isNew: true }), flash: false,
      });
    }
    const senior = { id: store.newId('s'), ...values, createdAt: now().toISOString() };
    store.seniors.push(senior);
    store.save();
    res.redirect(`/seniors/${senior.id}?msg=senior_added`);
  });

  router.get('/seniors/:id', (req, res) => {
    const senior = seniorOr404(req.params.id);
    const match = store.activeMatchForSenior(senior.id);
    const contacts = store.contactsForSenior(senior.id);
    const nowDate = now();
    const upcoming = contacts
      .filter((c) => c.status === 'scheduled' && !isUnmarkedPast(c, nowDate))
      .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
    const recent = contacts
      .filter((c) => c.status === 'completed' || c.status === 'missed')
      .sort((a, b) => new Date(b.completedAt || b.scheduledFor) - new Date(a.completedAt || a.scheduledFor))
      .slice(0, 5);
    // [v2] A volunteer gets only what they need about their senior (first
    // name, interests, languages, times); family and the senior get only the
    // companion's first name.
    const kind = req.viewer?.kind;
    const shownSenior = kind === 'volunteer' ? seniorForVolunteer(senior) : senior;
    // [v2] A volunteer sees notes on their own calls only, never an earlier
    // companion's (after a rematch, V2-B-02).
    const ownNotesOnly = (list) =>
      kind === 'volunteer' ? list.map((c) => (c.volunteerId === req.viewer.id ? c : { ...c, notes: '', missedNote: null })) : list;
    const companion = match ? store.volunteer(match.volunteerId) : null;
    render(req, res, {
      title: shownSenior.name,
      active: 'seniors',
      wide: true,
      body: seniorProfilePage({
        senior: shownSenior,
        assessment: assess(senior),
        volunteer: isFamilyOrSenior(req.viewer) ? volunteerFirstNameOnly(companion) : companion,
        match,
        upcoming: ownNotesOnly(upcoming),
        recent: ownNotesOnly(withoutPrivateNotes(req.viewer, recent)), // [roles] family and seniors never see call notes
        sparkSet: store.latestSparkSet(senior.id),
        sparkMode: sparks.modeInfo,
        misfit: match && !isFamilyOrSenior(req.viewer) ? misfitOf(senior, store.volunteer(match.volunteerId)) : [], // [roles] a coordinator warning
        hideNotice: req.query.warn === 'live_fallback', // the flash banner already says it
        hideSparks: isFamilyOrSenior(req.viewer), // [roles] sparks are a volunteer tool
        seniorView: req.viewer?.kind === 'senior', // [roles] the senior's own page: no risk labels about them
      }),
    });
  });

  router.get('/seniors/:id/edit', (req, res) => {
    const senior = seniorOr404(req.params.id);
    render(req, res, { title: t('core.title.edit', { name: senior.name }), active: 'seniors', body: seniorFormPage({ senior, isNew: false }) });
  });

  router.post('/seniors/:id', (req, res) => {
    const senior = seniorOr404(req.params.id);
    const { values, errors } = validateSenior(req.body);
    if (Object.keys(errors).length) {
      return render(req, res, {
        title: t('core.title.fixForm', { title: t('core.title.edit', { name: senior.name }) }), active: 'seniors', status: 200,
        body: seniorFormPage({ senior: { ...values, id: senior.id }, errors, isNew: false }), flash: false,
      });
    }
    Object.assign(senior, values, { updatedAt: now().toISOString() });
    store.save();
    // Never break a match silently: warn if the edit means the pair no longer fits.
    const match = store.activeMatchForSenior(senior.id);
    const misfit = match ? misfitOf(senior, store.volunteer(match.volunteerId)) : [];
    res.redirect(`/seniors/${senior.id}?msg=senior_saved${misfit.length ? '&warn=match_misfit' : ''}`);
  });

  // Conversation Sparks: generate 3 starters, save them, show them on the profile.
  router.post('/seniors/:id/sparks', async (req, res) => {
    const senior = seniorOr404(req.params.id);
    const variant = Math.max(0, Math.min(1000, Number.parseInt(str(req.body.variant), 10) || 0));
    const input = buildSparkInput(senior, store.contactsForSenior(senior.id), now());
    const result = await sparks.generate(input, variant);
    store.sparkSets.push({
      id: store.newId('sp'),
      seniorId: senior.id,
      variant,
      mode: result.mode,
      model: result.model,
      provider: result.provider || null,
      sparks: result.sparks,
      tip: result.tip,
      notice: result.notice,
      inputs: { interests: input.interests, daysSince: input.daysSince, season: input.season },
      createdAt: now().toISOString(),
    });
    // Keep only the last 10 spark sets per senior so the file stays small.
    const mine = store.sparkSets.filter((s) => s.seniorId === senior.id);
    if (mine.length > 10) {
      const drop = new Set(mine.slice(0, mine.length - 10).map((s) => s.id));
      store.data.sparkSets = store.sparkSets.filter((s) => !drop.has(s.id));
    }
    store.save();
    const flag = result.mode === 'mock-fallback' ? 'warn=live_fallback' : 'msg=sparks';
    const back = safeBack(req.body.back); // e.g. a volunteer's "My week" page
    res.redirect(back ? `${back.split('#')[0]}${back.includes('?') ? '&' : '?'}${flag}` : `/seniors/${senior.id}?${flag}#sparks`);
  });

  // ----- volunteers -----
  router.get('/admin/volunteers', (req, res) => {
    const town = townFromQuery(req.query); // [towns]
    const rows = rowsInTown([...store.volunteers], town) // [towns]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((volunteer) => ({
        volunteer,
        seniors: store.activeMatchesForVolunteer(volunteer.id).map((m) => store.senior(m.seniorId)).filter(Boolean),
      }));
    const filter = townFilter({ action: '/admin/volunteers', town, asked: req.query.town, shown: rows.length, total: store.volunteers.length, noun: ['volunteer', 'volunteers'], label: 'Show volunteers in' }); // [towns]
    render(req, res, { title: t('core.title.volunteers'), active: 'volunteers', body: volunteersListPage({ rows, townFilter: filter, townName: town }) }); // [towns]
  });

  router.get('/admin/volunteers/new', (req, res) => {
    render(req, res, { title: t('core.title.addVolunteer'), active: 'volunteers', body: volunteerFormPage({ isNew: true }) });
  });

  router.post('/admin/volunteers', (req, res) => {
    const { values, errors } = validateVolunteer(req.body);
    if (Object.keys(errors).length) {
      return render(req, res, {
        title: t('core.title.fixForm', { title: t('core.title.addVolunteer') }), active: 'volunteers', status: 200,
        body: volunteerFormPage({ volunteer: values, errors, isNew: true }), flash: false,
      });
    }
    const volunteer = { id: store.newId('v'), ...values, createdAt: now().toISOString() };
    store.volunteers.push(volunteer);
    store.save();
    res.redirect(`/volunteers/${volunteer.id}?msg=volunteer_added`);
  });

  router.get('/volunteers/:id', (req, res) => {
    const volunteer = volunteerOr404(req.params.id);
    const assigned = store
      .activeMatchesForVolunteer(volunteer.id)
      .map((match) => {
        const senior = storeSeenBy(req.viewer, store).senior(match.seniorId); // [v2] a volunteer sees first names only
        return senior ? { senior, match, assessment: assess(senior), misfit: misfitOf(senior, volunteer) } : null;
      })
      .filter(Boolean);
    render(req, res, { title: volunteer.name, active: 'volunteers', body: volunteerProfilePage({ volunteer, assigned }) });
  });

  router.get('/volunteers/:id/edit', (req, res) => {
    const volunteer = volunteerOr404(req.params.id);
    render(req, res, { title: t('core.title.edit', { name: volunteer.name }), active: 'volunteers', body: volunteerFormPage({ volunteer, isNew: false }) });
  });

  router.post('/volunteers/:id', (req, res) => {
    const volunteer = volunteerOr404(req.params.id);
    const { values, errors } = validateVolunteer(req.body);
    const current = store.activeMatchesForVolunteer(volunteer.id).length;
    if (!errors.maxSeniors && values.maxSeniors < current) {
      const first = volunteer.name.split(' ')[0];
      errors.maxSeniors = t('core.validate.belowCurrent', { name: first, n: current });
    }
    if (Object.keys(errors).length) {
      return render(req, res, {
        title: t('core.title.fixForm', { title: t('core.title.edit', { name: volunteer.name }) }), active: 'volunteers', status: 200,
        body: volunteerFormPage({ volunteer: { ...values, id: volunteer.id }, errors, isNew: false }), flash: false,
      });
    }
    Object.assign(volunteer, values, { updatedAt: now().toISOString() });
    store.save();
    // Never break a match silently: warn if any of this volunteer's pairs no longer fits.
    const misfit = store
      .activeMatchesForVolunteer(volunteer.id)
      .some((m) => misfitOf(store.senior(m.seniorId), volunteer).length);
    res.redirect(`/volunteers/${volunteer.id}?msg=volunteer_saved${misfit ? '&warn=match_misfit' : ''}`);
  });

  // ----- matching -----
  router.get('/admin/match', (req, res) => {
    if (req.query.seniorId) {
      const senior = seniorOr404(req.query.seniorId);
      const currentMatch = store.activeMatchForSenior(senior.id);
      const ranking = rankVolunteers(senior, store.volunteers.filter(isActiveVolunteer), store.matches); // [v2] pending volunteers can't be matched
      return render(req, res, {
        title: t('core.title.matchSenior', { name: senior.name }), active: 'match',
        body: matchSeniorPage({
          senior,
          currentMatch,
          currentVolunteer: currentMatch ? store.volunteer(currentMatch.volunteerId) : null,
          ranking,
        }),
      });
    }
    const unmatched = store.seniors.filter((s) => !store.activeMatchForSenior(s.id));
    const matched = store.matches
      .filter((m) => m.active)
      .map((m) => ({ senior: store.senior(m.seniorId), volunteer: store.volunteer(m.volunteerId) }))
      .filter((p) => p.senior && p.volunteer);
    render(req, res, { title: t('core.title.match'), active: 'match', body: matchIndexPage({ unmatched, matched }) });
  });

  router.post('/admin/matches', (req, res) => {
    const senior = seniorOr404(str(req.body.seniorId));
    const volunteer = volunteerOr404(str(req.body.volunteerId));
    if (store.activeMatchForSenior(senior.id)) throw httpError(409, t('core.http.alreadyMatched', { name: senior.name }));
    if (!isActiveVolunteer(volunteer)) throw httpError(409, t('core.http.notApproved', { name: volunteer.name })); // [v2]
    // Re-check the rules on the server. Never trust that the form was up to date.
    const result = rankVolunteers(senior, [volunteer], store.matches);
    if (!result.eligible.length) {
      throw httpError(409, t('core.http.cannotMatch', { volunteer: volunteer.name, senior: senior.name, problems: result.ineligible[0].problems.join('; ') }));
    }
    store.matches.push({
      id: store.newId('m'),
      seniorId: senior.id,
      volunteerId: volunteer.id,
      score: result.eligible[0].score,
      active: true,
      createdAt: now().toISOString(),
      endedAt: null,
    });
    store.save();
    res.redirect(`/seniors/${senior.id}?msg=matched`);
  });

  router.post('/admin/matches/:id/end', (req, res) => {
    const match = store.matches.find((m) => m.id === req.params.id && m.active);
    if (!match) throw httpError(404, t('core.http.noMatch'));
    const nowDate = now();
    match.active = false;
    match.endedAt = nowDate.toISOString();
    // Calls the pair had planned come off the calendar (and the volunteer's
    // week). They stay in the history as "cancelled", so nothing is deleted.
    // Past calls nobody marked are left alone: they may have happened.
    for (const c of store.contacts) {
      if (c.status === 'scheduled' && c.seniorId === match.seniorId && c.volunteerId === match.volunteerId && new Date(c.scheduledFor) > nowDate) {
        c.status = 'cancelled';
        c.cancelReason = 'match_ended';
        c.cancelledAt = nowDate.toISOString();
      }
    }
    store.save();
    res.redirect(`/admin/match?seniorId=${match.seniorId}&msg=match_ended`);
  });

  // ----- calls & visits -----
  const contactsView = (req, res, { form, errors = {}, status = 200 }) => {
    const nowDate = now();
    const isMine = callsVisibleTo(req.viewer); // [roles] a volunteer sees only their own pairs and calls
    const seen = storeSeenBy(req.viewer, store); // [v2] and only their seniors' first names
    const pairs = store.matches
      .filter((m) => m.active)
      .filter(isMine) // [roles]
      .map((match) => ({ match, senior: seen.senior(match.seniorId), volunteer: store.volunteer(match.volunteerId) }))
      .filter((p) => p.senior && p.volunteer)
      .sort((a, b) => a.senior.name.localeCompare(b.senior.name));
    const scheduled = store.contacts
      .filter((c) => c.status === 'scheduled')
      .filter(isMine) // [roles]
      .map((c) => ({ ...withPeople(c, seen), canLog: canLogNow(c, nowDate), canMiss: canMarkMissedNow(c, nowDate) }))
      .filter((c) => c.senior)
      .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
    const happenedAt = (c) => new Date(c.completedAt || c.cancelledAt || c.scheduledFor);
    const recent = store.contacts
      .filter((c) => c.status !== 'scheduled')
      .filter(isMine) // [roles]
      .map((c) => withPeople(c, seen))
      .filter((c) => c.senior)
      .sort((a, b) => happenedAt(b) - happenedAt(a))
      .slice(0, 15);
    render(req, res, {
      title: Object.keys(errors).length ? t('core.title.fixForm', { title: t('core.title.contacts') }) : t('core.title.contacts'),
      active: 'contacts',
      status,
      wide: true,
      flash: Object.keys(errors).length ? false : undefined,
      body: contactsPage({
        pairs,
        form,
        errors,
        // A call stays "coming up" for an hour after it starts (it may be going on now).
        upcoming: scheduled.filter((c) => !isUnmarkedPast(c, nowDate)),
        overdue: scheduled.filter((c) => isUnmarkedPast(c, nowDate)),
        recent,
      }),
    });
  };

  router.get('/contacts', (req, res) => {
    // Pre-fill the form when coming from a senior or volunteer page.
    let matchId = req.query.matchId || '';
    if (!matchId && req.query.seniorId) matchId = store.activeMatchForSenior(req.query.seniorId)?.id || '';
    // [v2] A volunteer can only pre-fill one of their own pairs (V2-B-06).
    const mine = callsVisibleTo(req.viewer);
    const match = store.matches.find((m) => m.id === matchId && m.active && mine(m));
    const senior = match ? store.senior(match.seniorId) : null;
    const volunteer = match ? store.volunteer(match.volunteerId) : null;
    // Suggest the pair's next shared free time (at least an hour from now).
    // Otherwise: tomorrow at 4 PM, a calendar day even on the 25-hour day in November.
    const shared = senior && volunteer ? senior.availability.filter((slot) => volunteer.availability.includes(slot)) : [];
    const suggested = nextSlotTime(shared, now());
    contactsView(req, res, {
      form: {
        matchId: match ? match.id : '',
        action: 'schedule',
        type: senior ? senior.contactMethod : 'phone',
        date: toDateInput(suggested || startOfLocalDay(now(), 1)),
        time: suggested ? toTimeInput(suggested) : '16:00',
      },
    });
  });

  router.post('/contacts', (req, res) => {
    const nowDate = now();
    const { form, errors, match, when, duration } = validateContact(req.body, store, nowDate);
    if (Object.keys(errors).length) return contactsView(req, res, { form, errors, status: 200 });

    const isLog = form.action === 'log';
    // Pressing Save twice (or a slow connection) must not add the same call twice:
    // the same pair, type, and time that is already saved is ignored.
    const duplicate = store.contacts.some(
      (c) =>
        c.seniorId === match.seniorId &&
        c.volunteerId === match.volunteerId &&
        c.type === form.type &&
        c.status === (isLog ? 'completed' : 'scheduled') &&
        new Date(c.scheduledFor).getTime() === when.getTime()
    );
    if (duplicate) return res.redirect('/contacts?msg=duplicate');
    store.contacts.push({
      id: store.newId('c'),
      seniorId: match.seniorId,
      volunteerId: match.volunteerId,
      type: form.type,
      status: isLog ? 'completed' : 'scheduled',
      scheduledFor: when.toISOString(),
      completedAt: isLog ? when.toISOString() : null,
      durationMinutes: isLog ? duration : null,
      notes: form.notes,
      createdAt: nowDate.toISOString(), // the timestamp of when this was recorded
    });
    store.save();

    // Soft check: is the time inside the pair's shared availability?
    const senior = store.senior(match.seniorId);
    const volunteer = store.volunteer(match.volunteerId);
    const slot = slotForDate(when);
    const shared = senior.availability.filter((s) => volunteer.availability.includes(s));
    const warn = !isLog && (!slot || !shared.includes(slot)) ? '&warn=outside_hours' : '';
    res.redirect(`/contacts?msg=${isLog ? 'logged' : 'scheduled'}${warn}`);
  });

  const markContact = (status) => (req, res) => {
    const contact = store.contacts.find((c) => c.id === req.params.id);
    if (!contact) throw httpError(404, t('core.http.noCall'));
    if (contact.status === 'cancelled') {
      throw httpError(409, t('core.http.cancelled'));
    }
    if (contact.status !== 'scheduled') throw httpError(409, t('core.http.alreadyMarked'));
    const nowDate = now();
    const noun = contact.type === 'visit' ? 'visit' : 'call';
    let reason = null;
    let reasonNote = null;
    if (status === 'missed') {
      // Optional reason. Old forms without one still work.
      reason = str(req.body.reason);
      reasonNote = str(req.body.reasonNote);
      if (reason && !isMissedReason(reason)) throw httpError(400, t('core.http.reason'));
      if (chars(reasonNote) > 200) throw httpError(400, t('core.http.reasonNote'));
      // A call that hasn't started yet can't have been missed.
      if (!canMarkMissedNow(contact, nowDate)) {
        throw httpError(409, t(`core.http.notMissedYet.${noun}`, { when: formatDateTime(contact.scheduledFor) }));
      }
    } else if (!canLogNow(contact, nowDate)) {
      // Only on its day or later (Carmel calendar): a Thursday visit can't be logged on Tuesday.
      throw httpError(409, t(`core.http.notDoneYet.${noun}`, { date: formatLongDate(contact.scheduledFor), time: formatTime(contact.scheduledFor) }));
    }
    if (status === 'missed') {
      contact.missedReason = reason || null;
      contact.missedNote = reasonNote || null;
    }
    contact.status = status;
    if (status === 'completed') {
      // If it was marked early in the day, count it as happening now, not later today.
      const scheduled = new Date(contact.scheduledFor);
      contact.completedAt = (scheduled > nowDate ? nowDate : scheduled).toISOString();
    }
    contact.markedAt = nowDate.toISOString();
    store.save();
    const back = safeBack(req.body.back);
    res.redirect(back ? `${back}${back.includes('?') ? '&' : '?'}msg=${status}` : `/contacts?msg=${status}`);
  };
  router.post('/contacts/:id/complete', markContact('completed'));
  router.post('/contacts/:id/missed', markContact('missed'));

  // ----- dashboard -----
  const dashboardView = (req, res, { errors = {}, thresholdInput, status = 200 } = {}) => {
    const town = seesEverything(req.viewer) ? townFromQuery(req.query) : null; // [towns]
    const everyone = seniorsVisibleTo(req.viewer, dashboardSummary(store, now())); // [roles] family: only their senior
    const summary = rowsInTown(everyone, town, (r) => r.senior); // [towns]
    render(req, res, {
      title: Object.keys(errors).length ? t('core.title.fixForm', { title: t('core.title.dashboard') }) : t('core.title.dashboard'),
      active: 'dashboard',
      status,
      wide: true,
      flash: Object.keys(errors).length ? false : undefined,
      body: dashboardPage({
        summary, // [towns] [roles]
        townFilter: seesEverything(req.viewer) ? townFilter({ action: '/admin/dashboard', town, asked: req.query.town, shown: summary.length, total: everyone.length }) : '', // [towns]
        townName: town, // [towns]
        threshold: store.settings.riskThresholdDays,
        // [v2] family members see only the companion's first name
        volunteersById: new Map(store.volunteers.map((v) => [v.id, seesEverything(req.viewer) ? v : volunteerFirstNameOnly(v)])),
        errors,
        thresholdInput,
      }),
    });
  };
  router.get('/dashboard', (req, res) => dashboardView(req, res)); // a family member's own senior (an admin sees all)
  router.get('/admin/dashboard', (req, res) => dashboardView(req, res));

  router.post('/admin/settings', (req, res) => {
    const raw = str(req.body.riskThresholdDays);
    const n = wholeNumber(raw);
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      return dashboardView(req, res, {
        errors: { riskThresholdDays: t('core.validate.threshold') },
        thresholdInput: raw,
        status: 200,
      });
    }
    store.settings.riskThresholdDays = n;
    store.save();
    res.redirect('/admin/dashboard?msg=threshold');
  });

  // ----- preferences & demo tools -----
  // The Accessibility menu: POST /prefs/text-size (size), /prefs/contrast
  // (contrast), and /prefs/theme (theme). Each choice is checked against its
  // allow-list and kept in its own cookie. The redirect goes back to the page
  // the person was on, but only to a path on this site (safeBack).
  for (const pref of PREFS) {
    router.post(`/prefs/${pref.route}`, (req, res) => {
      const value = str(req.body[pref.field]);
      if (pref.options.some((o) => o.id === value)) res.setCookie(pref.cookie, value);
      res.redirect(safeBack(req.body.back) || '/');
    });
  }

  router.get('/admin/demo/reset', (req, res) => {
    render(req, res, { title: t('core.title.reset'), body: resetConfirmPage() });
  });

  // [v2] A reset re-seeds everything, which wipes sign-ups and sessions. The
  // admin who pressed it stays signed in, with a new session for the seed admin.
  router.post('/admin/demo/reset', async (req, res) => {
    store.reset(now());
    const admin = store.userByEmail(SEED_ADMIN_EMAIL);
    if (admin) sessionCookie(res, req, await createSession(store, admin.id));
    res.redirect('/admin/dashboard?msg=reset');
  });

  // ----- add-on modules -----
  // Each module registers its own routes, so adding one never means editing
  // this file. `ctx` is the contract they get.
  const ctx = {
    store, sparks, now, render, assess, seniorOr404, volunteerOr404, withPeople,
    httpError, str, toArray, safeBack,
    validateSenior, validateVolunteer, chars, isInvisible, // [v2 accounts] sign-up reuses the same checks
    flashMessages: FLASH, // add keys: ctx.flashMessages.my_key = 'Text'
    warnMessages: WARN,
    coordinatorHome, // [v2] temporary: the placeholder / uses it until the public home exists
  };
  registerFeatures(router, ctx);
  registerIndiana(router, ctx);
  registerDesignPages(router, ctx);
  registerSite(router, ctx); // [v2] public website: /, /how-it-works, ...
  registerI18n(router, ctx); // [v2 i18n] POST /prefs/language
  registerTranslate(router, ctx); // [v2] /messages, /phrases, /translate
  registerRoles(router, ctx); // [roles] must be last: adds /sign-in and checks every route on the server

  return createHandler({ router, renderError });
}
