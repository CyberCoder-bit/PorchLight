// Account pages (v2): sign in, sign up, my account, waiting for approval,
// too many tries, and the coordinator's approvals. Every page works without
// JavaScript. All words come from t() (src/i18n/en/auth.js) and all user
// text goes through html``, so it is always escaped.

import { html } from '../views/html.js';
import {
  banner, backLink, errorSummary, textField, selectField, interestCheckboxes, methodRadios, methodCheckboxes,
  availabilityFieldset,
} from '../views/components.js';
import { townSelectField } from '../towns/views.js';
import { languageFieldset, formatLanguages } from '../i18n/fields.js';
import { UI_LANGUAGES } from '../i18n/languages.js';
import { t } from '../i18n/index.js';
import { signOutForm } from '../roles/views.js';
import { MIN_PASSWORD } from './validate.js';

const demoNotice = () => banner({ kind: 'warning', text: t('auth.demoNotice') });
const hidden = (name, value) => (value ? html`<input type="hidden" name="${name}" value="${value}">` : '');

const emailField = (values, errors, name = 'email', label = t('auth.fields.email')) =>
  textField({ name, label, value: values[name], error: errors[name], type: 'email', required: true, autocomplete: name === 'email' ? 'email' : 'off' });
const newPasswordField = (errors, name = 'password', label = t('auth.fields.newPassword')) =>
  textField({ name, label, error: errors[name], type: 'password', required: true, autocomplete: 'new-password', hint: t('auth.fields.passwordHint', { min: MIN_PASSWORD }) });

// ----- sign in -----

// The one-click demo buttons. Never an admin button.
export const DEMO_BUTTONS = [
  { as: 'senior', key: 'auth.demo.senior' },
  { as: 'senior-ar', key: 'auth.demo.seniorAr' },
  { as: 'volunteer', key: 'auth.demo.volunteer' },
  { as: 'volunteer-translate', key: 'auth.demo.volunteerTranslate' },
  { as: 'family', key: 'auth.demo.family' },
];

export function demoButtons() {
  return html`
    <section class="panel" aria-labelledby="demo-heading">
      <h2 id="demo-heading">${t('auth.demo.title')}</h2>
      <p>${t('auth.demo.intro')}</p>
      <div class="button-row">
        ${DEMO_BUTTONS.map(
          (b) => html`<form method="post" action="/sign-in/demo" class="inline-form">
            <input type="hidden" name="as" value="${b.as}">
            <button type="submit" class="button button-secondary">${t(b.key)}</button>
          </form>`
        )}
      </div>
    </section>`;
}

export function signInPage({ viewer, values = {}, errors = {}, next }) {
  return html`
    <h1>${t('auth.signIn.title')}</h1>
    ${errorSummary(errors)}
    ${demoNotice()}
    ${viewer
      ? html`<section class="panel notice-panel" aria-labelledby="now-heading">
          <h2 id="now-heading">${t('auth.signIn.already', { label: viewer.label })}</h2>
          <p class="actions"><a class="button" href="${viewer.home}">${t('auth.signIn.goHome')}</a></p>
          ${signOutForm('')}
        </section>`
      : ''}
    <section class="panel" aria-labelledby="password-heading">
      <h2 id="password-heading">${t('auth.signIn.withPassword')}</h2>
      <form method="post" action="/sign-in" class="stack-form" novalidate>
        ${hidden('next', next)}
        ${textField({ name: 'email', label: t('auth.fields.email'), value: values.email, error: errors.email, type: 'email', required: true, autocomplete: 'username' })}
        ${textField({ name: 'password', label: t('auth.fields.password'), error: errors.password, type: 'password', required: true, autocomplete: 'current-password' })}
        <button type="submit" class="button">${t('auth.signIn.button')}</button>
      </form>
      <p>${t('auth.signIn.noAccount')} <a href="/sign-up">${t('auth.signUp.link')}</a></p>
    </section>
    ${demoButtons()}`;
}

export function tooManyPage({ kind }) {
  return html`
    <h1>${t('auth.tooMany.title')}</h1>
    <p class="lead">${t(kind === 'signUp' ? 'auth.tooMany.signUp' : 'auth.tooMany.signIn')}</p>
    <p>${t('auth.tooMany.help')} <a href="/help">${t('auth.tooMany.helpLink')}</a></p>`;
}

// ----- sign up -----

export function signUpChoicePage() {
  const card = (href, titleKey, textKey) => html`
    <li class="card">
      <h2><a href="${href}">${t(titleKey)}</a></h2>
      <p>${t(textKey)}</p>
    </li>`;
  return html`
    ${backLink('/sign-in', t('auth.signIn.backLabel'))}
    <h1>${t('auth.signUp.title')}</h1>
    ${demoNotice()}
    <p class="lead">${t('auth.signUp.lead')}</p>
    <ul class="card-grid plain-list" role="list">
      ${card('/sign-up/senior', 'auth.signUp.seniorTitle', 'auth.signUp.seniorText')}
      ${card('/sign-up/volunteer', 'auth.signUp.volunteerTitle', 'auth.signUp.volunteerText')}
      ${card('/sign-up/family', 'auth.signUp.familyTitle', 'auth.signUp.familyText')}
    </ul>
    <p>${t('auth.signUp.haveAccount')} <a href="/sign-in">${t('auth.signIn.link')}</a></p>`;
}

export function seniorSignUpPage({ values = {}, errors = {}, helper = false }) {
  return html`
    ${backLink('/sign-up', t('auth.signUp.backLabel'))}
    <h1>${t(helper ? 'auth.signUp.helperTitle' : 'auth.signUp.seniorTitle')}</h1>
    ${errorSummary(errors)}
    ${demoNotice()}
    <p class="lead">${t(helper ? 'auth.signUp.helperLead' : 'auth.signUp.seniorLead')}</p>
    <form method="post" action="/sign-up/senior" class="stack-form" novalidate>
      ${helper ? html`<input type="hidden" name="helper" value="1">` : ''}
      <fieldset class="panel">
        <legend>${t(helper ? 'auth.signUp.aboutSenior' : 'auth.signUp.aboutYou')}</legend>
        ${textField({ name: 'name', label: t('auth.fields.fullName'), value: values.name, error: errors.name, required: true, autocomplete: helper ? 'off' : 'name' })}
        ${textField({ name: 'preferredName', label: t('auth.fields.preferredName'), value: values.preferredName, error: errors.preferredName, hint: t('auth.fields.preferredNameHint') })}
        ${emailField(values, errors)}
        ${newPasswordField(errors)}
        ${townSelectField(values, errors.town)}
      </fieldset>
      ${interestCheckboxes(values.interests || [], errors.interests)}
      ${availabilityFieldset(values.availability || [], errors.availability)}
      ${methodRadios(values.contactMethod, errors.contactMethod)}
      ${languageFieldset({ values, errors, legend: t('auth.fields.languages') })}
      ${helper
        ? html`<fieldset class="panel">
            <legend>${t('auth.signUp.aboutHelper')}</legend>
            ${textField({ name: 'helperName', label: t('auth.fields.yourName'), value: values.helperName, error: errors.helperName, required: true, autocomplete: 'name' })}
            ${emailField(values, errors, 'helperEmail', t('auth.fields.yourEmail'))}
            ${newPasswordField(errors, 'helperPassword', t('auth.fields.yourPassword'))}
            ${textField({ name: 'relationship', label: t('auth.fields.relationship'), value: values.relationship, error: errors.relationship, required: true, hint: t('auth.fields.relationshipHint') })}
            <div class="field${errors.consent ? ' has-error' : ''}">
              ${errors.consent ? html`<p class="field-error" id="error-consent"><span aria-hidden="true">⚠ </span>${errors.consent}</p>` : ''}
              <div class="choice">
                <input type="checkbox" id="field-consent" name="consent" value="yes"${values.consent ? html` checked` : ''}${errors.consent ? html` aria-invalid="true" aria-describedby="error-consent"` : ''}>
                <label for="field-consent">${values.name ? t('auth.signUp.consentNamed', { name: values.preferredName || values.name }) : t('auth.signUp.consent')} <span class="required">(${t('auth.fields.required')})</span></label>
              </div>
            </div>
          </fieldset>`
        : html`<p><a href="/sign-up/senior?helper=1">${t('auth.signUp.helperLink')}</a></p>`}
      <button type="submit" class="button">${t('auth.signUp.create')}</button>
    </form>`;
}

export function volunteerSignUpPage({ values = {}, errors = {} }) {
  return html`
    ${backLink('/sign-up', t('auth.signUp.backLabel'))}
    <h1>${t('auth.signUp.volunteerTitle')}</h1>
    ${errorSummary(errors)}
    ${demoNotice()}
    <p class="lead">${t('auth.signUp.volunteerLead')}</p>
    <form method="post" action="/sign-up/volunteer" class="stack-form" novalidate>
      <fieldset class="panel">
        <legend>${t('auth.signUp.aboutYou')}</legend>
        ${textField({ name: 'name', label: t('auth.fields.fullName'), value: values.name, error: errors.name, required: true, autocomplete: 'name' })}
        ${emailField(values, errors)}
        ${newPasswordField(errors)}
        ${textField({ name: 'affiliation', label: t('auth.fields.affiliation'), value: values.affiliation, error: errors.affiliation, hint: t('auth.fields.affiliationHint') })}
        ${townSelectField(values, errors.town)}
      </fieldset>
      ${interestCheckboxes(values.interests || [], errors.interests)}
      ${availabilityFieldset(values.availability || [], errors.availability)}
      ${methodCheckboxes(values.contactMethods || [], errors.contactMethods)}
      ${languageFieldset({ values, errors, legend: t('auth.fields.languages') })}
      <button type="submit" class="button">${t('auth.signUp.create')}</button>
    </form>`;
}

export function familySignUpPage({ values = {}, errors = {} }) {
  return html`
    ${backLink('/sign-up', t('auth.signUp.backLabel'))}
    <h1>${t('auth.signUp.familyTitle')}</h1>
    ${errorSummary(errors)}
    ${demoNotice()}
    <p class="lead">${t('auth.signUp.familyLead')}</p>
    <form method="post" action="/sign-up/family" class="stack-form" novalidate>
      ${textField({ name: 'name', label: t('auth.fields.fullName'), value: values.name, error: errors.name, required: true, autocomplete: 'name' })}
      ${emailField(values, errors)}
      ${newPasswordField(errors)}
      ${textField({ name: 'familyCode', label: t('auth.fields.familyCode'), value: values.familyCode, error: errors.familyCode, required: true, autocomplete: 'off', hint: t('auth.fields.familyCodeHint') })}
      ${textField({ name: 'relationship', label: t('auth.fields.relationship'), value: values.relationship, error: errors.relationship, required: true, hint: t('auth.fields.relationshipHint') })}
      <button type="submit" class="button">${t('auth.signUp.create')}</button>
    </form>
    <section class="panel" aria-labelledby="no-code-heading">
      <h2 id="no-code-heading">${t('auth.signUp.noCodeTitle')}</h2>
      <p>${t('auth.signUp.noCodeText')}</p>
      <p><a href="/sign-up/senior?helper=1">${t('auth.signUp.helperLink')}</a></p>
    </section>`;
}

// ----- my account -----

export function accountPage({ viewer, values, errors = {}, familyCode, showLanguages }) {
  return html`
    <h1>${t('auth.account.title')}</h1>
    ${errorSummary(errors)}
    <p class="lead">${t('auth.account.lead', { label: viewer.label })}</p>
    ${familyCode
      ? html`<section class="panel notice-panel" aria-labelledby="code-heading">
          <h2 id="code-heading">${t('auth.account.familyCodeTitle')}</h2>
          <p class="family-code"><strong>${familyCode}</strong></p>
          <p>${t('auth.account.familyCodeText')}</p>
        </section>`
      : ''}
    <form method="post" action="/account" class="stack-form" novalidate>
      ${textField({ name: 'name', label: t('auth.fields.yourName'), value: values.name, error: errors.name, required: true, autocomplete: 'name' })}
      ${selectField({
        name: 'uiLanguage',
        label: t('auth.fields.uiLanguage'),
        options: UI_LANGUAGES.map((l) => ({ value: l.code, label: l.name === l.english ? l.name : `${l.name} (${l.english})` })),
        value: values.uiLanguage,
        error: errors.uiLanguage,
        hint: t('auth.fields.uiLanguageHint'),
      })}
      ${showLanguages ? languageFieldset({ values, errors, legend: t('auth.fields.languages') }) : ''}
      ${showLanguages ? '' : html`<p>${t('auth.account.spoken')} ${formatLanguages(values)}</p>`}
      <button type="submit" class="button">${t('auth.account.save')}</button>
    </form>
    ${signOutForm('')}`;
}

export function waitingPage({ viewer, declined }) {
  const kind = viewer.kind === 'family' ? 'family' : 'volunteer';
  return html`
    <h1>${t(declined ? 'auth.waiting.declinedTitle' : 'auth.waiting.title')}</h1>
    <p class="lead">${t(declined ? `auth.waiting.declined` : `auth.waiting.${kind}`)}</p>
    <p>${t('auth.waiting.meanwhile')} <a href="/account">${t('auth.nav.account')}</a> · <a href="/help">${t('auth.tooMany.helpLink')}</a></p>
    ${signOutForm('')}`;
}

// ----- coordinator: approvals -----

export function approvalsPage({ volunteers, links }) {
  const buttons = (action) => html`
    <form method="post" action="${action}" class="inline-form">
      <button type="submit" class="button button-small" name="decision" value="approve">${t('auth.approvals.approve')}</button>
    </form>
    <form method="post" action="${action}" class="inline-form">
      <button type="submit" class="button button-secondary button-small" name="decision" value="decline">${t('auth.approvals.decline')}</button>
    </form>`;
  return html`
    ${backLink('/admin', t('auth.approvals.backLabel'))}
    <h1>${t('auth.approvals.title')}</h1>
    <p class="lead">${t('auth.approvals.lead')}</p>
    <section class="panel" aria-labelledby="pending-volunteers">
      <h2 id="pending-volunteers">${t('auth.approvals.volunteers')}</h2>
      ${volunteers.length
        ? html`<ul class="plain-list">${volunteers.map(
            ({ volunteer, email }) => html`<li class="card">
              <p><strong>${volunteer.name}</strong>${volunteer.affiliation ? html`, ${volunteer.affiliation}` : ''} (${volunteer.town || ''})</p>
              <p class="muted">${email}</p>
              <div class="button-row">${buttons(`/admin/approvals/volunteers/${volunteer.id}`)}</div>
            </li>`
          )}</ul>`
        : html`<p class="muted">${t('auth.approvals.noVolunteers')}</p>`}
    </section>
    <section class="panel" aria-labelledby="pending-family">
      <h2 id="pending-family">${t('auth.approvals.family')}</h2>
      ${links.length
        ? html`<ul class="plain-list">${links.map(
            ({ link, user, senior }) => html`<li class="card">
              <p>${t('auth.approvals.familyLine', { name: user.name, relationship: link.relationship || '', senior: senior.name })}</p>
              <p class="muted">${user.email}</p>
              <div class="button-row">${buttons(`/admin/approvals/family/${link.id}`)}</div>
            </li>`
          )}</ul>`
        : html`<p class="muted">${t('auth.approvals.noFamily')}</p>`}
    </section>`;
}
