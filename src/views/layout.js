// Page shell shared by every screen: skip link, header, navigation, AI mode
// badge, Accessibility menu, feedback banner, and footer.

import { html, raw } from './html.js';
import { banner } from './components.js';
import { COMMUNITY } from '../community.js';
import { navFor, viewerLine } from '../roles/views.js'; // [roles]

// Main navigation. `key` matches the `active` value a page passes to render(),
// which marks that link with aria-current="page".
const NAV = [
  { href: '/', label: 'Home', key: 'home' },
  { href: '/seniors', label: 'Seniors', key: 'seniors' },
  { href: '/volunteers', label: 'Volunteers', key: 'volunteers' },
  { href: '/match', label: 'Match', key: 'match' },
  { href: '/contacts', label: 'Calls & Visits', key: 'contacts' },
  { href: '/dashboard', label: 'Family Dashboard', key: 'dashboard' },
  { href: '/attention', label: 'Needs attention', key: 'attention' },
  { href: '/help', label: 'Get help', key: 'help' },
];

// "No dead ends": after a success message, offer the obvious next step.
// Built only from the message key and the current path (no user text).
function nextStep(req) {
  const msg = req.query.msg;
  const seniorId = (req.path.match(/^\/seniors\/([^/]+)$/) || [])[1];
  if (msg === 'reset' && req.path !== '/tour') return { href: '/tour', label: 'Continue the 2-minute demo tour' };
  if (msg === 'matched' && seniorId) return { href: `/contacts?seniorId=${encodeURIComponent(seniorId)}`, label: 'Schedule the first call' };
  if (msg === 'senior_added' && seniorId) return { href: `/match?seniorId=${encodeURIComponent(seniorId)}`, label: 'Find a companion' };
  if ((msg === 'completed' || msg === 'logged') && req.path !== '/dashboard') return { href: '/dashboard', label: 'See the Family Dashboard' };
  return null;
}

function flashBanner(flash, req) {
  const kind = flash.kind || 'success';
  const classes = `flash flash-${kind}`;
  return banner({ kind, text: flash.text, next: kind === 'success' ? nextStep(req) : null, extraClass: classes });
}

// ---------- Accessibility menu: text size, contrast, and theme ----------
// Each choice is kept in its own cookie (POST /prefs/<route>, see app.js) and
// becomes a class on <html>, so the very first paint is right with no
// JavaScript: text-normal | text-large | text-xlarge, then theme-light or
// theme-dark (no theme class = match the device), then contrast-high.
export const TEXT_SIZES = [
  { id: 'normal', label: 'A', name: 'Normal text', word: 'Normal' },
  { id: 'large', label: 'A+', name: 'Large text', word: 'Large' },
  { id: 'xlarge', label: 'A++', name: 'Extra large text', word: 'Extra large' },
];
export const CONTRASTS = [
  { id: 'standard', label: 'Aa', word: 'Standard' },
  { id: 'high', label: 'Aa', word: 'High' },
];
export const THEMES = [
  { id: 'light', icon: 'sun', word: 'Light' },
  { id: 'dark', icon: 'moon', word: 'Dark' },
  { id: 'auto', icon: 'device', word: 'Match my device' },
];

// One entry per group in the menu. `field` is the buttons' name, `cookie` the
// cookie it sets, and `fallback` the value when there is no valid cookie.
// formClass "text-size" is kept from the original A/A+/A++ control.
export const PREFS = [
  { key: 'textSize', route: 'text-size', field: 'size', cookie: 'textsize', legend: 'Text size', formClass: 'text-size', options: TEXT_SIZES, fallback: 'normal' },
  { key: 'contrast', route: 'contrast', field: 'contrast', cookie: 'contrast', legend: 'Contrast', formClass: 'pref-contrast', options: CONTRASTS, fallback: 'standard' },
  { key: 'theme', route: 'theme', field: 'theme', cookie: 'theme', legend: 'Theme', formClass: 'pref-theme', options: THEMES, fallback: 'auto' },
];

// Cookie values are checked against the allow-lists; anything else is ignored.
export function readPrefs(cookies = {}) {
  const prefs = {};
  for (const pref of PREFS) {
    const value = cookies[pref.cookie];
    prefs[pref.key] = pref.options.some((o) => o.id === value) ? value : pref.fallback;
  }
  return prefs;
}

export function htmlClass({ textSize, contrast, theme }) {
  return [`text-${textSize}`, theme !== 'auto' && `theme-${theme}`, contrast === 'high' && 'contrast-high']
    .filter(Boolean)
    .join(' ');
}

// Where a preference change returns to. It has to be a page that loads with GET.
// After a form comes back with errors, the address is the form's POST target
// (/settings, /seniors), which is not a page, so we return to the page that
// holds that form instead (B-10). On a normal page the whole query string is
// kept (?seniorId=, ?matchId=, ?town= choose what the page shows), except the
// one-time ?msg= and ?warn= flags, which would repeat an old message.
// The POST /prefs/* routes still run the result through safeBack().
const DROP_QUERY = new Set(['msg', 'warn']);
const POST_RESULT_PAGES = [
  [/^\/seniors$/, () => '/seniors/new'],
  [/^\/seniors\/([^/]+)$/, ([, id]) => `/seniors/${id}/edit`],
  [/^\/seniors\/([^/]+)\/sparks$/, ([, id]) => `/seniors/${id}`],
  [/^\/volunteers$/, () => '/volunteers/new'],
  [/^\/volunteers\/([^/]+)$/, ([, id]) => `/volunteers/${id}/edit`],
  [/^\/matches(?:\/[^/]+\/end)?$/, (m, body) => withQuery('/match', { seniorId: body.seniorId })],
  [/^\/contacts(?:\/[^/]+\/(?:complete|missed))?$/, (m, body) => withQuery('/contacts', { matchId: body.matchId })],
  [/^\/settings$/, () => '/dashboard'],
  [/^\/demo\/reset$/, () => '/dashboard'],
];

function withQuery(path, params) {
  const pairs = Object.entries(params).filter(([, v]) => typeof v === 'string' && v !== '');
  return pairs.length ? `${path}?${pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}` : path;
}

export function prefsReturnPath(req) {
  if (req.method === 'POST') {
    const path = req.path.length > 1 ? req.path.replace(/\/+$/, '') : req.path;
    for (const [pattern, to] of POST_RESULT_PAGES) {
      const m = pattern.exec(path);
      if (m) return to(m, req.body || {});
    }
    return '/';
  }
  const query = Object.entries(req.query || {}).filter(([k]) => !DROP_QUERY.has(k));
  return withQuery(req.path, Object.fromEntries(query));
}

// Could someone have typed into a form on this page? Then the menu warns that
// a change reloads the page and clears what is not saved yet.
function hasTypedFields(req, body) {
  if (req.method === 'POST') return true; // a form that came back with errors
  return /<textarea\b(?![^>]*\sreadonly[\s>=])|<input\b(?![^>]*type="(?:hidden|submit|button)")|<select\b/.test(String(body ?? ''));
}

const ICONS = {
  person: '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="6.8" r="1.9" fill="currentColor"/><path d="M6.5 9.8 12 11l5.5-1.2M12 11v3.6m0 0-2.9 4.6m2.9-4.6 2.9 4.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  chevron: '<path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  sun: '<circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2.6M12 19.4V22M2 12h2.6M19.4 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  moon: '<path d="M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8Z" fill="currentColor"/>',
  device: '<rect x="2.5" y="3.5" width="19" height="13.5" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4.5h7.5a1 1 0 0 1 1 1V16H12Z" fill="currentColor"/><path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};
const icon = (name, cls) =>
  raw(`<svg class="${cls}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`);

// The sample in each button is decoration (aria-hidden); the word is its name.
function optionSample(pref, option) {
  if (pref.key === 'theme') return icon(option.icon, 'pref-sample pref-icon');
  return html`<span class="pref-sample" aria-hidden="true">${option.label}</span>`;
}

function prefForm(pref, current, backPath) {
  return html`
        <form class="${pref.formClass}" method="post" action="/prefs/${pref.route}">
          <input type="hidden" name="back" value="${backPath}">
          <fieldset class="pref-group">
            <legend class="pref-legend">${pref.legend}</legend>
            <div class="pref-options">
              ${pref.options.map((o) => {
                const pressed = o.id === current;
                // size-* is kept from the old control; pref-contrast-high etc. never clash with the <html> classes.
                const variant = pref.key === 'textSize' ? `size-${o.id}` : `pref-${pref.route}-${o.id}`;
                return html`<button type="submit" name="${pref.field}" value="${o.id}" aria-pressed="${pressed ? 'true' : 'false'}" class="pref-option ${variant}">${optionSample(pref, o)}<span class="pref-word">${o.word}</span>${pressed ? html`<span class="pref-check" aria-hidden="true">✓</span>` : ''}</button>`;
              })}
            </div>
          </fieldset>
        </form>`;
}

// A native <details> disclosure: it opens and closes with a click, Enter, or
// Space, with no JavaScript. Each group is its own small form, so pressing a
// button saves that choice right away (Post/Redirect/Get) and the page reloads
// with the new look. public/app.js only adds Escape and click-outside to close.
function accessibilityMenu(prefs, backPath, warnTyped) {
  return html`
      <details class="a11y-menu">
        <summary class="a11y-summary">${icon('person', 'a11y-icon')}<span class="a11y-summary-text">Accessibility</span>${icon('chevron', 'a11y-chevron')}</summary>
        <div class="a11y-panel">
          <p class="a11y-intro">Your choices are saved on this device.</p>
          ${warnTyped
            ? html`<p class="a11y-warning"><span class="a11y-warning-icon" aria-hidden="true">⚠︎</span> <span><strong>Heads up:</strong> a change reloads the page and clears any form you have not saved.</span></p>`
            : ''}
          ${PREFS.map((pref) => prefForm(pref, prefs[pref.key], backPath))}
        </div>
      </details>`;
}

// Read-only copy boxes (the family summary message) must print in full, but a
// <textarea> never grows on paper. Each one gets a print-only twin holding the
// same, already escaped, text; styles.css shows it only when printing (B-06).
const SafeHtml = raw('').constructor;
function withPrintCopies(body) {
  if (!(body instanceof SafeHtml)) return body;
  return raw(
    String(body).replace(
      /<textarea\b(?=[^>]*\sreadonly[\s>=])[^>]*>([\s\S]*?)<\/textarea>/g,
      (whole, text) => `${whole}<div class="print-copy" hidden>${text}</div>`
    )
  );
}

function modeBadge(sparkMode) {
  if (sparkMode.effective === 'live') {
    return html`<a class="mode-badge mode-live" href="/about-ai" title="${sparkMode.reason}">AI: Live (Claude)</a>`;
  }
  return html`<a class="mode-badge mode-mock" href="/about-ai" title="${sparkMode.reason}">AI: Offline mode</a>`;
}

export function layout({ title, active, body, req, ctx, flash, wide = false }) {
  const prefs = readPrefs(req.cookies);
  // color-scheme tells the browser how to draw native controls (date pickers,
  // scrollbars) to match the theme.
  const colorScheme = { light: 'light', dark: 'dark', auto: 'light dark' }[prefs.theme];
  const nav = navFor(req.viewer, NAV); // [roles] signed-in people see only their own pages; demo mode gets NAV
  const signedIn = viewerLine(req.viewer); // [roles] "Signed in as ... · Sign out", or the demo-mode line
  return html`<!DOCTYPE html>
<html lang="en" class="${htmlClass(prefs)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · PorchLight</title>
  <meta name="description" content="PorchLight helps older adults in Indiana communities stay connected with volunteer companions. Demo data starts in ${COMMUNITY.town}, ${COMMUNITY.county}.">
  <meta name="theme-color" content="${prefs.contrast === 'high' ? '#000000' : '#1d2433'}">
  <meta name="color-scheme" content="${colorScheme}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
  <script src="/app.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to main content</a>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="/" aria-label="PorchLight home">
        <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <path d="M16 3 6 10h20z" fill="#7a4b00"/>
          <rect x="9" y="10" width="14" height="16" rx="2" fill="#ffd66b" stroke="#7a4b00" stroke-width="2"/>
          <path d="M16 14c-2 3-2 6 0 8 2-2 2-5 0-8z" fill="#c2410c"/>
          <rect x="7" y="26" width="18" height="3" rx="1.5" fill="#7a4b00"/>
        </svg>
        <span class="brand-name">PorchLight</span>
      </a>
      <div class="header-tools">
        ${modeBadge(ctx.sparks.modeInfo)}
        ${accessibilityMenu(prefs, prefsReturnPath(req), hasTypedFields(req, body))}
      </div>
    </div>
    ${signedIn}
    <nav class="site-nav" aria-label="Main">
      <ul>
        ${nav.map(
          (item) => html`<li><a href="${item.href}"${active === item.key ? html` aria-current="page"` : ''}>${item.label}</a></li>`
        )}
      </ul>
    </nav>
  </header>
  <main id="main" tabindex="-1" class="${wide ? 'wide' : ''}">
    ${flash ? flashBanner(flash, req) : html`<div role="status" class="visually-hidden"></div>`}
    ${withPrintCopies(body)}
  </main>
  <footer class="site-footer">
    <p class="footer-note">Built for Indiana communities. Demo data is fictional.</p>
    <p>A prototype for the Nextech CSforGood 2026 competition. The sign-in is a demo with no passwords. Signed out, you can see every screen: senior, volunteer, family, and coordinator.</p>
    <ul class="footer-links">
      <li><a href="/tour">2-minute demo tour</a></li>
      <li><a href="/about-ai">How the AI works</a></li>
      <li><a href="/demo/reset">Reset demo data</a></li>
    </ul>
  </footer>
</body>
</html>`;
}
