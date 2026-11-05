// Screens for messages, the phrase card, and the conversation helper (v2).
// Every page works without JavaScript. All user text goes through html``,
// which escapes it. Words come from t() (keys in src/i18n/en/translate.js).

import { html, formatDateTime } from '../views/html.js';
import { banner, backLink, emptyState, errorSummary, selectField } from '../views/components.js';
import { t, tIn, currentLang } from '../i18n/index.js';
import { TRANSLATE_LANGUAGES, languageLabel, dirOf, PHRASE_KEYS, phraseIn, hasPhrases } from './phrases.js';

export const MAX_MESSAGE_CHARS = 500;

const languageOptions = () => TRANSLATE_LANGUAGES.map((l) => ({ value: l.code, label: languageLabel(l.code) }));

// The two notices every translation tool shows.
export function disclaimer() {
  return html`<p class="small muted translate-disclaimer">${t('translate.disclaimer')}</p>`;
}

// Said plainly BEFORE anything can be sent: what goes to the AI, and whether AI is on.
export function aiNotice(mode) {
  return banner({
    kind: 'status',
    word: t('translate.notice.word'),
    text: t('translate.notice.sent'),
    body: html`<p>${mode === 'live' ? t('translate.notice.liveOn') : t('translate.notice.liveOff')}</p>`,
  });
}

const NOTICE_KEYS = { needsAi: 'translate.unavailable.needsAi', limit: 'translate.unavailable.limit', error: 'translate.unavailable.error' };
const unavailableText = (notice) => t(NOTICE_KEYS[notice] || NOTICE_KEYS.error);

// ---------- /messages ----------

// pairs: [{ match, senior, volunteer, partnerName, count, last }]
export function messagesListPage({ pairs, showBoth }) {
  return html`
    <h1>${t('translate.messages.title')}</h1>
    <p class="lead">${t('translate.messages.lead')}</p>
    ${pairs.length
      ? html`<ul class="card-list">
        ${pairs.map(
          (p) => html`
          <li class="card">
            <h2 class="card-title"><a href="/messages/${p.match.id}">${showBoth ? t('translate.messages.pairName', { senior: p.seniorName, volunteer: p.volunteerName }) : t('translate.messages.withName', { name: p.partnerName })}</a></h2>
            <p class="card-meta">${p.count === 1 ? t('translate.messages.countOne') : t('translate.messages.countMany', { count: p.count })}${p.last ? html` · ${t('translate.messages.last', { when: formatDateTime(p.last.createdAt) })}` : ''}</p>
          </li>`
        )}
      </ul>`
      : emptyState(html`<p><strong>${t('translate.messages.emptyTitle')}</strong> ${t('translate.messages.emptyBody')}</p>`)}
    <p><a href="/phrases">${t('translate.phrases.title')}</a> · <a href="/translate">${t('translate.helper.title')}</a></p>`;
}

// ---------- /messages/:matchId ----------

// shown: [{ message, author, display: { text, lang, status, notice }, showingOriginal }]
export function threadPage({ match, title, shown, form = {}, errors = {}, mode, canPost }) {
  const reader = currentLang();
  return html`
    ${backLink('/messages', t('translate.thread.back'))}
    <h1>${title}</h1>
    ${shown.length
      ? html`<ol class="card-list" aria-label="${t('translate.thread.listLabel')}">
        ${shown.map((item, i) => messageItem(match, item, reader, i === shown.length - 1))}
      </ol>`
      : emptyState(html`<p><strong>${t('translate.thread.emptyTitle')}</strong> ${canPost ? t('translate.thread.emptyBody') : ''}</p>`)}
    ${canPost
      ? html`
      <section class="panel" aria-labelledby="write-heading" id="write">
        <h2 id="write-heading">${t('translate.form.heading')}</h2>
        ${aiNotice(mode)}
        ${errorSummary(errors)}
        <form method="post" action="/messages/${match.id}" class="stack-form" novalidate>
          ${selectField({ name: 'lang', label: t('translate.form.langLabel'), options: languageOptions(), value: form.lang || reader, error: errors.lang })}
          <div class="field${errors.text ? ' has-error' : ''}">
            <label for="field-text">${t('translate.form.textLabel')}</label>
            <p class="hint" id="hint-text">${t('translate.form.textHint', { max: MAX_MESSAGE_CHARS })}</p>
            ${errors.text ? html`<p class="field-error" id="error-text"><span aria-hidden="true">⚠ </span>${errors.text}</p>` : ''}
            <textarea id="field-text" name="text" rows="4" dir="auto" aria-describedby="hint-text${errors.text ? ' error-text' : ''}"${errors.text ? html` aria-invalid="true"` : ''}>${form.text || ''}</textarea>
          </div>
          <div class="form-actions">
            <button type="submit" class="button">${t('translate.form.send')}</button>
          </div>
        </form>
      </section>`
      : html`<p class="muted">${t('translate.thread.ended')}</p>`}`;
}

function messageItem(match, { message, author, display, showingOriginal }, reader, isLast) {
  const translated = display.status !== 'same' && display.status !== 'unavailable' && !showingOriginal;
  const base = `/messages/${match.id}`;
  return html`
    <li class="card" id="msg-${message.id}"${isLast ? html` tabindex="-1"` : ''}>
      <p class="card-meta"><strong>${author}</strong> · ${formatDateTime(message.createdAt)}</p>
      ${translated
        ? html`
          <p class="big" lang="${reader}" dir="auto">${display.text}</p>
          <p class="small">${t('translate.message.translatedFrom', { language: languageLabel(message.lang) })}
            <a href="${base}?original=${encodeURIComponent(message.id)}#msg-${message.id}">${t('translate.message.showOriginal')}</a></p>
          ${disclaimer()}`
        : html`
          <p class="big" lang="${message.lang}" dir="auto">${message.text}</p>
          ${showingOriginal
            ? html`<p class="small">${t('translate.message.original', { language: languageLabel(message.lang) })}
                <a href="${base}#msg-${message.id}">${t('translate.message.showTranslation')}</a></p>`
            : display.status === 'unavailable'
              ? html`<p class="small muted">${unavailableText(display.notice)} ${t('translate.message.original', { language: languageLabel(message.lang) })}</p>`
              : ''}`}
    </li>`;
}

// ---------- /phrases ----------

export function phrasesPage({ theirs }) {
  const mine = currentLang();
  const ready = hasPhrases(theirs);
  const sameLang = theirs === mine;
  return html`
    <h1>${t('translate.phrases.title')}</h1>
    <p class="lead">${t('translate.phrases.lead')}</p>
    <form method="get" action="/phrases" class="inline-form">
      ${selectField({ name: 'lang', label: t('translate.phrases.theirLabel'), options: languageOptions(), value: theirs })}
      <button type="submit" class="button button-secondary">${t('translate.phrases.show')}</button>
    </form>
    ${!ready ? banner({ kind: 'status', text: t('translate.phrases.notReady', { language: languageLabel(theirs) }) }) : ''}
    <div class="table-wrap">
      <table class="data-table big">
        <caption class="visually-hidden">${t('translate.phrases.caption')}</caption>
        <thead><tr>
          <th scope="col" lang="${mine}">${languageLabel(mine)}</th>
          ${ready && !sameLang ? html`<th scope="col">${languageLabel(theirs)}</th>` : ''}
        </tr></thead>
        <tbody>
          ${PHRASE_KEYS.map(
            (key) => html`<tr>
              <td lang="${mine}" dir="${dirOf(mine)}">${t(key)}</td>
              ${ready && !sameLang ? html`<td lang="${theirs}" dir="${dirOf(theirs)}">${tIn(theirs, key)}</td>` : ''}
            </tr>`
          )}
        </tbody>
      </table>
    </div>
    <p class="muted">${t('translate.phrases.printHint')}</p>`;
}

// ---------- /translate ----------

// sides: { mine: { lang, text, error }, theirs: { lang, text, error } }
// results: { forMe: display|null, forThem: display|null }
export function helperPage({ sides, results = {}, mode }) {
  const errors = {};
  if (sides.mine.error) errors.mine = sides.mine.error;
  if (sides.theirs.error) errors.theirs = sides.theirs.error;
  return html`
    <h1>${t('translate.helper.title')}</h1>
    <p class="lead">${t('translate.helper.lead')}</p>
    ${aiNotice(mode)}
    ${errorSummary(errors)}
    <form method="post" action="/translate" class="stack-form" novalidate id="helper-form"
      data-speak="${t('translate.helper.speak')}" data-stop="${t('translate.helper.stop')}" data-read="${t('translate.helper.readAloud')}">
      <div class="two-col">
        ${helperSide({ id: 'mine', heading: t('translate.helper.iSpeak'), langLabel: t('translate.helper.myLang'), textLabel: t('translate.helper.myWords'), side: sides.mine, outHeading: t('translate.helper.forMe'), result: results.forMe, outLang: sides.mine.lang })}
        ${helperSide({ id: 'theirs', heading: t('translate.helper.theySpeak'), langLabel: t('translate.helper.theirLang'), textLabel: t('translate.helper.theirWords'), side: sides.theirs, outHeading: t('translate.helper.forThem'), result: results.forThem, outLang: sides.theirs.lang })}
      </div>
      <div class="form-actions">
        <button type="submit" class="button">${t('translate.helper.translate')}</button>
        <a class="button button-secondary" href="/translate">${t('translate.helper.startOver')}</a>
      </div>
    </form>
    ${disclaimer()}
    <script src="/translate.js" defer></script>`;
}

function helperSide({ id, heading, langLabel, textLabel, side, outHeading, result, outLang }) {
  const errorId = `error-${id}`;
  return html`
    <section class="panel" aria-labelledby="${id}-heading">
      <h2 id="${id}-heading">${heading}</h2>
      ${selectField({ name: `${id}Lang`, label: langLabel, options: languageOptions(), value: side.lang })}
      <div class="field${side.error ? ' has-error' : ''}">
        <label for="field-${id}">${textLabel}</label>
        ${side.error ? html`<p class="field-error" id="${errorId}"><span aria-hidden="true">⚠ </span>${side.error}</p>` : ''}
        <textarea id="field-${id}" name="${id}" rows="4" class="big" dir="auto" lang="${side.lang}" data-speech-lang="${side.lang}"${side.error ? html` aria-invalid="true" aria-describedby="${errorId}"` : ''}>${side.text || ''}</textarea>
      </div>
      <h3>${outHeading}</h3>
      ${result
        ? result.status === 'unavailable'
          ? html`<p class="muted">${unavailableText(result.notice)}</p>`
          : html`<p class="big" lang="${outLang}" dir="auto" data-read-lang="${outLang}" id="out-${id}">${result.text}</p>`
        : html`<p class="muted">${t('translate.helper.nothingYet')}</p>`}
    </section>`;
}

// ---------- bilingual sparks (the senior profile page) ----------

// One spark in a second language, under the main text.
export function sparkSecondLanguage(lang, text) {
  return text
    ? html`<p class="spark-text" lang="${lang}" dir="${dirOf(lang)}"><span class="visually-hidden">${t('translate.spark.inLanguage', { language: languageLabel(lang) })} </span>${text}</p>`
    : html`<p class="spark-basis">${t('translate.spark.notReady', { language: languageLabel(lang) })}</p>`;
}
