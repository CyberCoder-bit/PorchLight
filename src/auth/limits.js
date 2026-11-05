// Rate limits (v2), counted in memory. That works on Workers too, because
// every request goes to one Durable Object (see src/worker.js).
//
//   sign-in:  at most 5 wrong passwords per email and address, per 15 minutes
//   sign-up:  at most 5 new accounts per address, per hour
//
// A limiter forgets old attempts on its own and never holds more than
// MAX_KEYS keys, so it can't fill up memory.

const MAX_KEYS = 10000;

export class RateLimiter {
  constructor({ limit, windowMs }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map(); // key -> [time, ...]
  }

  recent(key, now = Date.now()) {
    const list = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }

  blocked(key, now = Date.now()) {
    return this.recent(key, now).length >= this.limit;
  }

  hit(key, now = Date.now()) {
    const list = this.recent(key, now);
    list.push(now);
    this.hits.delete(key); // re-insert, so the Map keeps keys oldest first
    this.hits.set(key, list);
    while (this.hits.size > MAX_KEYS) this.hits.delete(this.hits.keys().next().value);
  }

  clear(key) {
    this.hits.delete(key);
  }
}

export function createLimits() {
  return {
    signIn: new RateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 }),
    signUp: new RateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 }),
  };
}

// Who is asking? On Workers, Cloudflare sets CF-Connecting-IP. On Node,
// src/node-server.js sets x-porchlight-client-ip from the socket and removes
// any CF-Connecting-IP the client sent, so neither can be faked.
export function clientIp(req) {
  const h = req.headers;
  const get = (name) => (h && typeof h.get === 'function' ? h.get(name) : null);
  return limitBucket((get('cf-connecting-ip') || get('x-porchlight-client-ip') || 'unknown').trim().slice(0, 64));
}

// One home internet connection gets a whole IPv6 /64 (2^64 addresses), so the
// limits count by /64, not by single address (V2-B-12). IPv4, and IPv4 written
// as IPv6 (::ffff:1.2.3.4), count by the plain address.
export function limitBucket(ip) {
  const value = String(ip).toLowerCase();
  if (!value.includes(':')) return value;
  if (value.includes('.')) return value.slice(value.lastIndexOf(':') + 1);
  const [head, tail] = value.split('::');
  const front = head ? head.split(':') : [];
  const back = tail ? tail.split(':') : [];
  const groups = value.includes('::') ? [...front, ...Array(Math.max(0, 8 - front.length - back.length)).fill('0'), ...back] : front;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}
