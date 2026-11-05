// Senior screens: list, profile (with Conversation Sparks), and add/edit form.

import { html, formatDateTime, formatDate, daysAgoText } from '../html.js';
import {
  statusBadge, trendBadge, chips, slotList, errorSummary, textField, textArea,
  interestCheckboxes, availabilityFieldset, methodRadios, methodLabel, banner, backLink, emptyState, sparkSourceLabel,
} from '../components.js';
import { placeText, townLabel } from '../../towns/index.js'; // [towns]
import { townSelectField } from '../../towns/views.js'; // [towns]
import { t } from '../../i18n/index.js'; // [v2 translate] the Messages link
import { bilingualSpark } from '../../translate/views.js'; // [v2 translate] sparks in both languages
import { noPhone } from '../../roles/viewer.js'; // phone numbers are never displayed, even if typed into a name field

export function seniorsListPage({ rows, townFilter = '', townName = null }) { // [towns] townFilter, townName
  return html`
    <div class="page-head">
      <h1>Seniors</h1>
      <a class="button" href="/seniors/new">Add a senior</a>
    </div>
    <p class="lead">Everyone in PorchLight, with their companion and how recently someone called or visited.</p>
    ${townFilter}
    ${rows.length
      ? html`<ul class="card-list">
      ${rows.map(
        ({ senior, assessment, volunteer }) => html`
        <li class="card">
          <h2 class="card-title"><a href="/seniors/${senior.id}">${senior.name}</a></h2>
          <p class="card-meta">${senior.age ? `Age ${senior.age} · ` : ''}${placeText(senior)} · prefers ${methodLabel(senior.contactMethod).toLowerCase()}s</p>
          <p class="badges">${statusBadge(assessment.status, assessment.info)} ${trendBadge(assessment.trend)}</p>
    <p><a href="/seniors/${senior.id}/summary">Weekly summary for family</a></p>
          <p>${volunteer
            ? html`Companion: <a href="/volunteers/${volunteer.id}">${volunteer.name}</a>`
            : html`No companion yet. <a href="/match?seniorId=${senior.id}">Find a companion</a>`}</p>
          <p class="muted">${assessment.lastContact ? `Last call or visit: ${daysAgoText(assessment.daysSince)}` : 'No calls or visits yet'}</p>
        </li>`
      )}
    </ul>`
      : townName // [towns]
        ? emptyState(html`<p><strong>No seniors in ${townName}.</strong> <a href="/seniors">Show all towns</a></p>`)
        : emptyState(html`<p><strong>No seniors yet.</strong> Add the first person who would like a companion.</p>
          <p><a href="/seniors/new">Add a senior</a></p>`)}`;
}

function sparkPanel({ senior, volunteer = null, sparkSet, sparkMode, hideNotice = false }) {
  const name = senior.preferredName || senior.name.split(' ')[0];
  const nextVariant = sparkSet ? (sparkSet.variant || 0) + 1 : 0;
  return html`
    <section class="panel spark-panel" id="sparks" aria-labelledby="sparks-heading" tabindex="-1">
      <h2 id="sparks-heading"><span aria-hidden="true">✦</span> Conversation sparks for ${name}</h2>
      <p>Three suggested ways to start the next conversation, based on ${name}'s interests and how long it has been since the last call or visit. They are only suggestions: use your own words.</p>
      ${sparkSet
        ? html`
          ${sparkSet.notice && !hideNotice ? banner({ kind: 'status', text: sparkSet.notice }) : ''}
          <ol class="sparks">
            ${sparkSet.sparks.map(
              (s) => html`<li><p class="spark-text">${s.text}</p>${bilingualSpark(s, { senior, volunteer, sparkSet })}<p class="spark-basis">Based on: ${s.basedOn}</p></li>`
            )}
          </ol>
          ${sparkSet.tip ? html`<p class="tip"><strong>Volunteer tip:</strong> ${sparkSet.tip}</p>` : ''}
          <p class="muted">Suggestions only. ${sparkSourceLabel(sparkSet)} · ${formatDateTime(sparkSet.createdAt)}</p>`
        : emptyState(html`<p><strong>No sparks yet for ${name}.</strong> Press “Get conversation sparks” for three ideas to use on the next call.</p>`)}
      <form method="post" action="/seniors/${senior.id}/sparks" class="inline-form" data-busy-text="${sparkMode.effective === 'live' ? 'Asking Claude…' : 'Working…'}">
        <input type="hidden" name="variant" value="${nextVariant}">
        <button type="submit" class="button">${sparkSet ? 'Show different sparks' : 'Get conversation sparks'}</button>
      </form>
    </section>`;
}

// `misfit`: what no longer fits between this senior and their companion
// (e.g. "No overlapping availability"), after an edit to either profile.
// `hideNotice`: the page already shows the same live-AI notice as a banner.
// `hideSparks` [roles]: family and senior views leave out the volunteer's sparks.
export function seniorProfilePage({ senior, assessment, volunteer, match, upcoming, recent, sparkSet, sparkMode, misfit = [], hideNotice = false, hideSparks = false, seniorView = false }) {
  const name = senior.preferredName || senior.name.split(' ')[0];
  return html`
    ${backLink('/seniors', 'all seniors')}
    <div class="page-head">
      <h1>${senior.name}${senior.preferredName && senior.preferredName !== senior.name.split(' ')[0] ? html` <span class="aka">(“${senior.preferredName}”)</span>` : ''}</h1>
      <a class="button button-secondary" href="/seniors/${senior.id}/edit">Edit profile</a>
    </div>
    ${seniorView ? '' : html`<p class="badges">${statusBadge(assessment.status, assessment.info)} ${trendBadge(assessment.trend)}</p>`}
    ${volunteer && misfit.length ? misfitNote({ senior, volunteer, misfit }) : ''}

    <section class="panel welcome" aria-labelledby="welcome-heading">
      <h2 id="welcome-heading">Hi ${name}! Here is your PorchLight.</h2>
      ${volunteer
        ? html`<p class="big">Your companion is <strong>${volunteer.name}</strong>.</p>`
        : html`<p class="big">We're finding a companion for you.</p>`}
      ${volunteer && match ? html`<p><a class="button button-secondary" href="/messages/${match.id}">${t('translate.thread.title', { name: volunteer.name.split(' ')[0] })}</a></p>` : ''}
      ${assessment.nextScheduled
        ? html`<p class="big">Your next ${methodLabel(assessment.nextScheduled.type).toLowerCase()}: <strong>${formatDateTime(assessment.nextScheduled.scheduledFor)}</strong>.</p>`
        : html`<p class="big">No call is scheduled yet.</p>`}
    </section>

    <div class="two-col">
      <div>
        ${hideSparks ? '' : sparkPanel({ senior, volunteer, sparkSet, sparkMode, hideNotice })}

        <section class="panel" aria-labelledby="contacts-heading">
          <h2 id="contacts-heading">Calls and visits</h2>
          ${match
            ? html`<p><a class="button button-secondary" href="/contacts?matchId=${match.id}">Schedule or log a call</a></p>`
            : html`<p><a class="button" href="/match?seniorId=${senior.id}">Find a companion for ${name}</a></p>`}
          <h3>Coming up</h3>
          ${upcoming.length
            ? html`<ul class="plain-list">${upcoming.map((c) => html`<li>${methodLabel(c.type)}: ${formatDateTime(c.scheduledFor)} <a href="/contacts/${c.id}/calendar.ics" download>Add to calendar<span class="visually-hidden">: ${methodLabel(c.type)} on ${formatDateTime(c.scheduledFor)}</span></a></li>`)}</ul>`
            : emptyState(match
              ? seniorView
                ? html`<p><strong>Nothing scheduled yet.</strong> Your companion will set up the next call with you.</p>`
                : html`<p><strong>Nothing scheduled.</strong> <a href="/contacts?matchId=${match.id}">Schedule the next call</a> so ${name} has something to look forward to.</p>`
              : html`<p><strong>Nothing scheduled.</strong> Calls can be scheduled once ${name} has a companion.</p>`)}
          <h3>Recent</h3>
          ${recent.length
            ? html`<ul class="plain-list">${recent.map(
                (c) => html`<li><strong>${formatDate(c.completedAt || c.scheduledFor)}</strong>: ${methodLabel(c.type)}${c.status === 'missed' ? html` <span class="badge badge-missed">Missed</span>` : c.status === 'cancelled' ? ' (cancelled: the match ended)' : c.durationMinutes ? ` (${c.durationMinutes} min)` : ''}${c.notes ? html`<br><span class="muted">${c.notes}</span>` : ''}</li>`
              )}</ul>`
            : emptyState(html`<p><strong>No calls or visits written down yet.</strong> After a call, log it on the <a href="/contacts${match ? `?matchId=${match.id}` : ''}">Calls &amp; Visits page</a>.</p>`)}
        </section>
      </div>

      <div>
        <section class="panel" aria-labelledby="about-heading">
          <h2 id="about-heading">About ${name}</h2>
          <dl class="facts">
            <dt>Age</dt><dd>${senior.age || 'Not given'}</dd>
            <dt>Neighborhood</dt><dd>${senior.neighborhood || 'Not given'}</dd>
            <dt>Town</dt><dd>${townLabel(senior)}</dd>
            <dt>Prefers</dt><dd>${methodLabel(senior.contactMethod)}s</dd>
            <dt>Companion</dt><dd>${volunteer ? html`<a href="/volunteers/${volunteer.id}">${volunteer.name}</a>` : 'Not matched yet'}</dd>
            <dt>Family contact</dt><dd>${senior.caregiver?.name ? `${noPhone(senior.caregiver.name)}${senior.caregiver.relationship ? ` (${noPhone(senior.caregiver.relationship)})` : ''}` : 'Not given'}</dd>
            <dt>Last call or visit</dt><dd>${assessment.lastContact ? `${daysAgoText(assessment.daysSince)} (${formatDate(assessment.lastContact.completedAt)})` : 'None yet'}</dd>
          </dl>
          ${senior.aboutMe ? html`<h3>In their own words</h3><p>${senior.aboutMe}</p>` : ''}
          <h3>Interests</h3>
          ${chips(senior.interests)}
          <h3>Usually available</h3>
          ${slotList(senior.availability)}
        </section>
      </div>
    </div>`;
}

// A match that no longer fits: say what changed and what to do. Never shown in
// color alone (the banner has an icon and a word).
export function misfitNote({ senior, volunteer, misfit }) {
  const name = senior.preferredName || senior.name.split(' ')[0];
  return banner({
    kind: 'warning',
    text: `${name}'s match with ${volunteer.name} no longer fits: ${misfit.join('; ')}. Update one of the profiles, or find ${name} a new companion.`,
    next: { href: `/attention/${senior.id}/rematch`, label: `Review ${name}'s match` },
  });
}

export function seniorFormPage({ senior = {}, errors = {}, isNew }) {
  const action = isNew ? '/seniors' : `/seniors/${senior.id}`;
  const first = (senior.preferredName || senior.name || '').split(' ')[0];
  return html`
    ${isNew ? backLink('/seniors', 'all seniors') : backLink(`/seniors/${senior.id}`, `${first || 'this senior'}'s profile`)}
    <h1>${isNew ? 'Add a senior' : `Edit ${senior.name}`}</h1>
    <p class="lead">${isNew ? 'Tell us a little about the person who would like a companion.' : 'Update this profile. Changes take effect right away.'}</p>
    ${errorSummary(errors)}
    <form method="post" action="${action}" class="stack-form" novalidate>
      ${textField({ name: 'name', label: 'Full name', value: senior.name, error: errors.name, required: true, autocomplete: 'off' })}
      ${textField({ name: 'preferredName', label: 'What they like to be called', value: senior.preferredName, error: errors.preferredName, hint: 'For example "Hal" for Harold. Volunteers and sparks will use this name.' })}
      ${textField({ name: 'age', label: 'Age', value: senior.age, error: errors.age, type: 'number', attrs: 'inputmode="numeric" min="50" max="120"' })}
      ${textField({ name: 'neighborhood', label: 'Neighborhood', value: senior.neighborhood, error: errors.neighborhood, hint: 'For example "Old Town" or "near the library".' })}
      ${townSelectField(senior, errors.town)}
      ${interestCheckboxes(senior.interests || [], errors.interests)}
      ${textArea({ name: 'aboutMe', label: 'About them, in their own words', value: senior.aboutMe, error: errors.aboutMe, hint: 'A few sentences about their life and what they enjoy. Used to make the conversation sparks personal. Please leave out phone numbers, emails, and addresses: PorchLight removes phone numbers and emails before anything goes to the AI. Up to 500 characters.' })}
      ${availabilityFieldset(senior.availability || [], errors.availability)}
      ${methodRadios(senior.contactMethod, errors.contactMethod)}
      <fieldset class="choice-group">
        <legend>Family or caregiver contact (optional)</legend>
        ${textField({ name: 'caregiverName', label: 'Name', value: senior.caregiver?.name, error: errors.caregiverName })}
        ${textField({ name: 'caregiverRelationship', label: 'Relationship', value: senior.caregiver?.relationship, error: errors.caregiverRelationship, hint: 'For example "Daughter, lives in Chicago".' })}
      </fieldset>
      <div class="form-actions">
        <button type="submit" class="button">${isNew ? 'Add senior' : 'Save changes'}</button>
        <a class="button button-secondary" href="${isNew ? '/seniors' : `/seniors/${senior.id}`}">Cancel</a>
      </div>
    </form>`;
}
