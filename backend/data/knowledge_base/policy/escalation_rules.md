---
id: escalation_rules
category: policy
tags: [escalation, manual-review, flagging, underwriter]
---

# When to Escalate to Human Underwriter

The system auto-flags an application for human review if any of the following holds:

1. **2+ verification flags** in the cross-document check (name, DOB, employment, income, EMI, banking hygiene)
2. **Income mismatch > 25%** between Account Aggregator extrapolation and ITR
3. **CIBIL band changed** between bureau pull and re-check (rare — system retry)
4. **Employment mismatch** between bureau and ITR sources
5. **Bounce count > 3** in last 6 months of bank statements
6. **Loan amount > ₹25L** on a salaried profile, regardless of FOIR
7. **First-time borrower** with no credit history (CIBIL "NH" or "NA")
8. **Existing default flag** in bureau, even if seasoned > 36 months

Single soft flags do not escalate — they're noted in the dealer brief for context.
