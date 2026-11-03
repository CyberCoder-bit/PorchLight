// Page shell shared by every screen: skip link, header, navigation, AI mode
// badge, text-size control, flash message, and footer.

import { html } from './html.js';

const NAV = [
  { href: '/', label: 'Home', key: 'home' },
  { href: '/seniors', label: 'Seniors', key: 'seniors' },
  { href: '/volunteers', label: 'Volunteers', key: 'volunteers' },
  { href: '/match', label: 'Match', key: 'match' },
  { href: '/contacts', label: 'Calls & Visits', key: 'contacts' },
  { href: '/dashboard', label: 'Family Dashboard', key: 'dashboard' },
];

export const TEXT_SIZES = [
  { id: 'normal', label: 'A', name: 'Normal text' },
  { id: 'large', label: 'A+', name: 'Large text' },
  { id: 'xlarge', label: 'A++', name: 'Extra large text' },
];

function modeBadge(sparkMode) {
  if (sparkMode.effective === 'live') {
    return html`<a class="mode-badge mode-live" href="/about-ai" title="${sparkMode.reason}">AI: Live (Claude)</a>`;
  }
  return html`<a class="mode-badge mode-mock" href="/about-ai" title="${sparkMode.reason}">AI: Offline mode</a>`;
}

function textSizeControl(current, backPath) {
  return html`
    <form class="text-size" method="post" action="/prefs/text-size">
      <input type="hidden" name="back" value="${backPath}">
      <span class="text-size-label" id="text-size-label">Text size</span>
      <span role="group" aria-labelledby="text-size-label" class="text-size-buttons">
        ${TEXT_SIZES.map(
          (s) => html`<button type="submit" name="size" value="${s.id}" aria-label="${s.name}"
            aria-pressed="${current === s.id ? 'true' : 'false'}" class="size-${s.id}">${s.label}</button>`
        )}
      </span>
    </form>`;
}

export function layout({ title, active, body, req, ctx, flash, wide = false }) {
  const textSize = TEXT_SIZES.some((s) => s.id === req.cookies.textsize) ? req.cookies.textsize : 'normal';
  const backPath = req.path + (req.path === '/match' && req.query.seniorId ? `?seniorId=${encodeURIComponent(req.query.seniorId)}` : '');
  return html`<!DOCTYPE html>
<html lang="en" class="text-${textSize}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · PorchLight</title>
  <meta name="description" content="PorchLight connects isolated seniors in Carmel, Indiana with volunteer companions.">
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
        ${textSizeControl(textSize, backPath)}
      </div>
    </div>
    <nav class="site-nav" aria-label="Main">
      <ul>
        ${NAV.map(
          (item) => html`<li><a href="${item.href}"${active === item.key ? html` aria-current="page"` : ''}>${item.label}</a></li>`
        )}
      </ul>
    </nav>
  </header>
  <main id="main" tabindex="-1" class="${wide ? 'wide' : ''}">
    ${flash ? html`<div class="flash flash-${flash.kind || 'success'}" role="status"><p>${flash.text}</p></div>` : html`<div role="status" class="visually-hidden"></div>`}
    ${body}
  </main>
  <footer class="site-footer">
    <p><strong>Prototype</strong> for the Nextech CSforGood 2026 competition. There is no login yet, so every role's screens are visible. All people shown are fictional.</p>
    <p><a href="/about-ai">How the AI works</a> · <a href="/demo/reset">Reset demo data</a></p>
  </footer>
</body>
</html>`;
}
