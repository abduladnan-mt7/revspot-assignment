import { handleTurn, assertKey } from './_agent.js';
import { clientMeta, rateLimit, track } from './_track.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const meta = clientMeta(req);
  const gate = await rateLimit(meta.ip);
  if (!gate.ok) {
    await track('rate_limited', meta, { used: gate.used });
    return res.status(429).json({
      error: `Demo limit reached (${gate.max} turns/hour). This is a live demo running on a metered API — try again shortly.`,
    });
  }

  try {
    assertKey();
    const out = await handleTurn(req.body || {});
    await track('turn', meta, {
      lang: out.lang,
      slots: out.slots ? Object.entries(out.slots)
        .filter(([k, v]) => v && ['intent', 'geography', 'budget_fit', 'timeline'].includes(k))
        .map(([k]) => k).join('+') || 'none' : 'none',
      outcome: out.slots?.outcome,
      ms: out.timings?.total,
    });
    res.status(200).json(out);
  } catch (err) {
    console.error('✗ turn:', err.message);
    await track('turn_error', meta, { message: err.message });
    res.status(500).json({ error: err.message });
  }
}

// Audio arrives as base64 in the JSON body; the 4.5 MB default is not enough
// for a long caller turn.
export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };
