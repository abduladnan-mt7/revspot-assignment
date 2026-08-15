import { handleTurn, assertKey } from './_agent.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    assertKey();
    res.status(200).json(await handleTurn(req.body || {}));
  } catch (err) {
    console.error('✗ turn:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// Audio arrives as base64 in the JSON body; the 4.5 MB default is not enough
// for a long caller turn.
export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };
