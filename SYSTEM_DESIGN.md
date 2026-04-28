# Car Loan Kiosk — End-to-End Gamified Loan Journey
## Agentic System Design Document

---

## 1. What We Are Building

A gamified car-loan kiosk system for showroom deployments.

A customer walks into a showroom, interacts with a touchscreen kiosk, talks to an AI avatar named **Priya**, selects a car, gets a real loan pre-approval — all without a single human intervening. After they leave the kiosk, a finance executive at the dealer desk collects documents digitally in 6-7 minutes and disburses the loan in 10 minutes.

**The goal:** Walk in → Drive out. Under 25 minutes total.

**The interview goal:** Demonstrate where AI agents are genuinely needed vs where rules-based systems are the right call, with a beautiful live demo deployed on Azure.

---

## 2. The Two Applications

### App 1 — Customer Kiosk
- Touchscreen display at the car showroom
- Avatar Priya guides the customer through 7 stages
- No personal data asked until Stage 4 (PAN entry)
- Gives a soft pre-approval at the end

### App 2 — Dealer Portal
- Separate web app on dealer's computer/tablet
- Receives real-time application from kiosk
- Dealer collects documents digitally (no physical paperwork)
- Triggers disbursement

---

## 3. The Customer Journey — All 7 Stages

### STAGE 0 — Idle / Attract
**Time:** Ongoing until customer approaches  
**What customer sees:** Looping animation of cars on a road. Priya standing to the side, occasionally glancing. Text: *"Drive home your dream car. Find out your loan in under 5 minutes."*  
**What Priya says:** *(after 10s idle)* "Hey! Come take a look — I can tell you exactly what you can afford."  
**System running:** Nothing. Pure animation.  
**Data collected:** None.

---

### STAGE 1 — Car Selection
**Time:** 0–90 seconds  
**What customer sees:**
- Card-based car catalog (beautiful, not a list)
- Filter by brand (Maruti / Hyundai / Tata / Honda / Toyota)
- Each card: photo, car name, price range
- Tap a car → expand → pick variant
- Selected car appears on the road in the background (animated)

**Priya reacts to their choice dynamically.**  
*"Great taste! The Creta SX is one of our top picks this month."*

**Gamification:** Car appearing on the road = journey has started. Progress: 0% → 15%.  
**System running:** Rules-based (filter catalog, sort by relevance).  
**Data collected:** Car model, variant, ex-showroom price. Nothing personal.

---

### STAGE 2 — Financial Discovery
**Time:** 90 seconds – 3 minutes  
**What customer sees:** Priya asks 4 questions. One at a time. All visual — sliders and cards, zero typing.

**Question 1 — Down Payment**
- Visual: Slider styled like a fuel gauge
- Range: ₹0 to ₹5L+
- "Recommended" marker at 20% of car price
- EMI preview updates live as they drag
- Labels: "Just starting" / "Good start" / "Strong" / "Excellent"

**Question 2 — Loan Tenure**
- Visual: 5 cards laid out like playing cards
- Options: 24 / 36 / 48 / 60 / 72 months
- Each card shows rough EMI for their car
- "Most popular" tag on 60 months
- Selecting one makes it jump forward, others recede

**Question 3 — Employment Type**
- Visual: 4 illustrated cards
- Salaried Corporate / Salaried Government / Self-Employed / Business Owner

**Question 4 — Monthly Income Range**
- Visual: Slider with brackets (not exact amount)
- Ranges: Under ₹30K / ₹30–50K / ₹50–75K / ₹75K–1L / Above ₹1L
- Priya: *"Ballpark is totally fine here."*

**After Q4 — The Hook:**
```
Your estimated eligibility:

      ₹ [BLURRED OUT]

🔒 Unlock your exact offer
   Just your PAN card. Takes 10 seconds.

        [ Check My Eligibility → ]
```

This is the most important moment. Customer has invested 2 minutes. The number is right there. Almost no one walks away.

**System running:** Rules-based (EMI = P×r×(1+r)^n / ((1+r)^n−1)). LLM only if customer says something unexpected via voice.  
**Data collected:** Down payment, tenure, employment type, income range. Still nothing personally identifying.  
**Progress:** 15% → 45%

---

### STAGE 3 — PAN Entry + Bureau Magic
**Time:** 3–5 minutes  
**What customer sees:**
- One large, friendly input field: PAN number
- Priya: *"I just need your PAN to fetch your credit profile. Secure, takes 10 seconds."*
- Small text: *"🔒 256-bit encrypted. Not stored until you apply."*

**The Loading Experience (built for anticipation):**
```
Priya: "Let me pull up your profile..."

Fetching credit profile...     ████████░░
Verifying income signals...    ██████░░░░
Checking existing loans...     █████████░
Calculating your offer...      ██████████  ✓
```
Each line appears one at a time. Takes 3–4 seconds even if data returns instantly. The wait is intentional — it builds anticipation.

**Then — The Reveal:**
```
✓ Profile found: Rahul Sharma
✓ CIBIL Score: 742  ★ Excellent

🎉 Congratulations!
You are pre-approved for up to

        ₹ 11,40,000

Interest rate: 9.25% p.a.
EMI starting ₹13,850/month
```
Confetti. Car on road jumps forward significantly.

**CIBIL Display Rules:**
- Score 750+: Show prominently. *"Your excellent CIBIL score got you our best rate."*
- Score 650–749: Show positively. *"Good credit profile."*
- Score below 650: Do NOT show the number. Just show the offer (reduced amount, higher rate) with no mention of why.

**What the bureau fetch returns (via PAN):**
- Full legal name
- Date of birth
- CIBIL score
- All existing loans and outstanding balances
- Payment history (used internally only)
- Credit enquiries

**System running:** Mock Bureau API → Rules Engine for decision → LLM writes the result message in natural language (LLM is renderer only, NOT the decision maker).  
**Progress:** 45% → 75%

---

### STAGE 4 — EMI Optimizer
**Time:** 5–6 minutes  
**What customer sees:** Three live sliders. All update the EMI number in real time.
- Loan Amount (capped at their approved limit)
- Down Payment (adjustable from what they said earlier)
- Tenure (24–72 months)

**Display:**
```
Your Monthly EMI:   ₹ 14,200
Loan Amount:        ₹ 10,00,000
Interest Rate:      9.25% p.a.
Tenure:             60 months
```
Note: Total interest and total payable are **never shown**. Only EMI, amount, rate, tenure.

**Three pre-set plans:**
- Conservative — lower EMI, longer tenure
- Balanced — recommended (pre-selected)
- Fast Track — higher EMI, own it sooner

**System running:** Rules-based (EMI math). No LLM.  
**Progress:** 75% → 85%

---

### STAGE 5 — Phone Number + Application Review
**Time:** 6–7 minutes  
**What customer sees:**
- Priya: *"One last thing — your number so we can send your loan summary on WhatsApp."*
- Single field: phone number
- Everything else pre-filled from bureau

**Review card:**
```
┌──────────────────────────────────┐
│  🚗 Hyundai Creta SX             │
│  Ex-showroom: ₹16,20,000         │
│                                  │
│  Loan Amount:    ₹10,00,000      │
│  Down Payment:   ₹6,20,000       │
│  Tenure:         60 months       │
│  EMI:            ₹13,850/month   │
│  Rate:           9.25% p.a.      │
│                                  │
│  Applicant:  Rahul Sharma        │
│                                  │
│  [ Confirm & Submit → ]          │
└──────────────────────────────────┘
```

**System running:** Form validation (rules). Submit triggers dealer portal notification.  
**Progress:** 85% → 95%

---

### STAGE 6 — Waiting (Dealer Processing)
**What customer sees:**
- Their car on the road, almost at the destination
- *"Your application is with the dealer. Grab a seat!"*
- Application ID displayed
- A small animated "What happens next" explainer (comic/card style) they can read

**What's happening in background:** Dealer portal receives real-time push notification.  
**System running:** WebSocket event listener.  
**Progress:** 95% → 99%

---

### STAGE 7 — Pre-Approved! Celebration
**What customer sees:**
- Full screen celebration. Car arrives at destination.
- Confetti. Priya is visibly excited.

```
🎊 Congratulations, Rahul!

Your Loan is Pre-Approved!

₹ 10,00,000
9.25% p.a.  |  ₹13,850/month  |  60 months

Next Steps:
1. Complete document verification at the desk (6-7 min)
2. Sign your digital agreement
3. Drive home your Creta!

[ 📱 Send to WhatsApp ]    [ 📄 Download Summary ]
```

**Pre-approval disclaimer (small):** *"Subject to document verification. Offer valid 48 hours."*

---

## 4. The Dealer Portal — Document Stage

After customer submits, dealer's screen shows:

### D1 — Dashboard
- Live feed of incoming applications
- Each application card: customer name, car, pre-approved amount, time elapsed
- New applications ping with a sound + visual alert

### D2 — Customer Detail
AI-generated 2-line brief (LLM writes from structured data):
> *"Salaried professional, ₹72K/month, CIBIL 742. Wants Creta SX, pre-approved ₹10L at 9.25%. Strong profile — recommend immediate engagement."*

Full profile below: car, loan terms, bureau summary.

### D3 — Digital Document Collection (6-7 minutes)

No physical paperwork. Everything fetched digitally.

**Step 1 — Aadhaar eKYC** (30 seconds)
- Dealer clicks "Send OTP Request"
- Customer gets OTP on Aadhaar-linked mobile
- Customer enters OTP on dealer tablet
- Returns: name, DOB, address, photograph

**Step 2 — Account Aggregator Consent** (2-3 minutes)
- Two options shown simultaneously:
  - QR code on screen (customer scans with phone camera)
  - SMS link sent to customer's phone
- Customer approves in their bank's app
- Returns: 6-12 months bank statements, avg monthly credits, existing EMI debits

**Step 3 — Income Tax Fetch** (1 minute)
- Via PAN + IT portal OTP
- Returns: annual income from Form 26AS, employer name, TDS details

**Checklist updates live:**
```
[ ✓ ] Aadhaar eKYC        Rahul Sharma, DOB: 12-Mar-1994
[ ✓ ] Account Aggregator   Avg credit: ₹71,200/month
[ ✓ ] Income Tax           Annual income: ₹8,54,000

All documents verified ✓
```

### D4 — Automated Verification Engine (Rules-Based)
```
Declared income ₹70K  vs  AA actual ₹71,200  →  Within 5% tolerance  →  PASS
Declared EMIs ₹8K     vs  Bureau ₹8,200       →  Matches              →  PASS
Address: Aadhaar      vs  Bureau               →  Matches              →  PASS
Employment: Salaried  vs  Form 26AS employer   →  Confirmed            →  PASS

Decision: FULL SANCTION at pre-approved terms ✓
```

### D5 — Digital Agreement + NACH
- Agreement auto-generated with exact loan terms
- Customer signs via Aadhaar e-Sign (OTP on phone)
- NACH mandate set up for auto-debit of EMI

### D6 — Disbursement
- Amount transferred via IMPS to dealer's account (not customer)
- Customer gets WhatsApp + SMS confirmation
- Dealer marks car as sold
- Kiosk shows final "Your loan is live!" screen

**Total time dealer stage:** ~10 minutes from document start to disbursement.

---

## 5. The Follow-Up Agent (Drop-Off Recovery)

If a customer leaves the kiosk before completing, and they've entered their phone number:

| Drop-off Stage | Wait Time | Message Angle |
|---|---|---|
| After car selection | 3 hours | "The Creta you liked — you're likely eligible for ₹10L+" |
| After financial discovery | 2 hours | "Your estimated EMI was ₹13,850. Confirm in 10 seconds." |
| After eligibility reveal | 30 minutes | "Rahul, your ₹11.4L offer is reserved for 48 hours." |
| After EMI optimizer | 15 minutes | "Your application is 90% done. Resume here →" |

**Why this is an Agent (not just a scheduler):**  
The agent reads the drop-off stage, reasons about urgency, selects the right message tone, picks the channel (WhatsApp first, SMS fallback), writes a personalised message referencing their specific car and EMI, and schedules it at the right time. These are multi-step decisions, not a fixed trigger.

**Agent tools:** `get_session_data`, `schedule_message`, `send_whatsapp`, `send_sms`

---

## 6. The "i" Button — Transparency Panel

Every screen on the kiosk has a small **"i"** button in the corner. Tapping it opens a side panel.

**What it shows:**

```
┌─────────────────────────────────────────┐
│  ⚡ What's happening right now          │
│                                         │
│  ACTIVE SYSTEM                          │
│  EMI Calculator (Rules-Based)           │
│                                         │
│  INPUTS USED                            │
│  Vehicle price: ₹16,20,000              │
│  Down payment:  ₹6,20,000              │
│  Tenure:        60 months               │
│  Rate:          9.25%                   │
│                                         │
│  AI USED?  ✗ No — pure math here        │
│                                         │
│  YOUR DATA RIGHT NOW                    │
│  Stored: Car choice, EMI preference     │
│  Not stored: Your name, income, PAN     │
│                                         │
│  [ Close ]                              │
└─────────────────────────────────────────┘
```

On the PAN + Bureau screen:
```
│  ACTIVE SYSTEM                          │
│  Bureau Fetch → Rules Engine → LLM      │
│                                         │
│  AI USED?  ✓ Yes — but only to          │
│  write your result in plain English.    │
│  The actual decision (eligible/not)     │
│  is made by fixed rules. AI cannot      │
│  override the eligibility decision.     │
│                                         │
│  YOUR DATA                              │
│  PAN used for: credit bureau check      │
│  Not shared with third parties          │
│  Encrypted in transit (TLS 1.3)         │
```

---

## 7. Rules vs LLM vs Agent — The Clear Map

| Component | Type | Why |
|---|---|---|
| EMI calculation | Rules | Pure math formula |
| Car catalog filter | Rules | Structured data query |
| Eligibility decision | Rules | Must be auditable for RBI compliance |
| Rate determination | Rules | CIBIL score → rate matrix lookup |
| Document verification | Rules | Pass/fail checks, no ambiguity |
| Disbursement trigger | Rules | Event-driven, deterministic |
| Eligibility result message | LLM (renderer) | Writes natural language from structured output |
| Dealer customer brief | LLM (renderer) | Summarises structured profile in 2 lines |
| Conversational fallback | LLM (agent) | Handles freeform voice/text input |
| Follow-up messaging | Agent | Multi-step reasoning: timing + content + channel |

**The key principle:** LLM never makes credit decisions. It only explains decisions that rules already made.

---

## 8. Dummy Data Design

### Bureau Profiles (PAN-based)
| PAN Prefix | Profile | CIBIL | Existing EMI | Outcome |
|---|---|---|---|---|
| A | Excellent salaried professional | 782 | ₹0 | Full approval, best rate |
| B | Good profile, one car loan running | 724 | ₹8,200 | Full approval, standard rate |
| C | Average, credit card debt | 668 | ₹14,000 | Partial approval |
| D | Borderline, missed 1 payment | 638 | ₹18,000 | Reduced offer |
| E | Decline, multiple defaults | 584 | ₹32,000 | Soft decline |

### Rate Matrix
| CIBIL Score | Interest Rate |
|---|---|
| 750+ | 8.75% p.a. |
| 700–749 | 9.25% p.a. |
| 650–699 | 10.00% p.a. |
| 600–649 | 11.50% p.a. |
| Below 600 | Not eligible |

### Eligibility Rules
```
FOIR (Fixed Obligation to Income Ratio) must be ≤ 55%
  FOIR = (proposed EMI + existing EMIs) / monthly income

LTV (Loan to Value) max 85% of ex-showroom price (new cars)

Minimum income: ₹25,000/month (salaried), ₹40,000/month (self-employed)
Minimum age: 21 | Maximum age at loan end: 65
Minimum employment tenure: 1 year current employer (salaried)
```

### Car Catalog (20 cars across brands)
Brands: Maruti Suzuki, Hyundai, Tata, Honda, Toyota  
Segments: Hatchback / Sedan / SUV / MUV  
Price range: ₹5L to ₹25L  
New cars only.

---

## 9. API Contract

```
POST   /api/bureau/fetch              { pan } → { name, dob, cibil, existing_emis }
POST   /api/eligibility/check         { income, down_payment, vehicle_price,
                                        existing_emis, employment_type }
                                      → { eligible, amount, rate, max_tenure, reason }
POST   /api/emi/calculate             { principal, rate, tenure } → { emi }
POST   /api/application/submit        { customer, loan, vehicle } → { application_id }
GET    /api/application/:id           → { status, stage, timestamps }
POST   /api/dealer/approve            { application_id } → { sanction_letter }
POST   /api/documents/aadhaar-otp     { aadhaar } → { otp_sent: true }
POST   /api/documents/aadhaar-verify  { aadhaar, otp } → { name, dob, address, photo }
POST   /api/documents/aa-consent      { phone, channel }
                                      → { consent_url, qr_code, sms_sent }
GET    /api/documents/aa-fetch        { consent_id } → { statements, avg_income }
POST   /api/documents/itr-fetch       { pan } → { annual_income, employer, tds }
POST   /api/followup/register         { phone, session_data, drop_off_stage }
GET    /api/dealer/applications        → [ live application list ]
POST   /api/chat/message              { message, session_id }
                                      → { response, extracted_data }
```

---

## 10. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Kiosk Frontend | Next.js 14 (App Router) | Server components, fast, great for kiosk |
| Dealer Portal | Next.js 14 (separate app) | Same stack, consistent |
| Styling | Tailwind CSS | Rapid UI development |
| Animations | Framer Motion | Smooth gamification transitions |
| UI Components | Shadcn/UI | Clean, accessible, customisable |
| Avatar | Azure Cognitive Services Talking Avatar | Real-time lip sync, enterprise grade |
| Voice (TTS) | Azure Neural TTS | Priya's voice |
| LLM | Azure OpenAI (GPT-4o) | Bank alignment, same Azure ecosystem |
| Backend | Python FastAPI | Clean, fast, ideal for AI integration |
| Follow-up Messaging | Twilio WhatsApp API | Real WhatsApp delivery |
| Scheduler | APScheduler (Python) | Follow-up agent timing |
| Deployment | Azure Static Web Apps + Azure Container Apps | Full Azure story |

---

## 11. Build Sequence

### Phase 1 — Data and Rules Foundation
- [ ] Car catalog JSON (20 cars, variants, prices, images)
- [ ] Bureau profiles JSON (5 profiles mapped to PAN prefixes)
- [ ] Loan rules JSON (FOIR, LTV, rate matrix, min income)
- [ ] FastAPI project setup
- [ ] All mock APIs returning dummy data
- [ ] Eligibility rules engine
- [ ] EMI calculator

### Phase 2 — Kiosk Frontend
- [ ] Project setup (Next.js + Tailwind + Framer Motion)
- [ ] Stage 0: Idle screen + road animation
- [ ] Stage 1: Car catalog + selection
- [ ] Stage 2: Financial discovery (4 questions)
- [ ] Stage 3: PAN entry + bureau loading + reveal
- [ ] Stage 4: EMI optimizer
- [ ] Stage 5: Phone capture + review
- [ ] Stage 6: Waiting screen (WebSocket)
- [ ] Stage 7: Celebration screen
- [ ] Gamification layer (road, car movement, progress bar)
- [ ] "i" button transparency panel on every screen

### Phase 3 — Intelligence Layer
- [ ] Azure OpenAI integration (eligibility result writer)
- [ ] Dealer brief generator (LLM)
- [ ] Conversational fallback (chat agent)
- [ ] Azure Talking Avatar integration (Priya)
- [ ] Follow-up agent (scheduler + message writer + sender)

### Phase 4 — Dealer Portal
- [ ] Dashboard with live application feed
- [ ] Customer detail + AI brief
- [ ] Aadhaar eKYC flow
- [ ] Account Aggregator flow (QR + SMS both)
- [ ] ITR fetch flow
- [ ] Automated verification engine
- [ ] Digital agreement screen
- [ ] Disbursement trigger + status

### Phase 5 — Polish and Deploy
- [ ] End-to-end demo flow testing
- [ ] Mobile responsiveness for dealer portal
- [ ] Azure deployment (both apps)
- [ ] Demo script and walkthrough

---

## 12. What We Are NOT Building (Deferred)

- Used car loans
- Co-applicant flow
- Physical document upload (replaced by digital fetch)
- Real bureau API integration (all mocked)
- Real IMPS disbursement (mocked)
- Regional language support (deferred)
- Multiple dealer locations (one dealer for demo)

---

*This document is the single source of truth before we write any code. All implementation decisions flow from here.*
