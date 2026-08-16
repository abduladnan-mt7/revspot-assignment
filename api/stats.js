import { createHash, timingSafeEqual } from 'node:crypto';
import { readStats } from './_track.js';

/**
 * Private visitor dashboard. Requires STATS_TOKEN via the `x-stats-token` header —
 * not a query string, which would write the secret into access logs, proxy logs and
 * browser history. `public/stats.html` supplies the header; see that file.
 *
 * Compared as SHA-256 digests so the check is constant-time and length-independent.
 */
export function tokenOk(provided) {
  const expected = process.env.STATS_TOKEN;
  if (!expected || !provided) return false;
  const a = createHash('sha256').update(String(provided)).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (!process.env.STATS_TOKEN) {
    return res.status(503).json({ error: 'STATS_TOKEN is not set on this deployment' });
  }
  if (!tokenOk(req.headers['x-stats-token'])) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(await readStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
