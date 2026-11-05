// The phrase card (/phrases) and the conversation helper (/translate).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.js';
import { buildDemoMessages } from '../../src/translate/demo.js';
import { NOW } from './helpers.js';

const DISCLAIMER = 'Machine translation, may contain mistakes. Don&#39;t use it for medical or money decisions.';

test('phrase card: about 20 phrases in a big, printable table; works for every signed-in role', async () => {
  const app = makeApp();
  const page = await app.get('/phrases?lang=es');
  assert.equal(page.status, 200);
  assert.match(page.text, /<table class="data-table big">/);
  assert.equal((page.text.match(/<tr>/g) || []).length, 21, 'a header row and 20 phrases');
  for (const phrase of ['Can you hear me?', 'Could you speak a little slower?', 'Same time next week?', 'Thank you for talking with me.']) {
    assert.ok(page.text.includes(phrase), phrase);
  }
  assert.match(page.text, /<form method="get" action="\/phrases"/);
  for (const viewer of ['senior:s-rosa', 'volunteer:v-linda', 'family:s-harold']) {
    assert.equal((await app.get('/phrases', viewer)).status, 200, viewer);
  }
});

test('phrase card: a language with no catalog yet says so instead of showing English twice', async () => {
  const app = makeApp();
  const page = await app.get('/phrases?lang=cnh');
  assert.match(page.text, /Phrases in Laiholh \(Hakha Chin\) are not ready yet\./);
  assert.doesNotMatch(page.text, /<th scope="col">Laiholh/);
  // An unknown code is ignored, never echoed back.
  const odd = await app.get('/phrases?lang=%3Cscript%3E');
  assert.equal(odd.status, 200);
  assert.doesNotMatch(odd.text, /<script>/);
});

test('helper: two sides, the notice before sending, the disclaimer, and its script only on this page', async () => {
  const app = makeApp();
  const page = await app.get('/translate');
  assert.equal(page.status, 200);
  assert.match(page.text, /I speak/);
  assert.match(page.text, /They speak/);
  assert.match(page.text, /will be sent to an AI service \(Gemini, or Cloudflare Workers AI as a backup\) to be translated/);
  assert.ok(page.text.includes(DISCLAIMER));
  assert.match(page.text, /<script src="\/translate\.js" defer><\/script>/);
  assert.doesNotMatch((await app.get('/messages')).text, /translate\.js/);
  assert.doesNotMatch((await app.get('/phrases')).text, /translate\.js/);
});

test('helper (no JS): each side is translated for the other; free text needs AI mode; HTML is escaped', async () => {
  const app = makeApp();
  const rosa = buildDemoMessages(NOW).find((m) => m.lang === 'es');
  const res = await app.post('/translate', { mine: '<b>Hola</b> amiga', mineLang: 'en', theirs: rosa.text, theirsLang: 'es' });
  assert.equal(res.status, 200);
  assert.match(res.text, /What a good idea, Linda!/, "their Spanish shown in my English");
  assert.match(res.text, /Translation needs AI mode\./, 'free text without AI');
  assert.ok(res.text.includes('&lt;b&gt;Hola&lt;/b&gt; amiga'));
  assert.doesNotMatch(res.text, /<b>Hola/);
  // Both boxes keep what was typed, so the talk can go on.
  assert.ok(res.text.includes(rosa.text));
});

test('helper: over 500 characters is refused with a clear message; family members cannot use it', async () => {
  const app = makeApp();
  const res = await app.post('/translate', { mine: 'x'.repeat(501), mineLang: 'en', theirs: '', theirsLang: 'es' });
  assert.match(res.text, /500 characters or fewer\. This one has 501/);
  assert.match(res.text, /aria-invalid="true"/);
  assert.equal((await app.get('/translate', 'family:s-harold')).status, 403);
  assert.equal((await app.get('/translate', 'volunteer:v-maya')).status, 200);
});
