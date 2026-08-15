/**
 * Smoke test for the hardest requirement in the brief.
 *
 * Synthesises the front-loaded caller line with Bulbul, feeds it through the live
 * /api/turn chain, and checks whether Meera re-asks something already answered.
 *
 *   node app/test-flow2.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '').trim();
}
const KEY = process.env.SARVAM_API_KEY;

const CALLER =
  "Yeah, I saw the ad. I'm looking at it as an investment, somewhere near the airport is ideal, " +
  "and my budget is around one and a half crore.";

console.log('\n  Synthesising the caller turn…');
const ttsRes = await fetch('https://api.sarvam.ai/text-to-speech', {
  method: 'POST',
  headers: { 'api-subscription-key': KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: CALLER, language_code: 'en-IN', model: 'bulbul:v3',
    speaker: 'kabir', pace: 1.0, output_audio_codec: 'wav', speech_sample_rate: '24000',
  }),
});
if (!ttsRes.ok) { console.error('  ✗ TTS failed:', await ttsRes.text()); process.exit(1); }
const audio = (await ttsRes.json()).audios[0];
console.log('  ✓ caller audio ready\n');

console.log('  Caller says:');
console.log(`    "${CALLER}"\n`);

const turn = await fetch('http://localhost:3000/api/turn', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    audio, mime: 'audio/wav', speaker: 'priya',
    history: [{
      role: 'assistant',
      content: 'Good morning! This is Meera calling from DivyaSree Developers. Am I speaking with Mr. Mehta?',
    }],
    slots: { intent: null, geography: null, budget_fit: null, timeline: null },
  }),
});
const j = await turn.json();
if (j.error) { console.error('  ✗', j.error); process.exit(1); }

console.log('  Heard      :', j.transcript);
console.log('  Language   :', j.detected);
console.log('\n  Meera says :');
console.log(`    "${j.reply}"\n`);
console.log('  Slots      :', JSON.stringify(j.slots));
console.log('  Latency    :', `stt ${j.timings.stt}ms · llm ${j.timings.llm}ms · total ${j.timings.total}ms (tts streams separately)`);

/* ── the actual assertion ─────────────────────────────────────────── */
const r = (j.reply || '').toLowerCase();
const violations = [];
// Each detector matches the QUESTION being asked again — not the topic word appearing
// inside an acknowledgement ("that's why investors look here" is banking, not asking).
if (/(self[- ]use or investment|investment or self|for yourself,? or (more of )?an? investment|weekend home,? or (more of )?an? investment|what('s| is) drawing you)/.test(r))
  violations.push('re-asked INTENT');
if (/(how (do you feel about|well do you know)|are you comfortable with).*(nandi|devanahalli|side|corridor|location)/.test(r))
  violations.push('re-asked GEOGRAPHY');
// Match asking ABOUT budget, not merely saying the word while acknowledging it
if (/(does that range (work|sit)|sit comfortably|what did you have in mind|hoping to land|what('| i)s your budget)/.test(r))
  violations.push('re-asked BUDGET');

const filled = j.slots ? ['intent','geography','budget_fit'].filter(k => j.slots[k]) : [];

console.log('\n  ─────────────────────────────────────────────');
console.log(`  Slots filled from one sentence: ${filled.length}/3  ${filled.join(', ')}`);
if (violations.length) {
  console.log(`  ✗ FAIL — ${violations.join('; ')}`);
  console.log('  The prompt needs work before recording anything.\n');
  process.exit(1);
}
console.log('  ✓ PASS — no already-answered question was re-asked.');
console.log(/timeline|december|2029|possession|horizon/.test(r)
  ? '  ✓ Correctly moved to the only empty slot: TIMELINE.\n'
  : '  ~ Did not ask about timeline — check the reply above is sensible.\n');
