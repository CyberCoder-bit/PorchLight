// The public website's pages (v2): what a signed-out visitor sees. Every
// string comes from t() (src/i18n/en/site.js); links and markup stay here.
// Each page has one h1, labeled sections, and works with no JavaScript.

import { html, raw } from '../html.js';
import { t } from '../../i18n/index.js';
import { UI_LANGUAGES } from '../../i18n/languages.js';
import { STATUS_INFO } from '../../risk.js';

// Sources from docs/research.md (checked November 3, 2026).
const SOURCES = {
  ibrc: 'https://www.incontext.indiana.edu/2024/nov-dec/article1.asp',
  polis: 'https://ipbs.org/projects/assets/2023-state-of-aging-report-COMPLIANT.pdf',
  surgeonGeneral: 'https://www.hhs.gov/sites/default/files/surgeon-general-social-connection-advisory.pdf',
  cicoa: 'https://cicoa.org/',
  shepherds: 'https://shepherdscenterofhamiltoncounty.org/',
  aarp: 'https://aarpcommunityconnections.org/',
  in211: 'https://www.in.gov/fssa/indiana-211/',
};

// Small line icons, drawn for PorchLight. Decoration only.
const ICONS = {
  talk: '<path d="M4 5.5h16v10H10l-5 4v-4H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 10.5h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  home: '<path d="M3.5 11.5 12 4.5l8.5 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 9.5V20h11V9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 17.5s-3-1.8-3-3.6a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 1.8-3 3.6-3 3.6z" fill="currentColor"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  cross: '<path d="m6.5 6.5 11 11m0-11-11 11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  arrow: '<path d="M5 12h13m-5-5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>',
};
const icon = (name, cls = 'site-icon') =>
  raw(`<svg class="${cls}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`);
const arrow = () => icon('arrow', 'site-arrow');

// The home page's picture: a house at night with its door lit and two people
// talking. Drawn for PorchLight in the brand colors; decoration only.
const HERO_ART = raw(`<svg class="hero-art" viewBox="0 0 320 260" aria-hidden="true" focusable="false">
  <rect width="320" height="260" rx="24" fill="#1d2433"/>
  <circle cx="262" cy="54" r="17" fill="#fff6e5"/><circle cx="271" cy="47" r="15" fill="#1d2433"/>
  <circle cx="44" cy="40" r="2.5" fill="#8f98ad"/><circle cx="98" cy="26" r="2" fill="#8f98ad"/><circle cx="210" cy="30" r="2.5" fill="#8f98ad"/><circle cx="292" cy="112" r="2" fill="#8f98ad"/><circle cx="24" cy="104" r="2" fill="#8f98ad"/>
  <path d="M0 214h320v22a24 24 0 0 1-24 24H24A24 24 0 0 1 0 236z" fill="#283149"/>
  <path d="M136 214h48l34 46h-116z" fill="#4d4535"/>
  <path d="M80 214V128l80-58 80 58v86z" fill="#2f3a55"/>
  <path d="M64 132 160 62l96 70" fill="none" stroke="#fff6e5" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M136 214v-52a24 24 0 0 1 48 0v52z" fill="#f29f22"/>
  <circle cx="160" cy="164" r="15" fill="#ffd66b"/><circle cx="160" cy="164" r="8" fill="#fffbea"/>
  <rect x="122" y="210" width="76" height="9" rx="4.5" fill="#fff6e5"/>
  <path d="M30 150h58a10 10 0 0 1 10 10v16a10 10 0 0 1-10 10H54l-12 10v-10H30a10 10 0 0 1-10-10v-16a10 10 0 0 1 10-10z" fill="#fff6e5"/>
  <circle cx="44" cy="168" r="3.5" fill="#1d2433"/><circle cx="59" cy="168" r="3.5" fill="#1d2433"/><circle cx="74" cy="168" r="3.5" fill="#1d2433"/>
  <path d="M232 104h58a10 10 0 0 1 10 10v16a10 10 0 0 1-10 10h-12v10l-12-10h-34a10 10 0 0 1-10-10v-16a10 10 0 0 1 10-10z" fill="#ffd66b"/>
  <path d="M248 122h26" stroke="#1d2433" stroke-width="5" stroke-linecap="round"/>
</svg>`);

const sourceLink = (href, label) =>
  html`<p class="fact-source"><span class="visually-hidden">${t('site.sourceLabel')} </span><a href="${href}">${label}</a></p>`;

// The three sign-up paths (the accounts module builds /sign-up/*).
function signUpLinks() {
  return html`
    <ul class="cta-links" role="list">
      <li><a class="button" href="/sign-up/senior">${t('site.cta.senior')}</a></li>
      <li><a class="button" href="/sign-up/volunteer">${t('site.cta.volunteer')}</a></li>
      <li><a class="button" href="/sign-up/family">${t('site.cta.family')}</a></li>
    </ul>`;
}

function ctaBand() {
  return html`
    <section class="cta-band" aria-labelledby="cta-heading">
      <h2 id="cta-heading">${t('site.cta.heading')}</h2>
      <p>${t('site.cta.body')}</p>
      ${signUpLinks()}
      <p class="cta-more"><a href="/sign-in">${t('site.cta.signIn')}</a> · <a href="/tour">${t('site.cta.tour')}</a></p>
    </section>`;
}

// A plain page: the title and a lead, then sections, then the sign-up band.
function sitePage({ title, lead, body, cta = true }) {
  return html`
    <div class="site-page">
      <header class="page-intro">
        <h1>${title}</h1>
        <p class="lead">${lead}</p>
      </header>
      ${body}
      ${cta ? ctaBand() : ''}
    </div>`;
}

function checkList(keys, kind = 'check') {
  return html`<ul class="check-list check-list-${kind}" role="list">
    ${keys.map((k) => html`<li>${icon(kind, 'check-icon')}<span>${t(k)}</span></li>`)}
  </ul>`;
}

function numberedSteps(prefix, count, headingTag = 'h3') {
  return html`<ol class="how-steps" role="list">
    ${Array.from({ length: count }, (_, i) => {
      const n = i + 1;
      const title = t(`${prefix}.step${n}.title`);
      return html`<li class="how-step">
        <span class="how-number" aria-hidden="true">${n}</span>
        ${headingTag === 'h2' ? html`<h2>${title}</h2>` : html`<h3>${title}</h3>`}
        <p>${t(`${prefix}.step${n}.body`)}</p>
      </li>`;
    })}
  </ol>`;
}

// ---------- / ----------
export function siteHomePage() {
  const roles = [
    { key: 'senior', icon: 'talk', more: '/for-seniors', signUp: '/sign-up/senior', cta: 'site.cta.senior' },
    { key: 'volunteer', icon: 'spark', more: '/for-volunteers', signUp: '/sign-up/volunteer', cta: 'site.cta.volunteer' },
    { key: 'family', icon: 'home', more: '/for-families', signUp: '/sign-up/family', cta: 'site.cta.family' },
  ];
  const facts = [
    { text: 'site.home.why1', href: SOURCES.ibrc, source: 'site.home.why1Source' },
    { text: 'site.home.why2', href: SOURCES.polis, source: 'site.home.why2Source' },
    { text: 'site.home.why3', href: SOURCES.surgeonGeneral, source: 'site.home.why3Source' },
  ];
  return html`
    <section class="site-hero" aria-labelledby="hero-heading">
      <div class="site-hero-text">
        <p class="eyebrow">${t('site.home.eyebrow')}</p>
        <h1 id="hero-heading">${t('site.home.heading')}</h1>
        <p class="lead">${t('site.home.lead')}</p>
        <p class="button-row">
          <a class="button button-large" href="/sign-up">${t('site.home.getStarted')} ${arrow()}</a>
          <a class="button button-secondary button-large" href="/tour">${t('site.home.tour')}</a>
        </p>
      </div>
      ${HERO_ART}
    </section>

    <section class="site-section" aria-labelledby="roles-heading">
      <h2 id="roles-heading">${t('site.home.rolesHeading')}</h2>
      <ul class="role-cards" role="list">
        ${roles.map(
          (r) => html`<li class="role-card-site">
            <span class="role-icon">${icon(r.icon)}</span>
            <h3>${t(`site.home.${r.key}.title`)}</h3>
            <p>${t(`site.home.${r.key}.body`)}</p>
            <p class="role-actions">
              <a class="button" href="${r.signUp}">${t(r.cta)}</a>
              <a class="text-link" href="${r.more}">${t(`site.home.${r.key}.more`)} ${arrow()}</a>
            </p>
          </li>`
        )}
      </ul>
    </section>

    <section class="site-section" aria-labelledby="steps-heading">
      <h2 id="steps-heading">${t('site.home.stepsHeading')}</h2>
      ${numberedSteps('site.home', 4)}
      <p><a class="text-link" href="/how-it-works">${t('site.home.stepsMore')} ${arrow()}</a></p>
    </section>

    <section class="site-section fact-band" aria-labelledby="why-heading">
      <h2 id="why-heading">${t('site.home.whyHeading')}</h2>
      <ul class="facts-list" role="list">
        ${facts.map((f) => html`<li class="fact"><p class="fact-text">${t(f.text)}</p>${sourceLink(f.href, t(f.source))}</li>`)}
      </ul>
    </section>

    <section class="site-section tour-band" aria-labelledby="tour-heading">
      <div>
        <h2 id="tour-heading">${t('site.home.tourHeading')}</h2>
        <p>${t('site.home.tourBody')}</p>
      </div>
      <p><a class="button button-large" href="/tour">${t('site.home.tour')} ${arrow()}</a></p>
    </section>`;
}

// ---------- /how-it-works ----------
export function howItWorksPage() {
  const alerts = [
    { key: 'atRisk', status: 'at_risk', icon: STATUS_INFO.at_risk.icon },
    { key: 'soon', status: 'due_soon', icon: STATUS_INFO.due_soon.icon },
    { key: 'dropping', status: 'dropping', icon: '↓' }, // the same arrow as trendBadge()
    { key: 'needsMatch', status: 'needs_match', icon: STATUS_INFO.needs_match.icon },
  ];
  return sitePage({
    title: t('site.how.title'),
    lead: t('site.how.lead'),
    body: html`
      <section class="site-section" aria-labelledby="how-steps-heading">
        <h2 id="how-steps-heading">${t('site.how.stepsHeading')}</h2>
        ${numberedSteps('site.how', 5)}
      </section>
      <section class="site-section" aria-labelledby="alerts-heading">
        <h2 id="alerts-heading">${t('site.how.alertsHeading')}</h2>
        <dl class="alert-list">
          ${alerts.map(
            (a) => html`<div class="alert-row">
              <dt><span class="badge badge-${a.status}"><span class="badge-icon" aria-hidden="true">${a.icon}</span> ${t(`site.how.alert.${a.key}`)}</span></dt>
              <dd>${t(`site.how.alert.${a.key}Body`)}</dd>
            </div>`
          )}
        </dl>
      </section>
      <section class="site-section panel explain" aria-labelledby="ai-heading">
        <h2 id="ai-heading">${t('site.how.aiHeading')}</h2>
        <p>${t('site.how.aiBody')}</p>
        <p><a class="text-link" href="/about-ai">${t('site.how.aiLink')} ${arrow()}</a></p>
      </section>`,
  });
}

// ---------- /for-seniors, /for-volunteers, /for-families ----------
export function forSeniorsPage() {
  return sitePage({
    title: t('site.seniors.title'),
    lead: t('site.seniors.lead'),
    body: html`
      <div class="split">
        <section class="site-section" aria-labelledby="get-heading">
          <h2 id="get-heading">${t('site.seniors.getHeading')}</h2>
          ${checkList(['site.seniors.get1', 'site.seniors.get2', 'site.seniors.get3', 'site.seniors.get4'])}
        </section>
        <section class="site-section" aria-labelledby="need-heading">
          <h2 id="need-heading">${t('site.seniors.needHeading')}</h2>
          ${checkList(['site.seniors.need1', 'site.seniors.need2'])}
        </section>
      </div>
      <section class="site-section panel explain" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">${t('site.seniors.privacyHeading')}</h2>
        <p>${t('site.seniors.privacyBody')}</p>
        <p><a class="text-link" href="/safety">${t('site.seniors.privacyLink')} ${arrow()}</a></p>
      </section>`,
  });
}

export function forVolunteersPage() {
  return sitePage({
    title: t('site.volunteers.title'),
    lead: t('site.volunteers.lead'),
    body: html`
      <div class="split">
        <section class="site-section" aria-labelledby="do-heading">
          <h2 id="do-heading">${t('site.volunteers.doHeading')}</h2>
          <ol class="plain-steps">
            <li>${t('site.volunteers.do1')}</li>
            <li>${t('site.volunteers.do2')}</li>
            <li>${t('site.volunteers.do3')}</li>
          </ol>
        </section>
        <section class="site-section" aria-labelledby="help-heading">
          <h2 id="help-heading">${t('site.volunteers.helpHeading')}</h2>
          ${checkList(['site.volunteers.help1', 'site.volunteers.help2', 'site.volunteers.help3'])}
        </section>
      </div>
      <section class="site-section panel explain" aria-labelledby="see-heading">
        <h2 id="see-heading">${t('site.volunteers.privacyHeading')}</h2>
        <p>${t('site.volunteers.privacyBody')}</p>
        <p><a class="text-link" href="/safety">${t('site.seniors.privacyLink')} ${arrow()}</a></p>
      </section>`,
  });
}

export function forFamiliesPage() {
  return sitePage({
    title: t('site.families.title'),
    lead: t('site.families.lead'),
    body: html`
      <div class="split">
        <section class="site-section" aria-labelledby="see-heading">
          <h2 id="see-heading">${t('site.families.seeHeading')}</h2>
          ${checkList(['site.families.see1', 'site.families.see2', 'site.families.see3'])}
        </section>
        <section class="site-section" aria-labelledby="not-heading">
          <h2 id="not-heading">${t('site.families.notHeading')}</h2>
          <p>${t('site.families.notBody')}</p>
        </section>
      </div>
      <section class="site-section" aria-labelledby="link-heading">
        <h2 id="link-heading">${t('site.families.linkHeading')}</h2>
        <ol class="plain-steps">
          <li>${t('site.families.link1')}</li>
          <li>${t('site.families.link2')}</li>
          <li>${t('site.families.link3')}</li>
        </ol>
      </section>`,
  });
}

// ---------- /languages ----------
// The list comes from the real interface languages (src/i18n/languages.js), so
// it is never out of date. Each name is shown in its own language, marked with
// lang and dir so screen readers and fonts get it right.
export function languagesPage() {
  return sitePage({
    title: t('site.languages.title'),
    lead: t('site.languages.lead'),
    body: html`
      <section class="site-section" aria-labelledby="ui-heading">
        <h2 id="ui-heading">${t('site.languages.uiHeading')}</h2>
        <p>${t('site.languages.uiBody')}</p>
        <ul class="language-list" role="list">
          ${UI_LANGUAGES.map(
            (l) => html`<li><span lang="${l.code}" dir="${l.dir}" class="language-name">${l.name}</span>${l.english && l.english !== l.name ? html` <span class="muted">(${l.english})</span>` : ''}${l.dir === 'rtl' ? html` <span class="muted">· ${t('site.languages.rtl')}</span>` : ''}</li>`
          )}
        </ul>
      </section>
      <section class="site-section" aria-labelledby="translate-heading">
        <h2 id="translate-heading">${t('site.languages.translateHeading')}</h2>
        <p>${t('site.languages.translateBody')}</p>
      </section>
      <section class="site-section panel notice-panel" aria-labelledby="honest-heading">
        <h2 id="honest-heading">${t('site.languages.honestHeading')}</h2>
        <ul class="plain-list">
          <li>${t('site.languages.honest1')}</li>
          <li>${t('site.languages.honest2')}</li>
          <li>${t('site.languages.honest3')}</li>
        </ul>
      </section>`,
  });
}

// ---------- /safety ----------
export function safetyPage() {
  const roles = ['senior', 'volunteer', 'family', 'coordinator'];
  return sitePage({
    title: t('site.safety.title'),
    lead: t('site.safety.lead'),
    body: html`
      <section class="site-section" aria-labelledby="roles-heading">
        <h2 id="roles-heading">${t('site.safety.rolesHeading')}</h2>
        <dl class="who-sees">
          ${roles.map((r) => html`<div class="who-row"><dt>${t(`site.safety.${r}`)}</dt><dd>${t(`site.safety.${r}Body`)}</dd></div>`)}
        </dl>
      </section>
      <section class="site-section" aria-labelledby="ai-heading">
        <h2 id="ai-heading">${t('site.safety.aiHeading')}</h2>
        ${checkList(['site.safety.aiSparks', 'site.safety.aiTranslate'])}
        ${checkList(['site.safety.aiNever', 'site.safety.aiDecide'], 'cross')}
        <p><a class="text-link" href="/about-ai">${t('site.how.aiLink')} ${arrow()}</a></p>
      </section>
      <section class="site-section" aria-labelledby="accounts-heading">
        <h2 id="accounts-heading">${t('site.safety.accountsHeading')}</h2>
        <ul class="plain-list">
          <li>${t('site.safety.accounts1')}</li>
          <li>${t('site.safety.accounts2')}</li>
        </ul>
      </section>
      <section class="site-section panel notice-panel" aria-labelledby="prototype-heading">
        <h2 id="prototype-heading">${t('site.safety.prototypeHeading')}</h2>
        <p>${t('site.safety.prototypeBody')}</p>
      </section>`,
  });
}

// ---------- /about ----------
export function aboutPage() {
  const facts = [
    { text: 'site.about.fact1', href: SOURCES.ibrc, source: 'site.about.sourceIbrc' },
    { text: 'site.about.fact2', href: SOURCES.ibrc, source: 'site.about.sourceIbrc' },
    { text: 'site.about.fact3', href: SOURCES.polis, source: 'site.about.sourcePolis' },
    { text: 'site.about.fact4', href: SOURCES.polis, source: 'site.about.sourcePolis' },
  ];
  const others = [
    { key: 'cicoa', href: SOURCES.cicoa },
    { key: 'shepherds', href: SOURCES.shepherds },
    { key: 'aarp', href: SOURCES.aarp },
    { key: 'in211', href: SOURCES.in211 },
  ];
  return sitePage({
    title: t('site.about.title'),
    lead: t('site.about.lead'),
    cta: false,
    body: html`
      <section class="site-section" aria-labelledby="team-heading">
        <h2 id="team-heading">${t('site.about.teamHeading')}</h2>
        <p>${t('site.about.team')}</p>
        <p>${t('site.about.school')}</p>
      </section>
      <section class="site-section" aria-labelledby="origin-heading">
        <h2 id="origin-heading">${t('site.about.originHeading')}</h2>
        <p>${t('site.about.origin')}</p>
      </section>
      <section class="site-section fact-band" aria-labelledby="facts-heading">
        <h2 id="facts-heading">${t('site.about.factsHeading')}</h2>
        <ul class="facts-list" role="list">
          ${facts.map((f) => html`<li class="fact"><p class="fact-text">${t(f.text)}</p>${sourceLink(f.href, t(f.source))}</li>`)}
        </ul>
      </section>
      <section class="site-section" aria-labelledby="others-heading">
        <h2 id="others-heading">${t('site.about.othersHeading')}</h2>
        <p>${t('site.about.othersBody')}</p>
        <ul class="plain-list">
          ${others.map((o) => html`<li><a href="${o.href}">${t(`site.about.${o.key}`)}</a></li>`)}
        </ul>
      </section>`,
  });
}
