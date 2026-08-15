/**
 * Meera — outbound qualification voice agent for DivyaSree "Whispers of the Wind".
 *
 * Zero-dependency Node server. Node 18+ (native fetch / FormData / Blob).
 *   node app/server.js   →   http://localhost:3000
 *
 * One turn = Saaras v3 (STT) → sarvam-105b-conversations (LLM) → Bulbul v3 (TTS).
 * Per-stage latency is measured and returned, because turn time is most of how a
 * voice agent feels and we need to know where it goes.
 */

import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/* ── env ─────────────────────────────────────────────────────────────── */
function loadEnv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '').trim();
  }
}
loadEnv();

const KEY = process.env.SARVAM_API_KEY;
if (!KEY) {
  console.error('\n  ✗ SARVAM_API_KEY missing. Add it to .env at the project root.\n');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const API = 'https://api.sarvam.ai';
const LLM_MODEL = 'sarvam-105b-conversations';
const STT_MODEL = 'saaras:v3';
const TTS_MODEL = 'bulbul:v3';

/* ── system prompt ───────────────────────────────────────────────────── */
/**
 * Delivered as its own system message immediately before the user turn, not appended
 * to the 14K-character prompt. Recency matters: buried at the end of a long prompt the
 * model ignored this instruction entirely and returned no slot line at all.
 */
const SLOT_PROTOCOL = `YOUR JOB THIS TURN — read this first, it outranks everything below it.

You are a closer doing TRIAGE. The four checkpoints (intent, geography, budget, timeline)
decide everything: a buyer gets your full warmth and a booked callback; a non-buyer gets a
fast, graceful release. Time spent on a non-buyer is time stolen from a buyer — and time
wasted for the non-buyer too. Respect both.

EVERY TURN MUST DO ONE OF THESE THREE THINGS, OR IT IS A WASTED TURN:
  1. FILL — move at least one empty checkpoint toward an answer.
  2. HANDLE — deal with an objection or a question they raised, then steer back.
  3. CLOSE — pitch and lock the Property Expert callback, or exit cleanly.
Rapport is carried INSIDE these moves (a warm reaction, then the question) — never as a
separate chat turn. If your draft reply does none of the three, throw it away.

PACE — the whole call is 2–3 minutes:
  - All four checkpoints inside FIVE caller turns. Pair two related questions to get there.
  - They volunteered several answers at once? Bank them all, jump to the first real gap.
  - Three checkpoints positive and they sound engaged? Stop qualifying on style points —
    trial close now: "sounds like this could fit — worth a proper look?"
  - All four positive? Pitch (two sentences, one vivid image + one hard fact) and close in
    the SAME breath: "would Saturday morning suit, or is Sunday easier?" Confirm it back.
  - Any blocker (budget no / timeline blocker / geography blocker / intent blocker)?
    Qualification is OVER. No more questions, no pitch, no callback ask. Two warm sentences:
    thank them for being straight, TELL them (never ask) "I'll keep you posted when we
    launch something closer", and end. The exit must leave them liking DivyaSree.

ENDING THE CALL — the system disconnects the line the moment your outcome is anything other
than in_progress. Therefore a final outcome may ONLY appear on a turn whose spoken reply is
the goodbye itself — never on a turn that asks a question.
  - They accept a callback slot → your VERY NEXT reply is the goodbye: confirm it back,
    thank them, warm bye ("Perfect — Saturday around eleven then. Thank you Mr. Sharma,
    have a lovely day."), with outcome=callback_booked and the final temperature set.
  - A release (blocker, not interested, wrong number, DNC) → the two warm exit sentences
    ARE the goodbye: set the final outcome and temperature on that same turn.
  - Nothing after the goodbye. The line cuts when you finish speaking.

HOW YOU SPEAK — two sentences maximum, count your full stops before answering:
  - Contractions always. React to what they actually said first, briefly, then advance.
  - At most one small filler per turn: so · actually · look · honestly · fair enough · na ·
    achha · haan · toh · ji. Never write laughter — "haha" is read aloud and sounds fake.
  - Open questions over checkboxes. Never recite feature lists — one image + one fact.
  - NEVER ask anything already asked or answered, in any wording. They dodged it? Leave the
    slot null and move on. Never re-introduce yourself or the project once they engage.
  - Never narrate your own behaviour ("let me explain", "I'll switch to Hindi", announcing
    a question). Do the thing. Asked for Hindi → next sentence IS Hindi, no acknowledgement.
  - Never hand them an exit ("is this a good time?" / "shall I call back?"). Permission is
    asked once, as an easy yes: "just twenty seconds — can I quickly tell you?" If they push
    back, ONE warm retry, then honour the answer. If they name a callback time, take it.

SCRIPT — LATIN ONLY. Never Devanagari or any non-Latin script, in any language. Hindi is
written the way Indians text: "Achha ji, toh ye investment ke liye dekh rahe hain?" Keep in
English: DivyaSree, Whispers of the Wind, RERA, square feet, investment, Property Expert,
plot, booking. Keep lakh, crore, and place names as they are.

OUTPUT FORMAT — exactly two parts, always:
1. Your spoken reply. One or two sentences, plain prose.
2. New line, then the literal token ###SLOTS### followed by one line of JSON.

Example:
Achha, that helps. And how well do you know the Nandi Hills side?
###SLOTS### {"intent":"investment","geography":null,"budget_fit":"yes","timeline":null,"stage":"S2","temperature":null,"outcome":"in_progress","tone":"warm"}

All eight keys, every time. Fill a slot the moment the caller reveals it, even unasked.
null for anything not yet known — never guess a slot to fill it.
  intent      self_use | investment | both | unclear | blocker | null
  geography   comfortable | hesitant | blocker | null
  budget_fit  yes | stretch | no | declined_to_say | null
  timeline    comfortable | hesitant | blocker | null
  stage       S0–S7
  temperature null until the call ends, then hot | warm | lukewarm | cold | suppress
  outcome     in_progress while the call continues · final values (these DISCONNECT the
              line): callback_booked | disqualified_budget | disqualified_timeline |
              disqualified_location | disqualified_intent | not_interested |
              callback_later | wrong_number | dnc | hostile_exit
  tone        how your voice is synthesised THIS turn — pick honestly:
              warm (default, rapport) · brisk (they're busy, be efficient) ·
              gentle (money, rejection, hesitation) · serious (price, dates, RERA) ·
              upbeat (pitch and close, when they lean in)

Part 2 is stripped before speech. Never speak it or mention it. A reply without ###SLOTS###
is malformed.`;

const promptPath = join(ROOT, 'docs', '02-system-prompt.md');
if (!existsSync(promptPath)) {
  console.error(`\n  ✗ System prompt not found at ${promptPath}\n`);
  process.exit(1);
}
const SYSTEM_PROMPT = readFileSync(promptPath, 'utf8');

/* ── Sarvam calls ────────────────────────────────────────────────────── */

async function transcribe(audioBuf, mime) {
  // Safety net: the STT endpoint rejects any Content-Type carrying a codecs
  // parameter (e.g. "audio/webm;codecs=opus"), and rejects webm outright.
  // The client transcodes to 16 kHz mono WAV, so anything else is a bug upstream.
  const clean = (mime || 'audio/wav').split(';')[0].trim();
  const type = clean === 'audio/wav' || clean === 'audio/mpeg' || clean === 'audio/mp3'
    ? clean : 'audio/wav';
  const ext = type === 'audio/wav' ? 'wav' : 'mp3';

  const fd = new FormData();
  fd.append('file', new Blob([audioBuf], { type }), `turn.${ext}`);
  fd.append('model', STT_MODEL);
  fd.append('language_code', 'unknown');   // auto-detect → this is the EN/HI switching
  fd.append('mode', 'transcribe');

  const r = await fetch(`${API}/speech-to-text`, {
    method: 'POST',
    headers: { 'api-subscription-key': KEY },
    body: fd,
  });
  if (!r.ok) throw new Error(`STT ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

async function chat(messages) {
  const r = await fetch(`${API}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'api-subscription-key': KEY,
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      temperature: 0.4,
      max_tokens: 300,          // turns are 1–2 sentences; this is a hard ceiling on rambling
      reasoning_effort: 'low',  // voice needs speed over deliberation
    }),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? '';
}

/**
 * Streaming TTS.
 *
 * The blocking /text-to-speech endpoint returns one base64 blob and cost 5–8s per turn —
 * the single largest component of a ~11s turn. /text-to-speech/stream returns raw binary
 * over a chunked HTTP response, so we proxy it straight to an <audio> element and the
 * browser starts playing on the first bytes. Perceived latency becomes time-to-first-sound
 * rather than time-to-complete-file.
 *
 * The reply text is parked here under a short id so the client can request it with a GET
 * (needed by <audio src>) without putting the text in a URL.
 */
/**
 * Language following across the Indic set.
 *
 * Saaras detects 23 languages; bulbul:v3 can speak 11. Anything detected outside Bulbul's
 * range falls back to Indian English rather than failing. The `speaker` is never changed —
 * a Bulbul voice speaks every supported language, so Meera keeps one identity throughout
 * instead of becoming a different person per language.
 *
 * Switching is driven by Saaras' own confidence rather than a turn counter: a single
 * borrowed word inside an English sentence comes back low-probability and is ignored, while
 * a genuine switch comes back high and takes effect on the very next turn.
 */
const SPEAKABLE = new Set([
  'en-IN', 'hi-IN', 'kn-IN', 'ta-IN', 'te-IN', 'ml-IN',
  'mr-IN', 'bn-IN', 'gu-IN', 'pa-IN', 'od-IN',
]);
const LANG_NAME = {
  'en-IN': 'English',  'hi-IN': 'Hindi',    'kn-IN': 'Kannada', 'ta-IN': 'Tamil',
  'te-IN': 'Telugu',   'ml-IN': 'Malayalam','mr-IN': 'Marathi', 'bn-IN': 'Bengali',
  'gu-IN': 'Gujarati', 'pa-IN': 'Punjabi',  'od-IN': 'Odia',
};
const SWITCH_CONFIDENCE = 0.35;

/**
 * An explicit request beats detection every time.
 *
 * The common failure: someone says "can you speak in Hindi" — in English. Saaras correctly
 * reports en-IN with high confidence, detection-only logic keeps English, and the caller has
 * to ask twice. Matched in both Latin and native scripts, since Saaras transcribes Hindi in
 * Devanagari even though we always reply in Latin.
 */
const LANG_REQUEST = [
  ['hi-IN', /\b(hindi)\b|हिंदी|हिन्दी/i],
  ['kn-IN', /\b(kannada)\b|ಕನ್ನಡ/i],
  ['ta-IN', /\b(tamil)\b|தமிழ்/i],
  ['te-IN', /\b(telugu)\b|తెలుగు/i],
  ['ml-IN', /\b(malayalam)\b|മലയാളം/i],
  ['mr-IN', /\b(marathi)\b|मराठी/i],
  ['bn-IN', /\b(bengali|bangla)\b|বাংলা/i],
  ['gu-IN', /\b(gujarati)\b|ગુજરાતી/i],
  ['pa-IN', /\b(punjabi)\b|ਪੰਜਾਬੀ/i],
  ['en-IN', /\b(english|angrezi)\b|अंग्रेज़ी|अंग्रेजी/i],
];

function requestedLanguage(transcript) {
  if (!transcript) return null;
  // only treat it as a request when it sits near switching language
  if (!/\b(speak|talk|bol|bolo|boliye|bolie|baat|mein|me|m|in|switch|kar|kijiye|karo)\b|में|मे/i.test(transcript)
      && !/^\s*(hindi|kannada|tamil|telugu|english)\s*[.?!]?\s*$/i.test(transcript)) return null;
  for (const [code, re] of LANG_REQUEST) if (re.test(transcript)) return code;
  return null;
}

function pickLanguage(detected, probability, previous, transcript) {
  const prev = SPEAKABLE.has(previous) ? previous : 'en-IN';

  const asked = requestedLanguage(transcript);
  if (asked && SPEAKABLE.has(asked)) return asked;      // explicit beats detected

  if (!detected || !SPEAKABLE.has(detected)) return prev;
  if (detected === prev) return prev;
  // a stray borrowed word scores low; a real switch scores high
  if (probability != null && probability < SWITCH_CONFIDENCE) return prev;
  return detected;
}

const pendingSpeech = new Map();

/**
 * Real prosody modulation. bulbul:v3 exposes `pace` and `temperature` per request
 * (pitch/loudness are v2-only), so the agent picks a tone each turn and it is mapped to
 * actual synthesis parameters — not to word choice. Slower and flatter when delivering a
 * rejection; quicker and livelier on the close.
 */
const TONE = {
  warm:    { pace: 1.12, temperature: 0.75 },
  brisk:   { pace: 1.28, temperature: 0.50 },
  gentle:  { pace: 1.00, temperature: 0.45 },
  serious: { pace: 1.05, temperature: 0.35 },
  upbeat:  { pace: 1.18, temperature: 0.85 },
};

function parkSpeech(text, lang, speaker, tone = 'warm') {
  const id = randomUUID();
  pendingSpeech.set(id, { text, lang, speaker, tone, at: Date.now() });
  // opportunistic sweep — this is a demo, not a fleet
  if (pendingSpeech.size > 64) {
    const cutoff = Date.now() - 5 * 60_000;
    for (const [k, v] of pendingSpeech) if (v.at < cutoff) pendingSpeech.delete(k);
  }
  return id;
}

async function speechStream({ text, lang, speaker, tone }) {
  const prosody = TONE[tone] || TONE.warm;
  const r = await fetch(`${API}/text-to-speech/stream`, {
    method: 'POST',
    headers: { 'api-subscription-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text.slice(0, 3400),           // stream endpoint caps at 3500
      language_code: lang,
      model: TTS_MODEL,
      speaker,
      ...prosody,                          // pace + temperature, chosen per turn
      output_audio_codec: 'mp3',
      output_audio_bitrate: '64k',         // plenty for speech; smaller = sooner
    }),
  });
  if (!r.ok) throw new Error(`TTS ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.body;
}

/* ── slot line: strip before speaking, parse for the panel ───────────── */
function splitSlots(raw) {
  const i = raw.indexOf('###SLOTS###');
  if (i === -1) return { spoken: raw.trim(), slots: null };
  const spoken = raw.slice(0, i).trim();
  const tail = raw.slice(i + '###SLOTS###'.length).trim();
  const start = tail.indexOf('{');
  const end = tail.lastIndexOf('}');
  let slots = null;
  if (start !== -1 && end > start) {
    try { slots = JSON.parse(tail.slice(start, end + 1)); } catch { /* keep null */ }
  }
  return { spoken, slots };
}

/* ── one turn ────────────────────────────────────────────────────────── */
async function handleTurn(body) {
  const t = {};
  const t0 = Date.now();

  const audio = Buffer.from(body.audio, 'base64');
  const stt = await transcribe(audio, body.mime || 'audio/webm');
  t.stt = Date.now() - t0;

  const transcript = (stt.transcript || '').trim();
  const detected = stt.language_code || 'en-IN';
  if (!transcript) {
    return { empty: true, transcript: '', detected, timings: t };
  }

  const history = Array.isArray(body.history) ? body.history : [];

  // Belt and braces on the hardest requirement. The model can re-derive slot state
  // from the transcript, but restating it immediately before the new turn makes
  // "don't re-ask" a fact in front of it rather than an inference behind it.
  const known = body.slots && Object.values(body.slots).some(Boolean)
    ? `\n\nALREADY KNOWN — do NOT ask about any of these again:\n${JSON.stringify(body.slots)}\n` +
      `Ask only about slots that are still null. Once all four are filled, move to the pitch.`
    : '';

  // A hard blocker ends qualification. Continuing to ask about timeline after someone
  // has said the price is out of reach wastes their time and makes the exit worse —
  // enforced here rather than left to the model, since the signal is already known.
  const blocked =
    body.slots?.budget_fit === 'no'      ? 'budget'   :
    body.slots?.timeline  === 'blocker'  ? 'timeline' :
    body.slots?.geography === 'blocker'  ? 'location' :
    body.slots?.intent    === 'blocker'  ? 'intent'   : null;

  const blockRule = blocked ? `

#### QUALIFICATION IS OVER — THIS CALL IS DISQUALIFIED ON ${blocked.toUpperCase()} ####
They are not a buyer for this project. STOP QUALIFYING IMMEDIATELY.
  - Do NOT ask about timeline, location, intent, or anything else. No more questions.
  - Do NOT pitch the project. Do NOT ask for a callback with the Property Expert.
  - Do NOT ask "may I keep your details?" or "should I save your number?" — never ask
    permission for something that costs them nothing. TELL them instead, warmly:
    "I'll keep you posted when we launch something closer to that range."
  - Frame it as the project's constraint, never their capacity: "this one starts a bit
    above that" — never "this may not be the right fit for you".
Close the call in TWO sentences: thank them for being straight, tell them you'll be in touch
about future launches, and end. Do not linger — lingering after a no is what makes it sting.
Set outcome to "disqualified_${blocked}", temperature to "cold".` : '';

  // Hindi conjugates for the listener's gender — "aap dekh rahe hain" (m) vs "aap dekh rahi
  // hain" (f). Getting it wrong is immediately jarring to a native speaker, and the model
  // will not reliably infer it from a name. Carried explicitly from the lead record.
  const g = body.gender === 'female' ? 'female' : body.gender === 'male' ? 'male' : null;
  const genderRule = !g ? '' : g === 'male' ? `

THE CALLER IS MALE. Use masculine agreement in Hindi, without exception:
  ✅ "aap dekh rahe hain" · "aapne socha tha" · "aap rehte hain" · "aap chahenge"
  ❌ "aap dekh rahi hain" · "aapne sochi thi" · "aap rehti hain"
Address him as "sir" or "ji" — never "ma'am". In English use "Mr." with the surname.` : `

THE CALLER IS FEMALE. Use feminine agreement in Hindi, without exception:
  ✅ "aap dekh rahi hain" · "aapne socha tha" · "aap rehti hain" · "aap chahengi"
  ❌ "aap dekh rahe hain" · "aap rehte hain"
Address her as "ma'am" or "ji" — never "sir". In English use "Ms." with the surname.`;

  // She kept re-asking permission ("kya main aapko bata sakti hoon?") in slightly different
  // words, because nothing told her the introduction was over. Once the caller has taken two
  // turns they are plainly engaged — state that as a fact rather than letting S0 re-fire.
  const userTurns = history.filter((m) => m.role === 'user').length;
  const pastIntro = userTurns >= 2
    ? `\n\nTHE INTRODUCTION IS OVER. They are engaged and talking to you. Permission is already ` +
      `granted — NEVER ask for it again in any wording ("is this a good time", "can I quickly ` +
      `tell you", "kya main bata sakti hoon", "do you have a minute"). Never re-introduce ` +
      `yourself or the project. Go straight to the next unfilled checkpoint, or to the pitch ` +
      `if all four are filled.`
    : '';

  // Language following was unreliable when left to the model to notice. Saaras already
  // tells us what was spoken and how confidently, so state it as a fact.
  const lang = pickLanguage(detected, stt.language_probability, body.lang, transcript);
  const langName = LANG_NAME[lang] || 'English';
  console.log(
    `  lang: detected=${detected} p=${stt.language_probability ?? '—'} ` +
    `prev=${body.lang || 'en-IN'} → ${lang}`
  );
  const langRule = lang === 'en-IN'
    ? `\n\nSpeak English (Indian English) this turn.`
    : `\n\nSPEAK ${langName.toUpperCase()} THIS TURN — mixed naturally with English the way ` +
      `people actually speak it, and written in LATIN SCRIPT ONLY. Never use Devanagari, ` +
      `Kannada, Tamil or any other non-Latin script. Do not reply in English. Do not announce ` +
      `the switch — just speak. Keep proper nouns in English: DivyaSree, Whispers of the Wind, ` +
      `RERA, square feet, investment, Property Expert. Keep lakh, crore and place names as-is.`;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'system',
      content: SLOT_PROTOCOL + known + genderRule + pastIntro + blockRule + langRule +
               interjectRule(body.interject) },
    { role: 'user', content: transcript },
  ];

  const t1 = Date.now();
  const raw = await chat(messages);
  t.llm = Date.now() - t1;

  const { spoken, slots } = splitSlots(raw);

  // TTS is no longer awaited here — the client fetches it as a stream, so the text
  // and the slot panel land as soon as the LLM returns. Voice stays constant across
  // languages; only language_code changes.
  const speechId = spoken
    ? parkSpeech(spoken, lang, body.speaker || 'shreya', slots?.tone)
    : null;
  t.total = Date.now() - t0;

  return {
    transcript, reply: spoken, speechId, slots, timings: t,
    detected, lang, langName,
    confidence: stt.language_probability ?? null,
    tone: slots?.tone || 'warm',
  };
}

/* ── greeting (no mic input — opens the call) ────────────────────────── */
async function handleGreeting(body) {
  // Beat one only. Greeting + name check — no company pitch, no project name yet.
  // The intro and the reason for calling land on the next two turns (§4.1).
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const who = (body.name || '').trim();
  // Honorific from the lead record — guessing it from a name gets it wrong often enough
  // to matter on the very first sentence of the call.
  const title = body.gender === 'female' ? 'Ms.' : body.gender === 'male' ? 'Mr.' : '';
  const surname = who.split(/\s+/).slice(-1)[0];
  const addressed = title && surname ? `${title} ${surname}` : who;
  const text = body.greeting ||
    (addressed ? `Hi, good ${part}! Am I speaking with ${addressed}?`
               : `Hi, good ${part}! Am I speaking with the right person?`);
  return {
    reply: text,
    speechId: parkSpeech(text, 'en-IN', body.speaker || 'shreya'),
    lang: 'en-IN',
  };
}

/* ── interjections ───────────────────────────────────────────────────────
   Deliberate disfluency. Real people on real calls clear their throat and
   apologise for it — a small imperfection reads as more human than a flawless
   delivery. Synthesised from text, so how convincing these are is an open
   question; kept as manual triggers precisely so they can be judged by ear.  */
const INTERJECTIONS = {
  ahem:   { insert: '— ahem, sorry —',            what: 'clear your throat' },
  cough:  { insert: '— ahem, ahem, excuse me —',  what: 'cough' },
  sneeze: { insert: '— achoo! sorry —',           what: 'sneeze' },
};

/**
 * An abstract instruction ("interrupt yourself mid-sentence") was ignored outright.
 * Giving the exact string to insert, plus a worked before/after, works reliably —
 * the model is much better at placing a literal token than at improvising a behaviour.
 */
function interjectRule(kind) {
  const it = INTERJECTIONS[kind];
  if (!it) return '';
  return `\n\n#### MANDATORY THIS TURN — YOU MUST ${it.what.toUpperCase()} MID-SENTENCE ####
Insert this exact text, word for word, INSIDE one of your sentences:  ${it.insert}

It must sit between two halves of a sentence — never at the very start, never at the very end,
never as a sentence of its own. Then carry on as if nothing happened. Do not mention it again.

WRONG:  Ahem, excuse me. It's about twenty minutes from the airport.
RIGHT:  It's about twenty minutes from the airport ${it.insert} and the density is unusually low.

This is not optional. Your reply is malformed if it does not contain ${it.insert}`;
}

/* ── http ────────────────────────────────────────────────────────────── */
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
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      const html = readFileSync(join(__dirname, 'public', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    if (req.method === 'POST' && req.url === '/api/turn') {
      const body = JSON.parse(await readBody(req));
      return send(200, await handleTurn(body));
    }

    if (req.method === 'POST' && req.url === '/api/greeting') {
      const body = JSON.parse(await readBody(req));
      return send(200, await handleGreeting(body));
    }

    if (req.method === 'GET' && req.url.startsWith('/api/speak')) {
      const id = new URL(req.url, 'http://x').searchParams.get('id');
      const item = pendingSpeech.get(id);
      if (!item) { res.writeHead(404); return res.end('expired'); }

      const stream = await speechStream(item);
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      });
      // pipe Sarvam's chunked audio straight through to the browser
      Readable.fromWeb(stream).pipe(res);
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

  models   ${STT_MODEL} · ${LLM_MODEL} · ${TTS_MODEL}
  prompt   docs/02-system-prompt.md  (${SYSTEM_PROMPT.length.toLocaleString()} chars)

  Use headphones — without them her voice feeds back into the mic.
`);
});
