// "No dead ends" for signed-in people: after a page is built, links and forms
// that lead somewhere this person can't go are taken off the page, so they
// never land on the "This page is for coordinators" page by accident.
//
// This is a courtesy only. The server checks every request (./access.js).
// It runs only for a signed-in volunteer, family member, or senior; demo mode
// and the coordinator get the page exactly as built.
//
// Our pages come from html`` (src/views/html.js): every attribute is
// double-quoted and every value is escaped, and <a> and <form> never nest, so
// these simple patterns are safe for them.
//   - a <p> or <li> that holds only a blocked link (a "Back to ..." line, a
//     footer link) is removed;
//   - a blocked link styled as a button, or a download link, is removed;
//   - a blocked link that is a closing call to action (right after a bold
//     sentence, at the end of its paragraph: "... </strong> See what to do
//     next") is removed;
//   - any other blocked link becomes its plain text ("Companion: Ethan Brooks");
//   - a blocked form is removed.

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// '/seniors/s-1?x=1#sparks' -> '/seniors/s-1'. Null for '#main', 'https://...', 'tel:...'.
function sitePath(href) {
  const h = decode(href);
  if (!h.startsWith('/') || h.startsWith('//')) return null;
  return h.split('#')[0].split('?')[0] || '/';
}

const attr = (attrs, name) => new RegExp(`\\b${name}="([^"]*)"`, 'i').exec(attrs)?.[1] ?? null;

const LINK = '<a\\b([^>]*)>((?:(?!<\\/?a\\b)[\\s\\S])*?)<\\/a>';
const ONLY_LINK = new RegExp(`<(p|li)\\b[^>]*>\\s*${LINK}\\s*<\\/\\1>`, 'g');
const ANY_LINK = new RegExp(LINK, 'g');
const FORM = /<form\b([^>]*)>[\s\S]*?<\/form>/g;

// allowed(method, path) -> boolean
export function stripBlocked(page, allowed) {
  const blockedLink = (attrs) => {
    const href = attr(attrs, 'href');
    const path = href === null ? null : sitePath(href);
    return path !== null && !allowed('GET', path);
  };
  return page
    .replace(ONLY_LINK, (whole, _tag, attrs) => (blockedLink(attrs) ? '' : whole))
    .replace(ANY_LINK, (whole, attrs, inner, offset, text) => {
      if (!blockedLink(attrs)) return whole;
      const isButton = /\bclass="[^"]*\bbutton\b/.test(attrs) || /\sdownload\b/.test(attrs);
      const before = text.slice(Math.max(0, offset - 12), offset);
      const after = text.slice(offset + whole.length, offset + whole.length + 8);
      const closingAction = /<\/strong>\s*$/.test(before) && /^\.?\s*<\/(p|li)>/.test(after);
      return isButton || closingAction ? '' : inner;
    })
    .replace(FORM, (whole, attrs) => {
      const action = attr(attrs, 'action');
      const path = action === null ? null : sitePath(action);
      if (path === null) return whole;
      const method = (attr(attrs, 'method') || 'get').toUpperCase();
      return allowed(method, path) ? whole : '';
    });
}
