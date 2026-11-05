// Volunteer screens: list, profile (with assigned seniors), and add/edit form.

import { html, formatDateTime, daysAgoText } from '../html.js';
import {
  statusBadge, trendBadge, chips, slotList, errorSummary, textField,
  interestCheckboxes, availabilityFieldset, methodCheckboxes, methodLabel, selectField, backLink, emptyState, tx, many,
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
      <h1>${tx('core.volunteers.title')}</h1>
      <a class="button" href="/admin/volunteers/new">${tx('core.volunteers.add')}</a>
    </div>
    <p class="lead">${tx('core.volunteers.lead')}</p>
    ${townFilter}
    ${rows.length
      ? html`<ul class="card-list">
      ${rows.map(
        ({ volunteer, seniors }) => html`
        <li class="card">
          <h2 class="card-title"><a href="/volunteers/${volunteer.id}">${volunteer.name}</a></h2>
          <p class="card-meta">${volunteer.affiliation || t('core.volunteers.community')} · ${townLabel(volunteer)}</p>
          <p>${tx(many(volunteer.maxSeniors, 'core.volunteers.card.load'), { n: seniors.length, max: volunteer.maxSeniors })}${seniors.length >= volunteer.maxSeniors ? html` <span class="badge badge-full">${tx('core.volunteers.card.full')}</span>` : ''}</p>
          ${seniors.length
            ? html`<p>${seniors.map((s, i) => html`${i ? ', ' : ''}<a href="/seniors/${s.id}">${s.name}</a>`)}</p>`
            : html`<p class="muted">${tx('core.volunteers.card.ready')}</p>`}
          <p class="muted">${tx('core.volunteers.card.canDo', { methods: volunteer.contactMethods.map((m) => methodLabel(m).toLowerCase()).join(', ') })}</p>
          <p><a href="/volunteers/${volunteer.id}/week">${tx('core.volunteers.card.week', { name: volunteer.name.split(' ')[0] })}</a></p>
        </li>`
      )}
    </ul>`
      : townName // [towns]
        ? emptyState(html`<p><strong>${tx('core.volunteers.empty.inTown', { town: townName })}</strong> <a href="/admin/volunteers">${tx('core.dashboard.empty.allTowns')}</a></p>`)
        : emptyState(html`<p><strong>${tx('core.volunteers.empty.title')}</strong> ${tx('core.volunteers.empty.text')}</p>
          <p><a href="/admin/volunteers/new">${tx('core.volunteers.add')}</a></p>`)}`;
}

export function volunteerProfilePage({ volunteer, assigned }) {
  const first = volunteer.name.split(' ')[0];
  return html`
    ${backLink('/admin/volunteers', t('core.back.allVolunteers'))}
    <div class="page-head">
      <h1>${volunteer.name}</h1>
      <div class="page-actions">
        <a class="button print-url" href="/volunteers/${volunteer.id}/week">${tx('core.volunteer.myWeek', { name: first })}</a>
        <a class="button button-secondary" href="/volunteers/${volunteer.id}/edit">${tx('core.senior.edit')}</a>
      </div>
    </div>
    <p class="lead">${volunteer.affiliation || t('core.volunteers.community')} · ${tx('core.volunteer.livesIn', { town: townLabel(volunteer) })}</p>

    <section class="panel" aria-labelledby="assigned-heading">
      <h2 id="assigned-heading">${tx('core.volunteer.seniors', { name: first, n: assigned.length, max: volunteer.maxSeniors })}</h2>
      ${assigned.length
        ? html`<ul class="card-list">${assigned.map(
            ({ senior, match, assessment, misfit = [] }) => html`
            <li class="card">
              <h3 class="card-title"><a href="/seniors/${senior.id}">${senior.name}</a></h3>
              <p class="badges">${statusBadge(assessment.status, assessment.info)} ${trendBadge(assessment.trend)}</p>
              ${misfit.length ? misfitNote({ senior, volunteer, misfit }) : ''}
              <p>${assessment.lastContact ? t('core.volunteer.lastContact', { when: daysAgoText(assessment.daysSince) }) : t('core.volunteer.noContacts')}
                ${assessment.nextScheduled ? t('core.volunteer.next', { when: formatDateTime(assessment.nextScheduled.scheduledFor) }) : html`<strong>${tx('core.senior.calls.nothing')}</strong>`}</p>
              <p class="actions">
                <a class="button button-secondary" href="/seniors/${senior.id}#sparks">${tx('core.senior.sparks.get')}<span class="visually-hidden"> ${tx('core.dashboard.card.summaryFor', { name: senior.name })}</span></a>
                <a class="button button-secondary" href="/contacts?matchId=${match.id}">${tx('core.senior.calls.scheduleOrLog')}<span class="visually-hidden"> ${tx('core.volunteer.with', { name: senior.name })}</span></a>
                <a class="button button-secondary" href="/messages/${match.id}">${t('translate.messages.title')}<span class="visually-hidden"> (${senior.name})</span></a>
              </p>
            </li>`
          )}</ul>`
        : emptyState(html`<p><strong>${tx('core.seniors.empty.title')}</strong> ${tx('core.volunteer.noSeniors', { name: first, link: html`<a href="/admin/match">${tx('core.volunteer.matchPage')}</a>` })}</p>`)}
    </section>

    <section class="panel" aria-labelledby="vol-about-heading">
      <h2 id="vol-about-heading">${tx('core.senior.about.heading', { name: first })}</h2>
      <h3>${tx('core.senior.about.interests')}</h3>
      ${chips(volunteer.interests)}
      <h3>${tx('core.senior.about.available')}</h3>
      ${slotList(volunteer.availability)}
      <h3>${tx('core.volunteer.ways')}</h3>
      ${chips(volunteer.contactMethods, methodLabel)}
      <h3>${t('lang.profile.languages')}</h3>
      <p>${formatLanguages(volunteer)}${volunteer.translateHelp ? ` · ${t('lang.profile.translateHelp')}` : ''}</p>
    </section>`;
}

export function volunteerFormPage({ volunteer = {}, errors = {}, isNew }) {
  const action = isNew ? '/admin/volunteers' : `/volunteers/${volunteer.id}`;
  const capacity = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: t(many(n, 'core.volunteerForm.capacity'), { n }) }));
  const first = (volunteer.name || '').split(' ')[0];
  return html`
    ${isNew ? backLink('/admin/volunteers', t('core.back.allVolunteers')) : backLink(`/volunteers/${volunteer.id}`, first ? t('core.back.profileOf', { name: first }) : t('core.back.thisVolunteerProfile'))}
    <h1>${isNew ? t('core.volunteerForm.addTitle') : t('core.seniorForm.editTitle', { name: volunteer.name })}</h1>
    <p class="lead">${t(isNew ? 'core.volunteerForm.addLead' : 'core.volunteerForm.editLead')}</p>
    ${errorSummary(errors)}
    <form method="post" action="${action}" class="stack-form" novalidate>
      ${textField({ name: 'name', label: t('core.seniorForm.name'), value: volunteer.name, error: errors.name, required: true, autocomplete: 'off' })}
      ${textField({ name: 'affiliation', label: t('core.volunteerForm.affiliation'), value: volunteer.affiliation, error: errors.affiliation, hint: t('core.volunteerForm.affiliationHint', { town: COMMUNITY.town }) })}
      ${townSelectField(volunteer, errors.town)}
      ${interestCheckboxes(volunteer.interests || [], errors.interests)}
      ${availabilityFieldset(volunteer.availability || [], errors.availability)}
      ${methodCheckboxes(volunteer.contactMethods || [], errors.contactMethods)}
      ${languageFieldset({ values: volunteer, errors, legend: t('lang.fields.legendYou') })}
      ${selectField({ name: 'maxSeniors', label: t('core.volunteerForm.maxSeniors'), options: capacity, value: volunteer.maxSeniors || 1, error: errors.maxSeniors })}
      <div class="form-actions">
        <button type="submit" class="button">${t(isNew ? 'core.volunteerForm.addButton' : 'core.seniorForm.save')}</button>
        <a class="button button-secondary" href="${isNew ? '/admin/volunteers' : `/volunteers/${volunteer.id}`}">${tx('core.seniorForm.cancel')}</a>
      </div>
    </form>`;
}
