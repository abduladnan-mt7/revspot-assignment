/**
 * Visitor tracking + per-IP rate limiting.
 *
 * Two backends behind one interface:
 *   - No config          → in-process memory + structured console logs (Vercel's log
 *                          viewer becomes the tracker). Zero dependencies, works today.
 *   - Upstash configured → shared across instances and survives restarts.
 *
 * Memory mode is honest but imperfect on serverless: each instance keeps its own
 * counters, so the real limit is roughly (limit × instances). It still stops a runaway
 * loop, which is the failure that actually drains an API budget.
 *
 * Geo comes from Vercel's own edge headers — no third-party lookup, no extra latency.
 * It resolves to CITY level. There is no such thing as a street address from an IP.
 */

const HAS_UPSTASH = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const HAS_TCP_REDIS = Boolean(process.env.REDIS_URL);
const HAS_REDIS = HAS_UPSTASH || HAS_TCP_REDIS;

/* ── who is calling ──────────────────────────────────────────────────── */
export function clientMeta(req) {
  const h = (k) => {
    const v = req.headers?.[k] ?? req.headers?.get?.(k);
    return typeof v === 'string' ? v : undefined;
  };
  const dec = (v) => { try { return v ? decodeURIComponent(v) : undefined; } catch { return v; } };

  const fwd = h('x-forwarded-for') || '';
  return {
    ip: (fwd.split(',')[0] || h('x-real-ip') || req.socket?.remoteAddress || 'unknown').trim(),
    city: dec(h('x-vercel-ip-city')),
    region: dec(h('x-vercel-ip-country-region')),
    country: h('x-vercel-ip-country'),
    ua: (h('user-agent') || '').slice(0, 160),
  };
}

export const describe = (m) =>
  [m.city, m.region, m.country].filter(Boolean).join(', ') || 'location unknown';

/* ── redis: two transports, one interface ────────────────────────────
   Upstash speaks REST; a self-hosted Redis speaks RESP over TCP. RESP is a simple
   text protocol, so both are implemented here directly — the repo stays free of
   dependencies either way.

   NOTE: a self-hosted Redis must be reachable from wherever the code runs. A
   127.0.0.1 address only works when the app runs on that same machine; from
   serverless it resolves to the function's own container. Use the host's public
   endpoint (and TLS — rediss://) for a deployed app.                            */

async function redisRest(cmd) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

/** Minimal RESP client — connect, AUTH, run one command, close. */
async function redisTcp(cmd) {
  const net = await import('node:net');
  const tls = await import('node:tls');
  const u = new URL(process.env.REDIS_URL);
  const secure = u.protocol === 'rediss:';
  const port = Number(u.port || 6379);
  const db = (u.pathname || '').replace('/', '');

  const encode = (args) =>
    `*${args.length}\r\n` + args.map((a) => `$${Buffer.byteLength(String(a))}\r\n${a}\r\n`).join('');

  return new Promise((resolve, reject) => {
    const sock = (secure ? tls : net).connect(
      secure ? { host: u.hostname, port, servername: u.hostname } : { host: u.hostname, port },
    );
    sock.setTimeout(4000);

    const pre = [];
    if (u.password) pre.push(u.username ? ['AUTH', decodeURIComponent(u.username), decodeURIComponent(u.password)]
                                        : ['AUTH', decodeURIComponent(u.password)]);
    if (db && db !== '0') pre.push(['SELECT', db]);

    let buf = '';
    let expected = pre.length + 1;   // replies to skip before ours
    const done = (fn, v) => { try { sock.destroy(); } catch {} fn(v); };

    sock.on('connect', () => sock.write([...pre, cmd].map(encode).join('')));
    sock.on('error', (e) => done(reject, e));
    sock.on('timeout', () => done(reject, new Error('redis timeout')));
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      // count complete replies; the last one is the answer to `cmd`
      let seen = 0, i = 0, last = null;
      while (i < buf.length) {
        const nl = buf.indexOf('\r\n', i);
        if (nl === -1) return;                       // wait for more
        const type = buf[i], line = buf.slice(i + 1, nl);
        if (type === '$') {
          const len = Number(line);
          if (len === -1) { last = null; i = nl + 2; }
          else {
            const end = nl + 2 + len;
            if (buf.length < end + 2) return;
            last = buf.slice(nl + 2, end); i = end + 2;
          }
        } else if (type === '*') {
          // arrays: collect simple bulk items
          const n = Number(line); const items = []; let j = nl + 2;
          for (let k = 0; k < n; k++) {
            const nl2 = buf.indexOf('\r\n', j);
            if (nl2 === -1) return;
            const len = Number(buf.slice(j + 1, nl2));
            if (len === -1) { items.push(null); j = nl2 + 2; continue; }
            const end = nl2 + 2 + len;
            if (buf.length < end + 2) return;
            items.push(buf.slice(nl2 + 2, end)); j = end + 2;
          }
          last = items; i = j;
        } else if (type === '-') {
          return done(reject, new Error(line));
        } else {                                     // + simple string, : integer
          last = type === ':' ? Number(line) : line; i = nl + 2;
        }
        if (++seen === expected) return done(resolve, last);
      }
    });
  });
}

const redis = (...cmd) => (HAS_UPSTASH ? redisRest(cmd) : redisTcp(cmd));

/** test hook — exercises the RESP client without the tracking layer */
export const __redisTest = (...cmd) => redisTcp(cmd);

/* ── rate limit ──────────────────────────────────────────────────────── */
const WINDOW_S = 3600;
const MAX_TURNS = Number(process.env.RATE_LIMIT_PER_HOUR || 40);   // ≈ 4 full calls
const mem = new Map();

export async function rateLimit(ip, cost = 1) {
  const key = `rl:${ip}`;
  try {
    if (HAS_REDIS) {
      const used = await redis('INCRBY', key, String(cost));
      if (used === cost) await redis('EXPIRE', key, String(WINDOW_S));
      return { ok: used <= MAX_TURNS, used, max: MAX_TURNS };
    }
    const now = Date.now();
    const slot = mem.get(key);
    if (!slot || now > slot.resetAt) {
      mem.set(key, { used: cost, resetAt: now + WINDOW_S * 1000 });
      if (mem.size > 5000) for (const [k, v] of mem) if (now > v.resetAt) mem.delete(k);
      return { ok: true, used: cost, max: MAX_TURNS };
    }
    slot.used += cost;
    return { ok: slot.used <= MAX_TURNS, used: slot.used, max: MAX_TURNS };
  } catch (err) {
    // Never let the limiter take the demo down — log and allow.
    console.error('rate-limit backend failed, allowing:', err.message);
    return { ok: true, used: 0, max: MAX_TURNS, degraded: true };
  }
}

/* ── tracking ────────────────────────────────────────────────────────── */
export async function track(event, meta, extra = {}) {
  const row = {
    at: new Date().toISOString(),
    event,
    ip: meta.ip,
    where: describe(meta),
    ...extra,
  };
  // Always: structured line. On Vercel these are queryable in the log viewer,
  // so the tracker works with no database at all.
  console.log('TRACK ' + JSON.stringify(row));

  if (!HAS_REDIS) return;
  try {
    await redis('LPUSH', 'visits', JSON.stringify(row));
    await redis('LTRIM', 'visits', '0', '499');           // keep the last 500
    await redis('PFADD', 'uniq:ips', meta.ip);            // cardinality, not a list
    await redis('INCR', `count:${event}`);
  } catch (err) {
    console.error('track write failed:', err.message);
  }
}

export async function readStats() {
  if (!HAS_REDIS) {
    return { backend: 'logs-only',
             note: 'No Upstash configured. Visits are in the Vercel log viewer — filter for "TRACK".' };
  }
  const [visits, uniq, calls, turns] = await Promise.all([
    redis('LRANGE', 'visits', '0', '99'),
    redis('PFCOUNT', 'uniq:ips'),
    redis('GET', 'count:call_started'),
    redis('GET', 'count:turn'),
  ]);
  return {
    backend: 'upstash',
    unique_visitors: uniq || 0,
    calls_started: Number(calls || 0),
    turns_spoken: Number(turns || 0),
    recent: (visits || []).map((v) => { try { return JSON.parse(v); } catch { return v; } }),
  };
}
