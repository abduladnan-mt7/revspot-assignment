# Sarvam API — Confirmed Facts (handoff note)

Written 2026-08-15. Everything here is **verified**, not remembered. Do not re-research it.

---

## Auth — verified working

```
Base URL:  https://api.sarvam.ai
Header:    api-subscription-key: <SARVAM_API_KEY>
Alt:       Authorization: Bearer <SARVAM_API_KEY>   (OpenAI-compatible tooling)
```

Key lives in `.env` as `SARVAM_API_KEY`. **Verified live** — `POST /translate` returned `HTTP 200`
on 2026-08-15. Only one key type exists; org-level keys not yet supported.

> **Rotate this key** in the Sarvam dashboard once the project ships — it was pasted into a chat
> transcript in plaintext.

---

## Endpoint index — confirmed URLs

| Purpose | Docs URL (append nothing — these are the `.md` sources) |
|---|---|
| **STT — REST** | `https://docs.sarvam.ai/api-reference/speech-to-text/transcribe.md` |
| **STT — realtime WebSocket** | `https://docs.sarvam.ai/api-reference/speech-to-text/transcribe/realtime/ws.md` |
| STT — batch (initiate/upload/start/status/download) | `https://docs.sarvam.ai/api-reference/speech-to-text/stt/job/*.md` |
| **TTS — REST** | `https://docs.sarvam.ai/api-reference/text-to-speech/convert.md` |
| **TTS — REST stream** | `https://docs.sarvam.ai/api-reference/text-to-speech/convert-stream.md` |
| **TTS — WebSocket** | `https://docs.sarvam.ai/api-reference/text-to-speech/stream.md` |
| **Chat completions** | `https://docs.sarvam.ai/api-reference/chat/chat-completions.md` |
| Chat — open-source models | `https://docs.sarvam.ai/api-reference/open-source/chat-completions.md` |
| Auth | `https://docs.sarvam.ai/api-reference/authentication.md` |
| **Full OpenAPI spec** | `https://docs.sarvam.ai/openapi.json` |

**Next session: fetch the three starred rows first** (STT REST, TTS stream, chat completions) to get
exact request/response field names. Do not guess payload shapes.

Docs convention: append `.md` to any docs URL for markdown, or `/llms.txt` for a page-level index.

---

## Models

| Role | Model | Notes |
|---|---|---|
| STT | **Saaras v3** | 23 languages, code-mixing (Hinglish), diarization, timestamps |
| TTS | **Bulbul v3** | 39 voices, 11 Indian languages, native Indic pronunciation |
| LLM | **Sarvam-105B** | 128K context, tuned for Indic reasoning |

## Pricing (published)

| Item | Rate |
|---|---|
| Speech-to-text | ₹30 / hour |
| Text-to-speech | ₹15–30 / 10K chars |
| Chat — input | ₹29.28 / 1M tokens |
| Chat — cached input | ₹10.98 / 1M tokens |
| Chat — output | ₹73.20 / 1M tokens |

₹1,000 free credits on the account. **This project estimated under ₹300.**

---

## Architecture decision — build our own, don't use the dashboard

**Why the change.** Sarvam's dashboard agent builder (`indus.sarvam.ai/samvaad`) has **no agent
creation API** — config is dashboard-only. More importantly, its test panel sits **behind Sarvam's
login**, so it does **not** satisfy the brief's *"shareable link to the working bot."* That route
silently downgrades the submission to recordings-only.

**The plan instead:**

```
Browser  ── mic audio ──▶  /api/turn  (server-side, holds the key)
                              ├─▶  POST /speech-to-text        (Saaras v3)
                              ├─▶  POST /v1/chat/completions   (Sarvam-105B + system prompt)
                              └─▶  POST /text-to-speech        (Bulbul v3)
         ◀── {transcript, reply, audio, slots, temperature} ──┘
```

Deployed on Vercel → the URL **is** deliverable #1.

**The differentiator this unlocks:** render the **slot table filling in real time** beside the
conversation. The brief's hardest requirement is "don't re-ask what was already answered" — a demo
that *visibly shows* three slots filling from one caller sentence proves it in a way no recording
can. No other entrant will have this.

**The risk, stated plainly:** a naive STT→LLM→TTS loop runs 2–4s per turn versus ~800ms on a managed
platform, and latency is most of how a voice agent *feels*. Mitigations, in order: TTS streaming
(`convert-stream` or the WebSocket), realtime STT over WebSocket rather than REST, and keeping the
system prompt cached. **Measure per-stage latency early** — if it can't get under ~1.5s, fall back
to the dashboard agent for the recordings and keep the web app as the visualiser.
