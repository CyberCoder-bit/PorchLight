// LIVE mode: ask an AI for JSON that matches a schema.
//
// The free Gemini tier is often busy ("503: high demand"), so each request
// tries the Gemini models in GEMINI_MODEL in order, then the Cloudflare
// Workers AI backup (only on Cloudflare), all within one time budget. A bad
// key or a refusal skips the rest of that provider but still tries the next
// one. When everything fails, the caller uses the offline (MOCK) ideas, so
// nobody is ever left without an answer.

import { LiveSparkError } from './errors.js';
import { askGemini } from './gemini.js';
import { askWorkersAi } from './workers-ai.js';

export { LiveSparkError };
export { DEFAULT_GEMINI_MODELS, parseModels } from './gemini.js';
export { DEFAULT_WORKERS_AI_MODEL } from './workers-ai.js';

// A busy model sometimes hangs instead of saying so: stop waiting for it after
// this long, so the next one still has time. The last one gets all that is left.
export const ATTEMPT_MAX_MS = 5000;

// Which models to try, in order: [{ provider, model }].
export function attemptsFor({ apiKey, models = [], workersAi = null }) {
  return [
    ...(apiKey ? models.map((model) => ({ provider: 'gemini', model })) : []),
    ...(workersAi?.ai ? [{ provider: 'workers-ai', model: workersAi.model }] : []),
  ];
}

/**
 * Resolves to { json, model, provider } from the first model that answers.
 * Throws LiveSparkError (with a short, friendly .reason) when all of them failed.
 */
export async function generateJson({ apiKey, models, baseURL, workersAi = null, system, user, schema, timeoutMs, maxOutputTokens = 4000 }) {
  const attempts = attemptsFor({ apiKey, models, workersAi });
  if (!attempts.length) throw new LiveSparkError('no AI is set up');
  const deadline = Date.now() + timeoutMs;
  const skipped = new Set(); // providers with a bad key or a refusal
  let firstHardError = null;
  let lastError = new LiveSparkError('the request timed out');
  for (const [index, { provider, model }] of attempts.entries()) {
    if (skipped.has(provider)) continue;
    const left = deadline - Date.now();
    if (left < 250) break;
    const last = index === attempts.length - 1;
    const timeout = last ? left : Math.min(ATTEMPT_MAX_MS, Math.floor(left / (attempts.length - index)));
    const options = { system, user, schema, maxOutputTokens, timeoutMs: timeout };
    try {
      return provider === 'gemini'
        ? await askGemini(model, { ...options, apiKey, baseURL })
        : await askWorkersAi(model, { ...options, ai: workersAi.ai });
    } catch (err) {
      lastError = err instanceof LiveSparkError ? err : new LiveSparkError('unexpected error', { cause: err });
      if (!lastError.retry) {
        skipped.add(provider);
        firstHardError ??= lastError;
      }
    }
  }
  // A bad key says more than "busy" from the backup afterwards.
  throw firstHardError || lastError;
}
