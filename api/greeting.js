import { handleGreeting, assertKey } from './_agent.js';
import { clientMeta, rateLimit, track } from './_track.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const meta = clientMeta(req);
  // A call costs more than a turn, so it draws more from the same budget.
  const gate = await rateLimit(meta.ip, 2);
  if (!gate.ok) {
    await track('rate_limited', meta, { used: gate.used });
    return res.status(429).json({
      error: `Demo limit reached (${gate.max} turns/hour). This is a live demo running on a metered API — try again shortly.`,
    });
  }

  try {
    assertKey();
    const out = await handleGreeting(req.body || {});
    await track('call_started', meta, { lead: req.body?.name });
    res.status(200).json(out);
  } catch (err) {
    console.error('✗ greeting:', err.message);
    await track('greeting_error', meta, { message: err.message });
    res.status(500).json({ error: err.message });
  }
}
