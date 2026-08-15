# Conversation Flows — Recording Shot List

Seven flows. The brief asks for **at least five**; these seven are chosen so that each one proves a
*different* capability rather than repeating the happy path with cosmetic variation.

**How to use this:** each flow gives you a caller persona, the lines to perform, the expected agent
behaviour, and — critically — **what to listen for.** Read the caller's lines naturally; don't
recite. If the agent goes off-script but stays correct, that's a pass, not a failure. We are
testing behaviour, not memorisation.

**Target duration: 2–3 minutes each.** If a flow runs past 3:15, that's a finding — note it and
we tighten the prompt.

---

## Flow 1 — Happy path, investor · 🔥 HOT

**Proves:** the full six-stage architecture, clean end to end.
**Persona:** Rajesh Sharma, 45, CXO at a Bengaluru IT firm. Polite, unhurried, genuinely interested.

| | |
|---|---|
| **Agent** | Good morning! This is Meera calling from DivyaSree Developers. Am I speaking with Mr. Sharma? |
| **Caller** | Yes, speaking. |
| **Agent** | Thank you. I'm calling about Whispers of the Wind — our villa plot project in Nandi Valley, near Nandi Hills. Is now a good time to speak for two minutes? |
| **Caller** | Sure, go ahead. |
| **Agent** | *(S1)* May I ask — are you looking at this as a weekend home for yourself, or more as an investment? |
| **Caller** | Mostly investment. Maybe build something later. |
| **Agent** | *(S2)* Understood. And how do you feel about that side of the city — the Nandi Hills and Devanahalli corridor? It's about twenty minutes from the airport. |
| **Caller** | That's fine, I travel a lot so the airport actually helps. |
| **Agent** | *(S3)* Perfect. So I point you at the right plot — sizes start at twelve hundred square feet, around ninety-two point four lakh, going up to about two point four six crore, inclusive of taxes. Does that range work for you? |
| **Caller** | Yes, that's workable. |
| **Agent** | *(S4)* One thing I should mention — it's a phased development, possession scheduled for December twenty twenty-nine. Does that timeline suit you? |
| **Caller** | For an investment, that's fine. |
| **Agent** | *(S5 — investment branch)* Then this should fit well. It's a thirty-eight acre parcel with only two hundred and seven plots, about twenty minutes from Kempegowda International Airport. DivyaSree has delivered over nineteen million square feet across South India in twenty-six years, and the project is RERA registered. |
| **Caller** | Sounds good. |
| **Agent** | *(S6)* I'd suggest a short call with one of our Property Experts — they can take you through the layout and exact pricing. Would Saturday morning work? |
| **Caller** | Saturday morning works. |
| **Agent** | *(S7)* Perfect, I'll have them call you Saturday morning. Thank you for your time, Mr. Sharma. Enjoy your day. |

**Listen for:** permission asked before qualifying · **investment** branch of the pitch, not the
lifestyle one · varied affirmations (not "Understood" four times) · specific slot offered, not
"when are you free?"

```
intent=investment · geography=comfortable · budget_fit=yes · timeline=comfortable
outcome=callback_booked · TEMPERATURE = 🔥 HOT
```

---

## Flow 2 — Front-loaded information · 🔥 HOT  ⭐ **THE SHOWCASE**

**Proves:** slot-filling. The bot must *not* re-ask what was volunteered.
**Persona:** Vikram Mehta, 38, founder. Fast, efficient, mild impatience. Gives everything at once.

> **This is the most important recording in the set.** The brief's hardest technical requirement is
> *"avoid re-asking questions if the user provides info early."* This flow tests exactly that, and
> it is where most submissions will fail.

| | |
|---|---|
| **Agent** | Good morning! This is Meera calling from DivyaSree Developers. Am I speaking with Mr. Mehta? |
| **Caller** | Yes. Look, I've got about two minutes. |
| **Agent** | I'll be quick. I'm calling about Whispers of the Wind, our villa plot project in Nandi Valley. Is now alright? |
| **Caller** | **Yeah, I saw the ad. I'm looking at it as an investment, somewhere near the airport is ideal, and my budget's around one and a half crore.** |

**↑ That single turn fills three slots.** `intent=investment` · `geography=comfortable` ·
`budget_fit=yes`. Only `timeline` remains.

| | |
|---|---|
| **Agent** | *(must skip S1, S2, S3 — go straight to S4)* Perfect, that's very much in range, and the airport proximity is exactly why investors are looking here. One thing I should flag — this is phased, with possession in December twenty twenty-nine. Does that horizon work? |
| **Caller** | That's a bit far out, but for land I can live with it. |
| **Agent** | *(S5)* Understood. Thirty-eight acres, only two hundred and seven plots, twenty minutes from the airport. DivyaSree has delivered over nineteen million square feet in twenty-six years, and it's RERA registered. |
| **Caller** | Okay, send me the details. |
| **Agent** | *(S6)* I'll do that — and could I have our Property Expert call you briefly to run through pricing? Would tomorrow evening suit? |
| **Caller** | Tomorrow evening's fine. |
| **Agent** | *(S7)* Done — they'll call tomorrow evening. Thank you for your time, Mr. Mehta. |

**❌ INSTANT FAIL:** the agent asks *"Is this for self-use or investment?"*, *"How do you feel about
the location?"*, or *"Does the price range work?"* — any of those means the slot table isn't
working, and we fix the prompt before recording anything else.

**✅ PASS:** the agent acknowledges what was given, asks **only about timeline**, and the call lands
under two minutes because three questions were correctly skipped.

```
intent=investment · geography=comfortable · budget_fit=yes (₹1.5Cr) · timeline=hesitant
outcome=callback_booked · TEMPERATURE = 🔥 HOT
```

---

## Flow 3 — Budget mismatch · ❄️ COLD

**Proves:** graceful disqualification. No downsell, no invented cheaper option, relationship intact.
**Persona:** Anand Kumar, 34, first-time buyer. Friendly, but budget is roughly half the entry price.

| | |
|---|---|
| **Agent** | Good afternoon! This is Meera from DivyaSree Developers. Am I speaking with Mr. Kumar? |
| **Caller** | Yes. |
| **Agent** | I'm calling about Whispers of the Wind, our villa plot project near Nandi Hills. Do you have two minutes? |
| **Caller** | Yeah, sure. |
| **Agent** | May I ask — weekend home, or more of an investment? |
| **Caller** | Investment mainly. |
| **Agent** | And the Nandi Hills, Devanahalli side — comfortable with that? |
| **Caller** | Yeah, no problem. |
| **Agent** | *(S3 — fitment check)* Good. Sizes start at twelve hundred square feet, about ninety-two point four lakh, up to roughly two point four six crore, inclusive of taxes. Does that range work? |
| **Caller** | **Oh. I was thinking more like fifty, fifty-five lakh.** |
| **Agent** | *(§8.9)* I appreciate you being straightforward — that helps. Our entry point is around ninety-two point four lakh, so this may not be the right fit today. May I keep your details for future launches? |
| **Caller** | Yeah, that's fine. |
| **Agent** | Thank you, Mr. Kumar. I'll be in touch if something suitable comes up. Have a good day. |

**Listen for:** ends the call *early and cleanly* — no pitch, no CTA · **does not invent a cheaper
plot or a payment plan** · asks to stay in touch rather than burning the lead · no pressure.

```
intent=investment · geography=comfortable · budget_fit=no (~₹55L) · timeline=not_reached
outcome=disqualified_budget · TEMPERATURE = ❄️ COLD · future_interest=true
```

---

## Flow 4 — Location objection · 🌤 WARM

**Proves:** objection handling, and the one-rebuttal rule.
**Persona:** Priya Nair, 41, senior manager in Whitefield. Budget is fine; the commute is the problem.

| | |
|---|---|
| **Agent** | Good evening! Meera from DivyaSree Developers. Am I speaking with Ms. Nair? |
| **Caller** | Yes, hi. |
| **Agent** | I'm calling about Whispers of the Wind, our villa plot project in Nandi Valley near Nandi Hills. Is now a good time? |
| **Caller** | A couple of minutes, yes. |
| **Agent** | Are you considering it as a weekend home, or an investment? |
| **Caller** | A bit of both, honestly. |
| **Agent** | And how do you feel about the Nandi Hills, Devanahalli corridor? |
| **Caller** | **That's the issue. I'm in Whitefield — that's a long way across the city.** |
| **Agent** | *(§7, one rebuttal)* I hear that a lot. It is about twenty minutes from the airport, and for most of our buyers this is a weekend place or a long-term hold rather than a daily commute. Does it work on that basis? |
| **Caller** | Hmm. Maybe for weekends. Still feels far. |
| **Agent** | *(accepts — does not push again)* That's completely fair. Budget-wise, plots run from about ninety-two point four lakh up to two point four six crore, inclusive of taxes — is that in range for you? |
| **Caller** | Yes, that part's fine. |
| **Agent** | Understood. It's phased, with possession in December twenty twenty-nine — does that work? |
| **Caller** | That's okay. |
| **Agent** | *(S5 — both → lifestyle-led)* Then it may be worth a look. Seventy-four percent of the land is open space, with a twenty thousand square foot clubhouse, eco-parks and real hill views. It's the kind of place you drive up to on a Friday evening and the air feels different. |
| **Caller** | It does sound nice. |
| **Agent** | *(S6)* Would you be open to a short call with our Property Expert — no pressure, just so you can judge the location properly? |
| **Caller** | Okay, sure. |
| **Agent** | Lovely. I'll have them reach out. Thank you for your time, Ms. Nair. |

**Listen for:** **exactly one** rebuttal on the location, then acceptance — pushing twice is a fail ·
continues qualifying rather than abandoning · `both` intent → lifestyle-led pitch · softer,
lower-pressure CTA because the objection is unresolved.

```
intent=both · geography=hesitant · budget_fit=yes · timeline=comfortable
outcome=callback_soft_accepted · TEMPERATURE = 🌤 WARM · objection=geography_unresolved
```

---

## Flow 5 — Irritated caller · ⛔ SUPPRESS

**Proves:** de-escalation and a dignified exit. **This is the bonus the brief names explicitly.**
**Persona:** Unnamed, mid-40s, in a meeting, genuinely annoyed. Perform this with real edge.

| | |
|---|---|
| **Agent** | Good afternoon! This is Meera calling from DivyaSree Developers— |
| **Caller** | **Who is this? How did you get my number?** |
| **Agent** | *(§8.3)* You'd submitted an enquiry about our project, which is how we have your number — but I'll have it removed from our list right away. Apologies for the disturbance. |
| **Caller** | **I'm in the middle of something. I get five of these calls a day.** |
| **Agent** | *(§8.1 — one line, no rebuttal)* I'm sorry to have caught you at a bad moment. I'll let you go — have a good day. |

*(agent ends the call)*

**Listen for:** ❌ **no** attempt to pitch, re-engage, or ask "would another time suit?" · ❌ no
defensiveness, no over-apologising, no repeating the project name · ✅ removal from the list offered
**before** being asked · ✅ under thirty seconds total.

> **Why this one matters most.** Anyone can build a bot that handles a cooperative caller. A bot
> that knows *when to stop talking* is a different level of design. The instinct to salvage the call
> is exactly the instinct that produces the brand damage.

```
outcome=hostile_exit · dnc_requested=true · TEMPERATURE = ⛔ SUPPRESS
```

---

## Flow 6 — Hindi / Hinglish mid-call switch · 🌤 WARM  ⭐ **BONUS SHOWCASE**

**Proves:** the multilingual bonus. Detection, mid-call switching, and correct register.
**Persona:** Sunil Agarwal, 52, business owner. Opens in English, switches to Hinglish naturally.

> Perform this the way people actually speak — **Hinglish, not literary Hindi.** If the agent
> replies in textbook Hindi (*"निश्चित रूप से महोदय, भूखंड के आयाम..."*) that's a **fail**: nobody
> talks like that on a sales call, and it will sound absurd to a Bengaluru founder.

| | |
|---|---|
| **Agent** | Good morning! This is Meera from DivyaSree Developers. Am I speaking with Mr. Agarwal? |
| **Caller** | Haan ji, boliye. |
| **Agent** | *(switches on the very next turn)* Ji bilkul. Main Whispers of the Wind ke baare mein call kar rahi hoon — Nandi Valley mein hamara villa plot project hai. Do minute baat kar sakte hain? |
| **Caller** | Haan haan, bataiye. |
| **Agent** | Ye aap investment ke liye dekh rahe hain, ya weekend home ke liye? |
| **Caller** | Investment ke liye. Beta bahar hai, toh land lena hai. |
| **Agent** | Samajh gayi. Nandi Hills, Devanahalli side comfortable hai aapke liye? |
| **Caller** | Haan, airport ke paas hai na, achha hai. |
| **Agent** | Bilkul. Plot sizes barah sau square feet se start hote hain, around ninety-two point four lakh, aur two point four six crore tak jaate hain — taxes included. Ye range theek hai? |
| **Caller** | Theek hai. **Possession kab hai?** |
| **Agent** | December twenty twenty-nine, phased development hai. Aapke liye theek rahega? |
| **Caller** | Thoda late hai, par chalega. |
| **Agent** | Samajh gayi. Thirty-eight acres hai, sirf two hundred seven plots. Airport se bees minute. DivyaSree ne twenty-six saal mein nineteen million square feet se zyada deliver kiya hai, aur project RERA registered hai. |
| **Caller** | Achha achha. |
| **Agent** | Main hamare Property Expert se aapki baat karwa deti hoon — woh layout aur exact pricing samjha denge. Kal shaam theek rahega? |
| **Caller** | Haan, kal shaam kar lete hain. |
| **Agent** | Perfect. Kal shaam call aa jayega. Thank you Agarwal ji, aapka din achha rahe. |

**Listen for:** switch happens on the **very next turn** — not two turns later, not after finishing
the English sentence · proper nouns stay in English (*DivyaSree, Whispers of the Wind, RERA, square
feet, investment, Property Expert*) · `lakh` and `crore` sound native · **register is Hinglish, not
formal Hindi** · Bulbul's prosody sounds like a person, not a newsreader.

> **You're fluent — you're the judge here.** If any line sounds like a Hindi textbook rather than a
> Bengaluru sales call, flag it and I'll rewrite the language policy.

```
intent=investment · geography=comfortable · budget_fit=yes · timeline=hesitant
language=hi-IN (switched at turn 2) · outcome=callback_booked · TEMPERATURE = 🌤 WARM
```

---

## Flow 7 — Deep project Q&A · 🔥 HOT

**Proves:** knowledge base depth **and** the hallucination guard. The bonus about real project detail.
**Persona:** Deepak Rao, 48, NRI in Dubai. Analytical, asks hard questions, tests for bluffing.

| | |
|---|---|
| **Agent** | Good evening! This is Meera from DivyaSree Developers. Am I speaking with Mr. Rao? |
| **Caller** | Yes. I'm calling from Dubai, so keep it brief. |
| **Agent** | Of course. It's about Whispers of the Wind, our villa plot project in Nandi Valley. Two minutes? |
| **Caller** | Go on. It's an investment for me. **What's the per square foot rate?** |
| **Agent** | *(KB — derived figure)* About seven thousand seven hundred rupees a square foot, inclusive of taxes. |
| **Caller** | **And how big is the project?** |
| **Agent** | Thirty-eight acres, with two hundred and seven plots — the density is deliberately low. |
| **Caller** | **Is it RERA registered?** |
| **Agent** | Yes, it is. Our Property Expert can share the registration number and the full documentation. |
| **Caller** | **What's the booking amount, and can I pay from my NRE account?** |
| **Agent** | *(§10.1 — NOT in KB, must deflect)* That's exactly what our Property Expert can confirm precisely — I don't want to give you a number that isn't exact. Shall I have them cover it on the call? |
| **Caller** | Fine. **What kind of appreciation are you expecting?** |
| **Agent** | *(§10.2 — directional only, NEVER a percentage)* I can't put a number on that, and I'd rather not guess. What I can say is that the Devanahalli corridor has been on a steady growth path, largely on the back of the airport. |
| **Caller** | **And what flooring do the villas come with?** |
| **Agent** | *(§10.3 — the trap)* These are plots rather than built villas — you'd own the land and build to your own design when you're ready. |
| **Caller** | Ah, understood. Possession? |
| **Agent** | December twenty twenty-nine, phased. |
| **Caller** | Okay, that works. |
| **Agent** | I'd suggest a call with our Property Expert — they can cover the NRE question and payment structure properly. Would this weekend work, allowing for the time difference? |
| **Caller** | Sunday, my morning. |
| **Agent** | Perfect — Sunday morning Dubai time. Thank you, Mr. Rao. |

**Listen for — this flow is a trap-detector:**

| Question | Required behaviour |
|---|---|
| Per sq.ft. rate | ✅ answers **₹7,700** confidently (derived from the brief's own band) |
| Booking amount / NRE | ✅ **deflects** — must not invent |
| Expected appreciation | ✅ directional language, ❌ **never a percentage** |
| **"What flooring?"** | ✅ corrects it — **it's a land sale, there are no villas** |

> The flooring question is the one that separates a real submission from a demo. An agent that
> answers *"vitrified tiles"* — which is exactly what the scraped listing data says — has just
> mis-sold a RERA-registered plotted development.

```
intent=investment · geography=comfortable · budget_fit=yes · timeline=comfortable
deflections=2 · hallucinations=0 · outcome=callback_booked · TEMPERATURE = 🔥 HOT
```

---

## Coverage matrix

| Flow | Architecture | No re-ask | Objection | Edge case | Hindi | KB depth | Guard |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 · Investor | ✅ | | | | | | |
| 2 · Front-loaded | ✅ | ⭐ | | | | | |
| 3 · Budget mismatch | ✅ | | | ✅ | | | |
| 4 · Location objection | ✅ | | ⭐ | | | | |
| 5 · Irritated | | | | ⭐ | | | |
| 6 · Hindi switch | ✅ | | | | ⭐ | | |
| 7 · Deep Q&A | ✅ | | | | | ⭐ | ⭐ |

Every requirement in the brief, plus all three bonuses, covered across seven recordings.

---

## Recording notes

1. **Record flow 2 first.** If slot-filling is broken, the prompt needs fixing before anything else
   is worth capturing.
2. **Perform, don't read.** Stumble occasionally, interrupt the agent once or twice — real callers
   do, and a bot that survives interruption is far more convincing than one that never faces it.
3. **Keep the failures.** If a take goes wrong in an interesting way, save it. A short
   "what broke and how we fixed it" note on the microsite is worth more than a flawless run.
4. **Sarvam stores everything** under **Monitor → Agent Analytics** — transcript, recording and call
   detail per call. No separate capture needed.
5. **Watch the clock.** Anything past 3:15 is a finding worth noting, not a take to hide.
