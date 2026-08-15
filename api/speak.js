import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { speechStream, decodeSpeech, assertKey } from './_agent.js';

/**
 * Streams synthesised speech straight to an <audio> element.
 *
 * The whole request is encoded in `?p=` rather than looked up in server memory, so this
 * can be served by a different instance than the turn that produced it — the thing that
 * makes the app deployable on serverless.
 */
export default async function handler(req, res) {
  try {
    assertKey();
    const params = decodeSpeech(req.query.p);
    if (!params.text) return res.status(400).send('no text');

    const stream = await speechStream(params);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    // pipeline() forwards stream errors rather than crashing the process
    await pipeline(Readable.fromWeb(stream), res);
  } catch (err) {
    console.error('✗ speak:', err.message);
    if (!res.headersSent) res.status(502).send('tts failed');
    else res.destroy();
  }
}
