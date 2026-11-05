// Conversation Spark service: decides between MOCK_MODE and LIVE_MODE and
// always returns 3 sparks, even if the live API fails.
//
//   SPARK_MODE=auto (default)  LIVE if ANTHROPIC_API_KEY is set AND the SDK is installed, else MOCK
//   SPARK_MODE=mock            always offline templates
//   SPARK_MODE=live            ask for LIVE. If the key or SDK is missing, warn and use MOCK.

import { generateMockSparks, pickTip, seasonOf } from './mock.js';
import { generateLiveSparks, loadSdk } from './live.js';
import { lastCompletedContact, calendarDaysBetween } from '../risk.js';
import { localDateKey } from '../tz.js';

export async function resolveSparkMode(config) {
  const sdkInstalled = Boolean(await loadSdk());
  const hasKey = Boolean(config.anthropicApiKey);
  if (config.sparkMode === 'mock') {
    return { effective: 'mock', reason: 'SPARK_MODE=mock', warning: null };
  }
  if (hasKey && sdkInstalled) {
    return { effective: 'live', reason: `ANTHROPIC_API_KEY found; using ${config.claudeModel}`, warning: null };
  }
  const missing = !hasKey
    ? 'no ANTHROPIC_API_KEY is set'
    : 'the @anthropic-ai/sdk package is not installed (run npm install)';
  return {
    effective: 'mock',
    reason: `Offline templates (${missing})`,
    warning: config.sparkMode === 'live' ? `SPARK_MODE=live was requested, but ${missing}. Using MOCK mode.` : null,
  };
}

// Gather what a spark generator needs from the stored data.
export function buildSparkInput(senior, contacts, now = new Date()) {
  const last = lastCompletedContact(contacts);
  return {
    seniorId: senior.id,
    name: senior.preferredName || senior.name.split(' ')[0],
    interests: senior.interests || [],
    aboutMe: senior.aboutMe || '',
    contactMethod: senior.contactMethod,
    daysSince: last ? calendarDaysBetween(last.completedAt, now) : null,
    // The local calendar day (an 8 PM call in Carmel is already the next day in UTC).
    lastContactDay: last ? localDateKey(last.completedAt) : null,
    lastContactType: last ? last.type : null,
    season: seasonOf(now),
    now,
  };
}

export function createSparkService(config, modeInfo) {
  return {
    modeInfo,
    model: config.claudeModel,
    // [v2 translate] The same Claude settings, for translating messages (src/translate). A method, so the key is never serialized.
    liveOptions: () => ({ apiKey: config.anthropicApiKey, model: config.claudeModel, baseURL: config.anthropicBaseUrl, perAccount: config.translateDailyPerAccount, total: config.translateDailyTotal }),
    // In LIVE mode: { reason, at } when the most recent request fell back to
    // MOCK, or null after a LIVE success. Lets the header and /about-ai say
    // what is really happening instead of "Live" while every call falls back.
    lastFallback: null,

    // What to show people right now: the startup mode, unless LIVE is set up
    // but the last request had to use the offline ideas.
    currentModeInfo() {
      if (modeInfo.effective !== 'live' || !this.lastFallback) return modeInfo;
      return {
        effective: 'mock',
        reason: `Live AI is set up, but the last request failed (${this.lastFallback.reason}), so the offline ideas were used`,
        warning: modeInfo.warning,
      };
    },

    async generate(input, variant = 0) {
      if (modeInfo.effective === 'live') {
        try {
          const live = await generateLiveSparks(input, {
            apiKey: config.anthropicApiKey,
            model: config.claudeModel,
            baseURL: config.anthropicBaseUrl,
          });
          this.lastFallback = null;
          return {
            mode: 'live',
            model: live.model,
            sparks: live.sparks,
            tip: pickTip(`${input.seniorId}|${variant}`),
            notice: null,
          };
        } catch (err) {
          console.warn(`[sparks] LIVE mode failed (${err.reason || err.message}); falling back to MOCK.`);
          this.lastFallback = { reason: err.reason || 'unknown error', at: new Date().toISOString() };
          const mock = generateMockSparks(input, variant);
          return {
            mode: 'mock-fallback',
            model: null,
            sparks: mock.sparks,
            tip: mock.tip,
            notice: `Live AI was unavailable (${err.reason || 'unknown error'}), so these sparks came from the built-in ideas.`,
          };
        }
      }
      const mock = generateMockSparks(input, variant);
      return { mode: 'mock', model: null, sparks: mock.sparks, tip: mock.tip, notice: null };
    },
  };
}
