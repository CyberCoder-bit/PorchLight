// Volunteer screens: list, profile (with assigned seniors), and add/edit form.

import { html, formatDateTime, daysAgoText } from '../html.js';
import {
  statusBadge, trendBadge, chips, slotList, errorSummary, textField,
  interestCheckboxes, availabilityFieldset, methodCheckboxes, methodLabel, selectField,
} from '../components.js';

export function volunteersListPage({ rows }) {
  return html`
    <div class="page-head">
      <h1>Volunteers</h1>
      <a class="button" href="/volunteers/new">Add a volunteer</a>
    </div>
    <p class="lead">Porch Light companions: students, retirees, and neighbors who call or visit a senior every week.</p>
    <ul class="card-list">
      ${rows.map(
        ({ volunteer, seniors }) => html`
        <li class="card">
          <h2 class="card-title"><a href="/volunteers/${volunteer.id}">${volunteer.name}</a></h2>
          <p class="card-meta">${volunteer.affiliation || 'Community volunteer'}</p>
          <p>Companion to ${seniors.length} of ${volunteer.maxSeniors} senior${volunteer.maxSeniors === 1 ? '' : 's'}${seniors.length >= volunteer.maxSeniors ? html` <span class="badge badge-full">Full</span>` : ''}</p>
          ${seniors.length
            ? html`<p>${seniors.map((s, i) => html`${i ? ', ' : ''}<a href="/seniors/${s.id}">${s.name}</a>`)}</p>`
            : html`<p class="muted">No seniors yet. Ready for a match.</p>`}
          <p class="muted">Can do: ${volunteer.contactMethods.map((m) => methodLabel(m).toLowerCase()).join(', ')}</p>
        </li>`
      )}
    </ul>`;
}

export function volunteerProfilePage({ volunteer, assigned }) {
  const first = volunteer.name.split(' ')[0];
  return html`
    <div class="page-head">
      <h1>${volunteer.name}</h1>
      <a class="button button-secondary" href="/volunteers/${volunteer.id}/edit">Edit profile</a>
    </div>
    <p class="lead">${volunteer.affiliation || 'Community volunteer'}</p>

    <section class="panel" aria-labelledby="assigned-heading">
      <h2 id="assigned-heading">${first}'s seniors (${assigned.length} of ${volunteer.maxSeniors})</h2>
      ${assigned.length
        ? html`<ul class="card-list">${assigned.map(
            ({ senior, match, assessment }) => html`
            <li class="card">
              <h3 class="card-title"><a href="/seniors/${senior.id}">${senior.name}</a></h3>
              <p>${statusBadge(assessment.status, assessment.info)} ${trendBadge(assessment.trend)}</p>
              <p>${assessment.lastContact ? `Last contact ${daysAgoText(assessment.daysSince)}.` : 'No contact yet.'}
                ${assessment.nextScheduled ? `Next: ${formatDateTime(assessment.nextScheduled.scheduledFor)}.` : html`<strong>Nothing scheduled.</strong>`}</p>
              <p class="actions">
                <a class="button" href="/seniors/${senior.id}#sparks">Get conversation sparks</a>
                <a class="button button-secondary" href="/contacts?matchId=${match.id}">Schedule or log a call</a>
              </p>
            </li>`
          )}</ul>`
        : html`<p>No seniors assigned yet. A coordinator can pair ${first} with someone on the <a href="/match">Match page</a>.</p>`}
    </section>

    <section class="panel" aria-labelledby="vol-about-heading">
      <h2 id="vol-about-heading">About ${first}</h2>
      <h3>Interests</h3>
      ${chips(volunteer.interests)}
      <h3>Usually available</h3>
      ${slotList(volunteer.availability)}
      <h3>Ways to connect</h3>
      ${chips(volunteer.contactMethods, methodLabel)}
    </section>`;
}

export function volunteerFormPage({ volunteer = {}, errors = {}, isNew }) {
  const action = isNew ? '/volunteers' : `/volunteers/${volunteer.id}`;
  const capacity = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n} senior${n === 1 ? '' : 's'}` }));
  return html`
    <h1>${isNew ? 'Add a volunteer' : `Edit ${volunteer.name}`}</h1>
    <p class="lead">${isNew ? 'Sign up to be a Porch Light companion.' : 'Update this volunteer profile.'}</p>
    ${errorSummary(errors)}
    <form method="post" action="${action}" class="stack-form" novalidate>
      ${textField({ name: 'name', label: 'Full name', value: volunteer.name, error: errors.name, required: true, autocomplete: 'off' })}
      ${textField({ name: 'affiliation', label: 'School, group, or organization', value: volunteer.affiliation, error: errors.affiliation, hint: 'For example "Carmel High School junior, Key Club".' })}
      ${interestCheckboxes(volunteer.interests || [], errors.interests)}
      ${availabilityFieldset(volunteer.availability || [], errors.availability)}
      ${methodCheckboxes(volunteer.contactMethods || [], errors.contactMethods)}
      ${selectField({ name: 'maxSeniors', label: 'How many seniors can you stay in touch with?', options: capacity, value: volunteer.maxSeniors || 1, error: errors.maxSeniors })}
      <div class="form-actions">
        <button type="submit" class="button">${isNew ? 'Add volunteer' : 'Save changes'}</button>
        <a href="${isNew ? '/volunteers' : `/volunteers/${volunteer.id}`}">Cancel</a>
      </div>
    </form>`;
}
