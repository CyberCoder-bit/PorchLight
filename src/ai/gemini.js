// Google's Gemini API, called with fetch(). There is no package to install,
// and the same code runs in Node and on Cloudflare Workers. The reply is
// structured output: JSON that must match the schema we send.

import { LiveSparkError } from './errors.js';

export const GEMINI_API = 'https://generativelanguage.googleapis.com';
// Flash-Lite first: it answers in about a second when it isn't busy. "-latest"
// names follow Google's newest model, so the app keeps working when an older
// model is retired; a retired name (404) just moves on to the next one.
export const DEFAULT_GEMINI_MODELS = Object.freeze(['gemini-flash-lite-latest', 'gemini-3-flash-preview']);

// "a, models/b" -> ['a', 'b']; empty -> the defaults.
export function parseModels(value) {
  const models = String(value || '')
    .split(',')
    .map((name) => name.trim().replace(/^models\//, ''))
    .filter(Boolean);
  return models.length ? models : [...DEFAULT_GEMINI_MODELS];
}

const DECLINED = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII']);

function httpError(status, body) {
  const error = body?.error || {};
  const message = String(error.message || '');
  const badKey = status === 401 || (error.details || []).some((d) => d?.reason === 'API_KEY_INVALID') || /API key/i.test(message);
  if (badKey) return new LiveSparkError('the API key was rejected');
  if (status === 403) return new LiveSparkError('the API key lacks permission for this model');
  if (status === 429) return new LiveSparkError('rate limited; try again in a minute', { retry: true });
  if (status === 404) return new LiveSparkError('the model name was not found (check GEMINI_MODEL)', { retry: true });
  if (status >= 500) return new LiveSparkError('the AI service is busy right now', { retry: true });
  return new LiveSparkError(status === 400 ? 'the API rejected the request' : `API error ${status}`, { retry: true });
}

const networkError = (err) =>
  new LiveSparkError(err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 'the request timed out' : 'could not reach the Gemini API (offline?)', { cause: err, retry: true });

export async function askGemini(model, { apiKey, baseURL, system, user, schema, maxOutputTokens, timeoutMs }) {
  const url = `${String(baseURL || GEMINI_API).replace(/\/+$/, '')}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let response;
  let body = null;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          maxOutputTokens,
          // Short, simple writing: little thinking keeps it fast.
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    body = await response.json().catch((err) => {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') throw err;
      return null;
    });
  } catch (err) {
    throw networkError(err);
  }
  if (!response.ok) throw httpError(response.status, body);
  if (!body) throw new LiveSparkError('the response was not valid JSON', { retry: true });
  if (body.promptFeedback?.blockReason) throw new LiveSparkError('Gemini declined this request');

  const candidate = body.candidates?.[0];
  const finish = candidate?.finishReason;
  if (DECLINED.has(finish)) throw new LiveSparkError('Gemini declined this request');
  if (finish === 'MAX_TOKENS') throw new LiveSparkError('the response was cut off', { retry: true });
  if (finish && finish !== 'STOP') throw new LiveSparkError(`the response stopped early (${finish})`, { retry: true });

  // Skip "thought" parts: only the answer is JSON.
  const text = (candidate?.content?.parts || [])
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
  if (!text.trim()) throw new LiveSparkError('the response had no text', { retry: true });
  try {
    return { json: JSON.parse(text), model: body.modelVersion || model, provider: 'gemini' };
  } catch {
    throw new LiveSparkError('the response was not valid JSON', { retry: true });
  }
}
