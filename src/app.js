// All routes. createApp() returns a Web-standard handler, (Request) => Response,
// so the same app runs under Node (node-server.js) and on Cloudflare Workers
// (worker.js), and tests can run it against a temporary data file.

import { Router, createHandler, httpError } from './http.js';
import { parseLocalDateTime, startOfLocalDay } from './tz.js';
import { isInterest, isSlot, isMethod, slotForDate, isMissedReason } from './vocab.js';
import { rankVolunteers } from './matching.js';
import { assessSenior, dashboardSummary, calendarDaysBetween } from './risk.js';
import { buildSparkInput } from './sparks/index.js';
import { layout, TEXT_SIZES } from './views/layout.js';
import { toDateInput } from './views/html.js';
import { homePage, aboutAiPage, resetConfirmPage, errorPage } from './views/pages/home.js';
import { seniorsListPage, seniorProfilePage, seniorFormPage } from './views/pages/seniors.js';
import { volunteersListPage, volunteerProfilePage, volunteerFormPage } from './views/pages/volunteers.js';
import { matchIndexPage, matchSeniorPage } from './views/pages/match.js';
import { contactsPage } from './views/pages/contacts.js';
import { dashboardPage } from './views/pages/dashboard.js';
import { registerFeatures } from './features/index.js';
import { registerIndiana } from './indiana/index.js';
import { registerDesignPages } from './views/pages/extra.js';
import { checkTown, townFromQuery, rowsInTown } from './towns/index.js'; // [towns]
import { townFilter } from './towns/views.js'; // [towns]
import { registerRoles, withoutPrivateNotes, seniorsVisibleTo, callsVisibleTo, seesEverything, isFamilyOrSenior } from './roles/index.js'; // [roles]

// Short messages shown after a form is submitted (?msg=...).
const FLASH = {
  senior_added: 'Senior added. Next step: find them a companion.',
  senior_saved: 'Profile saved.',
  volunteer_added: 'Volunteer added. They can now be matched with a senior.',
  volunteer_saved: 'Profile saved.',
  matched: 'Match confirmed! Next step: schedule the first call.',
  match_ended: 'Match ended. You can now choose a new companion.',
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
  live_fallback: 'Live AI was unavailable, so these sparks came from the offline templates.',
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
  if (!values.name) errors.name = 'Enter the senior’s full name.';
  else if (values.name.length > 80) errors.name = 'Name must be 80 characters or fewer.';
  if (values.preferredName.length > 40) errors.preferredName = 'Preferred name must be 40 characters or fewer.';
  if (values.age) {
    const n = Number(values.age);
    if (!Number.isInteger(n) || n < 50 || n > 120) errors.age = 'Age must be a whole number between 50 and 120, or left blank.';
    else values.age = n;
  } else {
    values.age = null;
  }
  if (values.neighborhood.length > 80) errors.neighborhood = 'Neighborhood must be 80 characters or fewer.';
  if (!values.interests.length) errors.interests = 'Choose at least one interest.';
  if (values.aboutMe.length > 500) errors.aboutMe = `“About them” must be 500 characters or fewer (now ${values.aboutMe.length}).`;
  if (!values.availability.length) errors.availability = 'Choose at least one time block.';
  if (!isMethod(values.contactMethod)) errors.contactMethod = 'Choose how they prefer to connect.';
  if (values.caregiver.name.length > 80) errors.caregiverName = 'Name must be 80 characters or fewer.';
  if (values.caregiver.relationship.length > 80) errors.caregiverRelationship = 'Relationship must be 80 characters or fewer.';
  checkTown(body, values, errors); // [towns] only towns on this deployment's list
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
    maxSeniors: Number(str(body.maxSeniors) || 1),
  };
  if (!values.name) errors.name = 'Enter the volunteer’s full name.';
  else if (values.name.length > 80) errors.name = 'Name must be 80 characters or fewer.';
  if (values.affiliation.length > 100) errors.affiliation = 'This must be 100 characters or fewer.';
  if (!values.interests.length) errors.interests = 'Choose at least one interest.';
  if (!values.availability.length) errors.availability = 'Choose at least one time block.';
  if (!values.contactMethods.length) errors.contactMethods = 'Choose at least one way to connect.';
  if (!Number.isInteger(values.maxSeniors) || values.maxSeniors < 1 || values.maxSeniors > 5) {
    errors.maxSeniors = 'Choose between 1 and 5 seniors.';
  }
  checkTown(body, values, errors); // [towns] only towns on this deployment's list
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
    if (!when) {
      errors.date = 'Enter a real date.';
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
    duration = Number(form.durationMinutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 480) {
      errors.durationMinutes = 'Length must be a whole number of minutes from 1 to 480, or left blank.';
    }
  }
  if (form.notes.length > 500) errors.notes = 'Notes must be 500 characters or fewer.';
  return { form, errors, match, when, duration };
}

// ---------- app ----------
// Note: when a form has errors we re-show it with status 200 (not 422) so the
// browser console stays clean during demos; the error summary tells the user.

export function createApp({ store, sparks, now = () => new Date() }) {
  const router = new Router();

  const render = (req, res, { title, active, body, status = 200, wide = false, flash }) =>
    res.html(String(layout({ title, active, body, req, ctx: { sparks }, flash: flash ?? flashFrom(req), wide })), status);

  const renderError = (req, res, status, message) =>
    render(req, res, { title: status === 404 ? 'Not found' : 'Error', body: errorPage({ status, message }), status });

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

  // ----- home -----
  router.get('/', (req, res) => {
    const summary = dashboardSummary(store, now());
    const stats = {
      seniors: store.seniors.length,
      activeMatches: store.matches.filter((m) => m.active).length,
      checkInsThisWeek: store.contacts.filter(
        (c) => c.status === 'completed' && calendarDaysBetween(c.completedAt, now()) <= 6
      ).length,
      flagged: summary.filter((r) => r.status === 'at_risk' || r.status === 'needs_match').length,
    };
    const attention = summary.filter((r) => r.status === 'at_risk' || r.status === 'needs_match');
    render(req, res, { title: 'Home', active: 'home', body: homePage({ stats, attention }) });
  });

  router.get('/about-ai', (req, res) => {
    render(req, res, { title: 'How the AI works', body: aboutAiPage({ modeInfo: sparks.modeInfo, model: sparks.model }) });
  });

  router.get('/healthz', (req, res) => res.json({ ok: true, sparkMode: sparks.modeInfo.effective }));

  // ----- seniors -----
  router.get('/seniors', (req, res) => {
    const town = townFromQuery(req.query); // [towns]
    const all = [...store.seniors]; // [towns]
    const rows = rowsInTown(all, town) // [towns]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((senior) => {
        const m = store.activeMatchForSenior(senior.id);
        return { senior, assessment: assess(senior), volunteer: m ? store.volunteer(m.volunteerId) : null };
      });
    const filter = townFilter({ action: '/seniors', town, shown: rows.length, total: all.length }); // [towns]
    render(req, res, { title: 'Seniors', active: 'seniors', body: seniorsListPage({ rows, townFilter: filter, townName: town }) }); // [towns]
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
      .filter((c) => c.status === 'scheduled' && new Date(c.scheduledFor) >= nowDate)
      .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
    const recent = contacts
      .filter((c) => c.status !== 'scheduled')
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
        recent: withoutPrivateNotes(req.viewer, recent), // [roles] family and seniors never see call notes
        sparkSet: store.latestSparkSet(senior.id),
        sparkMode: sparks.modeInfo,
        hideSparks: isFamilyOrSenior(req.viewer), // [roles] sparks are a volunteer tool
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
    res.redirect(`/seniors/${senior.id}?msg=senior_saved`);
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
    const town = townFromQuery(req.query); // [towns]
    const rows = rowsInTown([...store.volunteers], town) // [towns]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((volunteer) => ({
        volunteer,
        seniors: store.activeMatchesForVolunteer(volunteer.id).map((m) => store.senior(m.seniorId)).filter(Boolean),
      }));
    const filter = townFilter({ action: '/volunteers', town, shown: rows.length, total: store.volunteers.length, noun: ['volunteer', 'volunteers'], label: 'Show volunteers in' }); // [towns]
    render(req, res, { title: 'Volunteers', active: 'volunteers', body: volunteersListPage({ rows, townFilter: filter, townName: town }) }); // [towns]
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
        return senior ? { senior, match, assessment: assess(senior) } : null;
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
    if (Object.keys(errors).length) {
      return render(req, res, {
        title: `Fix the form: Edit ${volunteer.name}`, active: 'volunteers', status: 200,
        body: volunteerFormPage({ volunteer: { ...values, id: volunteer.id }, errors, isNew: false }), flash: false,
      });
    }
    Object.assign(volunteer, values, { updatedAt: now().toISOString() });
    store.save();
    res.redirect(`/volunteers/${volunteer.id}?msg=volunteer_saved`);
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
    match.active = false;
    match.endedAt = now().toISOString();
    store.save();
    res.redirect(`/match?seniorId=${match.seniorId}&msg=match_ended`);
  });

  // ----- calls & visits -----
  const contactsView = (req, res, { form, errors = {}, status = 200 }) => {
    const nowDate = now();
    const isMine = callsVisibleTo(req.viewer); // [roles] a volunteer sees only their own pairs and calls
    const pairs = store.matches
      .filter((m) => m.active)
      .filter(isMine) // [roles]
      .map((match) => ({ match, senior: store.senior(match.seniorId), volunteer: store.volunteer(match.volunteerId) }))
      .filter((p) => p.senior && p.volunteer)
      .sort((a, b) => a.senior.name.localeCompare(b.senior.name));
    const scheduled = store.contacts
      .filter((c) => c.status === 'scheduled')
      .filter(isMine) // [roles]
      .map(withPeople)
      .filter((c) => c.senior)
      .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
    const recent = store.contacts
      .filter((c) => c.status !== 'scheduled')
      .filter(isMine) // [roles]
      .map(withPeople)
      .filter((c) => c.senior)
      .sort((a, b) => new Date(b.completedAt || b.scheduledFor) - new Date(a.completedAt || a.scheduledFor))
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
        upcoming: scheduled.filter((c) => new Date(c.scheduledFor) >= nowDate),
        overdue: scheduled.filter((c) => new Date(c.scheduledFor) < nowDate),
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
    const tomorrow = startOfLocalDay(now(), 1); // a calendar day, even on the 25-hour day in November
    contactsView(req, res, {
      form: {
        matchId: match ? match.id : '',
        action: 'schedule',
        type: senior ? senior.contactMethod : 'phone',
        date: toDateInput(tomorrow),
        time: '16:00',
      },
    });
  });

  router.post('/contacts', (req, res) => {
    const nowDate = now();
    const { form, errors, match, when, duration } = validateContact(req.body, store, nowDate);
    if (Object.keys(errors).length) return contactsView(req, res, { form, errors, status: 200 });

    const isLog = form.action === 'log';
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
    if (contact.status !== 'scheduled') throw httpError(409, 'That call was already marked.');
    if (status === 'missed') {
      // Optional reason. Old forms without one still work.
      const reason = str(req.body.reason);
      const reasonNote = str(req.body.reasonNote);
      if (reason && !isMissedReason(reason)) throw httpError(400, 'Choose a reason from the list.');
      if (reasonNote.length > 200) throw httpError(400, 'The note about the missed call must be 200 characters or fewer.');
      contact.missedReason = reason || null;
      contact.missedNote = reasonNote || null;
    }
    contact.status = status;
    if (status === 'completed') {
      // If it was marked early, count it as happening now, not in the future.
      const nowDate = now();
      const scheduled = new Date(contact.scheduledFor);
      contact.completedAt = (scheduled > nowDate ? nowDate : scheduled).toISOString();
    }
    contact.markedAt = now().toISOString();
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
      title: Object.keys(errors).length ? 'Fix the form: Family dashboard' : 'Family dashboard',
      active: 'dashboard',
      status,
      wide: true,
      flash: Object.keys(errors).length ? false : undefined,
      body: dashboardPage({
        summary, // [towns] [roles]
        townFilter: seesEverything(req.viewer) ? townFilter({ action: '/dashboard', town, shown: summary.length, total: everyone.length }) : '', // [towns]
        townName: town, // [towns]
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
    const n = Number(raw);
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
  registerRoles(router, ctx); // [roles] must be last: adds /sign-in and checks every route on the server

  return createHandler({ router, renderError });
}
