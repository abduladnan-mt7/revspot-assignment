# Design Rationale — Decisions, Trade-offs, and What I Deliberately Did Not Build

Every decision below could have gone the other way. This document records what I chose, what I gave
up, and why. Where I'm uncertain, I say so.

---

## 1. Reading the brief

Three things in the brief shaped everything downstream.

**"Avoid re-asking questions if the user provides info early."** Buried in the technical
requirements, this is the hardest thing in the document. It rules out a linear script and forces a
slot-filling state machine. Everything about the architecture follows from this one line.

**"Source Budget: Fitment check for the ₹92.4 lakh+ starting price."** The word is *fitment*, not
*budget discovery*. You do not ask a CXO what their budget is — it's crude and it costs you the
frame. You state the range and let them react. Same information, and the relationship survives.

**The pitch comes after qualification.** The stage ordering is explicit. Qualify first, then pitch —
which only pays off if the pitch actually *uses* what you learned. So the pitch branches on intent
(§6.4). Without the branch, the four checkpoints are just a survey.

**One interpretation call:** the brief lists *"Qualification (The 4 Checkpoints)"* and nests six
items under it, the last two being The Pitch and CTA. Those aren't checkpoints. I implemented four
checkpoints followed by two stages — preserving both the stated count and the stated flow. Noted in
Appendix A of the prompt rather than resolved silently.

---

## 2. Platform: Sarvam primary, ElevenLabs benchmark

**The candidates**

| | Sarvam | ElevenLabs | Self-built (LiveKit/Pipecat) |
|---|---|---|---|
| English voice quality | Good | **Best in class** | Depends on chosen TTS |
| Indic pronunciation | **Native (Bulbul v3)** | Needs phonetic workarounds | Depends |
| Hinglish code-mixing | **Native (Saaras v3 ASR)** | Weak | Hard |
| Mid-call EN↔HI switching | **A settings toggle** | Prompt-level, unreliable | Build it yourself |
| Outbound campaigns | **Built in** | Via Twilio | Build it yourself |
| Indian telephony | **In-platform (Vobiz)** | Twilio + DLT | Twilio + DLT |
| Data residency | **India, self-hosted models** | US | Your choice |
| Build time | Hours | Hours | Days |

**Decision: Sarvam is the primary agent.**

The deciding factor isn't quality-in-general, it's **fit to *these* requirements**. Four of the
brief's demands — Indic pronunciation, Hinglish, mid-call language switching, and outbound — are
platform *primitives* on Sarvam and *workarounds* on ElevenLabs. When a platform's primitives match
the requirements exactly, that's the platform. Fighting a tool to do what another does natively is
effort spent on the wrong problem.

The pronunciation requirement makes the point on its own. The brief asks for a phonetic guide
because generic TTS mangles *Divyasree*, *Nandi*, *lakh* and *crore*. Bulbul v3 is trained on Indian
languages and culturally grounded data — it gets most of this right before you write a single
phonetic override. The dictionary in §5 then becomes insurance rather than life support.

**Decision: ElevenLabs is kept as a benchmark, not discarded.**

ElevenLabs likely wins on premium *English* warmth, and this is a luxury brand selling to CXOs and
NRIs — tone is part of the product. So the same prompt runs on both, the same two flows are recorded
on each, and the comparison is published with the audio. If ElevenLabs sounds materially better in
English, that's a real finding and it belongs in the submission.

**What I gave up:** roughly half a day building the same agent twice, and some risk of the
comparison being read as indecision rather than diligence. I think it's worth it — "which stack for
Indian voice AI" is a live question for anyone in this space, and answering it with recordings
rather than opinion is more useful than picking one and asserting.

---

## 3. What we are deliberately NOT building: real outbound telephony

**The brief says "outbound." We are demonstrating over web calls, not live phone calls.**

**Why.** Outbound calling to Indian mobile numbers is regulated under TRAI's DLT framework. A real
outbound campaign needs entity registration, header and content-template approval, KYC with a
telecom provider, and scrubbing against the DND registry. That process runs in **days to weeks**,
mostly waiting on approvals nobody in this project controls.

**Why it's the right call, not a shortcut.** The brief's own deliverable clause allows it:

> *"A shareable link to the working bot **or** a recorded audio files of test calls."*

Spending the deadline on telecom paperwork would produce the *same* conversational artifact, later
and with more risk. The graded object is the conversation, and the conversation is identical over
either transport.

**What's genuinely lost.** Real telephony would test things a web call cannot: audio codec
degradation, network jitter, barge-in over a live line, and answering-machine detection. Those are
real gaps and I'd rather name them than paper over them.

**What we did instead.** The agent is *designed* outbound throughout — it opens cold, identifies
itself unprompted, asks permission before proceeding, handles gatekeepers and voicemail (§8.6, 7.12),
and honours DNC instantly (§8.3). It is a live phone number away from production, and the
architecture assumes that number will exist.

> **The honest one-liner:** *we skipped the telecom paperwork, not the telephony design.*

---

## 4. Conversation architecture: state machine, not script

A script is easier to write, easier to review, and completely brittle. The moment a caller answers
two questions at once — which real callers constantly do — a script either re-asks (and sounds
deaf) or loses the information.

So: four slots, fillable from anywhere in the conversation, checked before every question.

**What I gave up:** predictability. A script produces identical calls; a state machine produces
varied ones, which is harder to test and occasionally surprising. I judged that the brief's
"avoid re-asking" requirement is worth more than reproducibility — and Flow 2 exists specifically to
prove the trade paid off.

**Where it's still weak:** slot inference is LLM judgment, not deterministic parsing. "I'm in
Hebbal" should infer `geography = comfortable`, but a genuinely ambiguous answer might get
mis-slotted. §6.3 constrains this by listing what may be inferred and instructing the model to leave
a slot empty rather than stretch. It reduces the failure rate; it does not eliminate it. With more
time I'd add a post-call validator that flags low-confidence slots for human review.

---

## 5. Fact discipline: the block list

The unusual part of the knowledge base is **Tier 4 — what the agent may never say.**

This came out of the research. Public aggregator data on this project is badly polluted: one listing
had ₹39.6 lakh for a 1,200 sq.ft. plot (off by more than half), another claimed ₹33,000/sq.ft.
(implausible), a third tagged a December-2029 project as *"Ready to Move"*, and several listed
**interior specifications — vitrified tiles, granite platforms, split-AC provisions — for what is a
land sale.**

That last one is the dangerous one. An agent describing flooring on a plot deal is finished in one
sentence, and on a RERA-registered project a misquoted price or possession date is the developer's
compliance exposure, not merely an embarrassment.

Hence the hard rule: **if it isn't in §11, the agent doesn't know it** — and a single deflection
line that converts any gap into the CTA:

> *"That's exactly what our Property Expert can confirm precisely — I don't want to give you a
> number that isn't exact. Shall I have them cover it on the call?"*

One line, roughly fifteen unanswerable questions handled, and every one of them ends pointing at the
close. Flow 7 tests it deliberately: booking amount, NRE payment, expected appreciation percentage,
and the flooring trap.

**The derived rate.** The brief gives a price band but no per-sq.ft. figure, and every investor asks
for one inside ninety seconds. It's recoverable, and both ends of the band agree:

```
₹92,40,000 ÷ 1,200 = ₹7,700/sq.ft.
₹7,700 × 3,199     = ₹2,46,32,300  ≈  ₹2.46 Cr   ✓
```

I used the derived ₹7,700 rather than the ₹8,300 quoted on listing sites — because it's internally
consistent with every other number the agent quotes, and the listings are demonstrably unreliable.
If the client's real rate card says otherwise, one line in §11 changes it.

---

## 6. Tone: why "fitment check" beats "what's your budget?"

The single highest-leverage sentence in the prompt:

> *"Sizes start at twelve hundred square feet, which works out to about ninety-two point four lakh,
> and go up to around two point four six crore for the larger ones, all inclusive of taxes. Does
> that range sit comfortably with what you had in mind?"*

You learn the same thing as *"what's your budget?"* — but you've given information before asking
for it, framed the range as the product's rather than a test of their means, and left them
volunteering rather than disclosing. With HNIs the second version doesn't just feel better, it gets
answered more often.

The same logic runs through the whole prompt: one rebuttal per objection and never two; proactively
raising the 2029 possession date rather than hiding it; offering a specific callback slot rather
than asking them to do the scheduling work.

---

## 7. AI disclosure

**Decision: the agent uses a human name, but admits it's an AI when asked directly.**

The brief says to introduce yourself as a Divyasree consultant and is silent on disclosure. A human
first name is standard for outbound and materially warmer. But denying it under direct questioning
is the kind of thing that becomes a brand incident, and these agents run against real customers for
a real developer.

The middle position — human name, honest under direct questioning, then carry on — costs almost
nothing in conversion and removes the tail risk entirely.

**I hold this one loosely.** It's a client policy question more than an engineering one, and a
reasonable client could decide otherwise. §8.7 is a two-line change.

---

## 8. Limitations

Stated plainly, because the alternative is having them found.

1. **No live telephony.** Untested against codec degradation, jitter, and real barge-in (§3).
2. **Slot inference is probabilistic.** Ambiguous answers can mis-slot (§5).
3. **Hindi is verified by ear, not measured.** No WER benchmark against a labelled Hinglish set.
4. **Single-persona voice.** Not tested across accents, ages, or noisy environments.
5. **Knowledge base is static.** Real inventory, live pricing and phase status would need a CRM tool
   call — supported by the platform, out of scope here.
6. **No CRM write-back.** The structured record is emitted but goes nowhere.
7. **Small n.** Seven scripted flows are a demonstration, not a statistically meaningful evaluation.

---

## 9. With more time

In priority order:

1. **DLT registration and a live number** — closes limitation 1, the largest gap.
2. **CRM tool call** for live inventory, and write-back of the qualification record — turns a demo
   into something usable.
3. **An eval set.** Thirty to fifty scripted calls with labelled expected slots, scored
   automatically. Right now "it works" is a judgment; it should be a number.
4. **Slot-confidence scoring** with human review flags for low-confidence extractions.
5. **Latency budget measurement** — ASR, LLM and TTS timings separately. Perceived naturalness is
   mostly a latency property and I have not measured it.
6. **A/B the opening line.** The permission ask is the highest-drop-off moment on any outbound call
   and is worth optimising empirically rather than by taste.

---

## 10. In one paragraph

Sarvam is the primary platform because four of the brief's requirements are its native primitives
rather than workarounds; ElevenLabs is kept as a published benchmark because English tone matters
for a luxury brand and the comparison is genuinely useful. The agent is a slot-filling state machine
rather than a script, because the brief's hardest requirement is not re-asking what was already
volunteered. The knowledge base is defined as much by what the agent may never say as by what it
may, because public data on this project is polluted and the project is RERA-registered. And we
built the outbound *design* without the outbound *paperwork* — a deliberate, brief-sanctioned trade
that costs live-line testing and buys the entire deadline.
