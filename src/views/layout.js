// Page shell shared by every screen: skip link, header, navigation, AI mode
// badge, Accessibility menu, feedback banner, and footer.

import { html, raw } from './html.js';
import { banner } from './components.js';
import { COMMUNITY } from '../community.js';
import { navFor, viewerLine } from '../roles/views.js'; // [roles]
import { currentLang, dirFor, t } from '../i18n/index.js'; // [v2 i18n]
import { languagePicker } from '../i18n/picker.js'; // [v2 i18n]

// Main navigation. `key` matches the `active` value a page passes to render(),
// which marks that link with aria-current="page".
// [v2] This is the coordinator's (admin's) nav. Other people get their own
// pages from navFor() (src/roles/views.js); signed out, there is no app nav.
// [v2 i18n] `label` is a catalog key; adminNav() turns it into words for this request.
const NAV = [
  { href: '/admin', label: 'core.nav.home', key: 'home' },
  { href: '/admin/seniors', label: 'core.nav.seniors', key: 'seniors' },
  { href: '/admin/volunteers', label: 'core.nav.volunteers', key: 'volunteers' },
  { href: '/admin/match', label: 'core.nav.match', key: 'match' },
  { href: '/contacts', label: 'core.nav.contacts', key: 'contacts' },
  { href: '/admin/dashboard', label: 'core.nav.dashboard', key: 'dashboard' },
  { href: '/admin/attention', label: 'core.nav.attention', key: 'attention' },
  { href: '/admin/approvals', label: 'core.nav.approvals', key: 'approvals' },
  { href: '/help', label: 'core.nav.help', key: 'help' },
];
const adminNav = () => NAV.map((item) => ({ ...item, label: t(item.label) }));

// "No dead ends": after a success message, offer the obvious next step.
// Built only from the message key and the current path (no user text).
function nextStep(req) {
  const msg = req.query.msg;
  const seniorId = (req.path.match(/^\/seniors\/([^/]+)$/) || [])[1];
  if (msg === 'reset' && req.path !== '/tour') return { href: '/tour', label: t('core.next.tour') };
  if (msg === 'matched' && seniorId) return { href: `/contacts?seniorId=${encodeURIComponent(seniorId)}`, label: t('core.next.firstCall') };
  if (msg === 'senior_added' && seniorId) return { href: `/admin/match?seniorId=${encodeURIComponent(seniorId)}`, label: t('core.next.findCompanion') };
  if ((msg === 'completed' || msg === 'logged') && req.path !== '/dashboard') return { href: '/dashboard', label: t('core.next.dashboard') };
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
// [v2 i18n] `name`, `word` and `legend` are getters, so they are read in the
// request's language each time a page is drawn. `label` (A, A+, Aa) is a sample.
export const TEXT_SIZES = [
  { id: 'normal', label: 'A', get name() { return t('core.a11y.sizeName.normal'); }, get word() { return t('core.a11y.size.normal'); } },
  { id: 'large', label: 'A+', get name() { return t('core.a11y.sizeName.large'); }, get word() { return t('core.a11y.size.large'); } },
  { id: 'xlarge', label: 'A++', get name() { return t('core.a11y.sizeName.xlarge'); }, get word() { return t('core.a11y.size.xlarge'); } },
];
export const CONTRASTS = [
  { id: 'standard', label: 'Aa', get word() { return t('core.a11y.contrastWord.standard'); } },
  { id: 'high', label: 'Aa', get word() { return t('core.a11y.contrastWord.high'); } },
];
export const THEMES = [
  { id: 'light', icon: 'sun', get word() { return t('core.a11y.themeWord.light'); } },
  { id: 'dark', icon: 'moon', get word() { return t('core.a11y.themeWord.dark'); } },
  { id: 'auto', icon: 'device', get word() { return t('core.a11y.themeWord.auto'); } },
];

// One entry per group in the menu. `field` is the buttons' name, `cookie` the
// cookie it sets, and `fallback` the value when there is no valid cookie.
// formClass "text-size" is kept from the original A/A+/A++ control.
export const PREFS = [
  { key: 'textSize', route: 'text-size', field: 'size', cookie: 'textsize', get legend() { return t('core.a11y.textSize'); }, formClass: 'text-size', options: TEXT_SIZES, fallback: 'normal' },
  { key: 'contrast', route: 'contrast', field: 'contrast', cookie: 'contrast', get legend() { return t('core.a11y.contrast'); }, formClass: 'pref-contrast', options: CONTRASTS, fallback: 'standard' },
  { key: 'theme', route: 'theme', field: 'theme', cookie: 'theme', get legend() { return t('core.a11y.theme'); }, formClass: 'pref-theme', options: THEMES, fallback: 'auto' },
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
  [/^\/admin\/seniors$/, () => '/admin/seniors/new'], // [v2 accounts] coordinator pages moved under /admin
  [/^\/seniors\/([^/]+)$/, ([, id]) => `/seniors/${id}/edit`],
  [/^\/seniors\/([^/]+)\/sparks$/, ([, id]) => `/seniors/${id}`],
  [/^\/admin\/volunteers$/, () => '/admin/volunteers/new'],
  [/^\/volunteers\/([^/]+)$/, ([, id]) => `/volunteers/${id}/edit`],
  [/^\/admin\/matches(?:\/[^/]+\/end)?$/, (m, body) => withQuery('/admin/match', { seniorId: body.seniorId })],
  [/^\/contacts(?:\/[^/]+\/(?:complete|missed))?$/, (m, body) => withQuery('/contacts', { matchId: body.matchId })],
  [/^\/admin\/settings$/, () => '/admin/dashboard'],
  [/^\/admin\/demo\/reset$/, () => '/admin/dashboard'],
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
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
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
        <summary class="a11y-summary">${icon('person', 'a11y-icon')}<span class="a11y-summary-text">${t('core.a11y.summary')}</span>${icon('chevron', 'a11y-chevron')}</summary>
        <div class="a11y-panel">
          <p class="a11y-intro">${t('core.a11y.intro')}</p>
          ${warnTyped
            ? html`<p class="a11y-warning"><span class="a11y-warning-icon" aria-hidden="true">⚠︎</span> <span><strong>${t('core.a11y.headsUp')}</strong> ${t('core.a11y.warning')}</span></p>`
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

// The badge holds its full wording and a short one. Narrow screens show the
// short one ("AI: Offline") and keep the full one for screen readers, so the
// link's name is always the full wording and starts with what is on screen.
function modeBadge(sparkMode) {
  const live = sparkMode.effective === 'live';
  const [long, short] = live
    ? [t('core.mode.liveLong'), t('core.mode.liveShort')]
    : [t('core.mode.offlineLong'), t('core.mode.offlineShort')];
  return html`<a class="mode-badge ${live ? 'mode-live' : 'mode-mock'}" href="/about-ai" title="${sparkMode.reason}"><span class="mode-badge-long">${long}</span><span class="mode-badge-short" aria-hidden="true">${short}</span></a>`;
}

// The main nav's list. It is drawn twice (see siteMenu below), the same both times.
function navList(items, active) {
  return html`<ul>
        ${items.map(
          (item) => html`<li><a href="${item.href}"${active === item.key ? html` aria-current="page"` : ''}>${item.label}</a></li>`
        )}
      </ul>`;
}

// [v2 site] Signed-out visitors get the public website's nav instead of the
// app's: its pages, then Sign in and a "Get started" button. `key` matches the
// `active` value the site pages pass (src/views/site/index.js).
const SITE_NAV = [
  { href: '/how-it-works', key: 'site-how', label: 'site.nav.how' },
  { href: '/for-seniors', key: 'site-seniors', label: 'site.nav.seniors' },
  { href: '/for-volunteers', key: 'site-volunteers', label: 'site.nav.volunteers' },
  { href: '/for-families', key: 'site-families', label: 'site.nav.families' },
  { href: '/languages', key: 'site-languages', label: 'site.nav.languages' },
  { href: '/safety', key: 'site-safety', label: 'site.nav.safety' },
];
const siteNavItems = () => SITE_NAV.map((item) => ({ ...item, label: t(item.label) }));

function accountLinks(active) {
  return html`<ul class="nav-account">
        <li><a href="/sign-in"${active === 'sign-in' ? html` aria-current="page"` : ''}>${t('site.nav.signIn')}</a></li>
        <li><a class="button nav-cta" href="/sign-up">${t('site.nav.getStarted')}</a></li>
      </ul>`;
}

// [v2 brand] The PorchLight mark (public/brand/porchlight-mark.svg), drawn
// inline so its roofline and step take the text color around it (cream in the
// header, ink in the footer). Decoration: the link around it has the name.
const MARK = raw(`<svg class="brand-mark" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">
          <path d="M8 22.5 24 9l16 13.5" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M15 41V28.5a9 9 0 0 1 18 0V41z" fill="#f29f22"/>
          <circle cx="24" cy="29" r="6" fill="#ffd66b"/>
          <circle cx="24" cy="29" r="3.25" fill="#fffbea"/>
          <path d="M10.5 41.75h27" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        </svg>`);
const brandName = () => html`<span class="brand-name">Porch<span class="brand-name-light">Light</span></span>`;

// Narrow screens (styles.css, "Menu") swap the nav bar for a "Menu" button
// beside Accessibility. The button is a native <details>, so it opens and
// closes with a click, Enter, or Space and needs no JavaScript. Its list is the
// <nav> right after it: styles.css shows that nav only while Menu is open, so
// the list opens right below the button and pushes the page down instead of
// covering it. It comes after the Accessibility menu, so the order on screen
// is the keyboard order. Exactly one of the two navs is ever displayed: this
// one ("Main menu") on narrow screens, the bar ("Main") on wide ones. The other
// is display: none, so screen readers meet a single navigation landmark.
function siteMenu(links) {
  return html`
      <details class="site-menu">
        <summary class="site-menu-summary" aria-controls="site-menu-nav">${icon('menu', 'site-menu-icon')}<span class="site-menu-text">${t('core.layout.menu')}</span></summary>
      </details>
      <nav class="site-nav" id="site-menu-nav" aria-label="${t('core.layout.mainMenu')}">
      ${links}
      </nav>`;
}

// `noindex`: pages search engines must not list (every /admin page; see render() in app.js).
export function layout({ title, active, body, req, ctx, flash, wide = false, noindex = false }) {
  const prefs = readPrefs(req.cookies);
  // color-scheme tells the browser how to draw native controls (date pickers,
  // scrollbars) to match the theme.
  const colorScheme = { light: 'light', dark: 'dark', auto: 'light dark' }[prefs.theme];
  // [v2 site] Signed out: the public website's nav, Sign in, and Get started.
  // Signed in: only your own pages (navFor), and "Signed in as ... · Sign out".
  const signedOut = !req.viewer;
  const links = signedOut
    ? html`<div class="site-nav-row">${navList(siteNavItems(), active)}${accountLinks(active)}</div>`
    : html`<div class="site-nav-row">${navList(navFor(req.viewer, adminNav()), active)}</div>`; // [roles]
  const signedIn = signedOut ? '' : viewerLine(req.viewer); // [roles]
  return html`<!DOCTYPE html>
<html lang="${currentLang()}" dir="${dirFor()}" class="${htmlClass(prefs)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${noindex ? html`<meta name="robots" content="noindex, nofollow">` : ''}
  <title>${title} · PorchLight</title>
  <meta name="description" content="${t('core.layout.metaDescription', { town: COMMUNITY.town, county: COMMUNITY.county })}">
  <meta name="theme-color" content="${prefs.contrast === 'high' ? '#000000' : '#1d2433'}">
  <meta name="color-scheme" content="${colorScheme}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preload" href="/fonts/atkinson-hyperlegible-next-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/styles.css">
  <script src="/app.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">${t('core.layout.skip')}</a>

  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="/" aria-label="${t('site.brand.home')}">
        ${MARK}
        ${brandName()}
      </a>
      <div class="header-tools">
        ${modeBadge(ctx.sparks.modeInfo)}
        ${accessibilityMenu(prefs, prefsReturnPath(req), hasTypedFields(req, body))}
        ${languagePicker(req)}
      </div>
      ${siteMenu(links)}
    </div>
    ${signedIn}
    <nav class="site-nav" aria-label="${t('core.layout.mainNav')}">
      ${links}
    </nav>
  </header>
  <main id="main" tabindex="-1" class="${wide ? 'wide' : ''}">
    ${flash ? flashBanner(flash, req) : html`<div role="status" class="visually-hidden"></div>`}
    ${withPrintCopies(body)}
  </main>
  <footer class="site-footer">
    <div class="footer-inner">
      <p class="footer-brand"><a class="brand brand-footer" href="/" aria-label="${t('site.brand.home')}">${MARK}${brandName()}</a></p>
      <p class="footer-tagline">${t('site.footer.tagline')}</p>
      <ul class="footer-links">
        <li><a href="/safety">${t('site.footer.safety')}</a></li>
        <li><a href="/about">${t('site.footer.about')}</a></li>
        <li><a href="/about-ai">${t('site.footer.aboutAi')}</a></li>
        <li><a href="/tour">${t('site.footer.tour')}</a></li>
      </ul>
      <p class="footer-note">${t('site.footer.note')}</p>
    </div>
  </footer>
</body>
</html>`;
}
