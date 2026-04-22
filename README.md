<div align="center">

# Kotak · Gamified Loan Kiosk

**Walk into a showroom → drive out with a car in 25 minutes.**

An end-to-end agentic AI system for Kotak Bank's car-loan journey.
A customer talks to a real-time Azure AI avatar named Priya, picks a car,
answers four slider-based questions, gets a pre-approval, and walks to the
dealer desk — where a LangGraph-orchestrated agent handles digital document
verification with OTP human-in-loop and recommends a one-click sanction.

<br/>

### 🚀 Try it live

| Role | Try it | What you'll see |
|---|---|---|
| **Customer** | **[→ ai-loan-kiosk.vercel.app](https://ai-loan-kiosk.vercel.app/)** | Priya live, full 7-stage journey with WebRTC avatar |
| **Dealer** | **[→ ai-loan-dealer.vercel.app](https://ai-loan-dealer.vercel.app/)** | Applications queue + Analytics funnel + LangGraph review |
| **API docs** | **[→ kotak-loan-kiosk.onrender.com/docs](https://kotak-loan-kiosk.onrender.com/docs)** | FastAPI auto-generated Swagger |

> First request to the backend may take ~30s (Render free tier cold start).
> Demo PAN starts with **A / B / C / D / E** → different personas & outcomes.
> Demo OTP in the AI Review panel is **`123456`**.

![Next.js](https://img.shields.io/badge/Next.js_16-000?style=flat&logo=nextdotjs&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph_1.1-1C3C3C?style=flat)
![Azure](https://img.shields.io/badge/Azure_Speech_+_Avatar-0078D4?style=flat&logo=microsoftazure&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI_GPT--4o-412991?style=flat&logo=openai&logoColor=white)

</div>

---

## What this actually is

A three-part system demonstrating where AI genuinely belongs in a loan flow
— and where it doesn't. Nothing marketing-flavoured:

- **Money decisions (eligibility, rate, FOIR)** → deterministic rules, auditable, RBI-defensible
- **Natural-language rendering (greetings, briefs, narratives)** → LLM calls
- **Multi-step coordination (document verification with OTP pauses)** → LangGraph agentic workflow
- **Customer face (avatar)** → Azure Real-Time TTS Avatar streaming over WebRTC

The split is the point. A regulator can inspect the rules. An interviewer can
see the agent. A customer sees Priya.

## Screenshots

> **Add your screenshots to `docs/screenshots/` with these filenames and they'll render below.**

### Customer kiosk
<div align="center">

<img src="docs/screenshots/idle.png" width="85%" alt="Priya greets the customer on arrival — WebRTC avatar, editorial two-column layout"/>

| Car catalog | Financial discovery | PAN + Bureau |
|---|---|---|
| ![](docs/screenshots/car-catalog.png) | ![](docs/screenshots/financial-discovery.png) | ![](docs/screenshots/pan-entry.png) |

| Pre-approval reveal | EMI optimizer | Celebration |
|---|---|---|
| ![](docs/screenshots/eligibility-result.png) | ![](docs/screenshots/emi-optimizer.png) | ![](docs/screenshots/celebration.png) |

</div>

### Dealer portal
<div align="center">

| Applications queue | Analytics funnel |
|---|---|
| ![](docs/screenshots/dealer-applications.png) | ![](docs/screenshots/dealer-analytics.png) |

<img src="docs/screenshots/ai-review.png" width="85%" alt="LangGraph agentic review — 5-agent pipeline with OTP interrupt-resume"/>

</div>

## Architecture

```
┌─────────────────┐     events      ┌───────────────────────┐
│  Kiosk (3000)   │────────────────▶│                       │
│  Customer-facing│                 │                       │
│  Next.js 16     │ token + ICE     │   FastAPI Backend     │
│                 │◀────────────────│   (8000)              │
│                 │                 │                       │
│  ┌───────────┐  │    WebRTC       │   ▪ sessions.json     │
│  │  Azure    │  │  video+audio    │   ▪ applications[]    │
│  │  Speech   │◀─┼─────────────────┼─▶ ▪ analytics/*       │
│  │  SDK      │  │  peer-to-peer   │   ▪ LangGraph review  │
│  └───────────┘  │  (lip-synced)   │   ▪ mock India Stack  │
└─────────────────┘                 │                       │
                                    │   Azure Speech API    │
┌─────────────────┐     polls       │   OpenAI GPT-4o       │
│ Dealer (3001)   │◀───────────────▶│   Groq LLM (optional) │
│ Applications +  │   10s poll      │                       │
│ Analytics tabs  │                 └───────────────────────┘
└─────────────────┘
```

Three apps, one backend. Each app owns its concern, shares nothing but the API.

## 🧭 How to walk the full demo (customer + dealer, end-to-end)

Open both links side-by-side. ~90 seconds total.

### 1. On the **[kiosk](https://ai-loan-kiosk.vercel.app/)** (customer screen)

1. **Wait 3–5 seconds** — Lisa's WebRTC avatar auto-connects. You'll see her pulse-ring "connecting" indicator, then she appears nodding. No action needed.
2. **Tap "Begin"** — she speaks the greeting (first tap unlocks audio, browser rule). She speaks, then auto-advances.
3. **Pick a car** — filter by brand, tap any card. Priya corner-widget reacts in bottom-left.
4. **Answer 4 sliders** — down payment, tenure, employment, income range. Live EMI preview.
5. **See the teaser** — *"Your eligibility: ₹ █████"* blurred. Hook to PAN entry.
6. **Enter PAN** — use `ABCPE1234A` (prefix A → Rahul Sharma, strong approval). Backend runs mock bureau → rules engine → LLM writes Priya's result message.
7. **Eligibility reveal** — 🎉 amount, rate, EMI, CIBIL 742. Priya congratulates in natural language.
8. **Adjust EMI** — three sliders; numbers update live.
9. **Enter phone** — any 10 digits. Review screen shows everything.
10. **Submit** → you land on the Waiting screen. Polls dealer status every 3s.

### 2. On the **[dealer portal](https://ai-loan-dealer.vercel.app/)** — process the application

1. **Applications tab** (the default page) → your new submission appears at the top within 10 seconds.
2. **Click "Review →"** on the row → opens the application detail page.
3. **(Optional) Click "Generate Brief"** → LLM writes a 2-line customer approach guide in ~1s.
4. **Click "▶ Start AI Review"** inside the AI Review panel (dark header).
   A terminal-style log appears and the LangGraph graph runs live:
   - 🪪 Aadhaar OTP request → **enter `123456`** → Aadhaar eKYC data fetched
   - 🏦 Account Aggregator consent → **enter `123456`** → 6 months of bank statements
   - 📄 ITR portal OTP → **enter `123456`** → Form 26AS / income data
   - 🔍 Cross-verification (6 checks) — name, DOB, employment, income, existing EMI, banking hygiene
   - ⚖️ Underwriter re-runs FOIR on **verified** income
   - ✍️ LLM composes the final dealer brief
5. **Recommendation card appears** — `SANCTION` in green with confidence % + the prose brief.
6. **Click "✓ Sanction & Notify Customer"** — the big green button.
   - Application status flips to `Sanctioned`
   - Right sidebar "Customer Notifications" shows the mock SMS sent to the customer's phone
   - **Back on the kiosk** → the waiting screen auto-advances to the celebration screen within 3 seconds
7. **Click "Disburse Amount"** — second mock SMS logged, status → `Disbursed`.

### 3. On the **Analytics tab** — see the journey data

Same dealer portal, top-right nav: **Analytics**.

- **5 stat cards** — Total sessions / Active now / Completed / Dropped / Conversion rate
- **AI Insights** panel — narrative bullets over the funnel
- **Funnel chart** — all 11 stages, bar per stage with % reaching it
- **Drop-off hotspot** — highlights which stage loses the most customers
- **Popular cars** — top 5 picks
- **Recent Sessions** table — every kiosk visitor (yes, including drop-offs). Click any row → **full event timeline** with readable rows (not raw JSON): car picked, financial answers, PAN masked, bureau profile, loan config, phone, application ID.

> Try the different PAN prefixes to see how the system behaves:
> **A** (Rahul, CIBIL 782) → strong approval · **C** (Vikram, CIBIL 668) → partial approval · **E** (Rajan, CIBIL 584) → soft decline with phone captured for follow-up.

---

## The customer journey — 7 stages

| # | Stage | What happens | What runs |
|:-:|---|---|---|
| 0 | Idle / Attract | WebRTC avatar auto-connects on page load. First tap unlocks audio → Priya greets. | Azure Avatar (WebRTC) |
| 1 | Car Catalog | Filter 20 cars by brand + segment. Tap to pick. | Rules (JSON query) |
| 2 | Financial Discovery | 4 slider questions: down payment, tenure, employment, income range. Live EMI preview. | Rules (EMI formula) |
| 3 | PAN + Bureau | Customer enters PAN → mock bureau returns profile → rules engine computes eligibility → LLM writes Priya's result message | Mock bureau → rules → LLM renderer |
| 4 | EMI Optimizer | Three sliders adjust amount/tenure/down payment with live EMI update. | Rules (EMI math) |
| 5 | Phone + Review | Phone capture, review card, submit. | Form validation |
| 6 | Waiting | Kiosk polls application status every 3s. Auto-advances the instant the dealer sanctions. | WebSocket-ready polling |
| 7 | Celebration | Confetti, *"Your car is waiting for you"*, SMS notification acknowledgement. | Rules |

## Where AI sits — honest breakdown

| Feature | Technology | Why this choice |
|---|---|---|
| Priya's face + voice | **Azure Real-Time TTS Avatar** (WebRTC, lip-synced) | Real-time, multi-region, enterprise-grade |
| Stage-3 result message | **LLM (OpenAI / Groq)** | Personalized prose from structured rule-engine output |
| Dealer brief | **LLM renderer** | Turns 12 structured fields into 3 natural-language lines |
| Follow-up drop-off agent | **LLM + tools** | Multi-step reasoning: timing + channel + tone + message body |
| Agentic document review | **LangGraph 1.x** | 5-node graph with `interrupt()` for OTP pauses |
| Eligibility decision | **Rules engine** | Deterministic, auditable, RBI-safe |
| FOIR / LTV / rate lookup | **Rules** | Money decisions never leave the rules layer |
| Document cross-verification | **Python comparison** | Field matching is rules, not intelligence |
| Session tracking | **JSON file** (swap for Postgres in prod) | Every kiosk visitor logged, including drop-offs |

**Principle: the LLM never makes credit decisions. It only explains
decisions that rules already made.**

## The agentic review (LangGraph deep-dive)

When the dealer clicks **Start AI Review** on an application, this graph runs:

```
         START
           │
         init  ──▶ request_aadhaar_otp ⏸   (interrupt — waits for dealer-entered OTP)
                          │
                   fetch_aadhaar (mock)
                          │
                    request_aa_consent ⏸   (interrupt — consent code)
                          │
                    fetch_aa (mock)
                          │
                    request_itr_otp ⏸      (interrupt — IT portal OTP)
                          │
                    fetch_itr (mock)
                          │
                         verify
                    ┌─────┴─────┐
                    │           │
              [2+ flags]     [passes]
                    │           │
              flagged_end   underwrite   ← re-runs FOIR on VERIFIED income
                    │           │        (rules engine, authoritative)
                    │           │
                    └──▶ compose_brief  ← LLM writes 3-line dealer summary
                              │
                            END
```

Key properties:

- **Human-in-loop via `langgraph.types.interrupt()`** — the graph pauses at each OTP node until the dealer POSTs the code; state is persisted in `InMemorySaver` so the pause survives across HTTP calls
- **Conditional edges** — 2+ verification flags route to `flagged_end`; otherwise to `underwrite`
- **LLM is the renderer, not the underwriter** — the re-check uses the same rules engine that Stage 3 did, just fed verified income from the AA data rather than the customer's declared income

For the demo OTP is hardcoded (`123456`) — swap in real UIDAI / Sahamati / IT portal integrations to ship.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Kiosk + Dealer frontend | Next.js 16 (App Router) + Tailwind + Framer Motion + Zustand | Fast, SSR-ready, great for touchscreens |
| Backend | Python 3.11 + FastAPI | Async, type-hinted, best-in-class for AI glue |
| Agentic orchestration | LangGraph 1.1.9 with `InMemorySaver` | Native interrupt/resume, conditional edges, graph visualisation |
| Avatar | Azure Real-Time TTS Avatar (`lisa-casual-sitting`) | Sub-second lip-sync via WebRTC |
| Voice | Azure Neural TTS (`en-IN-NeerjaNeural`) | Indian English female, free-tier friendly |
| LLM | OpenAI GPT-4o (with graceful template fallback if no key) | Best prose quality; templates keep demo alive without keys |
| Mock India Stack | JSON files (`bureau_profiles.json`, `demo_documents.json`) | One master file per citizen keeps Aadhaar / AA / ITR consistent |
| Session store | `sessions.json` on disk | Demo-simple; swap for Postgres in prod with zero code change |
| Deployment | Render (backend) + Vercel (two frontends) | Both free tier, GitHub-connected auto-deploy on `git push` |

## Demo personas

PAN prefix triggers a persona — the whole journey is deterministic based on
the first letter:

| PAN prefix | Persona | CIBIL | Outcome |
|:-:|---|:-:|---|
| **A** | Rahul Sharma · Salaried at TCS | 782 | Strong approval, best rate |
| **B** | Priya Mehta · Salaried at Infosys BPM | 724 | Standard approval |
| **C** | Vikram Patel · Self-employed retail | 668 | Partial approval |
| **D** | Sneha Gupta · Salaried small firm, 2 missed payments | 638 | Reduced offer, CIBIL hidden |
| **E** | Rajan Kumar · Self-employed, 5 missed, defaults | 584 | Soft decline, phone captured for follow-up |

**Demo OTP:** `123456` — works for all OTP prompts in the AI Review panel.

## Run locally

Three terminals.

### 1. Backend
```bash
cd backend
python -m venv venv
source venv/Scripts/activate    # Windows Git Bash
pip install -r requirements.txt
cp .env.example .env             # fill Azure / OpenAI / ElevenLabs keys
uvicorn main:app --reload --port 8000
```

### 2. Kiosk
```bash
cd kiosk
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev                      # http://localhost:3000
```

### 3. Dealer Portal
```bash
cd dealer-portal
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev -- -p 3001           # http://localhost:3001
```

## Deploy (free)

### Backend → Render
1. [dashboard.render.com](https://dashboard.render.com) → **New Web Service** → connect this repo
2. Root Directory: `backend` · Build: `pip install -r requirements.txt` · Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Env vars: `PYTHON_VERSION=3.11.9`, `TTS_PROVIDER=azure`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION=centralindia`, `AZURE_AVATAR_KEY`, `AZURE_AVATAR_REGION=southeastasia`
4. Deploy → copy the URL (e.g. `kotak-loan-kiosk.onrender.com`)

### Frontends → Vercel (two projects)
1. [vercel.com/new](https://vercel.com/new) → import this repo → **Root Directory: `kiosk`**
2. Env var: `NEXT_PUBLIC_API_URL=<your Render URL>`
3. Deploy → get your kiosk URL
4. Repeat with **Root Directory: `dealer-portal`**

Every `git push origin main` auto-redeploys all three.

## Project structure

```
kotak-project/
├── backend/
│   ├── agents/                    LLM reasoner + LangGraph review graph
│   │   ├── review_graph.py        ▸ the agentic review pipeline (6 nodes)
│   │   ├── llm_reasoner.py        ▸ single abstraction over OpenAI with template fallback
│   │   └── followup_agent.py      ▸ drop-off recovery agent (APScheduler)
│   ├── data/
│   │   ├── cars.json              20 cars, 5 brands
│   │   ├── bureau_profiles.json   5 PAN-prefix personas (A-E)
│   │   ├── demo_documents.json    Aadhaar / AA / ITR per persona
│   │   └── loan_rules.json        FOIR, LTV, rate matrix, income floors
│   ├── engines/
│   │   ├── eligibility_engine.py  ▸ the rules engine (never overridden by AI)
│   │   └── emi_calculator.py
│   ├── routers/                   bureau, eligibility, application, dealer, review, sessions, analytics, avatar, tts
│   └── main.py
│
├── kiosk/                         Customer touchscreen
│   ├── app/page.tsx               AvatarProvider wrapper + stage switch
│   ├── components/
│   │   ├── stages/                One file per journey stage
│   │   └── shared/                PriyaAvatar, RoadProgress, KotakHeader, TTSToggle
│   └── lib/
│       ├── useAvatar.ts           WebRTC hook (Azure Speech SDK)
│       ├── avatarContext.tsx      Auto-starts session on page mount
│       ├── useSpeech.ts           Audio-only fallback (Neerja / browser TTS)
│       ├── useSession.ts          Every stage transition → /session/event
│       └── store.ts               Zustand kiosk state
│
├── dealer-portal/                 Dealer web app
│   ├── app/
│   │   ├── page.tsx               Applications queue (polls every 10s)
│   │   ├── applications/[id]/     Full application + AI Review panel
│   │   └── analytics/             Funnel, drop-offs, session timelines
│   └── components/
│       ├── NavTabs.tsx
│       └── AIReviewPanel.tsx      ▸ the LangGraph OTP UI
│
├── SYSTEM_DESIGN.md               Original product design doc
└── README.md                      You are here
```

## What's built · what's next

**Shipped:**
- [x] 7-stage customer kiosk with Azure Real-Time Avatar (WebRTC)
- [x] Editorial Tier-1 UI with auto-connecting WebRTC on page load
- [x] Rules-based eligibility engine (FOIR / LTV / rate matrix / min-income)
- [x] Mock India Stack — bureau, Aadhaar eKYC, Account Aggregator, ITR
- [x] Dealer portal with Applications + Analytics tabs
- [x] Full session tracking for every kiosk visitor (including drop-offs)
- [x] LangGraph agentic review with OTP interrupt/resume (6-node graph)
- [x] LLM dealer brief generator (OpenAI / Groq switchable)
- [x] Customer notifications on sanction (mock SMS logged)
- [x] One-repo monorepo deployable in 3 clicks (Render + 2× Vercel)

**Next:**
- [ ] Voice-driven kiosk (Whisper STT + GPT-4o structured output — drops slider inputs)
- [ ] Auto-sanction for clear profiles (CIBIL ≥ 750 + FOIR < 30%)
- [ ] Twilio-wired follow-up agent with real WhatsApp sending
- [ ] Custom Indian avatar (Azure Custom Avatar — video recording + approval)
- [ ] Leads table for declined customers (cross-sell funnel)

## Credits

Built as an interview-stage agentic AI demo for Kotak Mahindra Bank. Uses
public India Stack concepts (UIDAI, Account Aggregator, IT portal) — all
mocked. No real customer data anywhere in the repo.
