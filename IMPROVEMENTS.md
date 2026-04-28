# Improvements Backlog

Tracked list of known gaps and enhancements. Update this file as items are
completed (move from "To do" to "Done — when, what, link to commit").

Categories — Rules engine · Knowledge base · LLM stack · LangGraph
orchestration · Frontend · DevOps · Tests.

Priority key: 🔥 ship-blocker · 🟡 next phase · 🟢 nice-to-have.

---

## Rules engine

### 🔥 Add input validation
**Problem:** `eligibility_engine.check_eligibility()` does not validate
inputs. Negative `existing_emi`, zero `income`, `down_payment > vehicle_price`,
out-of-range `tenure_months`, and `age < min_age` are not rejected.
**Fix:** Wrap the function with a Pydantic input model that enforces
ranges. Reject with a clear error before any computation runs.
**Where:** `backend/engines/eligibility_engine.py`.

### 🟡 Reconcile rules engine with KB policy
**Problem:** `loan_rules.json` uses a single 55% FOIR cap for all bands.
The KB (`policy/foir_caps.md`) describes a richer cap-by-income-by-CIBIL
matrix. Brief text may suggest a tighter cap than the engine actually
applies.
**Fix:** Either expand the engine to use the matrix, OR simplify the KB
to match the engine. Engine should always be the single source of truth.
**Where:** `backend/engines/eligibility_engine.py`,
`backend/data/loan_rules.json`, `backend/data/knowledge_base/policy/foir_caps.md`.

### 🟡 Salaried vs self-employed rate spread
**Problem:** Engine uses a single rate per CIBIL band. KB describes a
25 bps salaried concession. Brief text claims this concession; engine
doesn't reflect it.
**Fix:** Add `employment_type` parameter to `get_interest_rate()`; apply
spread.
**Where:** `backend/engines/eligibility_engine.py`.

### 🟡 LTV by car age and segment
**Problem:** Engine uses a flat 85% LTV. KB describes lower LTV for older
used cars and premium segments. Engine doesn't differentiate.
**Fix:** Read car age and price tier from the application; adjust LTV
cap from a small lookup table.

### 🟢 Rate concession at high tenure
**Problem:** KB mentions a +25 bps floating-rate concession at tenure ≥ 60
months. Engine doesn't model this option at all.
**Fix:** Add a `rate_type` field (`fixed` / `floating`); engine returns
both options when applicable.

---

## Knowledge base

### 🟡 Pad sparse chunks with prose summaries — **paired with Ask Priya**
**Problem:** Chunks like `min_income.md`, `processing_fees.md`,
`age_eligibility.md` are mostly tables. Embedding-based retrieval misses
queries that use synonyms (`salary cutoff` instead of `income requirement`).
**Why it can wait today:** Our current retrieval queries are built from
structured form data (employment, CIBIL band, income, car) — we control
the vocabulary on both ends, so synonym mismatch never happens. This only
becomes a blocker when **Ask Priya** lets customers type free-form
questions through the same KB.
**Fix:** Add a one-paragraph summary at the top of each thin chunk that
paraphrases key terms.
**Where:** `backend/data/knowledge_base/policy/*.md` (the table-heavy ones).
**Ship together with:** the Ask Priya feature below.

### 🟡 Embed metadata text alongside chunk body
**Problem:** Currently only `c.content` gets embedded. Tags
(`[eligibility, minimum-income, employment]`) and chunk id are not in the
search vector.
**Fix:** In `_index_all()`, prepend `f"# {c.id}\nTags: {', '.join(c.tags)}\n\n"`
to the embedded document.
**Where:** `backend/agents/knowledge_base.py:_ChromaIndex._index_all`.

### 🟡 Hybrid retrieval — semantic + BM25 — **paired with Ask Priya**
**Problem:** Pure semantic search misses free-form queries that contain a
literal term from the chunk but in a way the embedder doesn't fully
capture (e.g., "₹25,000 income enough" — works today, borderline tomorrow).
**Why it can wait today:** Same as above — current queries are
structured. Only matters when free-form text becomes a query source.
**Fix:** Run both ChromaDB and BM25 in parallel. Merge results using
reciprocal rank fusion (RRF). We already have BM25 implemented as a
fallback; promote it to a co-retriever.
**Where:** `backend/agents/knowledge_base.py:KnowledgeBase`.
**Ship together with:** Ask Priya.

### 🟢 Score threshold for retrieval
**Problem:** We always return top-K, even if the K-th hit has a weak score
(e.g., 0.18). Weak chunks confuse the LLM.
**Fix:** Drop chunks below a configurable threshold (default ~0.3 cosine).
Edge-of-quality chunks become "no match" rather than noise.

### 🟢 Better embedding model
**Problem:** `MiniLM-L6-v2` (384 dims, the ChromaDB default) is fine but
not the strongest synonym handler.
**Fix:** Switch to OpenAI `text-embedding-3-small` via OpenRouter / direct
API. Cost is negligible at 30 chunks. Re-index once.

### 🟢 KB-vs-engine drift detector
**Problem:** Hard to know if a KB edit silently contradicts what the
engine actually does.
**Fix:** A CI script that:
1. Parses numerical claims from KB markdown (FOIR caps, rates, income floors).
2. Compares them against `loan_rules.json` and engine code paths.
3. Fails CI if any mismatch.

---

## LLM stack

### 🟡 LangSmith tracing — actually wire it up
**Problem:** `.env` has `LANGSMITH_API_KEY=` placeholder. Tracing is
defensively disabled if no key is set. We never see prompt/response
traces in production.
**Fix:**
1. Sign up at smith.langchain.com (free tier: 5K traces/month).
2. Add the key to Render env vars. Flip `LANGCHAIN_TRACING_V2=true`.
3. Wrap the OpenAI client with `langsmith.wrappers.wrap_openai()` in
   `llm_reasoner._client_and_model()` so the OpenAI SDK calls auto-trace.
**Where:** `backend/agents/llm_reasoner.py`.

### 🟡 Per-call AI metadata in review state
**Problem:** Right now we store `brief_meta` only at the brief node.
Per-call meta (which chunks were retrieved, tokens used, latency, model)
isn't surfaced.
**Fix:** Add `ai_trace: list[dict]` to `ReviewState`; each LLM-calling
node appends an entry: `{node, model, retrieved_chunks, tokens, latency_ms}`.
Serve via `/review/state/{id}`. Lets us optionally render an "AI Activity"
panel later.

### 🟢 Streaming responses
**Problem:** The dealer waits ~1.2 s for the brief while the entire
response generates. Could feel snappier streamed.
**Fix:** Backend exposes `/review/stream/{id}` over Server-Sent Events.
Frontend renders the brief token-by-token. LLM stack supports this
natively; just need an SSE endpoint and a small UI consumer.

---

## LangGraph orchestration

### 🟡 SqliteSaver for durable execution
**Problem:** We use `InMemorySaver`, which loses all paused-graph state
on backend restart. Killing uvicorn mid-flow breaks the demo.
**Fix:** Swap `InMemorySaver()` → `SqliteSaver.from_conn_string("data/checkpoints.sqlite")`.
**Where:** `backend/agents/review_graph.py:build_graph()`.
**Side benefit:** Demo "kill the server, restart, OTP still works"
becomes a real reproducible moment.

### 🟡 LLM-driven decision router (real agentic node)
**Problem:** `_after_verify` is a 3-line flag-counter. The actual routing
decision (auto-sanction / underwrite / flag / decline) currently has zero
LLM reasoning.
**Fix:** Replace the function with an LLM node that reads the
verification report + bureau band + FOIR + soft flags, retrieves
relevant chunks from `risk/` and `policy/`, and returns a structured
routing decision with a one-sentence rationale. Makes the graph
genuinely agentic.

### 🟢 Risk Memo Composer node
**Problem:** Verification narrative is a one-liner. A richer risk memo
synthesizing all available signals would strengthen the brief.
**Fix:** New node between `verify` and `compose_brief` that produces a
structured risk memo (Pydantic) — fed as additional context into
`compose_brief`.

### 🟢 Graph visualisation endpoint
**Problem:** "What does the graph look like?" requires reading code.
**Fix:** `GET /review/graph.png` calls `REVIEW_GRAPH.get_graph().draw_mermaid_png()`
and returns the PNG. Add a "View Agent" button in the dealer portal that
opens the diagram in a modal.

### 🟢 Subgraph for the OTP-fetch trio
**Problem:** Aadhaar, AA, ITR are essentially "request OTP → wait →
fetch data" three times. Repetition.
**Fix:** Extract the pattern as a reusable LangGraph subgraph parameterised
by source. Cleaner code, fewer nodes to maintain.

---

## Frontend (kiosk + dealer portal)

### 🟡 Customer-side LLM upgrade — Stage 3 message via OpenRouter + RAG
**Problem:** `result_writer.py` (the kiosk's Stage 3 congratulations
message) still uses the old direct OpenAI client without KB grounding.
With no `OPENAI_API_KEY` it falls through to a hardcoded template.
**Fix:** Rewrite `result_writer.py` to use `llm_reasoner._chat()` and
retrieve from KB (`policy/`, `cross_sell/`). Adds the same RAG-grounded
prose to the customer reveal screen.

### 🟡 Mirror AI/template toggle on the customer reveal screen
**Problem:** The toggle exists only on the dealer portal. Customer
flow has no visible AI-vs-template contrast.
**Fix:** Same toggle pattern on the kiosk Stage 3 reveal, hidden behind
`?demo=true` URL flag (so production UI stays clean).

### 🟡 Ask Priya — RAG Q&A on the kiosk
**Problem:** Customer can't ask free-form questions ("what if I lose my
job?", "can I prepay early?"). Today's flow is form-only — every retrieval
query is built from structured form data, so retrieval works perfectly. The
moment we let customers type free-form text, retrieval quality matters
much more.

**What this feature needs (full prerequisites checklist):**

1. **Backend — new endpoint `POST /qa`**
   - Input: `{ question: str, session_context?: dict }`
   - Steps: retrieve top-K from `faq/` (and possibly `policy/`) → build
     grounded prompt → LLM call (Pydantic structured output) → return
     `{ answer: str, citations: [chunk_id], confidence: float }`
   - Live in `backend/routers/qa.py`, wires to `agents/llm_reasoner.py`

2. **Backend — KB retrieval upgrades** *(see paired items above)*
   - Pad sparse chunks with prose summaries
   - Hybrid retrieval (semantic + BM25) for synonym robustness
   - Score threshold so weak hits don't pollute the prompt

3. **Backend — guardrails for free-form input**
   - Reject prompt-injection patterns ("ignore previous instructions...")
   - Refuse to answer outside scope (rate quotes, advice on competitors)
   - Profanity / abuse filter on customer text
   - Rate-limit per session to prevent token-bombing

4. **Frontend — new kiosk stage `AskPriyaScreen.tsx`**
   - Text input + voice input (Azure Speech-to-Text via existing avatar
     SDK — already on the page)
   - Loading state while LLM thinks (~1–2 s)
   - Render answer + small "sources" footer linking to chunk ids
   - "Out of scope?" gentle redirect path

5. **UX — Priya speaks the answer aloud**
   - Pipe the LLM response into `useAvatar.speak(text)` so Priya lip-syncs
     the answer (the WebRTC avatar is already on screen)
   - Need to keep the avatar session alive throughout (see WebRTC item
     under Frontend → "Persistent WebRTC avatar session")

6. **Analytics — log Q&A events**
   - Add `kb_query` event type so we see what customers ask
   - Top unanswered queries become signal for new KB chunks

7. **Knowledge base content additions**
   - Audit `faq/` for coverage gaps (job loss, family medical emergency,
     change of car mid-application, NRI status changes…)
   - Likely 10–15 new chunks needed to handle 80% of plausible questions

8. **Tests**
   - Retrieval regression suite: 30+ (question → expected chunk id) cases
   - Refusal tests: prompt-injection attempts, off-scope queries
   - Latency budget: end-to-end Q&A under 2.5 s p95

**Ship order:** Backend prereqs (1, 2, 3) → minimal frontend (4) →
voice + WebRTC keep-alive (5) → analytics + tests (6, 8) → KB expansion (7,
ongoing).

**Where:** `backend/routers/qa.py` (new), `backend/agents/llm_reasoner.py`
(extend with `answer_question()`), `kiosk/components/stages/AskPriyaScreen.tsx`
(new), updates to `backend/agents/knowledge_base.py`.

### 🟢 "Ask AI" car search on the catalog stage
**Problem:** Catalog filtering is brand + segment buttons. No natural-
language search.
**Fix:** Free-text input → POST `/cars/ask` → LLM filters cars.json by
the customer's intent ("fuel-efficient family SUV under 10L") and
returns top 3 with reasoning.

### 🟡 Persistent WebRTC avatar session — keep Priya alive across stages
**Problem:** The Azure WebRTC avatar session is created once on page mount.
If the connection drops (network blip, idle timeout, tab unfocus, server
side ICE expiry), Priya disappears mid-journey and the customer has to
reload. The avatar needs to stay live for the full 5–10 minute kiosk
session, not just the first stage.

**Why this matters:**
- Customer trust collapses the moment Priya freezes or vanishes
- The "Ask Priya" feature (above) requires a live avatar session to speak
  the answer — without keep-alive, Priya can't respond in voice
- A mid-flow disconnect during a long form (financial-discovery, EMI
  optimizer) means the customer never recovers — they leave

**What's needed:**

1. **Heartbeat / keep-alive ping**
   - Send a no-op message to the WebRTC peer every ~25 s to prevent NAT
     mapping expiry and Azure session timeout (default 15 min).
   - Configurable interval based on server-reported `iceServers.lifetime`.

2. **Auto-reconnect on disconnection**
   - Listen for `pc.oniceconnectionstatechange` → on `disconnected` /
     `failed`, attempt reconnect with exponential backoff (1s → 2s → 4s,
     max 3 attempts).
   - Surface a small "Reconnecting…" badge in the corner widget while it
     happens (no full-screen interruption).

3. **Persist session across stage transitions**
   - Today the `AvatarProvider` wraps the page, but if a stage component
     re-mounts the avatar instance, the session is destroyed and a new
     one is created. Audit each stage transition to make sure the
     `useAvatar()` hook reuses the existing peer connection.
   - Consider moving the peer connection into a global singleton outside
     React's lifecycle, exposed via context.

4. **Idle handling (page focus + visibility)**
   - On `document.visibilitychange` → if hidden for > 60 s, gracefully
     close the session and re-establish on `visible`.
   - Saves Azure cost for kiosk tabs left open.

5. **Backend session refresh**
   - The `/avatar/session` endpoint mints a fresh ICE-server token every
     call. Add an `/avatar/refresh-token` endpoint the frontend can poll
     to renew without tearing down the peer connection.

6. **Telemetry**
   - Log every connection state transition (`new`, `connecting`,
     `connected`, `disconnected`, `failed`, `closed`) into the existing
     `session_event` analytics pipe so we see drop-off rates.

7. **Fallback to voice-only audio**
   - If WebRTC video can't be re-established, fall back to Azure Neural
     TTS audio-only via the existing `useSpeech` hook — Priya keeps
     talking even if her face vanishes.

**Where:** `kiosk/lib/useAvatar.ts`, `kiosk/lib/avatarContext.tsx`,
`backend/routers/avatar.py`. Some Azure SDK config in
`kiosk/lib/useAvatar.ts` re: `iceCandidatePoolSize` and reconnection
strategy.

**Ship order:** (1) heartbeat → (2) auto-reconnect → (3) singleton peer
connection across stages → (5) backend token refresh → (4, 6, 7) idle/
telemetry/fallback. Each step independently shippable; (1) alone solves
~70% of the silent-disconnect problem.

### 🟢 Loading skeletons for AI Review panel
**Problem:** Between the Restart click and the next OTP prompt, the
events log briefly shows empty.
**Fix:** Skeleton loader / placeholder text while waiting on backend.

---

## DevOps & deployment

### 🟡 Set OpenRouter env vars on Render
**Problem:** Production backend on Render still has placeholder
LLM credentials. LLM features fall through to template fallback in prod.
**Fix:** Add `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`,
`OPENROUTER_REFERER`, `OPENROUTER_TITLE` to Render dashboard env vars.
**Note:** rotate the OpenRouter key first — the original was exposed in
chat history during development.

### 🟡 ChromaDB cold-start optimisation on Render free tier
**Problem:** First request after a Render cold start downloads the 80MB
ONNX model on demand. ~30 s latency for the first kiosk visitor.
**Fix:** Pre-warm by running a startup hook that calls
`get_kb().retrieve("warm-up", k=1)`. Bakes the model download into deploy
time, not first-user time.

### 🟢 Pin chromadb deps tighter
**Problem:** Pip resolver upgraded fastapi 0.115 → 0.136 transitively
during chromadb install. Version drift is silent.
**Fix:** Audit `requirements.txt` after every dep add. Pin compatible
upper bounds.

### 🟢 Move dependency conflict resolution into a `pip-tools` workflow
**Problem:** Hand-pinning is error-prone (we hit one pip resolver conflict
already with `langsmith==0.1.147`).
**Fix:** Maintain `requirements.in` (high-level deps) and compile
`requirements.txt` via `pip-compile`. Catches conflicts before deploy.

---

## Tests

### 🔥 Persona regression tests
**Problem:** No automated tests over the 5 persona profiles. A bug in
`check_eligibility()` could ship silently.
**Fix:** `backend/tests/test_eligibility.py` with one test per persona
asserting decision, approved_amount, rate, FOIR, decline reason.

### 🔥 Boundary tests
**Problem:** Off-by-one bugs at decision cutoffs (CIBIL 649 vs 650, FOIR
54.9% vs 55.0%, income 24,999 vs 25,000) are easy to write and hard to
catch.
**Fix:** Tests at every threshold ±1.

### 🟡 Property-based tests
**Problem:** Tests cover known scenarios. Don't catch novel edge cases.
**Fix:** Use `hypothesis`. Property: *"if decision is approved, then
(emi + existing_emi) / income ≤ foir_max + ε"* over a wide input space.

### 🟡 KB retrieval regression suite
**Problem:** No automated check that "low CIBIL" queries land on
`faq/low_cibil`. A bad chunk edit could break retrieval silently.
**Fix:** `tests/test_kb_retrieval.py` with ~20 fixed (query → expected
chunk id in top-K) cases. Run on every PR.

### 🟢 LLM output schema tests
**Problem:** If Pydantic validation fails, we silently fall back to
template. We never know LLM output broke until users complain.
**Fix:** A small "smoke" test that runs `write_brief()` for each persona
and asserts the result is a `DealerBrief` (not a string).

---

## Done

Items completed during the session — newest first.

- **2026-04-24** · Phase 1 — RAG knowledge base + OpenRouter LLM +
  AI/template toggle + structured DealerBrief Pydantic schema. Commit
  `ede28c1`.
- **2026-04-24** · Defensive `.map()` guards in `AIReviewPanel`; safe
  `app.timeline` rendering; LangGraph 1.x interrupts API fix
  (`snap.tasks[i].interrupts`). Commit `ede28c1`.
- **2026-04-24** · LangSmith spam silenced when no API key set
  (`LANGCHAIN_TRACING_V2=false` default + defensive guard in
  `llm_reasoner`).
- **2026-04-24** · Render deploy fix: `langsmith>=0.3.45,<1.0.0` to
  resolve `langchain-core` 1.3.x compatibility. Commit `c7d042c`.
- **2026-04-24** · README updated with three demo cases walkthrough.
  Commit `53dd26b`.
