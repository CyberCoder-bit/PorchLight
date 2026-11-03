// Senior screens: list, profile (with Conversation Sparks), and add/edit form.

import { html, formatDateTime, formatDate, daysAgoText } from '../html.js';
import {
  statusBadge, trendBadge, chips, slotList, errorSummary, textField, textArea,
  interestCheckboxes, availabilityFieldset, methodRadios, methodLabel,
} from '../components.js';

export function seniorsListPage({ rows }) {
  return html`
    <div class="page-head">
      <h1>Seniors</h1>
      <a class="button" href="/seniors/new">Add a senior</a>
    </div>
    <p class="lead">Everyone enrolled in PorchLight, with their companion and how recently someone reached out.</p>
    <ul class="card-list">
      ${rows.map(
        ({ senior, assessment, volunteer }) => html`
        <li class="card">
          <h2 class="card-title"><a href="/seniors/${senior.id}">${senior.name}</a></h2>
          <p class="card-meta">${senior.age ? `${senior.age} · ` : ''}${senior.neighborhood || 'Carmel'} · prefers ${methodLabel(senior.contactMethod).toLowerCase()}s</p>
          <p>${statusBadge(assessment.status, assessment.info)} ${trendBadge(assessment.trend)}</p>
          <p>${volunteer
            ? html`Companion: <a href="/volunteers/${volunteer.id}">${volunteer.name}</a>`
            : html`No companion yet. <a href="/match?seniorId=${senior.id}">Find a match</a>`}</p>
          <p class="muted">${assessment.lastContact ? `Last contact ${daysAgoText(assessment.daysSince)}` : 'No contact recorded yet'}</p>
        </li>`
      )}
    </ul>`;
}

function sparkPanel({ senior, sparkSet, sparkMode }) {
  const name = senior.preferredName || senior.name.split(' ')[0];
  const nextVariant = sparkSet ? (sparkSet.variant || 0) + 1 : 0;
  const sourceText = (set) =>
    set.mode === 'live'
      ? `Written by Claude (${set.model})`
      : set.mode === 'mock-fallback'
        ? 'From the offline templates (live AI was unavailable)'
        : 'From the offline templates (MOCK mode)';
  return html`
    <section class="panel spark-panel" id="sparks" aria-labelledby="sparks-heading" tabindex="-1">
      <h2 id="sparks-heading"><span aria-hidden="true">✦</span> Conversation sparks for ${name}</h2>
      <p>Three personalized conversation starters for the next call, based on ${name}'s interests and how long it has been since the last contact.</p>
      ${sparkSet
        ? html`
          ${sparkSet.notice ? html`<p class="notice" role="note"><span aria-hidden="true">ⓘ </span>${sparkSet.notice}</p>` : ''}
          <ol class="sparks">
            ${sparkSet.sparks.map(
              (s) => html`<li><p class="spark-text">${s.text}</p><p class="spark-basis">Based on: ${s.basedOn}</p></li>`
            )}
          </ol>
          ${sparkSet.tip ? html`<p class="tip"><strong>Volunteer tip:</strong> ${sparkSet.tip}</p>` : ''}
          <p class="muted small">${sourceText(sparkSet)} · ${formatDateTime(sparkSet.createdAt)}</p>`
        : html`<p class="muted">No sparks yet for ${name}.</p>`}
      <form method="post" action="/seniors/${senior.id}/sparks" class="inline-form" data-busy-text="${sparkMode.effective === 'live' ? 'Asking Claude…' : 'Working…'}">
        <input type="hidden" name="variant" value="${nextVariant}">
        <button type="submit" class="button">${sparkSet ? 'Show different sparks' : 'Get conversation sparks'}</button>
      </form>
    </section>`;
}

export function seniorProfilePage({ senior, assessment, volunteer, match, upcoming, recent, sparkSet, sparkMode }) {
  const name = senior.preferredName || senior.name.split(' ')[0];
  return html`
    <div class="page-head">
      <h1>${senior.name}${senior.preferredName && senior.preferredName !== senior.name.split(' ')[0] ? html` <span class="aka">(“${senior.preferredName}”)</span>` : ''}</h1>
      <a class="button button-secondary" href="/seniors/${senior.id}/edit">Edit profile</a>
    </div>
    <p>${statusBadge(assessment.status, assessment.info)} ${trendBadge(assessment.trend)}</p>

    <section class="panel welcome" aria-labelledby="welcome-heading">
      <h2 id="welcome-heading">Hi ${name}! Here is your PorchLight.</h2>
      ${volunteer
        ? html`<p class="big">Your companion is <strong>${volunteer.name}</strong>.</p>`
        : html`<p class="big">We're finding a companion for you.</p>`}
      ${assessment.nextScheduled
        ? html`<p class="big">Your next ${methodLabel(assessment.nextScheduled.type).toLowerCase()}: <strong>${formatDateTime(assessment.nextScheduled.scheduledFor)}</strong>.</p>`
        : html`<p class="big">No call is scheduled yet.</p>`}
    </section>

    <div class="two-col">
      <div>
        ${sparkPanel({ senior, sparkSet, sparkMode })}

        <section class="panel" aria-labelledby="contacts-heading">
          <h2 id="contacts-heading">Calls and visits</h2>
          ${match
            ? html`<p><a class="button button-secondary" href="/contacts?matchId=${match.id}">Schedule or log a call</a></p>`
            : html`<p><a class="button" href="/match?seniorId=${senior.id}">Find a companion</a></p>`}
          <h3>Coming up</h3>
          ${upcoming.length
            ? html`<ul class="plain-list">${upcoming.map((c) => html`<li>${methodLabel(c.type)}: ${formatDateTime(c.scheduledFor)}</li>`)}</ul>`
            : html`<p class="muted">Nothing scheduled.</p>`}
          <h3>Recent</h3>
          ${recent.length
            ? html`<ul class="plain-list">${recent.map(
                (c) => html`<li><strong>${formatDate(c.completedAt || c.scheduledFor)}</strong>: ${methodLabel(c.type)}${c.status === 'missed' ? html` <span class="badge badge-missed">Missed</span>` : c.durationMinutes ? ` (${c.durationMinutes} min)` : ''}${c.notes ? html`<br><span class="muted">${c.notes}</span>` : ''}</li>`
              )}</ul>`
            : html`<p class="muted">No calls or visits recorded yet.</p>`}
        </section>
      </div>

      <div>
        <section class="panel" aria-labelledby="about-heading">
          <h2 id="about-heading">About ${name}</h2>
          <dl class="facts">
            <dt>Age</dt><dd>${senior.age || 'Not given'}</dd>
            <dt>Neighborhood</dt><dd>${senior.neighborhood || 'Not given'}</dd>
            <dt>Prefers</dt><dd>${methodLabel(senior.contactMethod)}s</dd>
            <dt>Companion</dt><dd>${volunteer ? html`<a href="/volunteers/${volunteer.id}">${volunteer.name}</a>` : 'Not matched yet'}</dd>
            <dt>Family contact</dt><dd>${senior.caregiver?.name ? `${senior.caregiver.name}${senior.caregiver.relationship ? ` (${senior.caregiver.relationship})` : ''}` : 'Not given'}</dd>
            <dt>Last contact</dt><dd>${assessment.lastContact ? `${daysAgoText(assessment.daysSince)} (${formatDate(assessment.lastContact.completedAt)})` : 'None yet'}</dd>
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

export function seniorFormPage({ senior = {}, errors = {}, isNew }) {
  const action = isNew ? '/seniors' : `/seniors/${senior.id}`;
  return html`
    <h1>${isNew ? 'Add a senior' : `Edit ${senior.name}`}</h1>
    <p class="lead">${isNew ? 'Tell us a little about the person who would like a companion.' : 'Update this profile. Changes take effect right away.'}</p>
    ${errorSummary(errors)}
    <form method="post" action="${action}" class="stack-form" novalidate>
      ${textField({ name: 'name', label: 'Full name', value: senior.name, error: errors.name, required: true, autocomplete: 'off' })}
      ${textField({ name: 'preferredName', label: 'What they like to be called', value: senior.preferredName, error: errors.preferredName, hint: 'For example "Hal" for Harold. Volunteers and sparks will use this name.' })}
      ${textField({ name: 'age', label: 'Age', value: senior.age, error: errors.age, type: 'number', attrs: 'inputmode="numeric" min="50" max="120"' })}
      ${textField({ name: 'neighborhood', label: 'Neighborhood', value: senior.neighborhood, error: errors.neighborhood, hint: 'For example "Old Town Carmel".' })}
      ${interestCheckboxes(senior.interests || [], errors.interests)}
      ${textArea({ name: 'aboutMe', label: 'About them, in their own words', value: senior.aboutMe, error: errors.aboutMe, hint: 'A few sentences about their life and what they enjoy. Used to personalize sparks. Up to 500 characters.' })}
      ${availabilityFieldset(senior.availability || [], errors.availability)}
      ${methodRadios(senior.contactMethod, errors.contactMethod)}
      <fieldset class="choice-group">
        <legend>Family or caregiver contact (optional)</legend>
        ${textField({ name: 'caregiverName', label: 'Name', value: senior.caregiver?.name, error: errors.caregiverName })}
        ${textField({ name: 'caregiverRelationship', label: 'Relationship', value: senior.caregiver?.relationship, error: errors.caregiverRelationship, hint: 'For example "Daughter, lives in Chicago".' })}
      </fieldset>
      <div class="form-actions">
        <button type="submit" class="button">${isNew ? 'Add senior' : 'Save changes'}</button>
        <a href="${isNew ? '/seniors' : `/seniors/${senior.id}`}">Cancel</a>
      </div>
    </form>`;
}

