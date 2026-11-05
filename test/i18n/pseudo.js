// Pseudo-locale tooling, for tests only (not a test file itself).
//
// withPseudo(fn) runs fn() with every t() string wrapped in ⟦…⟧ markers
// (setPseudoMarkersForTests in src/i18n/index.js). unwrappedText(html, ignore)
// then lists the visible text that has no markers: text that skipped t().
// `ignore` holds text that is allowed to stay as it is: user data (names)
// and the languages' own names in the picker.
//
// Pseudo is a switch inside the i18n module, never a language: it isn't in
// UI_LANGUAGES, and no cookie, header, or profile can turn it on.

import { setPseudoMarkersForTests } from '../../src/i18n/index.js';

export async function withPseudo(fn) {
  setPseudoMarkersForTests(true);
  try {
    return await fn();
  } finally {
    setPseudoMarkersForTests(false);
  }
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

// Visible text pieces of an HTML fragment, one per text node, decoded.
export function visibleText(markup) {
  return String(markup)
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*\baria-hidden="true"[^>]*>[\s\S]*?<\/(?:span|svg)>/g, ' ') // decoration
    .replace(/<option\b[^>]*>/g, '\n') // each option is its own piece
    .replace(/<[^>]+>/g, '\n')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (e) => ENTITIES[e])
    .split('\n')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

// Remove every ⟦…⟧ (innermost first, since a t() string can hold another).
const stripMarked = (s) => {
  let out = s;
  let before;
  do {
    before = out;
    out = out.replace(/⟦[^⟦⟧]*⟧/g, ' ');
  } while (out !== before);
  return out;
};

// Text a reader would see that did not come through t().
export function unwrappedText(markup, ignore = []) {
  const allowed = new Set(ignore);
  return visibleText(markup)
    .map((piece) => {
      let rest = stripMarked(piece);
      for (const word of ignore) rest = rest.split(word).join(' ');
      return rest.replace(/[\s.,:;·/()+\-–—0-9%]+/g, ' ').trim();
    })
    .filter((rest) => rest && !allowed.has(rest));
}
