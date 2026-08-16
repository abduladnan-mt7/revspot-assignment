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

const HAS_REDIS = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

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

/* ── redis over REST (no SDK, keeps the repo dependency-free) ────────── */
async function redis(...cmd) {
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
