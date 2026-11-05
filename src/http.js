// A deliberately small web framework (about 150 lines). We avoid Express so
// the app runs with no `npm install`, which matters on locked-down school
// networks.
//
// It works on Web-standard Request/Response objects, so the same code runs
// under Node (see node-server.js) and on Cloudflare Workers (see worker.js).
// Route handlers still get familiar `req` and `res` objects:
//   - routing with :params        router.get('/seniors/:id', handler)
//   - form-body parsing           req.body (application/x-www-form-urlencoded)
//   - cookies                     req.cookies
//   - response helpers            res.html(), res.redirect(), res.json(), res.setCookie()

import { withLang } from './i18n/index.js';
import { languageFromRequest } from './i18n/negotiate.js';

export const MAX_BODY_BYTES = 100 * 1024; // forms are tiny; reject anything larger

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    // Turn '/seniors/:id/edit' into a regex with a named group for each :param.
    const keys = [];
    const regex = new RegExp(
      '^' +
        pattern.replace(/\/:([a-zA-Z_]+)/g, (_, key) => {
          keys.push(key);
          return '/([^/]+)';
        }) +
        '/?$'
    );
    this.routes.push({ method, regex, keys, handler });
  }

  get(pattern, handler) { this.add('GET', pattern, handler); }
  post(pattern, handler) { this.add('POST', pattern, handler); }

  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = route.regex.exec(pathname);
      if (!m) continue;
      // A broken %-escape ("/seniors/%E0%A4%A") can't name anything we have,
      // so it is a "not found", never a crash.
      let params = {};
      try {
        route.keys.forEach((key, i) => {
          params[key] = decodeURIComponent(m[i + 1]);
        });
      } catch {
        params = null;
      }
      if (!params) continue;
      return { handler: route.handler, params };
    }
    return null;
  }
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

// Form fields that appear more than once (checkbox groups) become arrays.
function parseForm(text) {
  const params = new URLSearchParams(text);
  const body = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    body[key] = all.length > 1 ? all : all[0];
  }
  return body;
}

async function readBody(request) {
  const tooLarge = () => Object.assign(new Error('Request body too large'), { status: 413 });
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) throw tooLarge();
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_BODY_BYTES) throw tooLarge();
  return new TextDecoder().decode(bytes);
}

// Location values: printable ASCII only. Control characters (tab, CR, LF, ...)
// mean someone is playing tricks, so we fall back to the home page. Other
// characters outside ASCII are percent-encoded, as a browser would.
function safeLocation(location) {
  const value = String(location ?? '');
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return '/';
  try {
    return value.replace(/[^\u0021-\u007e]/gu, (ch) => encodeURIComponent(ch));
  } catch {
    return '/'; // a lone surrogate can't be encoded
  }
}

// Collects what a handler writes, then turns it into a Response.
function createResponse() {
  const headers = new Headers();
  let status = 200;
  let body = null;
  let sent = false;

  return {
    get headersSent() {
      return sent;
    },
    html(content, code = 200) {
      status = code;
      headers.set('Content-Type', 'text/html; charset=utf-8');
      headers.set('Cache-Control', 'no-store');
      body = content;
      sent = true;
    },
    json(data, code = 200) {
      status = code;
      headers.set('Content-Type', 'application/json; charset=utf-8');
      body = JSON.stringify(data, null, 2);
      sent = true;
    },
    // 303 See Other = "Post/Redirect/Get": after a form POST, the browser loads
    // a normal page, so pressing Refresh never re-submits the form.
    // A Location header can't hold control characters (CR/LF would split the
    // header), so a value with any of them goes home instead of crashing.
    redirect(location, code = 303) {
      status = code;
      headers.set('Location', safeLocation(location));
      sent = true;
    },
    // Any other response header, e.g. X-Robots-Tag on /admin pages.
    header(name, value) {
      headers.set(name, value);
    },
    setCookie(name, value, maxAgeSeconds = 60 * 60 * 24 * 365) {
      headers.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`);
    },
    // HEAD gets the same status and headers as GET, with no body.
    toResponse({ head = false } = {}) {
      return new Response(head ? null : body, { status, headers });
    },
  };
}

// Builds the app's request handler: (Request) => Promise<Response>.
export function createHandler({ router, renderError }) {
  // [v2 i18n] Each request runs in its own language (see src/i18n/index.js).
  return (request) => {
    const lang = languageFromRequest({
      cookies: parseCookies(request.headers.get('cookie') || ''),
      acceptLanguage: request.headers.get('accept-language') || '',
    });
    return withLang(lang, () => handleRequest(request, { router, renderError }));
  };
}

async function handleRequest(request, { router, renderError }) {
  const url = new URL(request.url);
  const res = createResponse();
  // HEAD (used by link checkers and uptime monitors) runs the GET route;
  // toResponse() then drops the body.
  const head = request.method === 'HEAD';
  const req = {
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    cookies: parseCookies(request.headers.get('cookie') || ''),
    headers: request.headers, // [v2] e.g. accept-language, and the client IP header (see src/auth)
    body: {},
    params: {},
  };

  try {
    const found = router.match(head ? 'GET' : req.method, url.pathname);
    if (!found) {
      renderError(req, res, 404, 'We could not find that page.');
      return res.toResponse({ head });
    }
    req.params = found.params;
    if (req.method === 'POST') req.body = parseForm(await readBody(request));
    await found.handler(req, res);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    if (!res.headersSent) {
      renderError(req, res, status, status === 500 ? 'Something went wrong on our side.' : err.message);
    }
  }
  return res.toResponse({ head });
}

// Throw this from a handler to show a friendly error page.
export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
