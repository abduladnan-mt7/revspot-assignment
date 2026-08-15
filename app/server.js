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

    if (req.method === 'POST' && url.pathname === '/api/turn') {
      return send(200, await handleTurn(JSON.parse(await readBody(req))));
    }

    if (req.method === 'POST' && url.pathname === '/api/greeting') {
      return send(200, await handleGreeting(JSON.parse(await readBody(req))));
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
