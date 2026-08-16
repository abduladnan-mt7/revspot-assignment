import { readStats } from './_track.js';

/**
 * Private visitor dashboard. Requires STATS_TOKEN — visitor IPs are not something
 * to serve to the open internet, and a public demo URL is guessable by definition.
 */
export default async function handler(req, res) {
  const token = process.env.STATS_TOKEN;
  if (!token) return res.status(503).json({ error: 'STATS_TOKEN is not set on this deployment' });
  if (req.query.token !== token) return res.status(401).json({ error: 'unauthorized' });

  try {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(await readStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
