---
id: risk_fraud_signals
category: risk
tags: [fraud, hard-flag, manual-review]
---

# Hard fraud signals (auto-flag)

Any single signal here triggers manual review by the fraud desk, regardless of other indicators.

## Identity-level
- Name mismatch between PAN and Aadhaar (after fuzzy matching)
- DOB mismatch across PAN, Aadhaar, and bureau (any pair)
- Phone or email shared with > 5 active applications in our system
- Address that matches a previously declined fraud application

## Income-level
- Salary credits from an entity not appearing in EPFO records (private sector salaried)
- ITR turnover dramatically higher than declared (> 2× — suggests inflated income on application)
- Bank statement showing salary credits but no corresponding TDS deduction
- "Round-tripping" pattern — large credits followed by withdrawal of same amount

## Document-level
- Submitted document with editing artefacts (font mismatch, alignment shifts)
- Aadhaar OTP delivered to a phone in a state different from Aadhaar address
- ITR portal access fails repeatedly with valid OTP (suggests forged ITR copy)

These are pattern indicators only. Final fraud determination is by the human fraud desk.
