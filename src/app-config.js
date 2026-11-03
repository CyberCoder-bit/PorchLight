// App settings that work in any runtime (Node or Cloudflare Workers).
// `env` is process.env locally, or the Worker's env bindings on Cloudflare.
// See README.md -> "MOCK_MODE vs LIVE_MODE" for the AI settings.

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
    anthropicApiKey: env.ANTHROPIC_API_KEY || '',
    anthropicBaseUrl: env.ANTHROPIC_BASE_URL || undefined, // only used by tests / proxies
    claudeModel: env.CLAUDE_MODEL || 'claude-sonnet-5-5',
  };
}
