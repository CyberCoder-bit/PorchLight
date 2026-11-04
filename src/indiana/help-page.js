// "Get help in Indiana" (GET /help): who to call when an older adult needs
// more than a friendly call. Everything shown comes from the fixed, cited
// list in src/community.js (localHelpFor). No AI and no JavaScript.

import { html } from '../views/html.js';
import { fromLocal, formatLocal } from '../tz.js';

// Friendly names for the official pages we cite. Unknown URLs show their host.
const SOURCE_NAMES = {
  'https://www.in.gov/fssa/ddars/bba/area-agencies-on-aging/': 'Indiana FSSA: Area Agencies on Aging (in.gov)',
  'https://www.in.gov/fssa/indiana-211/': 'Indiana FSSA: Indiana 211 (in.gov)',
  'https://www.in911.net/text-for-911.html': 'Indiana Statewide 911 Board: Text-for-911 (in911.net)',
  'https://cicoa.org/': 'CICOA website (cicoa.org)',
  'https://swirca.org/': 'SWIRCA & More website (swirca.org)',
};

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const sourceName = (url) => SOURCE_NAMES[url] || hostOf(url);

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
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function sourcesLine(r) {
  const urls = r.sources && r.sources.length ? r.sources : r.source ? [r.source] : [];
  if (!urls.length || !r.checked) return '';
  return html`<p class="muted">Checked ${checkedText(r.checked)} on ${urls.map(
    (u, i) => html`${i ? (i === urls.length - 1 ? ' and ' : ', ') : ''}<a href="${u}">${sourceName(u)}</a>`
  )}.</p>`;
}

function resourcePanel(r) {
  const headingId = `help-${r.id}`;
  return html`
    <section class="panel" aria-labelledby="${headingId}">
      <h2 id="${headingId}">${r.name}</h2>
      <p>${r.description}</p>
      <dl class="facts">
        <dt>When to call</dt>
        <dd>${r.whenToUse}</dd>
        ${r.counties && r.counties.length
          ? html`<dt>Serves</dt><dd>${listWords([...r.counties].sort())} counties</dd>`
          : ''}
        ${r.phones && r.phones.length
          ? html`<dt>Phone</dt>
            <dd>
              <ul class="plain-list">
                ${r.phones.map((p) => html`<li><span class="big">${phoneLink(p.number)}</span><br>${p.label}</li>`)}
              </ul>
            </dd>`
          : ''}
        ${r.textLine ? html`<dt>Text</dt><dd>${r.textLine}</dd>` : ''}
        ${r.url ? html`<dt>Website</dt><dd><a href="${r.url}">${r.urlLabel || hostOf(r.url)}</a></dd>` : ''}
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

  return html`
    <p class="breadcrumb"><a href="/">← Back to home</a></p>
    <h1>Get help in Indiana</h1>
    <p class="lead">Sometimes a friendly call or visit is not enough. If you, or an older adult you care about, need more help, these official services can help. This page lists who to call in ${place}, and anywhere else in Indiana.</p>

    ${emergency
      ? html`
      <section class="panel notice-panel" aria-labelledby="danger-heading">
        <h2 id="danger-heading"><span aria-hidden="true">⚠ </span>If someone may be in danger, call 911.</h2>
        <p class="big">Call ${phoneLink(emergency.phone)} right away if someone is hurt, very sick, missing, or not safe.</p>
        <p>After you call, tell their family and the PorchLight coordinator.</p>
        ${emergency.textLine ? html`<p>${emergency.textLine}</p>` : ''}
        ${sourcesLine(emergency)}
      </section>`
      : ''}

    <section class="panel explain" aria-labelledby="which-heading">
      <h2 id="which-heading">Which one should I call?</h2>
      <ul class="plain-list">
        ${emergency ? html`<li><strong>${emergency.situation || emergency.whenToUse}</strong><br>Call ${phoneLink(emergency.phone)}.</li>` : ''}
        ${others.map(
          (r) => html`<li><strong>${r.situation || r.whenToUse}</strong><br>${r.phone
            ? html`Call ${r.shortName || r.name} at ${phoneLink(r.phone)}${r.kind === 'aaa-directory' && r.url
              ? html`, or see <a href="${r.url}">the state's list of agencies</a>`
              : ''}.`
            : html`See <a href="#help-${r.id}">${r.name}</a> below.`}</li>`
        )}
        <li><strong>A call or visit was missed, or something seemed wrong on a call.</strong><br>Tell the PorchLight coordinator the same day.</li>
      </ul>
    </section>

    ${others.map(resourcePanel)}

    <section class="panel explain" aria-labelledby="about-help-heading">
      <h2 id="about-help-heading">About this list</h2>
      <p>Every name, phone number, and website here was copied from the official page linked with it. The date shows when it was last checked. Phone numbers can change. If a number does not work, dial ${phoneLink('211')}.</p>
      <p>This list is fixed information. PorchLight's AI conversation sparks never write or change it.</p>
      <p>PorchLight is a student prototype. It is not an emergency service, and it does not call anyone for you.</p>
    </section>`;
}
