---
id: risk_income_inconsistency
category: risk
tags: [income, verification, cross-check]
---

# Income inconsistency tolerance

We pull income from three sources and reconcile. Tolerance bands and actions:

## Sources
1. **Declared** — what the applicant typed in the kiosk
2. **Bank statements (AA)** — average monthly credits over 6 months × 12
3. **ITR (Income Tax portal)** — annual income from latest ITR

## Tolerance bands (using max of the three as denominator)
| Difference | Action |
|---|---|
| ≤ 15% | Accept verified income (use lower of AA × 12 vs ITR for FOIR) |
| 15–25% | Soft flag — note in brief, proceed with verified income |
| 25–40% | Manual review — possible bonus/variable income; needs explanation |
| > 40% | Hard flag — likely misrepresentation or data error; decline |

## Common legitimate causes for 15–25% gap
- Annual bonus paid in March (boosts ITR vs monthly avg)
- Variable pay / commission (sales roles)
- Short-tenure job change in last 6 months
- Self-employed with seasonal business

## Always use verified, never declared
For final FOIR computation, use the **lower of AA × 12 vs ITR**. Declared income is for initial eligibility check only — once verified data is available, declared is discarded.
