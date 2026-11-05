// Demo messages and their translations, written ahead of time (v2).
//
// Two fictional pairs write to each other in different languages:
//   Rosa (Spanish) and Linda (English), match m-rosa-linda
//   Samira (Arabic) and Jordan (English), match m-samira-jordan
// Each message comes with its translation, so the demo works offline in
// MOCK mode with no AI at all. The seed calls buildDemoMessages(now).

import { localParts, fromLocal } from '../tz.js';

// `daysAgo` calendar days before today, at hour:minute Indiana time.
function at(now, daysAgo, hour, minute) {
  const p = localParts(now);
  return fromLocal(p.year, p.month, p.day - daysAgo, hour, minute).toISOString();
}

// Each line: who wrote it, in which language, and the same words in the other language.
const THREADS = [
  {
    matchId: 'm-rosa-linda',
    senior: 's-rosa',
    volunteer: 'v-linda',
    lines: [
      {
        from: 'volunteer', lang: 'en', daysAgo: 3, time: [10, 15],
        text: 'Hi Rosa! I found that old movie you told me about, Roman Holiday. Do you want to watch it before our next video call?',
        es: '¡Hola, Rosa! Encontré esa película antigua que me contaste, Roman Holiday. ¿Quieres verla antes de nuestra próxima videollamada?',
      },
      {
        from: 'senior', lang: 'es', daysAgo: 3, time: [11, 2],
        text: '¡Qué buena idea, Linda! Me encanta Audrey Hepburn. La veo el sábado y el martes hablamos.',
        en: "What a good idea, Linda! I love Audrey Hepburn. I'll watch it on Saturday, and we'll talk on Tuesday.",
      },
      {
        from: 'senior', lang: 'es', daysAgo: 1, time: [16, 40],
        text: 'Chispa durmió toda la tarde encima de la cobija que estoy tejiendo.',
        en: "Chispa slept all afternoon on top of the blanket I'm knitting.",
      },
      {
        from: 'volunteer', lang: 'en', daysAgo: 1, time: [18, 5],
        text: 'Ha! Chispa has good taste. Will you send me a photo of the blanket when you finish it?',
        es: '¡Ja! Chispa tiene buen gusto. ¿Me mandas una foto de la cobija cuando la termines?',
      },
    ],
  },
  {
    matchId: 'm-samira-jordan',
    senior: 's-samira',
    volunteer: 'v-jordan',
    lines: [
      {
        from: 'volunteer', lang: 'en', daysAgo: 2, time: [17, 0],
        text: "Hello Samira, I'm Jordan. I'm happy to meet you! Does Thursday afternoon work for a phone call?",
        ar: 'مرحباً سميرة، أنا جوردان. يسعدني أن أتعرّف عليكِ! هل يناسبكِ بعد ظهر يوم الخميس لمكالمة هاتفية؟',
      },
      {
        from: 'senior', lang: 'ar', daysAgo: 2, time: [19, 30],
        text: 'أهلاً جوردان، شكراً لك. نعم، الخميس بعد الظهر مناسب جداً. سأحضّر الشاي ونتحدث.',
        en: 'Hello Jordan, thank you. Yes, Thursday afternoon is very good. I will make some tea and we can talk.',
      },
      {
        from: 'volunteer', lang: 'en', daysAgo: 1, time: [12, 10],
        text: "Great! I'll call you on Thursday at 2 PM. Talk soon.",
        ar: 'رائع! سأتصل بكِ يوم الخميس الساعة الثانية بعد الظهر. نتحدث قريباً.',
      },
    ],
  },
];

const OTHER = ['en', 'es', 'ar'];

// from|to|text -> the translation written above.
const DEMO_TRANSLATIONS = new Map();
for (const thread of THREADS) {
  for (const line of thread.lines) {
    for (const to of OTHER) {
      if (to !== line.lang && line[to]) DEMO_TRANSLATIONS.set(`${line.lang}|${to}|${line.text}`, line[to]);
    }
  }
}

export function demoTranslation(text, from, to) {
  return DEMO_TRANSLATIONS.get(`${from}|${to}|${String(text ?? '').trim()}`) || null;
}

// The demo messages, oldest first, with dates relative to `now`. When the
// seed's `matches` are given, a pair that isn't in the seed is skipped, so
// this works with and without the Samira and Jordan pair.
export function buildDemoMessages(now = new Date(), matches = null) {
  const known = Array.isArray(matches) ? new Set(matches.map((m) => m.id)) : null;
  const out = [];
  for (const thread of THREADS) {
    if (known && !known.has(thread.matchId)) continue;
    thread.lines.forEach((line, i) => {
      out.push({
        id: `msg-${thread.matchId.slice(2)}-${i + 1}`,
        matchId: thread.matchId,
        fromKind: line.from,
        fromId: line.from === 'senior' ? thread.senior : thread.volunteer,
        text: line.text,
        lang: line.lang,
        createdAt: at(now, line.daysAgo, line.time[0], line.time[1]),
      });
    });
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
