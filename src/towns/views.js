// Town pieces for pages: the town picker on the senior and volunteer forms,
// and the no-JavaScript "Show town" filter on the dashboard, Needs attention,
// Seniors, and Volunteers pages. Everything is escaped by html``.

import { html, plural } from '../views/html.js';
import { selectField } from '../views/components.js';
import { COMMUNITY, INDIANA_CENTRAL_TIME } from '../community.js';
import { DEPLOYMENT_TOWNS, townOf } from './index.js';

const ZONE_NAME = COMMUNITY.timeZone === INDIANA_CENTRAL_TIME ? 'Central' : 'Eastern';
const OTHER_ZONE = ZONE_NAME === 'Central' ? 'Eastern' : 'Central';

const townOptions = () => DEPLOYMENT_TOWNS.map((t) => ({ value: t.name, label: `${t.name} (${t.county})` }));

// <select name="town"> for the add/edit forms. `person` may be {} for a new one.
export function townSelectField(person, error) {
  const current = townOf(person);
  const options = townOptions();
  // Keep an old saved town visible even if it isn't on today's list.
  if (!options.some((o) => o.value === current)) options.unshift({ value: current, label: current });
  return selectField({
    name: 'town',
    label: 'Town',
    options,
    value: current,
    error,
    hint: `Towns on Indiana ${ZONE_NAME} time. Towns on ${OTHER_ZONE} time have their own PorchLight, because every call time uses one clock.`,
  });
}

// The GET filter: a labeled <select>, a submit button, and (when a town is
// chosen) a sentence that says what the numbers now count, e.g.
// "In Westfield: 1 senior (4 in all towns)."
//   action  the page's own path, e.g. '/dashboard'
//   town    the chosen town (from townFromQuery) or null for all towns
//   shown   how many rows are on the page now; total = how many in all towns
//   noun    ['senior', 'seniors'] or ['volunteer', 'volunteers'], ...
export function townFilter({ action, town, shown, total, noun = ['senior', 'seniors'], label = 'Show seniors in', asked = '' }) {
  const notServed = !town && typeof asked === 'string' && asked.trim() ? asked.trim().slice(0, 60) : '';
  const [one, many] = noun;
  return html`
    <form method="get" action="${action}" class="town-filter" aria-label="Filter by town">
      <div class="field">
        <label for="town-filter">${label}</label>
        <div class="inline-input">
          <select id="town-filter" name="town">
            <option value=""${town ? '' : html` selected`}>All towns</option>
            ${townOptions().map((o) => html`<option value="${o.value}"${o.value === town ? html` selected` : ''}>${o.label}</option>`)}
          </select>
          <button type="submit" class="button button-secondary">Show</button>
        </div>
      </div>
      ${town
        ? html`<p class="town-filter-status"><strong>In ${town}: ${plural(shown, one, many)}</strong> (${total} in all towns). <a href="${action}">Show all towns</a></p>`
        : notServed
          ? html`<p class="town-filter-status" role="status"><strong>"${notServed}" isn't one of the towns this PorchLight serves</strong>, so every town is shown.</p>`
          : ''}
    </form>`;
}
