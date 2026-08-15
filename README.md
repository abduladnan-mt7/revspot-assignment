# Whispers of the Wind — Outbound AI Voice Agent

Assignment submission for **Revspot**.
An outbound voice agent ("Meera") that qualifies leads for DivyaSree Developers' *Whispers of the
Wind* villa-plot project in Nandi Valley, North Bengaluru.

**Submission page (preview):** https://claude.ai/code/artifact/b8566822-9390-4493-b885-b300a9600f9c

> This Claude-hosted copy is for **previewing during the build**. The version that actually gets
> submitted ships from Vercel alongside the live demo, so the page and the bot share one URL and
> nothing depends on a Claude login. See "To finish" below.

---

## What's here

| File | What it is |
|---|---|
| `docs/01-knowledge-base.md` | Every fact the agent may state, in four tiers — authoritative, corroborated, derived, and **blocked**. Plus the unknowns list and compliance notes. |
| `docs/02-system-prompt.md` | **The graded artifact.** Eleven sections: identity, hard rules, voice delivery, pronunciation dictionary, state machine with slot table, stage playbooks, objection library, twelve edge-case protocols, language policy, fact discipline, knowledge base, structured output. Export this to PDF. |
| `docs/03-conversation-flows.md` | Seven recording scripts with personas, expected behaviour, and pass/fail criteria. |
| `docs/04-design-rationale.md` | Decisions, trade-offs, limitations, and what I'd build next. |
| `docs/05-setup-guide.md` | Click-by-click Sarvam and ElevenLabs setup, with cost estimate and a smoke-test gate. |
| `site/index.html` | The submission microsite. |

---

## The short version

The brief's hardest requirement is one line in the technical section:

> *"avoid re-asking questions if the user provides info early"*

That rules out a script. A caller who says *"investment, near the airport, budget around one and a
half crore"* has just answered three of the four checkpoints in one breath — and a scripted bot
will then ask what it was told, which ends the call.

So the agent is a **slot-filling state machine**: four slots, fillable from anywhere in the
conversation, checked before every question. Six stages total — the brief's four checkpoints, then
the pitch (which branches on intent), then the CTA.

Two other decisions worth naming:

- **The knowledge base forbids as much as it permits.** Public listing data for this project is
  polluted — one source describes vitrified flooring for what is a *land sale*. On a
  RERA-registered development a hallucinated fact is the developer's exposure, so the agent may
  state nothing outside `01-knowledge-base.md`, and every gap converts into the CTA.
- **We built the outbound design, not the outbound paperwork.** Indian outbound needs DLT
  registration, header approval, KYC and DND scrubbing — days to weeks of waiting. The brief permits
  a shareable link or recordings, and the conversation is identical over either transport.

---

## Deliverables against the brief

| Required | Status |
|---|---|
| Working bot / demo link | Config ready — needs a Sarvam account to go live |
| ≥5 recorded conversation flows | **7 scripted**, ready to record |
| System prompt as PDF | Written — needs export |
| *Bonus:* edge cases | **12 protocols**, 6 of them recorded |
| *Bonus:* English + Hindi | Language policy written; Sarvam handles switching natively |
| *Bonus:* real project detail | Researched — 38 acres, 207 plots, RERA number, developer record |
| *Not required:* qualification scorecard | Hot/Warm/Lukewarm/Cold emitted per call |

---

## To finish

1. Create a **Sarvam** account at `indus.sarvam.ai` (₹1,000 free credits; this project costs under ₹300)
2. Follow `docs/05-setup-guide.md`
3. **Run the Flow 2 smoke test first** — if slot-filling fails, fix the prompt before recording anything
4. Record all seven flows, download from Monitor → Agent Analytics
5. Build the ElevenLabs benchmark, record flows 1 and 6
6. Export `02-system-prompt.md` to PDF
7. Fill the placeholders on the microsite: your name, demo link, recordings link, PDF link
