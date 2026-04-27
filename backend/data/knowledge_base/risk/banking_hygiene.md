---
id: risk_banking_hygiene
category: risk
tags: [banking, account-aggregator, bank-statement]
---

# Banking hygiene signals — bank statement red flags

What we look for in 6 months of Account Aggregator data, in order of severity.

## Severe (single instance = manual review)
- Cheque return / ECS bounce in last 90 days
- Persistent overdraft beyond sanctioned limit
- Account marked "Inoperative" or "Dormant" reactivated within last 30 days
- Crypto exchange transactions > 20% of monthly throughput (regulatory caution)

## Concerning (2+ instances = manual review)
- Bounced transactions in last 6 months (any reason)
- Salary credit delayed > 5 days from expected payday for 2+ months
- Large round-figure cash deposits (> ₹1L) without business context
- Outflows to peer-to-peer lending apps (early-stage distress signal)

## Soft signals (note only)
- Average month-end balance < 1× monthly EMI commitment
- High debit-to-credit ratio (> 95% — living paycheck to paycheck)
- Frequent ATM withdrawals over UPI (older demographic; not negative)
- Salary spread across multiple accounts (legitimate — many do this)

## Why it matters
A clean current and savings account history is the single strongest predictor of EMI repayment behaviour — beats CIBIL for sub-prime customers. Don't skip the AA pull just because bureau looks fine.
