// Messages, the phrase card, and the conversation helper (v2).
//
//   GET  /messages              my pairs (the admin and demo mode: every active pair)
//   GET  /messages/:matchId     one pair's messages, each in the READER's language
//   POST /messages/:matchId     write a message (no JavaScript needed)
//   GET  /phrases?lang=xx       common phrases, mine and theirs side by side
//   GET  /translate             the conversation helper: two people, two languages
//   POST /translate
//
// Who may open what is in ./access.js (checked on the server before these
// handlers run). The thread routes check it again here.
// Translation is MOCK by default (demo messages and phrases only) and LIVE
// (Claude) when the conversation sparks run LIVE. See ./service.js.

import { t, currentLang } from '../i18n/index.js';
import { noPhone } from '../roles/viewer.js';
import { createTranslateService } from './service.js';
import { canUseThread } from './access.js';
import { isTranslateLanguage, languageLabel } from './phrases.js';
import { messagesListPage, threadPage, phrasesPage, helperPage, MAX_MESSAGE_CHARS } from './views.js';

export { buildDemoMessages } from './demo.js';

// Characters as people count them: "👍🏽" and "e + accent" are one each (same as app.js).
const GRAPHEMES = new Intl.Segmenter('en', { granularity: 'grapheme' });
// Every 4 UTF-16 units count as at least one character, so one "character"
// can't hide thousands of combining marks (V2-B-09).
export const chars = (s) => { let n = 0; for (const _ of GRAPHEMES.segment(s)) n++; return Math.max(n, Math.ceil(s.length / 4)); };
// Nothing you can see: spaces, zero-width characters, lone accents, blank letters (same as app.js).
const BLANK_LOOKING = /[\s\p{Cf}\p{Z}\p{M}ᅟᅠㅤﾠ⠀]/gu;
const isInvisible = (s) => !s.replace(BLANK_LOOKING, '');

const firstName = (p) => noPhone(p ? p.preferredName || String(p.name || '').split(' ')[0] : '');

// Who counts toward the daily limits: the account, else the demo person, else "demo".
export function usageKeyFor(viewer) {
  if (!viewer) return 'demo';
  if (viewer.userId) return `user:${viewer.userId}`;
  return `${viewer.kind}:${viewer.id ?? ''}`;
}

// Validate a new message: { text, lang } and errors keyed by field.
export function validateMessage(body, str) {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const lang = str(body.lang);
  const errors = {};
  if (!text || isInvisible(text)) errors.text = t('translate.error.blank');
  else if (chars(text) > MAX_MESSAGE_CHARS) errors.text = t('translate.error.tooLong', { max: MAX_MESSAGE_CHARS, count: chars(text) });
  if (!isTranslateLanguage(lang)) errors.lang = t('translate.error.lang');
  return { values: { text, lang }, errors };
}

export function registerTranslate(router, ctx) {
  const { store, sparks, render, httpError, str, now } = ctx;
  const options = typeof sparks.liveOptions === 'function' ? sparks.liveOptions() : {};
  const service =
    ctx.translate ||
    createTranslateService({
      store,
      live: sparks.modeInfo?.effective === 'live' ? options : null,
      limits: { perAccount: options.perAccount, total: options.total },
      now,
    });
  ctx.translate = service;
  ctx.flashMessages.message_sent = t('translate.flash.sent');

  const pairNames = (match) => ({ senior: store.senior(match.seniorId), volunteer: store.volunteer(match.volunteerId) });

  // Which pairs this person can open.
  function pairsFor(viewer) {
    return store.matches.filter((m) => m.active && canUseThread(viewer, m));
  }

  function authorName(message, match) {
    if (message.fromKind === 'senior') return firstName(store.senior(message.fromId || match.seniorId));
    if (message.fromKind === 'volunteer') return firstName(store.volunteer(message.fromId || match.volunteerId));
    return t('translate.message.coordinator');
  }

  function threadTitle(viewer, match) {
    const { senior, volunteer } = pairNames(match);
    if (viewer?.kind === 'senior') return t('translate.thread.title', { name: firstName(volunteer) });
    if (viewer?.kind === 'volunteer') return t('translate.thread.title', { name: firstName(senior) });
    return t('translate.thread.titleBoth', { senior: firstName(senior), volunteer: firstName(volunteer) });
  }

  // The match, if this person may see it (404 otherwise, so ids are not confirmed to strangers).
  function threadOr404(req) {
    const match = store.matches.find((m) => m.id === req.params.matchId) || null;
    if (!match || !canUseThread(req.viewer, match)) throw httpError(404, t('translate.error.noThread'));
    return match;
  }

  async function showThread(req, res, { form, errors = {}, status = 200 } = {}) {
    const match = threadOr404(req);
    const reader = currentLang();
    const userKey = usageKeyFor(req.viewer);
    // The newest 50, oldest first.
    const messages = store.messagesForMatch(match.id)
      .slice()
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .slice(-50);
    const original = str(req.query.original);
    const shown = await Promise.all(
      messages.map(async (message) => {
        const showingOriginal = original === message.id && message.lang !== reader;
        const display = showingOriginal
          ? { text: message.text, status: 'same', notice: null }
          : await service.translate({ text: message.text, from: message.lang, to: reader, userKey });
        return { message, author: authorName(message, match), display, showingOriginal };
      })
    );
    const canPost = match.active && canUseThread(req.viewer, match);
    render(req, res, {
      title: Object.keys(errors).length ? t('translate.form.fixTitle', { title: threadTitle(req.viewer, match) }) : threadTitle(req.viewer, match),
      active: 'messages',
      status,
      flash: Object.keys(errors).length ? false : undefined,
      body: threadPage({ match, title: threadTitle(req.viewer, match), shown, form, errors, mode: service.mode, canPost }),
    });
  }

  router.get('/messages', (req, res) => {
    const viewer = req.viewer;
    const showBoth = !viewer || (viewer.kind !== 'senior' && viewer.kind !== 'volunteer');
    const pairs = pairsFor(viewer).map((match) => {
      const { senior, volunteer } = pairNames(match);
      const all = store.messagesForMatch(match.id);
      const last = all.reduce((a, b) => (!a || String(b.createdAt) > String(a.createdAt) ? b : a), null);
      return {
        match,
        seniorName: firstName(senior),
        volunteerName: firstName(volunteer),
        partnerName: viewer?.kind === 'senior' ? firstName(volunteer) : firstName(senior),
        count: all.length,
        last,
      };
    });
    render(req, res, { title: t('translate.messages.title'), active: 'messages', body: messagesListPage({ pairs, showBoth }) });
  });

  router.get('/messages/:matchId', (req, res) => showThread(req, res));

  router.post('/messages/:matchId', async (req, res) => {
    const match = threadOr404(req);
    if (!match.active) throw httpError(409, t('translate.thread.ended'));
    const { values, errors } = validateMessage(req.body, str);
    if (Object.keys(errors).length) return showThread(req, res, { form: values, errors });
    const viewer = req.viewer;
    const fromKind = viewer?.kind === 'senior' || viewer?.kind === 'volunteer' ? viewer.kind : 'coordinator';
    store.messages.push({
      id: store.newId('msg'),
      matchId: match.id,
      fromKind,
      fromId: fromKind === 'coordinator' ? null : viewer.id,
      ...(viewer?.userId ? { fromUserId: viewer.userId } : {}),
      text: values.text,
      lang: values.lang,
      createdAt: now().toISOString(),
    });
    store.save();
    res.redirect(`/messages/${encodeURIComponent(match.id)}?msg=message_sent#write`);
  });

  // ----- phrase card -----
  router.get('/phrases', (req, res) => {
    const asked = str(req.query.lang);
    const mine = currentLang();
    const theirs = isTranslateLanguage(asked) ? asked : mine === 'en' ? 'es' : 'en';
    render(req, res, { title: t('translate.phrases.titleFor', { language: languageLabel(theirs) }), active: 'phrases', body: phrasesPage({ theirs }) });
  });

  // ----- conversation helper -----
  const helperSides = (source = {}) => {
    const mine = currentLang();
    const pick = (v, fallback) => (isTranslateLanguage(str(v)) ? str(v) : fallback);
    const mineLang = pick(source.mineLang, mine);
    return {
      mine: { lang: mineLang, text: typeof source.mine === 'string' ? source.mine.trim() : '' },
      theirs: { lang: pick(source.theirsLang ?? source.lang, mineLang === 'en' ? 'es' : 'en'), text: typeof source.theirs === 'string' ? source.theirs.trim() : '' },
    };
  };

  router.get('/translate', (req, res) => {
    render(req, res, { title: t('translate.helper.title'), active: 'translate', body: helperPage({ sides: helperSides(req.query), mode: service.mode }) });
  });

  router.post('/translate', async (req, res) => {
    const sides = helperSides(req.body);
    const userKey = usageKeyFor(req.viewer);
    for (const side of [sides.mine, sides.theirs]) {
      if (chars(side.text) > MAX_MESSAGE_CHARS) side.error = t('translate.error.tooLong', { max: MAX_MESSAGE_CHARS, count: chars(side.text) });
    }
    const run = (side, to) =>
      side.text && !side.error && !isInvisible(side.text) ? service.translate({ text: side.text, from: side.lang, to, userKey }) : null;
    const [forThem, forMe] = await Promise.all([run(sides.mine, sides.theirs.lang), run(sides.theirs, sides.mine.lang)]);
    const failed = sides.mine.error || sides.theirs.error;
    render(req, res, {
      title: failed ? t('translate.form.fixTitle', { title: t('translate.helper.title') }) : t('translate.helper.title'),
      active: 'translate',
      flash: failed ? false : undefined,
      body: helperPage({ sides, results: { forThem, forMe }, mode: service.mode }),
    });
  });
}
