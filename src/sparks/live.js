// LIVE_MODE: real conversation sparks from Claude, through the official
// Anthropic SDK (@anthropic-ai/sdk).
//
// The SDK is loaded with a dynamic import() only when LIVE mode is actually
// used. If someone runs the app without `npm install`, MOCK mode still works.
//
// PRIVACY: we send only what's needed to write good starters: the senior's
// preferred first name, interest labels, their "about me" text, days since
// last contact, and today's date and season. We never send caregiver
// details, phone numbers, or volunteer call notes.

import { interestLabel, methodLabel } from '../vocab.js';

export const SYSTEM_PROMPT = `You write conversation starters for PorchLight, a program in Carmel, Indiana that pairs older adults with volunteer companions (often high school students) for regular phone calls, video calls, and visits. A volunteer reads your starters right before a call.

Write exactly 3 conversation starters for the senior described in the user message.
- Starter 1 opens the call and fits how long it has been since the last contact: a warm follow-up if it was recent, an easy catch-up after about a week, or a glad-to-reconnect opener after a longer gap. A long gap must never make the senior feel guilty or neglected; the volunteer owns the gap. If there has been no contact yet, write a friendly first-conversation opener.
- Starters 2 and 3 each draw on a different interest or detail from the senior's profile. They can tie in the season or something local to Carmel when it fits naturally.
- Each starter is one or two sentences, under 40 words, in the volunteer's voice, spoken out loud, and ends with an open-ended question.
- Be warm and respectful. Talk to the senior as an adult with a lifetime of experience, never in a childish or patronizing way.
- Do not bring up health, medications, money, grief, or loss unless the profile makes clear the senior wants to talk about it. Do not invent facts about the senior or their family.

For each starter, also give a short "based_on" label (under 8 words) naming what it draws on, for example "Interest: Gardening" or "12 days since last contact".`;

// JSON schema for structured outputs: the API guarantees the reply matches it.
export const SPARK_SCHEMA = {
  type: 'object',
  properties: {
    sparks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          based_on: { type: 'string' },
        },
        required: ['text', 'based_on'],
        additionalProperties: false,
      },
    },
  },
  required: ['sparks'],
  additionalProperties: false,
};

export class LiveSparkError extends Error {
  constructor(reason, cause) {
    super(reason);
    this.reason = reason;
    this.cause = cause;
  }
}

let sdkPromise = null;
// Returns the Anthropic class, or null if the package isn't installed.
export function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = import('@anthropic-ai/sdk')
      .then((mod) => mod.default || mod.Anthropic || null)
      .catch(() => null);
  }
  return sdkPromise;
}

export function buildUserMessage(input) {
  const today = input.now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const lastContact =
    input.daysSince == null
      ? 'No contact yet (this will be their first conversation)'
      : `${input.daysSince} day${input.daysSince === 1 ? '' : 's'} ago${input.lastContactType ? ` (${methodLabel(input.lastContactType).toLowerCase()})` : ''}`;
  return [
    `Today: ${today} (${input.season})`,
    `Senior's preferred name: ${input.name}`,
    `Interests: ${input.interests.map(interestLabel).join(', ') || 'none listed'}`,
    `About them: ${input.aboutMe || 'nothing else on file'}`,
    `Last contact with a PorchLight volunteer: ${lastContact}`,
    `Upcoming contact type: ${methodLabel(input.contactMethod)}`,
  ].join('\n');
}

// Turn any failure into a short, human-readable reason for the UI.
function describeError(Anthropic, err) {
  if (err instanceof LiveSparkError) return err;
  if (Anthropic) {
    if (err instanceof Anthropic.AuthenticationError) return new LiveSparkError('the API key was rejected', err);
    if (err instanceof Anthropic.PermissionDeniedError) return new LiveSparkError('the API key lacks permission for this model', err);
    if (err instanceof Anthropic.NotFoundError) return new LiveSparkError('the model name was not found (check CLAUDE_MODEL)', err);
    if (err instanceof Anthropic.RateLimitError) return new LiveSparkError('rate limited; try again in a minute', err);
    if (err instanceof Anthropic.BadRequestError) return new LiveSparkError('the API rejected the request', err);
    if (err instanceof Anthropic.APIConnectionTimeoutError) return new LiveSparkError('the request timed out', err);
    if (err instanceof Anthropic.APIConnectionError) return new LiveSparkError('could not reach the Claude API (offline?)', err);
    if (err instanceof Anthropic.APIError) return new LiveSparkError(`API error ${err.status ?? ''}`.trim(), err);
  }
  return new LiveSparkError('unexpected error', err);
}

/**
 * Ask Claude for 3 sparks. Resolves to { sparks: [{text, basedOn}], model }.
 * Throws LiveSparkError (with a friendly .reason) on any failure; the caller
 * falls back to MOCK sparks so the volunteer is never left empty-handed.
 */
export async function generateLiveSparks(input, { apiKey, model, baseURL, timeoutMs = 20000 }) {
  const Anthropic = await loadSdk();
  if (!Anthropic) throw new LiveSparkError('the @anthropic-ai/sdk package is not installed (run npm install)');

  const client = new Anthropic({ apiKey, baseURL, timeout: timeoutMs, maxRetries: 1 });
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      // Short creative writing: low effort keeps it fast and cheap.
      // Structured outputs guarantee JSON that matches SPARK_SCHEMA.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SPARK_SCHEMA } },
      messages: [{ role: 'user', content: buildUserMessage(input) }],
    });

    if (response.stop_reason === 'refusal') throw new LiveSparkError('Claude declined this request');
    if (response.stop_reason === 'max_tokens') throw new LiveSparkError('the response was cut off');

    // Read blocks by type: the response may also contain thinking blocks.
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock) throw new LiveSparkError('the response had no text');

    let parsed;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      throw new LiveSparkError('the response was not valid JSON');
    }
    const sparks = (parsed.sparks || [])
      .filter((s) => s && typeof s.text === 'string' && s.text.trim())
      .slice(0, 3)
      .map((s) => ({ text: s.text.trim(), basedOn: String(s.based_on || '').trim() || 'Claude' }));
    if (sparks.length < 3) throw new LiveSparkError('the response had fewer than 3 starters');

    return { sparks, model: response.model || model };
  } catch (err) {
    throw describeError(Anthropic, err);
  }
}
