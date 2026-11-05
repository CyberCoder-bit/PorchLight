// The backup AI: Cloudflare Workers AI, through the Worker's AI binding
// ("ai" in wrangler.jsonc). It needs no key, and Cloudflare's free plan
// includes a daily allowance. It is only there when PorchLight runs on
// Cloudflare; `npm start` on a laptop uses Gemini alone.
//
// Gemma 4 is Google's open model: it handles all of PorchLight's languages,
// and it can return JSON that matches a schema, like Gemini.

import { LiveSparkError } from './errors.js';

export const DEFAULT_WORKERS_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';

function failure(err) {
  const message = String(err?.message || err || '');
  if (/\b4006\b|neurons/i.test(message)) return new LiveSparkError("today's free Workers AI allowance is used up", { cause: err });
  return new LiveSparkError('Cloudflare Workers AI failed', { cause: err, retry: true });
}

export async function askWorkersAi(model, { ai, system, user, schema, maxOutputTokens, timeoutMs }) {
  let timer;
  const timedOut = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new LiveSparkError('the request timed out', { retry: true })), timeoutMs);
  });
  let result;
  try {
    result = await Promise.race([
      ai.run(model, {
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        response_format: { type: 'json_schema', json_schema: { name: 'reply', schema, strict: true } },
        max_tokens: maxOutputTokens,
        // With thinking on, Gemma 4 can pad the JSON with blank lines until it runs
        // out of tokens. Off, it answers in about two seconds.
        chat_template_kwargs: { enable_thinking: false },
      }),
      timedOut,
    ]);
  } catch (err) {
    throw err instanceof LiveSparkError ? err : failure(err);
  } finally {
    clearTimeout(timer);
  }

  // Chat-completions models answer in choices[0].message; older ones in `response`.
  const choice = result?.choices?.[0];
  if (choice?.finish_reason === 'length') throw new LiveSparkError('the response was cut off', { retry: true });
  const content = choice ? choice.message?.content : result?.response;
  if (content && typeof content === 'object') return { json: content, model, provider: 'workers-ai' };
  if (typeof content !== 'string' || !content.trim()) throw new LiveSparkError('the response had no text', { retry: true });
  try {
    return { json: JSON.parse(content), model, provider: 'workers-ai' };
  } catch {
    throw new LiveSparkError('the response was not valid JSON', { retry: true });
  }
}
