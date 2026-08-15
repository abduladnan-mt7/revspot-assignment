import { handleGreeting, assertKey } from './_agent.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    assertKey();
    res.status(200).json(await handleGreeting(req.body || {}));
  } catch (err) {
    console.error('✗ greeting:', err.message);
    res.status(500).json({ error: err.message });
  }
}
