/**
 * Local dev server for Meera.
 *
 *   node app/server.js   →   http://localhost:3000
 *
 * Deliberately thin: all agent logic lives in api/_agent.js so that this and the
 * serverless functions in api/ run exactly the same code. Anything that behaves
 * differently here than in production is a bug in this file, not in the agent.
 */
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  handleTurn, handleGreeting, speechStream, decodeSpeech,
} from '../api/_agent.js';
import { clientMeta, rateLimit, track, readStats } from '../api/_track.js';
import { tokenOk } from '../api/stats.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 3000;

if (!process.env.SARVAM_API_KEY) {
  console.error('\n  ✗ SARVAM_API_KEY missing. Copy .env.example to .env and add your key.\n');
  process.exit(1);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const send = (code, obj) => {
    if (res.headersSent) return res.destroy();
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  try {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(readFileSync(join(ROOT, 'public', 'index.html')));
    }

    if (req.method === 'GET' && url.pathname === '/stats.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(readFileSync(join(ROOT, 'public', 'stats.html')));
    }

    if (req.method === 'POST' && (url.pathname === '/api/turn' || url.pathname === '/api/greeting')) {
      const isCall = url.pathname === '/api/greeting';
      const meta = clientMeta(req);
      const gate = await rateLimit(meta.ip, isCall ? 2 : 1);
      if (!gate.ok) {
        await track('rate_limited', meta, { used: gate.used });
        return send(429, { error: `Demo limit reached (${gate.max} turns/hour).` });
      }
      const payload = JSON.parse(await readBody(req));
      const out = isCall ? await handleGreeting(payload) : await handleTurn(payload);
      await track(isCall ? 'call_started' : 'turn', meta, {
        lang: out.lang, outcome: out.slots?.outcome, ms: out.timings?.total,
      });
      return send(200, out);
    }

    if (req.method === 'GET' && url.pathname === '/api/stats') {
      // Header, not query string — a secret in a URL is written to every access log.
      if (!process.env.STATS_TOKEN) return send(503, { error: 'STATS_TOKEN not set' });
      if (!tokenOk(req.headers['x-stats-token'])) return send(401, { error: 'unauthorized' });
      return send(200, await readStats());
    }

    if (req.method === 'GET' && url.pathname === '/api/speak') {
      try {
        const stream = await speechStream(decodeSpeech(url.searchParams.get('p')));
        res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
        await pipeline(Readable.fromWeb(stream), res);
      } catch (err) {
        console.error('✗ speak:', err.message);
        if (!res.headersSent) { res.writeHead(502); res.end('tts failed'); }
        else res.destroy();
      }
      return;
    }

    res.writeHead(404); res.end('Not found');
  } catch (err) {
    console.error('✗', err.message);
    send(500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`
  Meera is listening.

    →  http://localhost:${PORT}

  saaras:v3 · sarvam-105b-conversations · bulbul:v3

  Use headphones — without them her voice feeds back into the mic.
`);
});
