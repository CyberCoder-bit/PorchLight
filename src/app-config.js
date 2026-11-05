// App settings that work in any runtime (Node or Cloudflare Workers).
// `env` is process.env locally, or the Worker's env bindings on Cloudflare.
// See README.md -> "MOCK_MODE vs LIVE_MODE" for the AI settings.

import { parseModels } from './gemini.js';

export function toInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function buildAppConfig(env = {}) {
  const requested = String(env.SPARK_MODE || 'auto').toLowerCase();
  const sparkMode = ['auto', 'mock', 'live'].includes(requested) ? requested : 'auto';
  return {
    // Default "isolation risk" threshold in days. Families can change it on the dashboard.
    riskThresholdDays: toInt(env.RISK_THRESHOLD_DAYS, 7, 1, 60),
    sparkMode, // 'auto' | 'mock' | 'live'
    geminiApiKey: env.GEMINI_API_KEY || '',
    geminiBaseUrl: env.GEMINI_BASE_URL || undefined, // only used by tests / proxies
    // Tried in order; the next one is used when one is busy (comma-separated).
    geminiModels: parseModels(env.GEMINI_MODEL),
    // [v2 translate] AI translations per day (Indiana calendar day): per account, and for everyone together.
    translateDailyPerAccount: toInt(env.TRANSLATE_DAILY_PER_ACCOUNT, 30, 0, 10000),
    translateDailyTotal: toInt(env.TRANSLATE_DAILY_TOTAL, 300, 0, 100000),
  };
}
