// Translation service (v2): MOCK by default, LIVE when the sparks run LIVE.
//
//   translate({ text, from, to, userKey }) -> { text, status, notice }
//     status: 'same'        nothing to do (same language)
//             'cached'      translated before (store.translations)
//             'demo'        a demo message, translated ahead of time
//             'phrase'      a phrase from the phrase card
//             'live'        Gemini translated it just now
//             'unavailable' no translation; `text` is null and `notice` says why
//     notice: null | 'needsAi' (MOCK mode) | 'limit' (daily limit reached) | 'error' (AI failed)
//
// It never throws: any error falls back to MOCK, and MOCK always answers.
// The same text is never sent to the AI twice: answers are cached in
// store.translations, keyed by SHA-256 of "from|to|text" (at most CACHE_MAX).
// Daily limits are counted in store.usage on the Indiana calendar day.
// AI is only ever used to translate. It never decides matching, risk, or access.

import { mockTranslate } from './mock.js';
import { translateLive } from './live.js';
import { englishName } from './phrases.js';
import { localDateKey } from '../tz.js';

export const CACHE_MAX = 500;
export const DEFAULT_LIMITS = Object.freeze({ perAccount: 30, total: 300 });

export async function cacheKey(from, to, text) {
  const bytes = new TextEncoder().encode(`${from}|${to}|${text}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// live: { apiKey, models, model, baseURL } to use Gemini, or null for MOCK only.
export function createTranslateService({ store, live = null, limits = DEFAULT_LIMITS, now = () => new Date(), translateFn = translateLive } = {}) {
  const perAccount = Number.isInteger(limits?.perAccount) ? limits.perAccount : DEFAULT_LIMITS.perAccount;
  const total = Number.isInteger(limits?.total) ? limits.total : DEFAULT_LIMITS.total;

  // Today's counts, started fresh on a new Indiana day.
  function usageToday() {
    const day = localDateKey(now());
    if (!store.data.usage || store.data.usage.day !== day) store.data.usage = { day, total: 0, byUser: {} };
    const usage = store.data.usage;
    if (!usage.byUser || typeof usage.byUser !== 'object') usage.byUser = {};
    if (!Number.isInteger(usage.total)) usage.total = 0;
    return usage;
  }

  function remember(key, text) {
    if (!store.data.translations || typeof store.data.translations !== 'object') store.data.translations = {};
    const cache = store.data.translations;
    cache[key] = { text, createdAt: now().toISOString() };
    const keys = Object.keys(cache);
    // Oldest first (insertion order), so the oldest are dropped.
    for (let i = 0; i < keys.length - CACHE_MAX; i++) delete cache[keys[i]];
  }

  const offline = (input, notice) => {
    const mock = mockTranslate(input);
    return mock ? { text: mock.text, status: mock.source, notice: null } : { text: null, status: 'unavailable', notice };
  };

  return {
    mode: live ? 'live' : 'mock',
    model: live ? live.model : null,
    limits: { perAccount, total },

    // How many AI translations this account has left today.
    remaining(userKey) {
      const usage = usageToday();
      return Math.max(0, Math.min(perAccount - (usage.byUser[userKey] || 0), total - usage.total));
    },

    // allowAi: false keeps the text away from the AI (only ready-made and cached
    // translations), e.g. a message written while the form said nothing leaves
    // PorchLight (V2-B-04), or a person with no companion yet (V2-B-05).
    async translate({ text, from, to, userKey = 'demo', allowAi = true }) {
      const source = String(text ?? '').trim();
      if (!source || !from || !to || from === to) return { text: source, status: 'same', notice: null };
      try {
        const input = { text: source, from, to };
        // Written ahead of time: no AI, no limits.
        const mock = mockTranslate(input);
        if (mock) return { text: mock.text, status: mock.source, notice: null };

        const key = await cacheKey(from, to, source);
        const hit = store.data.translations?.[key];
        if (hit && typeof hit.text === 'string') return { text: hit.text, status: 'cached', notice: null };

        if (!live || !allowAi) return offline(input, 'needsAi');

        const usage = usageToday();
        if ((usage.byUser[userKey] || 0) >= perAccount || usage.total >= total) return offline(input, 'limit');
        // Count the try before it is made, so failures count toward the limits too.
        usage.byUser[userKey] = (usage.byUser[userKey] || 0) + 1;
        usage.total += 1;
        store.save();

        const result = await translateFn(
          { text: source, fromName: englishName(from), toName: englishName(to) },
          { apiKey: live.apiKey, models: live.models, baseURL: live.baseURL }
        );
        remember(key, result.text);
        store.save();
        return { text: result.text, status: 'live', notice: null };
      } catch (err) {
        console.warn(`[translate] falling back to MOCK (${err?.reason || err?.message || 'unknown error'})`);
        try {
          return offline({ text: source, from, to }, 'error');
        } catch {
          return { text: null, status: 'unavailable', notice: 'error' };
        }
      }
    },
  };
}
