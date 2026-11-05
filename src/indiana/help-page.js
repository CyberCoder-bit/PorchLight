// "Get help in Indiana" (GET /help): who to call when an older adult needs
// more than a friendly call. Everything shown comes from the fixed, cited
// list in src/community.js (localHelpFor). No AI and no JavaScript.
//
// [v2 i18n] Page words are core.help.* keys. The resources' descriptions come
// from core.help.res.<resource>.<field> when the catalog has that key, and from
// src/community.js otherwise (a new town's profile works before it is
// translated). Organization names and phone numbers are shown as they are.

import { html } from '../views/html.js';
import { fromLocal, formatLocal } from '../tz.js';
import { t, EN } from '../i18n/index.js';

// Friendly names for the official pages we cite. Unknown URLs show their host.
const SOURCE_KEYS = {
  'https://www.in.gov/fssa/ddars/bba/area-agencies-on-aging/': 'core.help.source.aaa',
  'https://www.in.gov/fssa/indiana-211/': 'core.help.source.in211',
  'https://www.in911.net/text-for-911.html': 'core.help.source.text911',
  'https://cicoa.org/': 'core.help.source.cicoa',
  'https://swirca.org/': 'core.help.source.swirca',
};

// Resource ids -> the part of their catalog keys.
const RESOURCE_KEYS = { 'in-aaa-directory': 'aaaDirectory', 'emergency-911': 'emergency' };

// A resource's text in the reader's language, or the profile's own words.
export function helpText(r, field) {
  const key = `core.help.res.${RESOURCE_KEYS[r.id] || r.id}.${field}`;
  return key in EN ? t(key) : r[field];
}
const phoneLabel = (r, p, i) => {
  const key = `core.help.res.${RESOURCE_KEYS[r.id] || r.id}.phone${i}`;
  return key in EN ? t(key) : p.label;
};

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const sourceName = (url) => (SOURCE_KEYS[url] ? t(SOURCE_KEYS[url]) : hostOf(url));

// "317-803-6131" -> "tel:+13178036131". Short numbers like 211 and 911 stay short.
export function telHref(number) {
  const digits = String(number).replace(/\D/g, '');
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `tel:+${digits}`;
  return `tel:${digits}`;
}

const phoneLink = (number) => html`<a href="${telHref(number)}">${number}</a>`;

// '2026-11-03' -> 'November 3, 2026' (through tz.js, like every date in the app).
function checkedText(isoDay) {
  const [year, month, day] = String(isoDay).split('-').map(Number);
  return formatLocal(fromLocal(year, month, day, 12), { month: 'long', day: 'numeric', year: 'numeric' });
}

function listWords(items) {
  if (items.length <= 1) return items.join('');
  return t('core.help.listLast', { rest: items.slice(0, -1).join(', '), last: items[items.length - 1] });
}

function sourcesLine(r) {
  const urls = r.sources && r.sources.length ? r.sources : r.source ? [r.source] : [];
  if (!urls.length || !r.checked) return '';
  return html`<p class="muted">${t('core.help.checkedOn', { date: checkedText(r.checked) })} ${urls.map(
    (u, i) => html`${i ? (i === urls.length - 1 ? html` ${t('core.help.and')} ` : ', ') : ''}<a href="${u}">${sourceName(u)}</a>`
  )}.</p>`;
}

function resourcePanel(r) {
  const headingId = `help-${r.id}`;
  const textLine = helpText(r, 'textLine');
  return html`
    <section class="panel" aria-labelledby="${headingId}">
      <h2 id="${headingId}">${helpText(r, 'name')}</h2>
      <p>${helpText(r, 'description')}</p>
      <dl class="facts">
        <dt>${t('core.help.whenToCall')}</dt>
        <dd>${helpText(r, 'whenToUse')}</dd>
        ${r.counties && r.counties.length
          ? html`<dt>${t('core.help.serves')}</dt><dd>${t('core.help.counties', { list: listWords([...r.counties].sort()) })}</dd>`
          : ''}
        ${r.phones && r.phones.length
          ? html`<dt>${t('core.help.phone')}</dt>
            <dd>
              <ul class="plain-list">
                ${r.phones.map((p, i) => html`<li><span class="big">${phoneLink(p.number)}</span><br>${phoneLabel(r, p, i)}</li>`)}
              </ul>
            </dd>`
          : ''}
        ${textLine ? html`<dt>${t('core.help.text')}</dt><dd>${textLine}</dd>` : ''}
        ${r.url ? html`<dt>${t('core.help.website')}</dt><dd><a href="${r.url}">${helpText(r, 'urlLabel') || hostOf(r.url)}</a></dd>` : ''}
      </dl>
      ${sourcesLine(r)}
    </section>`;
}

/**
 * @param {object} args
 * @param {object} args.community  profile from src/community.js
 * @param {object[]} args.resources  localHelpFor(community)
 */
export function helpPage({ community, resources }) {
  const emergency = resources.find((r) => r.kind === 'emergency');
  const others = resources.filter((r) => r.kind !== 'emergency');
  const place = `${community.county}, ${community.state}`;
  const emergencyText = emergency ? helpText(emergency, 'textLine') : null;

  return html`
    <p class="breadcrumb"><a href="/">← ${t('core.help.back')}</a></p>
    <h1>${t('core.help.title')}</h1>
    <p class="lead">${t('core.help.lead', { place })}</p>

    ${emergency
      ? html`
      <section class="panel notice-panel" aria-labelledby="danger-heading">
        <h2 id="danger-heading"><span aria-hidden="true">⚠ </span>${t('core.help.dangerTitle')}</h2>
        <p class="big">${t('core.help.call')} ${phoneLink(emergency.phone)} ${t('core.help.dangerCallAfter')}</p>
        <p>${t('core.help.afterCall')}</p>
        ${emergencyText ? html`<p>${emergencyText}</p>` : ''}
        ${sourcesLine(emergency)}
      </section>`
      : ''}

    <section class="panel explain" aria-labelledby="which-heading">
      <h2 id="which-heading">${t('core.help.whichTitle')}</h2>
      <ul class="plain-list">
        ${emergency ? html`<li><strong>${helpText(emergency, 'situation') || helpText(emergency, 'whenToUse')}</strong><br>${t('core.help.call')} ${phoneLink(emergency.phone)}.</li>` : ''}
        ${others.map(
          (r) => html`<li><strong>${helpText(r, 'situation') || helpText(r, 'whenToUse')}</strong><br>${r.phone
            ? html`${t('core.help.callAt', { name: helpText(r, 'shortName') || helpText(r, 'name') })} ${phoneLink(r.phone)}${r.kind === 'aaa-directory' && r.url
              ? html`${t('core.help.orSee')} <a href="${r.url}">${t('core.help.stateList')}</a>`
              : ''}.`
            : html`${t('core.help.see')} <a href="#help-${r.id}">${helpText(r, 'name')}</a> ${t('core.help.below')}`}</li>`
        )}
        <li><strong>${t('core.help.missedTitle')}</strong><br>${t('core.help.missedText')}</li>
      </ul>
    </section>

    ${others.map(resourcePanel)}

    <section class="panel explain" aria-labelledby="about-help-heading">
      <h2 id="about-help-heading">${t('core.help.aboutTitle')}</h2>
      <p>${t('core.help.about1')} ${phoneLink('211')}.</p>
      <p>${t('core.help.about2')}</p>
      <p>${t('core.help.about3')}</p>
    </section>`;
}
