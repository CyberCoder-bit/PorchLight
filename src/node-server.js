// Runs the app on Node's built-in `http` module: serves /public directly and
// passes everything else to the app's Web-standard handler (see http.js).
// On Cloudflare Workers, worker.js plays this role instead.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { MAX_BODY_BYTES } from './http.js';

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

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

// Reads at most MAX_BODY_BYTES + 1 bytes. That's enough for the handler to
// see the body is too large and show its friendly error page, without ever
// holding a huge upload in memory.
function readLimited(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      if (size > MAX_BODY_BYTES) return;
      chunks.push(chunk);
      size += chunk.length;
    });
    req.on('end', () => resolve(Buffer.concat(chunks).subarray(0, MAX_BODY_BYTES + 1)));
    req.on('error', reject);
  });
}

export function createNodeServer({ handle, publicDir }) {
  const resolvedPublic = path.resolve(publicDir);
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && serveStatic(resolvedPublic, url.pathname, res)) return;

      const hasBody = !['GET', 'HEAD'].includes(req.method);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (key !== 'content-length' && value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      // [v2 accounts] The client's address, for rate limits (src/auth/limits.js).
      // It always comes from the socket: whatever the client sent in these two
      // headers is thrown away, so nobody can pretend to be someone else.
      headers.delete('cf-connecting-ip');
      headers.set('x-porchlight-client-ip', req.socket.remoteAddress || 'unknown');
      const response = await handle(
        new Request(`http://${req.headers.host || 'localhost'}${req.url}`, {
          method: req.method,
          headers,
          body: hasBody ? await readLimited(req) : undefined,
        })
      );

      const out = {};
      response.headers.forEach((value, key) => {
        if (key !== 'set-cookie') out[key] = value;
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) out['set-cookie'] = cookies;
      res.writeHead(response.status, out);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      console.error(err);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Something went wrong on our side.');
    }
  });
}
