// Town pieces for pages: the town picker on the senior and volunteer forms,
// and the no-JavaScript "Show town" filter on the dashboard, Needs attention,
// Seniors, and Volunteers pages. Everything is escaped by html``.
// [v2 i18n] Words are core.towns.* keys. Town and county names are data and stay as they are.

import { html, raw, escapeHtml, plural } from '../views/html.js';
import { selectField } from '../views/components.js';
import { COMMUNITY, INDIANA_CENTRAL_TIME } from '../community.js';
import { DEPLOYMENT_TOWNS, townOf } from './index.js';
import { t } from '../i18n/index.js';
import { tCount } from '../features/words.js';

const ZONE = COMMUNITY.timeZone === INDIANA_CENTRAL_TIME ? 'central' : 'eastern';

// Escaped like html`` does, but keeps plain " marks as they were in the old
// template ("Evansville" isn't one of ...). A " can't end anything in element text.
const quotedText = (text) => raw(escapeHtml(text).replace(/&quot;/g, '"'));

const townOptions = () => DEPLOYMENT_TOWNS.map((t) => ({ value: t.name, label: `${t.name} (${t.county})` }));

// <select name="town"> for the add/edit forms. `person` may be {} for a new one.
export function townSelectField(person, error) {
  const current = townOf(person);
  const options = townOptions();
  // Keep an old saved town visible even if it isn't on today's list.
  if (!options.some((o) => o.value === current)) options.unshift({ value: current, label: current });
  return selectField({
    name: 'town',
    label: t('core.towns.label'),
    options,
    value: current,
    error,
    hint: t(`core.towns.hint.${ZONE}`),
  });
}

// What the filter counts. Callers pass a key prefix (core.towns.count.*, with
// .one and .other), or one of the older English pairs, which map to the same keys.
const NOUN_KEYS = {
  senior: 'core.towns.count.senior',
  volunteer: 'core.towns.count.volunteer',
  'senior on the list': 'core.towns.count.onList',
};
const LABEL_KEYS = { 'Show seniors in': 'core.towns.showSeniors', 'Show volunteers in': 'core.towns.showVolunteers' };

// The GET filter: a labeled <select>, a submit button, and (when a town is
// chosen) a sentence that says what the numbers now count, e.g.
// "In Westfield: 1 senior (4 in all towns)."
//   action  the page's own path, e.g. '/dashboard'
//   town    the chosen town (from townFromQuery) or null for all towns
//   shown   how many rows are on the page now; total = how many in all towns
//   noun    a key prefix such as 'core.towns.count.volunteer', or ['volunteer', 'volunteers']
export function townFilter({ action, town, shown, total, noun = 'core.towns.count.senior', label = 'Show seniors in', asked = '' }) {
  const notServed = !town && typeof asked === 'string' && asked.trim() ? asked.trim().slice(0, 60) : '';
  const nounKey = typeof noun === 'string' ? noun : NOUN_KEYS[noun[0]];
  const counted = nounKey ? tCount(nounKey, shown) : plural(shown, noun[0], noun[1]);
  const labelText = LABEL_KEYS[label] ? t(LABEL_KEYS[label]) : label;
  return html`
    <form method="get" action="${action}" class="town-filter" aria-label="${t('core.towns.filterLabel')}">
      <div class="field">
        <label for="town-filter">${labelText}</label>
        <div class="inline-input">
          <select id="town-filter" name="town">
            <option value=""${town ? '' : html` selected`}>${t('core.towns.all')}</option>
            ${townOptions().map((o) => html`<option value="${o.value}"${o.value === town ? html` selected` : ''}>${o.label}</option>`)}
          </select>
          <button type="submit" class="button button-secondary">${t('core.towns.show')}</button>
        </div>
      </div>
      ${town
        ? html`<p class="town-filter-status"><strong>${t('core.towns.inTown', { town, counted })}</strong> ${t('core.towns.inAll', { total })} <a href="${action}">${t('core.towns.showAll')}</a></p>`
        : notServed
          ? html`<p class="town-filter-status" role="status"><strong>${quotedText(t('core.towns.notServed', { town: notServed }))}</strong>${t('core.towns.notServedRest')}</p>`
          : ''}
    </form>`;
}
