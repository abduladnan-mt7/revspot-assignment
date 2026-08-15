# Setup Guide — managed-platform path (reference / benchmark)

> **Note — this is not how the delivered demo runs.** The submitted demo is a self-built
> pipeline (`app/` — see the README), chosen because the dashboard's test panel is not a
> shareable link. This guide is kept as the production-deployment reference and for building
> the ElevenLabs A/B benchmark. The rationale for the pivot is `04-design-rationale.md` §11.

Click-by-click. Follow in order; do not skip the smoke test in step 6.

---

# Part A · Sarvam Voice Agent (primary)

## 1. Account

1. Sign up at **`indus.sarvam.ai`**
2. Confirm **₹1,000 free credits** are showing on the account

**Rough cost of this project** (Sarvam's published rates):

| Item | Rate | This project |
|---|---|---|
| Speech-to-text | ₹30 / hour | ~30 min of testing → **₹15** |
| Text-to-speech | ₹15–30 / 10K chars | ~40K chars → **₹60–120** |
| LLM | ₹29.28 / 1M input tokens | negligible |

**Total well under ₹300.** The free credits cover this several times over. No card needed.

## 2. Create the agent

1. **Build → Agents**
2. **Create from Scratch** — *not* the Genie prompt-builder. Genie generates its own prompt; we
   have one, and we want it in verbatim.
3. Name it: `WOW — Divyasree Outbound Qualifier`
4. You land on the **Canvas**

## 3. Instructions tab

**Greeting** — the first thing spoken when the call connects:

```
Good morning! This is Meera calling from DivyaSree Developers. Am I speaking with {{contact_name}}?
```

> Use a variable chip for the name. Sarvam supports these — click the `{}` control rather than
> typing the braces. If contact names aren't wired up for the demo, drop it to
> `Am I speaking with the right person?`

**System Prompt** — paste the **entire contents** of `docs/02-system-prompt.md`.

Two notes on pasting:

- Paste **all of it**, including the pronunciation dictionary and edge-case sections. It's long, and
  that's fine — this is a long-context model with a 128K window. Trimming it is what breaks
  slot-filling.
- Keep the `<<< >>>` example markers. They read as *examples* to the model, which is what stops it
  reciting them verbatim.

## 4. Settings → Language personalisation

This section is why we chose Sarvam. It delivers the multilingual bonus as configuration rather
than prompt-wrestling.

| Field | Value |
|---|---|
| **Starting language** | `English` |
| **Switch language during call** | **ON** ← the bonus, in one toggle |
| **Languages allowed** | `English`, `Hindi` |

Leave every other Indic language **off**. Allowing ten languages when the brief asks for two just
widens the surface for mis-detection.

## 5. Settings → Speakers & voice

Pick from **Bulbul v3** (39 voices, 11 Indian languages).

**What to select for:** female, 30s–40s, warm, unhurried, clear Indian English. The buyer is an HNI
or CXO — this should sound like a senior consultant at a premium developer, not a call-centre agent.

**Audition each candidate on this exact line**, which contains every hard sound in the project:

> *"DivyaSree Whispers of the Wind, in Nandi Valley — plots from ninety-two point four lakh to two
> point four six crore, with possession in December twenty twenty-nine."*

Score each voice on:

| Check | Listening for |
|---|---|
| **Div-yaa-shree** | long middle syllable, *shree* ending — not "Div-ya-sree" |
| **Nun-dhee** | soft dental *dh* — not "Nan-dee" |
| **laakh** | long *aa* — not "lack" |
| **krore** | not "core" |
| **"December twenty twenty-nine"** | not "two thousand and twenty-nine" |
| Pace | unhurried — premium brands don't rush |

Then audition your shortlist **in Hindi** too. A voice that's lovely in English and stiff in Hindi
fails Flow 6. Pick one voice that does both well rather than the best English voice.

## 6. Test — smoke test before anything else

Open the **test agent** panel and speak to it normally. Live transcript appears alongside.

**Run Flow 2 first** (`docs/03-conversation-flows.md`). Open with, verbatim:

> *"Yeah, I saw the ad. I'm looking at it as an investment, somewhere near the airport is ideal, and
> my budget's around one and a half crore."*

| Result | Meaning |
|---|---|
| Agent asks only about **timeline** | ✅ Slot-filling works. Continue. |
| Agent asks intent, geography or budget | ❌ **Stop.** Fix the prompt before recording anything. |

If it fails, the usual causes are: the system prompt was truncated on paste, §5.2 got cut, or the
model is set too small. Check in that order.

Then run the other six flows and note anything that runs past 3:15.

## 7. Recordings

**Monitor → Agent Analytics** stores transcript, recording and call detail for every call. Nothing
extra to set up — run each flow once cleanly, then download.

Save as `flows/01-investor.mp3` … `flows/07-nri-deep-qa.mp3`.

## 8. Phone deployment — optional, see the rationale first

**Deploy → Phone Numbers** offers *rent from Sarvam (via Vobiz)* or *bring your own telephony*, and
**Outbound Campaigns** runs actual outbound.

**We are not doing this**, and §3 of `04-design-rationale.md` explains why: Indian outbound needs
DLT registration, header/template approval, KYC and DND scrubbing — days to weeks of waiting on
approvals, producing the same conversational artifact the web demo already produces. The brief
explicitly permits a shareable link or recordings.

**If you have spare time at the end** and a number is available, one real call to **your own
number** is a nice bonus. Never dial anyone else — the whole DLT framework exists precisely because
of unsolicited calls.

---

# Part B · ElevenLabs Agent (benchmark)

Purpose: an honest English-tone comparison. Roughly an hour's work.

1. Sign up at **`elevenlabs.io`**, free tier is fine
2. **Conversational AI → Agents → Create Agent**
3. Name it `WOW — Divyasree (ElevenLabs benchmark)`
4. **System prompt:** paste the *same* file, unchanged. Changing it invalidates the comparison.
5. **First message:** the same greeting
6. **Voice:** pick the closest available match — warm female, Indian English if offered
7. **Language:** English (its Hindi is the thing we expect to be weaker; we're testing that)
8. Record **Flow 1** and **Flow 6** only — one English, one Hindi. That's the comparison.

## What to listen for in the A/B

| Dimension | Expectation |
|---|---|
| English warmth | ElevenLabs likely ahead — more natural prosody |
| **Divyasree / Nandi** | Sarvam should win — Indic-native training |
| **lakh / crore** | Sarvam should win clearly |
| **Hindi (Flow 6)** | Sarvam should win decisively |
| Latency | Sarvam self-hosts in India — likely lower from an Indian client |

**Record whatever actually happens, including results that go against the recommendation.** A
benchmark that only confirms the choice isn't a benchmark. If ElevenLabs sounds better in English,
that's a real finding and it goes in the submission — the interesting conclusion is probably
*"Indic-native for Indic, global for English,"* which is a more useful answer than either platform
winning outright.

---

# Part C · Checklist

**Sarvam**
- [ ] Account created, credits confirmed
- [ ] Agent created from scratch
- [ ] Greeting set with name variable
- [ ] Full system prompt pasted — **verify nothing was truncated**
- [ ] Starting language English · switching ON · English + Hindi only
- [ ] Voice auditioned on the test line, in **both** languages
- [ ] **Flow 2 smoke test passed** ← gate
- [ ] All 7 flows recorded and downloaded
- [ ] Durations noted; anything past 3:15 flagged

**ElevenLabs**
- [ ] Agent created with the identical prompt
- [ ] Flows 1 and 6 recorded
- [ ] A/B observations written down

**Deliverables**
- [ ] System prompt exported to PDF
- [ ] 7 recordings named and organised
- [ ] Microsite published, link tested
- [ ] Design rationale reviewed
