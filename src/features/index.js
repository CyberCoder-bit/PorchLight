// Day-to-day features: the "Needs attention" queue, a
// volunteer's "My week", the weekly family summary, and calendar files.
// Register routes here; never edit src/app.js. See the ctx contract in app.js.
//
// None of these routes call the AI. My week only shows sparks that were
// already saved; making new ones is the existing POST /seniors/:id/sparks.

import { buildAttentionQueue } from './attention.js';
import { completedContacts } from '../risk.js';
import { missedCallsWithin } from './words.js';
import { attentionPage, rematchPage } from '../views/features/attention.js';

export function registerFeatures(router, ctx) {
  const { store, now, render } = ctx;

  // ----- Needs attention (coordinator queue) -----
  router.get('/attention', (req, res) => {
    const queue = buildAttentionQueue(store, now());
    render(req, res, { title: 'Needs attention', active: 'attention', body: attentionPage(queue) });
  });

  // Confirm page for ending a match. The button posts to the existing
  // POST /matches/:id/end, which keeps all history and redirects to
  // /match?seniorId=...&msg=match_ended.
  router.get('/attention/:seniorId/rematch', (req, res) => {
    const senior = ctx.seniorOr404(req.params.seniorId);
    const match = store.activeMatchForSenior(senior.id);
    const volunteer = match ? store.volunteer(match.volunteerId) : null;
    const contacts = store.contactsForSenior(senior.id).filter((c) => match && c.volunteerId === match.volunteerId);
    render(req, res, {
      title: match ? `Find a new companion for ${senior.name}` : `${senior.name} has no companion`,
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
}
