# Meera — AI Voice Agent for DivyaSree "Whispers of the Wind"

Submission for the Revspot open assignment: an **outbound AI voice agent** that qualifies
leads for DivyaSree Developers' *Whispers of the Wind* villa-plot project (Nandi Valley,
North Bengaluru) in a 2–3 minute call — four checkpoints, branched pitch, Property Expert
CTA — then emits a structured lead record.

Built as a working **outbound campaign console**: a lead queue on the left, the live call in
the centre, a mini CRM on the right that fills as calls complete, with CSV export.

---

## Run it

```bash
git clone https://github.com/abduladnan-mt7/revspot-assignment
cd revspot-assignment
cp .env.example .env        # add your Sarvam API key (₹1,000 free at dashboard.sarvam.ai)
node app/server.js          # Node 18+, zero dependencies
```

Open **http://localhost:3000**, use headphones, pick a lead, hit **call →**.
Hold the button (or Space) to speak; release to send. The call disconnects itself when
Meera closes or disqualifies.

## The stack

```
mic → Saaras v3 (STT, 23 langs, auto-detect) → sarvam-105b-conversations (+ system prompt)
    → Bulbul v3 (TTS, streamed MP3, tone-modulated) → speaker
```

Zero-dependency Node server (`app/server.js`), single-file client (`app/public/index.html`).
Speech synthesis starts the instant the LLM replies and streams to the browser — first audio
byte in ~30 ms from request.

## What it does beyond the brief

| Capability | How |
|---|---|
| **No re-asking** (the brief's hardest line) | Slot-filling state machine; slots fill from anywhere, server restates known state each turn |
| Fast triage | Buyers closed in ~4 caller turns; any hard blocker (budget/location/timeline/intent) triggers a warm 2-sentence release — enforced in code, not model judgment |
| English + Hindi + 9 more Indic languages | Detection-confidence gated switching, explicit-request override with negation handling ("I don't speak Hindi" ≠ a request), one voice throughout |
| Real prosody modulation | Model picks a tone per turn (warm/brisk/gentle/serious/upbeat) → mapped to actual Bulbul pace/temperature parameters |
| Listener-gender agreement | Hindi conjugates for the listener; gender travels on the lead record, never guessed from a name |
| Fact discipline | Four-tier knowledge base incl. an explicit **blocked-claims list** (public listing data for this project is polluted); every unknown deflects into the CTA |
| Auto-disconnect | Final outcome only on the goodbye turn; the line cuts when she finishes speaking |
| Mini CRM | Every call logged — hot/warm/lukewarm/cold, part-qualified, unattended, do-not-call — with slot dots, turn count, CSV export |

## Repository map

| Path | What |
|---|---|
| `app/` | The working demo (server, client, smoke test `node app/test-flow2.mjs`) |
| `docs/01-knowledge-base.md` | Facts in four tiers — authoritative / corroborated / derived / **blocked** |
| `docs/02-system-prompt.md` | **The system prompt deliverable** — identity, sales craft, pronunciation dictionary, state machine, objection library, 12 edge-case protocols, language policy, structured output |
| `docs/03-conversation-flows.md` | Seven scripted test flows with pass/fail criteria |
| `docs/04-design-rationale.md` | Every decision and trade-off, incl. §11 — what we reversed and why |
| `docs/05-setup-guide.md` | Managed-platform path (kept as production reference / A-B benchmark) |
| `deliverables/` | System prompt as PDF |
| `site/` | Submission microsite |

## Honest limitations

No live telephony (TRAI/DLT registration is days-to-weeks of paperwork; the brief permits a
web demo — design rationale §3). Turn latency is LLM-bound at ~4–6 s. No barge-in. Slot
inference is probabilistic. Chrome/Edge recommended (Safari's MediaRecorder lacks WebM).
