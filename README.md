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
npm start                   # Node 18+, zero dependencies
```

Open **http://localhost:3000**. A guided tour runs on first load (reopen it any time with
**guide**, top right).

### Walkthrough — you play the customer, she calls you

**Use headphones**, and allow the mic when the browser asks. Without headphones she hears her
own voice and interrupts herself.

1. **Press `call →` on Rajesh Sharma.** She greets him by name, with the right honorific.
2. **Hold the button** (or hold `Space`) and say *"Yes speaking, go ahead."* Release to send.
   The orb turns amber and swells while you talk, then pulses teal as she replies.
3. **Then try each of these** — the on-screen hint suggests them as you go:

| Say this | Watch for |
|---|---|
| *"I'm looking at it as an investment, somewhere near the airport, budget around one and a half crore."* | **Three checkpoint chips light at once** and she asks only about timeline — never re-asking what you just told her. This is the brief's hardest requirement. |
| *"Hindi mein baat kijiye."* | Switches language mid-call, **same voice**, no announcement. Works for Kannada, Tamil and 8 more. |
| *"What's the per square foot rate?"* | **₹7,700** — derived from the brief's own price band, so it can never contradict another number she quotes. |
| *"Honestly I only have about forty lakh."* | Stops qualifying **immediately**, two warm sentences, hangs up. No pitch to someone who can't buy. |
| *"Who gave you my number?"* | Offers to remove you from the list before you ask. Filed as **do-not-call**. |
| *"What flooring do the villas come with?"* | Corrects the premise — it's a **land sale**, there are no villas. (Public listings for this project wrongly say otherwise.) |

4. **She hangs up herself** once she's booked a callback or ruled you out — the call lands in
   the **mini CRM** on the right with its outcome, filled-slot dots and turn count.
5. **Press `export`** for the CRM as a spreadsheet.

Other controls: `ahem` / `cough` / `sneeze` arm a disfluency that lands *inside* her next
sentence; the voice picker is locked during a call and free between them.

## The stack

```
mic → Saaras v3 (STT, 23 langs, auto-detect) → sarvam-105b-conversations (+ system prompt)
    → Bulbul v3 (TTS, streamed MP3, tone-modulated) → speaker
```

Zero dependencies. Agent logic lives in `api/_agent.js`; `app/server.js` (local) and the
serverless functions in `api/` run identical code. Speech synthesis starts the instant the LLM
replies and streams to the browser, and is addressed by an encoded URL rather than server
state — so it works unchanged on serverless.

**Deploying:** any Node host runs `npm start`. On Vercel the `api/` functions and `public/`
static files are picked up automatically — set `SARVAM_API_KEY` in the project's environment
variables.

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
| `api/` | Agent core (`_agent.js`) + serverless handlers |
| `app/server.js` | Local dev server · `npm start` |
| `public/index.html` | The console UI |
| `app/test-flow2.mjs` | Slot-filling smoke test · `npm test` |
| `docs/01-knowledge-base.md` | Facts in four tiers — authoritative / corroborated / derived / **blocked** |
| `docs/02-system-prompt.md` | **The system prompt deliverable** — identity, sales craft, pronunciation dictionary, state machine, objection library, 12 edge-case protocols, language policy, structured output |
| `docs/03-conversation-flows.md` | Seven scripted test flows with pass/fail criteria |
| `docs/04-design-rationale.md` | Every decision and trade-off, incl. §11 — what we reversed and why |
| `docs/05-setup-guide.md` | Managed-platform path (kept as production reference / A-B benchmark) |
| `deliverables/` | System prompt as PDF |
| `site/` | Submission microsite |

## Running it publicly

The demo calls a metered API, so the deployed build protects itself:

| | |
|---|---|
| **Rate limit** | `RATE_LIMIT_PER_HOUR` turns per IP (default 40 ≈ 4 full calls). Returns 429 with an explanation, never a silent failure. |
| **Usage tracking** | Every call and turn logs `TRACK {...}` with IP, city/region/country (from Vercel's edge headers — no third-party lookup), language, outcome and latency. |
| **Dashboard** | Open `/stats.html` and enter `STATS_TOKEN`. Sent as an `x-stats-token` header and compared in constant time — never in the URL, where it would land in access logs and browser history. |
| **Storage** | None required. Logs-only by default. Set `UPSTASH_REDIS_REST_URL` / `_TOKEN` to get shared counters and a persisted 500-visit history. |

Geolocation resolves to **city level**; an IP does not yield a street address. The page
carries a short notice that usage is logged.

## Honest limitations

No live telephony (TRAI/DLT registration is days-to-weeks of paperwork; the brief permits a
web demo — design rationale §3). Turn latency is LLM-bound at ~4–6 s. No barge-in. Slot
inference is probabilistic. Chrome/Edge recommended (Safari's MediaRecorder lacks WebM).
