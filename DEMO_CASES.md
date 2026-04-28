# Demo Cases — Three flow walkthroughs

Three example flows through the system, one per PAN prefix. Same code path
runs for all three; the rules engine takes a different branch and the LLM
retrieves a different set of KB chunks.

- **Case 1 (PAN A · Rahul Sharma)** → Full approval, clean profile
- **Case 2 (PAN C · Vikram Patel)** → Partial approval after FOIR breach
- **Case 3 (PAN E · Rajan Kumar)** → Soft decline + lead capture

For the full persona table see `README.md → Demo personas`. Demo OTP for the
LangGraph review is `123456` (works for all three OTP prompts).

---

## Case 1 — Rahul Sharma · Full approval

| | |
|---|---|
| **PAN** | `ABCPE1234A` |
| **Profile** | Salaried, TCS Limited |
| **CIBIL** | 782 (Excellent) |
| **Verified income** | ₹85,000/month |
| **Existing EMI** | ₹0 |
| **Picks** | Maruti Suzuki Baleno · ₹8.5L |
| **Down payment** | ₹1.0L · Loan ₹7.5L (capped at LTV → ₹7.225L) · 60 months |
| **Final** | Approved at ₹7.225L · 8.75% p.a. · LOW risk |

```
┌─────────────────────────────────────────────────────────────────┐
│                       CUSTOMER KIOSK                            │
└─────────────────────────────────────────────────────────────────┘

 [Stage 0]   Idle / Welcome
            │ (Azure WebRTC avatar)
            ▼
 [Stage 1]   Pick car: Maruti Baleno Delta
            │ (Rules query over cars.json)
            ▼
 [Stage 2]   Sliders → ₹1L down, 60mo, salaried, ₹75K–1L
            │ (Rules: live EMI preview)
            ▼
 [Stage 3]   Enter PAN  →  Mock Bureau pull
            │   ┌─ Rules engine computes:
            │   │   • Eligible: ₹7.225L  (LTV cap 85%)
            │   │   • Rate: 8.75% p.a.   (CIBIL 750+ band)
            │   │   • EMI: ~₹14,925
            │   │   • FOIR: 17.6% (vs 55% cap)
            │   └─ ✅ SANCTION pre-approved
            │
            │  ┌──────────────────────────────────────────┐
            │  │ 🤖 LLM CALL #1 — Stage-3 message          │
            │  │ Provider: OpenRouter → Grok 4.1 Fast      │
            │  │ KB retrieved: rate_card, foir_caps        │
            │  └──────────────────────────────────────────┘
            ▼
 [Stage 4-5] EMI optimizer → Phone → Review → Submit
            ▼
 [Stage 6]   Waiting (poll dealer)


┌─────────────────────────────────────────────────────────────────┐
│                       DEALER PORTAL                             │
└─────────────────────────────────────────────────────────────────┘

 Application appears → Click "Start AI Review"
            │
            ▼
 LangGraph: init → request_aadhaar 🛑(123456) → fetch_aadhaar
                 → request_aa 🛑(123456) → fetch_aa
                 → request_itr 🛑(123456) → fetch_itr → verify
                              │
                              ▼  6/6 checks pass · 0 flags
            ┌──────────────────────────────────────────┐
            │ 🤖 LLM CALL #2 — Verification narrative   │
            │ KB retrieved:                             │
            │   • risk/employment_verification          │
            │   • risk/income_inconsistency             │
            └──────────────────────────────────────────┘
                              ▼
                    underwrite (FOIR 17.6% ✓)
                              ▼
            ┌──────────────────────────────────────────┐
            │ 🤖 LLM CALL #3 — Structured DealerBrief   │
            │ KB retrieved (4 chunks):                  │
            │   • policy/rate_card                      │
            │   • policy/foir_caps                      │
            │   • cross_sell/salaried_high_income       │
            │   • cross_sell/low_band_recovery (weak)   │
            │ Output:                                   │
            │   risk: LOW · confidence: 100%            │
            │   summary: "₹85K/mo TCS · FOIR 17.6%      │
            │     well below 55% cap"                   │
            │   cross_sell: pre-approved PL up to       │
            │     3× monthly income                     │
            └──────────────────────────────────────────┘
                              ▼
              Sanction → Mock SMS → Customer celebrates
```

---

## Case 2 — Vikram Patel · Partial approval after FOIR breach

| | |
|---|---|
| **PAN** | `CVKPE5678C` |
| **Profile** | Self-employed retail business |
| **CIBIL** | 668 (Below average) |
| **Verified income** | ₹55,000/month |
| **Existing EMI** | ₹14,000 (₹9.5K + ₹4.5K) |
| **Asks** | ₹8.5L loan on a ₹14L Brezza |

### Rules engine math

- Self-employed sub-700 → rate 10.00% (KB: `rate_card.md`)
- Asked-EMI: ~₹18,800 at 10%/60mo
- Asked-FOIR = (18,800 + 14,000) / 55,000 = **59.6%**
- Single FOIR cap in `loan_rules.json`: **55%**
- ❌ Breach → engine reduces loan to fit
- Max-allowed total EMI: 55% × 55,000 = ₹30,250
- Max NEW EMI: ₹30,250 − ₹14,000 = ₹16,250
- Backsolve loan at 10%/60mo for ₹16,250 EMI → **~₹7.65L**
- ✅ Reduced sanction at ~₹7.65L

> **Note:** with the smaller default scenario (₹8.5L car instead of ₹14L),
> Vikram approves at full amount because his FOIR works out to 53% (within
> the 55% cap). To trigger this partial-approval path, he must request a
> larger loan size.

### Flow

```
[Stage 3]  PAN → Bureau (CIBIL 668)
              │
              ▼ Rules engine: asked-FOIR breaches cap, reduces loan
              ▼
 ┌──────────────────────────────────────────────────────┐
 │ 🤖 LLM CALL — Stage-3 message (action-aware)          │
 │ KB retrieved:                                         │
 │   • policy/foir_caps                                  │
 │   • policy/rate_card                                  │
 │   • faq/low_cibil                                     │
 │ Output guidance: "we can pre-approve ₹7.65L at        │
 │  10%; bumping down payment by ₹40K drops FOIR to      │
 │  ~50% and unlocks a better rate band"                 │
 └──────────────────────────────────────────────────────┘

[Dealer side] — Same LangGraph review runs to completion

 verify → 6/6 checks pass (no fraud flags · soft flags noted)
       → underwrite re-confirms reduced loan with verified income
       → compose_brief

 ┌──────────────────────────────────────────────────────┐
 │ 🤖 STRUCTURED DEALER BRIEF                            │
 │ KB retrieved:                                         │
 │   • policy/foir_caps                                  │
 │   • policy/rate_card                                  │
 │   • cross_sell/self_employed_business                 │
 │   • risk/soft_flag_thresholds                         │
 │                                                       │
 │ risk: MEDIUM · confidence: 75%                        │
 │ key_concerns:                                         │
 │   • FOIR breach at requested loan size                │
 │   • 1 missed payment in 12 months · 4 inquiries       │
 │ talking_points:                                       │
 │   • Suggest higher down payment to keep target loan   │
 │   • OR offer reduced loan with full sanction          │
 │ cross_sell: working capital OD (same docs)            │
 └──────────────────────────────────────────────────────┘
```

### Side-by-side: Template vs LLM

```
 ┌───────────────────────────────────────────────────┐
 │ 📄 TEMPLATE                                       │
 │ "Vikram is a self-employed professional, with     │
 │  verified ₹55,000/month, ₹14,000 existing EMI.    │
 │  Their average credit profile leaves FOIR at      │
 │  59.6% — well within the 55% cap.                 │
 │  Recommendation: SANCTION."                       │
 │                                                   │
 │  ❌ Says "well within" when 59.6 > 55             │
 │  ❌ Recommends SANCTION when rules say partial    │
 │  ❌ No actionable suggestion                      │
 │  ❌ No cross-sell                                 │
 │  ❌ No risk tier                                  │
 └───────────────────────────────────────────────────┘
                       vs
 ┌───────────────────────────────────────────────────┐
 │ 🤖 LLM + RAG                                      │
 │  ✅ Catches the FOIR breach                       │
 │  ✅ Suggests +₹40K down payment OR reduced loan   │
 │  ✅ Cites cap from foir_caps.md                   │
 │  ✅ Cites rate from rate_card.md                  │
 │  ✅ Cross-sell from self_employed_business.md     │
 │  ✅ MEDIUM risk badge, 75% confidence             │
 └───────────────────────────────────────────────────┘
```

---

## Case 3 — Rajan Kumar · Soft decline + lead capture

| | |
|---|---|
| **PAN** | `ERAKE9999E` |
| **Profile** | Self-employed, no business proof |
| **CIBIL** | 584 (High risk) |
| **Verified income** | ₹35,000/month |
| **Existing EMI** | ₹26,000 (₹12K + ₹8K + ₹6K) |
| **Missed payments** | 5 in last 12 months · 8 enquiries |

### Rules engine math

- CIBIL **< 650** → auto-decline at first gate (`min_cibil_eligible` in `loan_rules.json`)
- Existing FOIR already 74% (₹26K / ₹35K) → no headroom regardless
- 8 hard inquiries in 6 months → distress signal
- 5 missed payments → multiple soft flags trip
- Decline reason returned: `credit_score`

### Flow

```
[Stage 3] PAN → Bureau (CIBIL 584)
              │
              ▼ Rules engine: AUTO-DECLINE at credit gate
              │
              ▼
 ┌──────────────────────────────────────────────────────┐
 │ 🤖 LLM CALL — Empathetic decline message              │
 │ KB retrieved:                                         │
 │   • faq/low_cibil                                     │
 │   • faq/rejection_reasons                             │
 │   • cross_sell/low_band_recovery                      │
 │ Output: "Rajan, we couldn't pre-approve at this       │
 │  time — your existing EMIs leave little room for      │
 │  another. Three things that would help: clear the     │
 │  smallest credit balance, avoid new applications      │
 │  for 90 days, and revisit in 4 months."               │
 └──────────────────────────────────────────────────────┘
              │
              ▼
 [Stage]    Phone capture only (NO loan submission)
              │
              ▼
 ┌──────────────────────────────────────────────────────┐
 │ 🤖 Drop-off recovery agent (Phase 3)                  │
 │ Scheduled via APScheduler: SMS in 30 days             │
 │ "Hi Rajan, 30 days since your visit. Want a quick     │
 │  check on whether your profile has improved?"         │
 └──────────────────────────────────────────────────────┘

[Dealer side] — never reaches the queue (auto-declined)
              Lead enters the soft-decline funnel for
              cross-sell of secured-credit-card products.
```

---

## Comparison summary

| | Rahul (A) | Vikram (C) | Rajan (E) |
|---|---|---|---|
| **CIBIL** | 782 ✅ | 668 ⚠️ | 584 ❌ |
| **Outcome** | Full sanction ₹7.225L | Reduced sanction ~₹7.65L | Soft decline |
| **Decision by** | Rules engine | Rules engine | Rules engine |
| **LLM role** | Renders + cross-sells | Renders + suggests action | Renders empathy |
| **KB chunks hit** | rate_card, foir_caps, salaried_high_income | foir_caps, rate_card, self_employed_business, soft_flag_thresholds | low_cibil, rejection_reasons, low_band_recovery |
| **Risk level** | LOW | MEDIUM | HIGH |
| **Goes to dealer** | Yes | Yes | No (lead funnel) |

---

## Key architectural truths these cases demonstrate

1. **The rules engine owns every money decision.** The LLM only describes
   what the engine already decided. The "no" outcome for Rajan is decided
   in 5 lines of Python; the "yes" outcome for Rahul is the same path.
2. **Same code path, three different branches.** No persona-specific code
   anywhere. Behaviour comes from data + rules.
3. **The KB grounds every prose claim.** Every ₹, every %, every product
   name in the brief is traceable to a specific chunk file.
4. **Three LLM calls per flow.** Stage-3 message, verification narrative,
   dealer brief. Each retrieves 2–4 chunks.
5. **Auto-decline still uses the LLM** — but only to write the explanation,
   never to make the decision.
