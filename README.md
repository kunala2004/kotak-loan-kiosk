# Kotak Bank — Gamified Loan Journey

An end-to-end agentic AI system for Kotak Bank car showrooms. A customer walks into a showroom, talks to an AI avatar named **Priya** on a touchscreen kiosk, selects a car, and gets a real pre-approval in under 7 minutes. A LangGraph-orchestrated agent then handles digital document verification on the dealer side and delivers a one-click sanction recommendation.

**Goal:** Walk in → Drive out — under 25 minutes total.

---

## What this project demonstrates

- **Where AI genuinely helps** vs where rules are the right call
- **Clear separation** between deterministic money decisions (rules) and natural-language rendering (LLM)
- **A real agentic workflow** — not just LLM calls stitched together. LangGraph orchestrates 5 nodes with interrupt-resume for human-in-loop OTP/consent steps
- **Live analytics** on every kiosk visitor — including drop-offs — for cross-sell and funnel optimization

---

## Architecture

```
┌──────────────────┐   events    ┌──────────────────┐
│  Kiosk (3000)    │────────────▶│                  │
│  Customer-facing │             │  FastAPI (8000)  │
└──────────────────┘             │                  │
                                 │  ▪ sessions      │
┌──────────────────┐   polls     │  ▪ applications  │
│ Dealer (3001)    │◀───────────▶│  ▪ analytics     │
│ Applications +   │             │  ▪ LangGraph     │
│ Analytics tabs   │             │    review agent  │
└──────────────────┘             └──────────────────┘
```

Three apps, one backend. Each app owns its concern, shares nothing but the API.

---

## Where AI is used — honest breakdown

| Layer | Technology | AI? | Why this choice |
|---|---|---|---|
| Eligibility decision (approve/rate/FOIR) | Python rules | ❌ | Must be deterministic, auditable, RBI-safe |
| EMI math | Formula | ❌ | It's arithmetic |
| Document cross-verification | Python comparison | ❌ | Field matching is rules, not intelligence |
| Voice of Priya | ElevenLabs TTS | ✓ | Real-time voice synthesis |
| Priya's Stage-3 result message | LLM (OpenAI / Groq) | ✓ | Personalized prose from structured data |
| Dealer brief (2-line summary) | LLM | ✓ | Natural-language rendering |
| Review workflow orchestration | **LangGraph** | ✓ (agentic) | Multi-step with interrupts |
| Document cross-check narrative | LLM | ✓ | Prose summary |
| Follow-up drop-off messaging | LLM agent | ✓ (agentic) | Multi-step reasoning: timing + channel + content |
| Analytics insights | LLM (template today) | ⚠ | Narrative summarization |

**Key principle:** LLM never makes credit decisions. It only explains decisions that rules already made. AI does prose; rules do money.

---

## The 7-stage customer journey

| Stage | What happens | System |
|---|---|---|
| 0 | Idle / Attract — Priya stands silent | TTS on tap |
| 1 | Car catalog — filter 20 cars by brand/segment | Rules |
| 2 | Financial discovery — 4 sliders, no typing | Rules (live EMI preview) |
| 3 | PAN + bureau fetch + eligibility result | Mock bureau → Rules decide → LLM writes Priya's message |
| 4 | EMI optimizer — customize loan | Rules |
| 5 | Phone + review — final submission | Form validation |
| 6 | Waiting — polls dealer status every 3s | WebSocket-ready polling |
| 7 | Celebration — "Your car is waiting for you" | Auto-advance on dealer sanction |

---

## The dealer flow

**Applications tab** — live list of submitted applications. Click any row to open full detail.

**Analytics tab** — funnel chart across all 11 kiosk stages, drop-off hotspot, popular cars, conversion rate, avg time on kiosk, full event timeline per session.

**Application detail** has an **AI Review panel** that runs a LangGraph 5-agent pipeline:

```
init → request_aadhaar ⏸ → fetch_aadhaar
     → request_aa      ⏸ → fetch_aa
     → request_itr     ⏸ → fetch_itr
     → verify → (conditional) underwrite OR flagged
     → compose_brief → END
```

Each `⏸` is a `langgraph.interrupt()` — the graph pauses until the dealer enters the OTP (demo: `123456`). State persists via `InMemorySaver`. Cross-verification is deterministic Python; the brief and narrative are LLM-written when the OpenAI key is set.

---

## Tech stack

| Layer | Choice |
|---|---|
| Kiosk frontend | Next.js 16 + Tailwind + Framer Motion + Zustand |
| Dealer portal | Next.js 16 (separate app) |
| Backend | Python 3.11 + FastAPI |
| Agentic orchestration | LangGraph 1.x (with `interrupt()` primitive) |
| LLM | OpenAI GPT-4o (graceful fallback to templates if no key) |
| Voice | ElevenLabs (default voice: Lily, Indian female) |
| Session store | JSON file (demo); swap for Postgres in prod |
| Mock India Stack | JSON files for bureau / Aadhaar / AA / ITR (demo); swap for real APIs in prod |

---

## Demo personas (PAN prefix → outcome)

| PAN prefix | Persona | CIBIL | Outcome |
|---|---|---|---|
| A | Rahul Sharma · Salaried · TCS | 782 | Strong approval |
| B | Priya Mehta · Salaried · Infosys | 724 | Standard approval |
| C | Vikram Patel · Self-employed retail | 668 | Partial approval |
| D | Sneha Gupta · Salaried small firm | 638 | Reduced offer |
| E | Rajan Kumar · Self-employed · defaults | 584 | Soft decline |

Any PAN starting with that letter triggers that persona.

**Demo OTP:** `123456` — works for all OTP prompts in the AI Review panel.

---

## Run locally

### Backend
```bash
cd backend
python -m venv venv
source venv/Scripts/activate      # Windows: venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env              # fill in ELEVENLABS_API_KEY, OPENAI_API_KEY
uvicorn main:app --reload --port 8000
```

### Kiosk
```bash
cd kiosk
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev                        # opens on http://localhost:3000
```

### Dealer Portal
```bash
cd dealer-portal
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev -- -p 3001             # opens on http://localhost:3001
```

---

## Deploy (free)

### Backend → Render
1. Sign in to [render.com](https://render.com) with GitHub
2. **New → Web Service** → connect this repo
3. Render auto-detects `backend/render.yaml`
4. Set these env vars in the dashboard: `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`
5. Deploy → note the URL (e.g. `https://kotak-backend.onrender.com`)

### Frontends → Vercel (two separate projects)
1. Sign in to [vercel.com](https://vercel.com) with GitHub
2. **Add new project** → import this repo → **Root Directory: `kiosk`**
3. Add env var: `NEXT_PUBLIC_API_URL` = your Render URL
4. Deploy → this gives you the kiosk URL
5. Repeat with **Root Directory: `dealer-portal`** for the second project

### Auto-deploy on push
Once connected, every `git push origin main` redeploys all three apps automatically.

---

## Project structure

```
kotak-project/
├── backend/                 FastAPI + LangGraph + rules engine
│   ├── agents/              llm_reasoner, review_graph, followup_agent
│   ├── data/                cars.json, bureau_profiles.json, demo_documents.json
│   ├── engines/             eligibility_engine, emi_calculator
│   ├── routers/             bureau, eligibility, application, dealer, review, ...
│   ├── main.py
│   ├── render.yaml
│   └── requirements.txt
│
├── kiosk/                   Customer-facing Next.js app
│   ├── app/page.tsx         7-stage switch
│   ├── components/
│   │   ├── stages/          One file per stage
│   │   └── shared/          PriyaAvatar, RoadProgress, KotakHeader, TTSToggle
│   └── lib/                 useSpeech, useSession, store, types
│
├── dealer-portal/           Dealer-facing Next.js app
│   ├── app/
│   │   ├── page.tsx                          Applications list
│   │   ├── applications/[id]/page.tsx        Application detail + AI Review
│   │   └── analytics/                        Funnel + sessions tab
│   └── components/          NavTabs, AIReviewPanel
│
├── SYSTEM_DESIGN.md         Original product design doc
└── README.md
```

---

## Roadmap

Built and shipped:
- ✓ 7-stage kiosk with Priya TTS
- ✓ Rules-based eligibility engine
- ✓ Dealer portal with live applications + analytics tabs
- ✓ Full session tracking (every visitor, including drop-offs)
- ✓ LangGraph agentic review with OTP interrupt-resume
- ✓ Mock India Stack (bureau, Aadhaar, AA, ITR) with consistent persona data
- ✓ Customer notifications on sanction (mock SMS)

Next:
- Voice-driven kiosk (Whisper + GPT-4o structured output)
- Auto-sanction for clear profiles (CIBIL ≥ 750 + FOIR < 30%)
- Twilio-wired follow-up agent for drop-offs
- Car recommendation agent (natural language → top 3 picks)

---

## Credits

Built as an agentic AI demo for Kotak Mahindra Bank. Uses public India Stack concepts (UIDAI, Account Aggregator, Income Tax portal) — all mocked. No real customer data.
