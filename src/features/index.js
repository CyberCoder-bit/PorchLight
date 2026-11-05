// Day-to-day features: the "Needs attention" queue, a
// volunteer's "My week", the weekly family summary, and calendar files.
// Register routes here; never edit src/app.js. See the ctx contract in app.js.
//
// None of these routes call the AI. My week only shows sparks that were
// already saved; making new ones is the existing POST /seniors/:id/sparks.

import { buildAttentionQueue } from './attention.js';
import { completedContacts } from '../risk.js';
import { missedCallsWithin } from './words.js';
import { buildWeek } from './week.js';
import { buildFamilySummary } from './summary.js';
import { buildCallIcs, sendDownload } from './calendar.js';
import { attentionPage, rematchPage } from '../views/features/attention.js';
import { myWeekPage } from '../views/features/week.js';
import { familySummaryPage } from '../views/features/summary.js';
import { townFromQuery, rowsInTown } from '../towns/index.js'; // [towns]
import { townFilter } from '../towns/views.js'; // [towns]
import { storeSeenBy, volunteerFirstNameOnly } from '../roles/index.js'; // [v2 accounts] each person sees only what is theirs
import { t } from '../i18n/index.js'; // [v2 i18n]

export function registerFeatures(router, ctx) {
  const { store, now, render } = ctx;

  // ----- Needs attention (coordinator queue) -----
  router.get('/admin/attention', (req, res) => {
    const queue = buildAttentionQueue(store, now());
    // [towns] ?town=Westfield shows only that town's seniors; unknown towns are ignored.
    const town = townFromQuery(req.query);
    const items = rowsInTown(queue.items, town, (i) => i.senior);
    const filtered = { ...queue, items, comingUp: rowsInTown(queue.comingUp, town, (a) => a.senior), townName: town };
    filtered.townFilter = townFilter({ action: '/admin/attention', town, asked: req.query.town, shown: items.length, total: queue.items.length, noun: 'core.towns.count.onList' });
    render(req, res, { title: t('core.attention.title'), active: 'attention', body: attentionPage(filtered) });
  });

  // Confirm page for ending a match. The button posts to the existing
  // POST /admin/matches/:id/end, which keeps all history and redirects to
  // /admin/match?seniorId=...&msg=match_ended.
  router.get('/attention/:seniorId/rematch', (req, res) => {
    const senior = ctx.seniorOr404(req.params.seniorId);
    const match = store.activeMatchForSenior(senior.id);
    const volunteer = match ? store.volunteer(match.volunteerId) : null;
    const contacts = store.contactsForSenior(senior.id).filter((c) => match && c.volunteerId === match.volunteerId);
    render(req, res, {
      title: match ? t('core.rematch.pageTitle', { name: senior.name }) : t('core.rematch.pageTitleNone', { name: senior.name }),
      active: 'attention',
      body: rematchPage({
        senior,
        match,
        volunteer,
        together: completedContacts(contacts),
        missedWithVolunteer: missedCallsWithin(contacts, now()),
      }),
    });
  });

  // ----- My week (volunteer) -----
  router.get('/volunteers/:id/week', (req, res) => {
    const volunteer = ctx.volunteerOr404(req.params.id);
    const busyText = ctx.sparks.modeInfo.effective === 'live' ? t('core.week.askingClaude') : t('core.week.working');
    render(req, res, {
      title: t('core.week.title', { name: volunteer.name }),
      active: 'volunteers',
      body: myWeekPage(buildWeek(storeSeenBy(req.viewer, store), volunteer, now()), { busyText }), // [v2] a volunteer sees first names only
    });
  });

  // ----- Weekly family summary -----
  router.get('/seniors/:id/summary', (req, res) => {
    const senior = ctx.seniorOr404(req.params.id);
    const match = store.activeMatchForSenior(senior.id);
    const summary = buildFamilySummary({
      senior,
      assessment: ctx.assess(senior),
      volunteer: match ? (req.viewer?.kind === 'family' ? volunteerFirstNameOnly(store.volunteer(match.volunteerId)) : store.volunteer(match.volunteerId)) : null, // [v2] family: first name only
      contacts: store.contactsForSenior(senior.id),
      thresholdDays: store.settings.riskThresholdDays,
      now: now(),
    });
    render(req, res, { title: t('core.summary.title', { name: senior.name }), active: 'dashboard', body: familySummaryPage(summary) });
  });

  // ----- Add to calendar (.ics) for a scheduled call -----
  router.get('/contacts/:id/calendar.ics', (req, res) => {
    const contact = store.contacts.find((c) => c.id === req.params.id);
    const senior = contact ? store.senior(contact.seniorId) : null;
    if (!contact || !senior) throw ctx.httpError(404, t('core.calendar.notFound'));
    if (contact.status === 'cancelled') throw ctx.httpError(409, t('core.calendar.cancelled'));
    if (contact.status !== 'scheduled') throw ctx.httpError(409, t('core.calendar.marked'));
    const { body, filename } = buildCallIcs({ contact, senior, volunteer: store.volunteer(contact.volunteerId), now: now() });
    sendDownload(res, { body, contentType: 'text/calendar; charset=utf-8', filename });
  });
}
