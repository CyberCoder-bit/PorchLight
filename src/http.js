// A deliberately small web framework (about 200 lines) built on Node's
// built-in `http` module. We avoid Express so the app runs with no
// `npm install`, which matters on locked-down school networks.
//
// It provides:
//   - routing with :params        router.get('/seniors/:id', handler)
//   - form-body parsing           req.body (application/x-www-form-urlencoded)
//   - cookies                     req.cookies
//   - static files from /public   (with path-traversal protection)
//   - response helpers            res.html(), res.redirect(), res.json()

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MAX_BODY_BYTES = 100 * 1024; // forms are tiny; reject anything larger

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

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
      const params = {};
      route.keys.forEach((key, i) => {
        params[key] = decodeURIComponent(m[i + 1]);
      });
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function addResponseHelpers(res) {
  res.html = (body, status = 200) => {
    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  };
  res.json = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data, null, 2));
  };
  // 303 See Other = "Post/Redirect/Get": after a form POST, the browser loads
  // a normal page, so pressing Refresh never re-submits the form.
  res.redirect = (location, status = 303) => {
    res.writeHead(status, { Location: location });
    res.end();
  };
  res.setCookie = (name, value, maxAgeSeconds = 60 * 60 * 24 * 365) => {
    res.setHeader(
      'Set-Cookie',
      `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`
    );
  };
}

function serveStatic(publicDir, pathname, res) {
  const filePath = path.normalize(path.join(publicDir, pathname));
  // Path-traversal guard: the resolved file must stay inside /public.
  if (!filePath.startsWith(publicDir + path.sep)) return false;
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

export function createServer({ router, publicDir, renderError }) {
  const resolvedPublic = path.resolve(publicDir);
  return http.createServer(async (req, res) => {
    addResponseHelpers(res);
    const url = new URL(req.url, 'http://localhost');
    req.path = url.pathname;
    req.query = Object.fromEntries(url.searchParams);
    req.cookies = parseCookies(req.headers.cookie);
    req.body = {};

    try {
      if (req.method === 'GET' && serveStatic(resolvedPublic, url.pathname, res)) return;

      const found = router.match(req.method, url.pathname);
      if (!found) {
        renderError(req, res, 404, 'We could not find that page.');
        return;
      }
      req.params = found.params;
      if (req.method === 'POST') {
        req.body = parseForm(await readBody(req));
      }
      await found.handler(req, res);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      if (!res.headersSent) {
        renderError(req, res, status, status === 500 ? 'Something went wrong on our side.' : err.message);
      } else {
        res.end();
      }
    }
  });
}

// Throw this from a handler to show a friendly error page.
export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
