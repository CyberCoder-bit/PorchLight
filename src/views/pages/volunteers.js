// Volunteer screens: list, profile (with assigned seniors), and add/edit form.

import { html, formatDateTime, daysAgoText } from '../html.js';
import {
  statusBadge, trendBadge, chips, slotList, errorSummary, textField,
  interestCheckboxes, availabilityFieldset, methodCheckboxes, methodLabel, selectField, backLink, emptyState,
} from '../components.js';
import { COMMUNITY } from '../../community.js';
import { misfitNote } from './seniors.js';
import { townLabel } from '../../towns/index.js'; // [towns]
import { townSelectField } from '../../towns/views.js'; // [towns]
import { languageFieldset, formatLanguages } from '../../i18n/fields.js'; // [v2 i18n]
import { t } from '../../i18n/index.js'; // [v2 i18n, translate]

export function volunteersListPage({ rows, townFilter = '', townName = null }) { // [towns] townFilter, townName
  return html`
    <div class="page-head">
      <h1>Volunteers</h1>
      <a class="button" href="/volunteers/new">Add a volunteer</a>
    </div>
    <p class="lead">PorchLight companions: students, retirees, and neighbors who call or visit a senior every week.</p>
    ${townFilter}
    ${rows.length
      ? html`<ul class="card-list">
      ${rows.map(
        ({ volunteer, seniors }) => html`
        <li class="card">
          <h2 class="card-title"><a href="/volunteers/${volunteer.id}">${volunteer.name}</a></h2>
          <p class="card-meta">${volunteer.affiliation || 'Community volunteer'} · ${townLabel(volunteer)}</p>
          <p>Companion to ${seniors.length} of ${volunteer.maxSeniors} senior${volunteer.maxSeniors === 1 ? '' : 's'}${seniors.length >= volunteer.maxSeniors ? html` <span class="badge badge-full">Full</span>` : ''}</p>
          ${seniors.length
            ? html`<p>${seniors.map((s, i) => html`${i ? ', ' : ''}<a href="/seniors/${s.id}">${s.name}</a>`)}</p>`
            : html`<p class="muted">No seniors yet. Ready for a match.</p>`}
          <p class="muted">Can do: ${volunteer.contactMethods.map((m) => methodLabel(m).toLowerCase()).join(', ')}</p>
          <p><a href="/volunteers/${volunteer.id}/week">${volunteer.name.split(' ')[0]}'s week</a></p>
        </li>`
      )}
    </ul>`
      : townName // [towns]
        ? emptyState(html`<p><strong>No volunteers in ${townName}.</strong> <a href="/volunteers">Show all towns</a></p>`)
        : emptyState(html`<p><strong>No volunteers yet.</strong> Add the first volunteer so seniors can be matched with a companion.</p>
          <p><a href="/volunteers/new">Add a volunteer</a></p>`)}`;
}

export function volunteerProfilePage({ volunteer, assigned }) {
  const first = volunteer.name.split(' ')[0];
  return html`
    ${backLink('/volunteers', 'all volunteers')}
    <div class="page-head">
      <h1>${volunteer.name}</h1>
      <div class="page-actions">
        <a class="button print-url" href="/volunteers/${volunteer.id}/week">My week: ${first}'s calls</a>
        <a class="button button-secondary" href="/volunteers/${volunteer.id}/edit">Edit profile</a>
      </div>
    </div>
    <p class="lead">${volunteer.affiliation || 'Community volunteer'} · Lives in ${townLabel(volunteer)}</p>

    <section class="panel" aria-labelledby="assigned-heading">
      <h2 id="assigned-heading">${first}'s seniors (${assigned.length} of ${volunteer.maxSeniors})</h2>
      ${assigned.length
        ? html`<ul class="card-list">${assigned.map(
            ({ senior, match, assessment, misfit = [] }) => html`
            <li class="card">
              <h3 class="card-title"><a href="/seniors/${senior.id}">${senior.name}</a></h3>
              <p class="badges">${statusBadge(assessment.status, assessment.info)} ${trendBadge(assessment.trend)}</p>
              ${misfit.length ? misfitNote({ senior, volunteer, misfit }) : ''}
              <p>${assessment.lastContact ? `Last call or visit: ${daysAgoText(assessment.daysSince)}.` : 'No calls or visits yet.'}
                ${assessment.nextScheduled ? `Next: ${formatDateTime(assessment.nextScheduled.scheduledFor)}.` : html`<strong>Nothing scheduled.</strong>`}</p>
              <p class="actions">
                <a class="button button-secondary" href="/seniors/${senior.id}#sparks">Get conversation sparks<span class="visually-hidden"> for ${senior.name}</span></a>
                <a class="button button-secondary" href="/contacts?matchId=${match.id}">Schedule or log a call<span class="visually-hidden"> with ${senior.name}</span></a>
                <a class="button button-secondary" href="/messages/${match.id}">${t('translate.messages.title')}<span class="visually-hidden"> (${senior.name})</span></a>
              </p>
            </li>`
          )}</ul>`
        : emptyState(html`<p><strong>No seniors yet.</strong> A coordinator can pair ${first} with someone on the <a href="/match">Match page</a>.</p>`)}
    </section>

    <section class="panel" aria-labelledby="vol-about-heading">
      <h2 id="vol-about-heading">About ${first}</h2>
      <h3>Interests</h3>
      ${chips(volunteer.interests)}
      <h3>Usually available</h3>
      ${slotList(volunteer.availability)}
      <h3>Ways to connect</h3>
      ${chips(volunteer.contactMethods, methodLabel)}
      <h3>${t('lang.profile.languages')}</h3>
      <p>${formatLanguages(volunteer)}${volunteer.translateHelp ? ` · ${t('lang.profile.translateHelp')}` : ''}</p>
    </section>`;
}

export function volunteerFormPage({ volunteer = {}, errors = {}, isNew }) {
  const action = isNew ? '/volunteers' : `/volunteers/${volunteer.id}`;
  const capacity = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n} senior${n === 1 ? '' : 's'}` }));
  const first = (volunteer.name || '').split(' ')[0];
  return html`
    ${isNew ? backLink('/volunteers', 'all volunteers') : backLink(`/volunteers/${volunteer.id}`, `${first || 'this volunteer'}'s profile`)}
    <h1>${isNew ? 'Add a volunteer' : `Edit ${volunteer.name}`}</h1>
    <p class="lead">${isNew ? 'Sign up to be a PorchLight companion.' : 'Update this volunteer profile. Changes take effect right away.'}</p>
    ${errorSummary(errors)}
    <form method="post" action="${action}" class="stack-form" novalidate>
      ${textField({ name: 'name', label: 'Full name', value: volunteer.name, error: errors.name, required: true, autocomplete: 'off' })}
      ${textField({ name: 'affiliation', label: 'School, group, or organization', value: volunteer.affiliation, error: errors.affiliation, hint: `For example "${COMMUNITY.town} High School junior, Key Club" or "Retired nurse".` })}
      ${townSelectField(volunteer, errors.town)}
      ${interestCheckboxes(volunteer.interests || [], errors.interests)}
      ${availabilityFieldset(volunteer.availability || [], errors.availability)}
      ${methodCheckboxes(volunteer.contactMethods || [], errors.contactMethods)}
      ${languageFieldset({ values: volunteer, errors, legend: t('lang.fields.legendYou') })}
      ${selectField({ name: 'maxSeniors', label: 'How many seniors can you stay in touch with?', options: capacity, value: volunteer.maxSeniors || 1, error: errors.maxSeniors })}
      <div class="form-actions">
        <button type="submit" class="button">${isNew ? 'Add volunteer' : 'Save changes'}</button>
        <a class="button button-secondary" href="${isNew ? '/volunteers' : `/volunteers/${volunteer.id}`}">Cancel</a>
      </div>
    </form>`;
}
