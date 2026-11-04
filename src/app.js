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
import { layout, TEXT_SIZES } from './views/layout.js';
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

// Short messages shown after a form is submitted (?msg=...).
const FLASH = {
  senior_added: 'Senior added. Next step: find them a companion.',
  senior_saved: 'Profile saved.',
  volunteer_added: 'Volunteer added. They can now be matched with a senior.',
  volunteer_saved: 'Profile saved.',
  matched: 'Match confirmed! Next step: schedule the first call.',
  match_ended: 'Match ended. You can now choose a new companion. Calls they had planned were taken off the calendar.',
  duplicate: 'That call was already saved, so it was not added twice.',
  scheduled: 'Call scheduled.',
  logged: 'Call logged. The dashboard is updated.',
  completed: 'Marked as completed. The dashboard is updated.',
  missed: 'Marked as missed. Next step: pick a new time for the call.',
  sparks: 'New conversation sparks are ready.',
  threshold: 'Alert setting updated.',
  reset: 'Demo data reset. Dates now start from today.',
};
const WARN = {
  outside_hours: "Heads up: that time is outside the pair's usual shared availability. Double-check it works for both of them.",
  live_fallback: 'Live AI was unavailable, so these sparks came from the built-in ideas.',
  match_misfit: 'Saved, but the current match no longer fits. The note on this page says why and what to do.',
};

const toArray = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const str = (v) => (typeof v === 'string' ? v.trim() : Array.isArray(v) ? String(v[0] ?? '').trim() : '');

// Optional `back` (a path on this site) returns the user to the page they came from.
// Anything that could leave the site ("//evil.example") is ignored.
function safeBack(v) {
  const back = str(v);
  return back.startsWith('/') && !back.startsWith('//') && !back.startsWith('/\\') ? back : null;
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
const chars = (s) => [...s].length;
// True if the text has nothing you can see (only spaces or zero-width characters).
const isInvisible = (s) => !s.replace(/[\s\p{Cf}\p{Z}]/gu, '');
// Whole numbers typed as plain digits only: "80", not "0x50", "8e1", or "80.0".
const wholeNumber = (s) => (/^\d{1,4}$/.test(s) ? Number(s) : NaN);

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
  if (isInvisible(values.name)) errors.name = 'Enter the senior’s full name.';
  else if (chars(values.name) > 80) errors.name = 'Name must be 80 characters or fewer.';
  if (chars(values.preferredName) > 40) errors.preferredName = 'Preferred name must be 40 characters or fewer.';
  if (values.age) {
    const n = wholeNumber(values.age);
    if (!Number.isInteger(n) || n < 50 || n > 120) errors.age = 'Age must be a whole number between 50 and 120, or left blank.';
    else values.age = n;
  } else {
    values.age = null;
  }
  if (chars(values.neighborhood) > 80) errors.neighborhood = 'Neighborhood must be 80 characters or fewer.';
  if (!values.interests.length) errors.interests = 'Choose at least one interest.';
  if (chars(values.aboutMe) > 500) errors.aboutMe = `“About them” must be 500 characters or fewer (now ${chars(values.aboutMe)}).`;
  if (!values.availability.length) errors.availability = 'Choose at least one time block.';
  if (!isMethod(values.contactMethod)) errors.contactMethod = 'Choose how they prefer to connect.';
  if (chars(values.caregiver.name) > 80) errors.caregiverName = 'Name must be 80 characters or fewer.';
  if (chars(values.caregiver.relationship) > 80) errors.caregiverRelationship = 'Relationship must be 80 characters or fewer.';
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
  if (isInvisible(values.name)) errors.name = 'Enter the volunteer’s full name.';
  else if (chars(values.name) > 80) errors.name = 'Name must be 80 characters or fewer.';
  if (chars(values.affiliation) > 100) errors.affiliation = 'This must be 100 characters or fewer.';
  if (!values.interests.length) errors.interests = 'Choose at least one interest.';
  if (!values.availability.length) errors.availability = 'Choose at least one time block.';
  if (!values.contactMethods.length) errors.contactMethods = 'Choose at least one way to connect.';
  if (!Number.isInteger(values.maxSeniors) || values.maxSeniors < 1 || values.maxSeniors > 5) {
    errors.maxSeniors = 'Choose between 1 and 5 seniors.';
  }
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
  if (!match) errors.matchId = 'Choose who this call is for.';
  if (!isMethod(form.type)) errors.type = 'Choose phone, video, or visit.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) errors.date = 'Enter a date.';
  if (!/^\d{2}:\d{2}$/.test(form.time)) errors.time = 'Enter a time.';
  let when = null;
  if (!errors.date && !errors.time) {
    when = parseLocalDateTime(form.date, form.time); // Carmel time, even on a UTC server
    const [hour, minute] = form.time.split(':').map(Number);
    if (!when && !parseLocalDateTime(form.date, '12:00')) {
      errors.date = 'Enter a real date.';
    } else if (!when && (hour > 23 || minute > 59)) {
      errors.time = 'Enter a real time, from 00:00 to 23:59.';
    } else if (!when) {
      // The date is real, so the time was skipped when the clocks sprang forward.
      errors.time = 'That time didn’t exist that day: the clocks jumped from 2:00 AM to 3:00 AM. Choose 3:00 AM or later.';
    } else if (form.action === 'schedule' && when < new Date(now.getTime() - 5 * 60 * 1000)) {
      errors.date = 'A scheduled call must be in the future. To record a past call, choose “Log one that already happened.”';
    } else if (form.action === 'log' && when > new Date(now.getTime() + 5 * 60 * 1000)) {
      errors.date = 'A logged call can’t be in the future. To plan ahead, choose “Schedule a future call or visit.”';
    } else if (Math.abs(calendarDaysBetween(when, now)) > 366) {
      errors.date = 'Choose a date within the next or past year.';
    }
  }
  let duration = null;
  if (form.durationMinutes) {
    duration = wholeNumber(form.durationMinutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 480) {
      errors.durationMinutes = 'Length must be a whole number of minutes from 1 to 480, or left blank.';
    }
  }
  if (chars(form.notes) > 500) errors.notes = 'Notes must be 500 characters or fewer.';
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
  const render = (req, res, { title, active, body, status = 200, wide = false, flash }) =>
    res.html(String(layout({ title, active, body, req, ctx: { sparks: shownSparks() }, flash: flash ?? flashFrom(req), wide })), status);

  const renderError = (req, res, status, message) =>
    render(req, res, {
      title: status === 404 ? 'Not found' : 'Error',
      body: errorPage({
        status,
        message: status === 413 ? 'That form had more text than PorchLight can save at once.' : message,
      }),
      status,
    });

  const seniorOr404 = (id) => {
    const s = store.senior(id);
    if (!s) throw httpError(404, 'We could not find that senior.');
    return s;
  };
  const volunteerOr404 = (id) => {
    const v = store.volunteer(id);
    if (!v) throw httpError(404, 'We could not find that volunteer.');
    return v;
  };
  const assess = (senior) =>
    assessSenior(senior, {
      contacts: store.contactsForSenior(senior.id),
      activeMatch: store.activeMatchForSenior(senior.id),
      thresholdDays: store.settings.riskThresholdDays,
      now: now(),
    });
  const withPeople = (c) => ({ ...c, senior: store.senior(c.seniorId), volunteer: store.volunteer(c.volunteerId) });
  // What no longer fits between a matched pair (no shared time, or a way of
  // connecting the volunteer doesn't offer), using the Match page's own rules.
  // Capacity is left out: the pair already counts toward it.
  const misfitOf = (senior, volunteer) => (senior && volunteer ? scorePair(senior, volunteer, 0).problems : []);

  // ----- home -----
  router.get('/', (req, res) => {
    const summary = dashboardSummary(store, now());
    const stats = {
      seniors: store.seniors.length,
      activeMatches: store.matches.filter((m) => m.active).length,
      checkInsThisWeek: store.contacts.filter(
        (c) => c.status === 'completed' && calendarDaysBetween(c.completedAt, now()) <= 6
      ).length,
      flagged: summary.filter(needsAttention).length,
    };
    const attention = summary.filter(needsAttention); // the same list as /attention
    render(req, res, { title: 'Home', active: 'home', body: homePage({ stats, attention }) });
  });

  router.get('/about-ai', (req, res) => {
    render(req, res, {
      title: 'How the AI works',
      body: aboutAiPage({ modeInfo: sparks.modeInfo, model: sparks.model, lastFallback: sparks.lastFallback || null }),
    });
  });

  router.get('/healthz', (req, res) => res.json({ ok: true, sparkMode: sparks.modeInfo.effective }));

  // ----- seniors -----
  router.get('/seniors', (req, res) => {
    const rows = [...store.seniors]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((senior) => {
        const m = store.activeMatchForSenior(senior.id);
        return { senior, assessment: assess(senior), volunteer: m ? store.volunteer(m.volunteerId) : null };
      });
    render(req, res, { title: 'Seniors', active: 'seniors', body: seniorsListPage({ rows }) });
  });

  router.get('/seniors/new', (req, res) => {
    render(req, res, { title: 'Add a senior', active: 'seniors', body: seniorFormPage({ isNew: true }) });
  });

  router.post('/seniors', (req, res) => {
    const { values, errors } = validateSenior(req.body);
    if (Object.keys(errors).length) {
      return render(req, res, {
        title: 'Fix the form: Add a senior', active: 'seniors', status: 200,
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
    render(req, res, {
      title: senior.name,
      active: 'seniors',
      wide: true,
      body: seniorProfilePage({
        senior,
        assessment: assess(senior),
        volunteer: match ? store.volunteer(match.volunteerId) : null,
        match,
        upcoming,
        recent,
        sparkSet: store.latestSparkSet(senior.id),
        sparkMode: sparks.modeInfo,
        misfit: match ? misfitOf(senior, store.volunteer(match.volunteerId)) : [],
        hideNotice: req.query.warn === 'live_fallback', // the flash banner already says it
      }),
    });
  });

  router.get('/seniors/:id/edit', (req, res) => {
    const senior = seniorOr404(req.params.id);
    render(req, res, { title: `Edit ${senior.name}`, active: 'seniors', body: seniorFormPage({ senior, isNew: false }) });
  });

  router.post('/seniors/:id', (req, res) => {
    const senior = seniorOr404(req.params.id);
    const { values, errors } = validateSenior(req.body);
    if (Object.keys(errors).length) {
      return render(req, res, {
        title: `Fix the form: Edit ${senior.name}`, active: 'seniors', status: 200,
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
  router.get('/volunteers', (req, res) => {
    const rows = [...store.volunteers]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((volunteer) => ({
        volunteer,
        seniors: store.activeMatchesForVolunteer(volunteer.id).map((m) => store.senior(m.seniorId)).filter(Boolean),
      }));
    render(req, res, { title: 'Volunteers', active: 'volunteers', body: volunteersListPage({ rows }) });
  });

  router.get('/volunteers/new', (req, res) => {
    render(req, res, { title: 'Add a volunteer', active: 'volunteers', body: volunteerFormPage({ isNew: true }) });
  });

  router.post('/volunteers', (req, res) => {
    const { values, errors } = validateVolunteer(req.body);
    if (Object.keys(errors).length) {
      return render(req, res, {
        title: 'Fix the form: Add a volunteer', active: 'volunteers', status: 200,
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
        const senior = store.senior(match.seniorId);
        return senior ? { senior, match, assessment: assess(senior), misfit: misfitOf(senior, volunteer) } : null;
      })
      .filter(Boolean);
    render(req, res, { title: volunteer.name, active: 'volunteers', body: volunteerProfilePage({ volunteer, assigned }) });
  });

  router.get('/volunteers/:id/edit', (req, res) => {
    const volunteer = volunteerOr404(req.params.id);
    render(req, res, { title: `Edit ${volunteer.name}`, active: 'volunteers', body: volunteerFormPage({ volunteer, isNew: false }) });
  });

  router.post('/volunteers/:id', (req, res) => {
    const volunteer = volunteerOr404(req.params.id);
    const { values, errors } = validateVolunteer(req.body);
    const current = store.activeMatchesForVolunteer(volunteer.id).length;
    if (!errors.maxSeniors && values.maxSeniors < current) {
      const first = volunteer.name.split(' ')[0];
      errors.maxSeniors = `${first} is companion to ${current} seniors right now. To lower this below ${current}, end one of ${first}’s matches first.`;
    }
    if (Object.keys(errors).length) {
      return render(req, res, {
        title: `Fix the form: Edit ${volunteer.name}`, active: 'volunteers', status: 200,
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
  router.get('/match', (req, res) => {
    if (req.query.seniorId) {
      const senior = seniorOr404(req.query.seniorId);
      const currentMatch = store.activeMatchForSenior(senior.id);
      const ranking = rankVolunteers(senior, store.volunteers, store.matches);
      return render(req, res, {
        title: `Match ${senior.name}`, active: 'match',
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
    render(req, res, { title: 'Match', active: 'match', body: matchIndexPage({ unmatched, matched }) });
  });

  router.post('/matches', (req, res) => {
    const senior = seniorOr404(str(req.body.seniorId));
    const volunteer = volunteerOr404(str(req.body.volunteerId));
    if (store.activeMatchForSenior(senior.id)) throw httpError(409, `${senior.name} already has a companion. End that match first.`);
    // Re-check the rules on the server. Never trust that the form was up to date.
    const result = rankVolunteers(senior, [volunteer], store.matches);
    if (!result.eligible.length) {
      throw httpError(409, `${volunteer.name} can't be matched with ${senior.name}: ${result.ineligible[0].problems.join('; ')}.`);
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

  router.post('/matches/:id/end', (req, res) => {
    const match = store.matches.find((m) => m.id === req.params.id && m.active);
    if (!match) throw httpError(404, 'We could not find that match.');
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
    res.redirect(`/match?seniorId=${match.seniorId}&msg=match_ended`);
  });

  // ----- calls & visits -----
  const contactsView = (req, res, { form, errors = {}, status = 200 }) => {
    const nowDate = now();
    const pairs = store.matches
      .filter((m) => m.active)
      .map((match) => ({ match, senior: store.senior(match.seniorId), volunteer: store.volunteer(match.volunteerId) }))
      .filter((p) => p.senior && p.volunteer)
      .sort((a, b) => a.senior.name.localeCompare(b.senior.name));
    const scheduled = store.contacts
      .filter((c) => c.status === 'scheduled')
      .map((c) => ({ ...withPeople(c), canLog: canLogNow(c, nowDate), canMiss: canMarkMissedNow(c, nowDate) }))
      .filter((c) => c.senior)
      .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
    const happenedAt = (c) => new Date(c.completedAt || c.cancelledAt || c.scheduledFor);
    const recent = store.contacts
      .filter((c) => c.status !== 'scheduled')
      .map(withPeople)
      .filter((c) => c.senior)
      .sort((a, b) => happenedAt(b) - happenedAt(a))
      .slice(0, 15);
    render(req, res, {
      title: Object.keys(errors).length ? 'Fix the form: Calls & visits' : 'Calls & visits',
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
    const match = store.matches.find((m) => m.id === matchId && m.active);
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
    if (!contact) throw httpError(404, 'We could not find that call.');
    if (contact.status === 'cancelled') {
      throw httpError(409, 'That call was cancelled when the match ended, so it can’t be logged or marked missed.');
    }
    if (contact.status !== 'scheduled') throw httpError(409, 'That call was already marked.');
    const nowDate = now();
    const noun = contact.type === 'visit' ? 'visit' : 'call';
    let reason = null;
    let reasonNote = null;
    if (status === 'missed') {
      // Optional reason. Old forms without one still work.
      reason = str(req.body.reason);
      reasonNote = str(req.body.reasonNote);
      if (reason && !isMissedReason(reason)) throw httpError(400, 'Choose a reason from the list.');
      if (chars(reasonNote) > 200) throw httpError(400, 'The note about the missed call must be 200 characters or fewer.');
      // A call that hasn't started yet can't have been missed.
      if (!canMarkMissedNow(contact, nowDate)) {
        throw httpError(409, `That ${noun} is set for ${formatDateTime(contact.scheduledFor)}, so it hasn’t been missed yet. You can mark it missed once that time has passed.`);
      }
    } else if (!canLogNow(contact, nowDate)) {
      // Only on its day or later (Carmel calendar): a Thursday visit can't be logged on Tuesday.
      throw httpError(409, `That ${noun} is set for ${formatLongDate(contact.scheduledFor)} at ${formatTime(contact.scheduledFor)}. You can mark it done on that day, once it has happened.`);
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
    render(req, res, {
      title: Object.keys(errors).length ? 'Fix the form: Family dashboard' : 'Family dashboard',
      active: 'dashboard',
      status,
      wide: true,
      flash: Object.keys(errors).length ? false : undefined,
      body: dashboardPage({
        summary: dashboardSummary(store, now()),
        threshold: store.settings.riskThresholdDays,
        volunteersById: new Map(store.volunteers.map((v) => [v.id, v])),
        errors,
        thresholdInput,
      }),
    });
  };
  router.get('/dashboard', (req, res) => dashboardView(req, res));

  router.post('/settings', (req, res) => {
    const raw = str(req.body.riskThresholdDays);
    const n = wholeNumber(raw);
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      return dashboardView(req, res, {
        errors: { riskThresholdDays: 'Enter a whole number of days from 1 to 60.' },
        thresholdInput: raw,
        status: 200,
      });
    }
    store.settings.riskThresholdDays = n;
    store.save();
    res.redirect('/dashboard?msg=threshold');
  });

  // ----- preferences & demo tools -----
  router.post('/prefs/text-size', (req, res) => {
    const size = str(req.body.size);
    if (TEXT_SIZES.some((s) => s.id === size)) res.setCookie('textsize', size);
    // Only redirect to a path on this site (prevents "open redirect" tricks).
    const back = str(req.body.back);
    res.redirect(back.startsWith('/') && !back.startsWith('//') ? back : '/');
  });

  router.get('/demo/reset', (req, res) => {
    render(req, res, { title: 'Reset demo data', body: resetConfirmPage() });
  });

  router.post('/demo/reset', (req, res) => {
    store.reset(now());
    res.redirect('/dashboard?msg=reset');
  });

  // ----- add-on modules -----
  // Each module registers its own routes, so adding one never means editing
  // this file. `ctx` is the contract they get.
  const ctx = {
    store, sparks, now, render, assess, seniorOr404, volunteerOr404, withPeople,
    httpError, str, toArray, safeBack,
    flashMessages: FLASH, // add keys: ctx.flashMessages.my_key = 'Text'
    warnMessages: WARN,
  };
  registerFeatures(router, ctx);
  registerIndiana(router, ctx);
  registerDesignPages(router, ctx);

  return createHandler({ router, renderError });
}
