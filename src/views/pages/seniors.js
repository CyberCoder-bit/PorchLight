// Senior screens: list, profile (with Conversation Sparks), and add/edit form.

import { html, formatDateTime, formatDate, daysAgoText } from '../html.js';
import {
  statusBadge, trendBadge, chips, slotList, errorSummary, textField, textArea,
  interestCheckboxes, availabilityFieldset, methodRadios, methodLabel, banner, backLink, emptyState, sparkSourceLabel, tx,
} from '../components.js';
import { placeText, townLabel } from '../../towns/index.js'; // [towns]
import { townSelectField } from '../../towns/views.js'; // [towns]
import { languageFieldset, formatLanguages } from '../../i18n/fields.js'; // [v2 i18n]
import { t } from '../../i18n/index.js'; // [v2 i18n, translate, accounts]
import { bilingualSpark } from '../../translate/views.js'; // [v2 translate] sparks in both languages
import { noPhone } from '../../roles/viewer.js'; // phone numbers are never displayed, even if typed into a name field

export function seniorsListPage({ rows, townFilter = '', townName = null }) { // [towns] townFilter, townName
  return html`
    <div class="page-head">
      <h1>${tx('core.seniors.title')}</h1>
      <a class="button" href="/admin/seniors/new">${tx('core.seniors.add')}</a>
    </div>
    <p class="lead">${tx('core.seniors.lead')}</p>
    ${townFilter}
    ${rows.length
      ? html`<ul class="card-list">
      ${rows.map(
        ({ senior, assessment, volunteer }) => html`
        <li class="card">
          <h2 class="card-title"><a href="/seniors/${senior.id}">${senior.name}</a></h2>
          <p class="card-meta">${senior.age ? `${t('core.seniors.card.age', { age: senior.age })} · ` : ''}${placeText(senior)} · ${tx('core.seniors.card.prefers', { method: methodLabel(senior.contactMethod).toLowerCase() })}</p>
          <p class="badges">${statusBadge(assessment.status, assessment.info)} ${trendBadge(assessment.trend)}</p>
    <p><a href="/seniors/${senior.id}/summary">${tx('core.seniors.card.summary')}</a></p>
          <p>${volunteer
            ? tx('core.seniors.card.companion', { name: html`<a href="/volunteers/${volunteer.id}">${volunteer.name}</a>` })
            : html`${tx('core.seniors.card.noCompanion')} <a href="/admin/match?seniorId=${senior.id}">${tx('core.seniors.card.findCompanion')}</a>`}</p>
          <p class="muted">${assessment.lastContact ? t('core.seniors.card.lastContact', { when: daysAgoText(assessment.daysSince) }) : t('core.seniors.card.noContacts')}</p>
        </li>`
      )}
    </ul>`
      : townName // [towns]
        ? emptyState(html`<p><strong>${tx('core.seniors.empty.inTown', { town: townName })}</strong> <a href="/admin/seniors">${tx('core.dashboard.empty.allTowns')}</a></p>`)
        : emptyState(html`<p><strong>${tx('core.seniors.empty.title')}</strong> ${tx('core.seniors.empty.text')}</p>
          <p><a href="/admin/seniors/new">${tx('core.seniors.add')}</a></p>`)}`;
}

function sparkPanel({ senior, volunteer = null, sparkSet, sparkMode, hideNotice = false }) {
  const name = senior.preferredName || senior.name.split(' ')[0];
  const nextVariant = sparkSet ? (sparkSet.variant || 0) + 1 : 0;
  return html`
    <section class="panel spark-panel" id="sparks" aria-labelledby="sparks-heading" tabindex="-1">
      <h2 id="sparks-heading"><span aria-hidden="true">✦</span> ${tx('core.senior.sparks.heading', { name })}</h2>
      <p>${tx('core.senior.sparks.intro', { name })}</p>
      ${sparkSet
        ? html`
          ${sparkSet.notice && !hideNotice ? banner({ kind: 'status', text: sparkSet.notice }) : ''}
          <ol class="sparks">
            ${sparkSet.sparks.map(
              (s) => html`<li><p class="spark-text">${s.text}</p>${bilingualSpark(s, { senior, volunteer, sparkSet })}<p class="spark-basis">${tx('core.senior.sparks.basedOn', { basis: s.basedOn })}</p></li>`
            )}
          </ol>
          ${sparkSet.tip ? html`<p class="tip"><strong>${tx('core.senior.sparks.tip')}</strong> ${sparkSet.tip}</p>` : ''}
          <p class="muted">${tx('core.senior.sparks.footer', { source: sparkSourceLabel(sparkSet), date: formatDateTime(sparkSet.createdAt) })}</p>`
        : emptyState(html`<p><strong>${tx('core.senior.sparks.noneTitle', { name })}</strong> ${tx('core.senior.sparks.noneText')}</p>`)}
      <form method="post" action="/seniors/${senior.id}/sparks" class="inline-form" data-busy-text="${t(sparkMode.effective === 'live' ? 'core.senior.sparks.askingClaude' : 'core.senior.sparks.working')}">
        <input type="hidden" name="variant" value="${nextVariant}">
        <button type="submit" class="button">${t(sparkSet ? 'core.senior.sparks.different' : 'core.senior.sparks.get')}</button>
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
    ${backLink('/admin/seniors', t('core.back.allSeniors'))}
    <div class="page-head">
      <h1>${senior.name}${senior.preferredName && senior.preferredName !== senior.name.split(' ')[0] ? html` <span class="aka">${tx('core.senior.aka', { name: senior.preferredName })}</span>` : ''}</h1>
      <a class="button button-secondary" href="/seniors/${senior.id}/edit">${tx('core.senior.edit')}</a>
    </div>
    ${seniorView ? '' : html`<p class="badges">${statusBadge(assessment.status, assessment.info)} ${trendBadge(assessment.trend)}</p>`}
    ${volunteer && misfit.length ? misfitNote({ senior, volunteer, misfit }) : ''}

    <section class="panel welcome" aria-labelledby="welcome-heading">
      <h2 id="welcome-heading">${tx('core.senior.welcome.heading', { name })}</h2>
      ${volunteer
        ? html`<p class="big">${tx('core.senior.welcome.companion', { name: html`<strong>${volunteer.name}</strong>` })}</p>`
        : html`<p class="big">${tx('core.senior.welcome.finding')}</p>`}
      ${volunteer && match ? html`<p><a class="button button-secondary" href="/messages/${match.id}">${t('translate.thread.title', { name: volunteer.name.split(' ')[0] })}</a></p>` : ''}
      ${assessment.nextScheduled
        ? html`<p class="big">${tx('core.senior.welcome.next', { method: methodLabel(assessment.nextScheduled.type).toLowerCase(), when: html`<strong>${formatDateTime(assessment.nextScheduled.scheduledFor)}</strong>` })}</p>`
        : html`<p class="big">${tx('core.senior.welcome.noNext')}</p>`}
      ${seniorView && senior.familyCode /* [v2 accounts] */
        ? html`<p>${t('auth.account.familyCodeTitle')}: <strong class="family-code">${senior.familyCode}</strong>. ${t('auth.account.familyCodeText')}</p>
          <p><a href="/messages">${t('auth.nav.messages')}</a> · <a href="/account">${t('auth.nav.account')}</a></p>`
        : ''}
    </section>

    <div class="two-col">
      <div>
        ${hideSparks ? '' : sparkPanel({ senior, volunteer, sparkSet, sparkMode, hideNotice })}

        <section class="panel" aria-labelledby="contacts-heading">
          <h2 id="contacts-heading">${tx('core.senior.calls.heading')}</h2>
          ${match
            ? html`<p><a class="button button-secondary" href="/contacts?matchId=${match.id}">${tx('core.senior.calls.scheduleOrLog')}</a></p>`
            : html`<p><a class="button" href="/admin/match?seniorId=${senior.id}">${tx('core.dashboard.card.findCompanion', { name })}</a></p>`}
          <h3>${tx('core.senior.calls.upcoming')}</h3>
          ${upcoming.length
            ? html`<ul class="plain-list">${upcoming.map((c) => html`<li>${methodLabel(c.type)}: ${formatDateTime(c.scheduledFor)} <a href="/contacts/${c.id}/calendar.ics" download>${tx('core.senior.calls.addToCalendar')}<span class="visually-hidden">: ${tx('core.senior.calls.calendarFor', { method: methodLabel(c.type), when: formatDateTime(c.scheduledFor) })}</span></a></li>`)}</ul>`
            : emptyState(match
              ? seniorView
                ? html`<p><strong>${tx('core.senior.calls.nothingYet')}</strong> ${tx('core.senior.calls.companionWillSchedule')}</p>`
                : html`<p><strong>${tx('core.senior.calls.nothing')}</strong> ${tx('core.senior.calls.scheduleNext', { link: html`<a href="/contacts?matchId=${match.id}">${tx('core.senior.calls.scheduleNextLink')}</a>`, name })}</p>`
              : html`<p><strong>${tx('core.senior.calls.nothing')}</strong> ${tx('core.senior.calls.onceMatched', { name })}</p>`)}
          <h3>${tx('core.senior.calls.recent')}</h3>
          ${recent.length
            ? html`<ul class="plain-list">${recent.map(
                (c) => html`<li><strong>${formatDate(c.completedAt || c.scheduledFor)}</strong>: ${methodLabel(c.type)}${c.status === 'missed' ? html` <span class="badge badge-missed">${tx('core.senior.calls.missed')}</span>` : c.status === 'cancelled' ? ` ${t('core.senior.calls.cancelled')}` : c.durationMinutes ? ` ${t('core.senior.calls.minutes', { n: c.durationMinutes })}` : ''}${c.notes ? html`<br><span class="muted">${c.notes}</span>` : ''}</li>`
              )}</ul>`
            : emptyState(html`<p><strong>${tx('core.senior.calls.noneWritten')}</strong> ${tx('core.senior.calls.logIt', { link: html`<a href="/contacts${match ? `?matchId=${match.id}` : ''}">${tx('core.senior.calls.logItLink')}</a>` })}</p>`)}
        </section>
      </div>

      <div>
        <section class="panel" aria-labelledby="about-heading">
          <h2 id="about-heading">${tx('core.senior.about.heading', { name })}</h2>
          <dl class="facts">
            <dt>${tx('core.senior.about.age')}</dt><dd>${senior.age || t('core.senior.about.notGiven')}</dd>
            <dt>${tx('core.senior.about.neighborhood')}</dt><dd>${senior.neighborhood || t('core.senior.about.notGiven')}</dd>
            <dt>${tx('core.senior.about.town')}</dt><dd>${townLabel(senior)}</dd>
            <dt>${tx('core.senior.about.prefers')}</dt><dd>${tx('core.senior.about.prefersMethod', { method: methodLabel(senior.contactMethod) })}</dd>
            <dt>${t('lang.profile.languages')}</dt><dd>${formatLanguages(senior)}${senior.translateHelp ? ` · ${t('lang.profile.translateHelp')}` : ''}</dd>
            <dt>${tx('core.senior.about.companion')}</dt><dd>${volunteer ? html`<a href="/volunteers/${volunteer.id}">${volunteer.name}</a>` : t('core.senior.about.notMatched')}</dd>
            <dt>${tx('core.senior.about.family')}</dt><dd>${senior.caregiver?.name ? `${noPhone(senior.caregiver.name)}${senior.caregiver.relationship ? ` (${noPhone(senior.caregiver.relationship)})` : ''}` : t('core.senior.about.notGiven')}</dd>
            <dt>${tx('core.dashboard.card.last')}</dt><dd>${assessment.lastContact ? `${daysAgoText(assessment.daysSince)} (${formatDate(assessment.lastContact.completedAt)})` : t('core.dashboard.card.noneYet')}</dd>
          </dl>
          ${senior.aboutMe ? html`<h3>${tx('core.senior.about.ownWords')}</h3><p>${senior.aboutMe}</p>` : ''}
          <h3>${tx('core.senior.about.interests')}</h3>
          ${chips(senior.interests)}
          <h3>${tx('core.senior.about.available')}</h3>
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
    text: t('core.senior.misfit.text', { name, volunteer: volunteer.name, problems: misfit.join('; ') }),
    next: { href: `/attention/${senior.id}/rematch`, label: t('core.senior.misfit.review', { name }) },
  });
}

export function seniorFormPage({ senior = {}, errors = {}, isNew }) {
  const action = isNew ? '/admin/seniors' : `/seniors/${senior.id}`;
  const first = (senior.preferredName || senior.name || '').split(' ')[0];
  return html`
    ${isNew ? backLink('/admin/seniors', t('core.back.allSeniors')) : backLink(`/seniors/${senior.id}`, first ? t('core.back.profileOf', { name: first }) : t('core.back.thisSeniorProfile'))}
    <h1>${isNew ? t('core.seniorForm.addTitle') : t('core.seniorForm.editTitle', { name: senior.name })}</h1>
    <p class="lead">${t(isNew ? 'core.seniorForm.addLead' : 'core.seniorForm.editLead')}</p>
    ${errorSummary(errors)}
    <form method="post" action="${action}" class="stack-form" novalidate>
      ${textField({ name: 'name', label: t('core.seniorForm.name'), value: senior.name, error: errors.name, required: true, autocomplete: 'off' })}
      ${textField({ name: 'preferredName', label: t('core.seniorForm.preferredName'), value: senior.preferredName, error: errors.preferredName, hint: t('core.seniorForm.preferredNameHint') })}
      ${textField({ name: 'age', label: t('core.seniorForm.age'), value: senior.age, error: errors.age, type: 'number', attrs: 'inputmode="numeric" min="50" max="120"' })}
      ${textField({ name: 'neighborhood', label: t('core.seniorForm.neighborhood'), value: senior.neighborhood, error: errors.neighborhood, hint: t('core.seniorForm.neighborhoodHint') })}
      ${townSelectField(senior, errors.town)}
      ${interestCheckboxes(senior.interests || [], errors.interests)}
      ${textArea({ name: 'aboutMe', label: t('core.seniorForm.aboutMe'), value: senior.aboutMe, error: errors.aboutMe, hint: t('core.seniorForm.aboutMeHint') })}
      ${availabilityFieldset(senior.availability || [], errors.availability)}
      ${methodRadios(senior.contactMethod, errors.contactMethod)}
      ${languageFieldset({ values: senior, errors })}
      <fieldset class="choice-group">
        <legend>${tx('core.seniorForm.caregiver')}</legend>
        ${textField({ name: 'caregiverName', label: t('core.seniorForm.caregiverName'), value: senior.caregiver?.name, error: errors.caregiverName })}
        ${textField({ name: 'caregiverRelationship', label: t('core.seniorForm.caregiverRelationship'), value: senior.caregiver?.relationship, error: errors.caregiverRelationship, hint: t('core.seniorForm.caregiverRelationshipHint') })}
      </fieldset>
      <div class="form-actions">
        <button type="submit" class="button">${t(isNew ? 'core.seniorForm.addButton' : 'core.seniorForm.save')}</button>
        <a class="button button-secondary" href="${isNew ? '/admin/seniors' : `/seniors/${senior.id}`}">${tx('core.seniorForm.cancel')}</a>
      </div>
    </form>`;
}
