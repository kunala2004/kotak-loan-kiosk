"""
Abstraction layer over the LLM.

When OPENAI_API_KEY is set, calls GPT-4o for real reasoning.
When not set, uses deterministic templates so the demo still works.

The agents in review_graph.py call these functions — they never touch
the LLM SDK directly. This means adding the key later is a one-line
config change; no agent code changes.
"""
import os
from typing import Any

OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")


def _has_openai() -> bool:
    return bool(OPENAI_KEY)


def _openai_chat(system: str, user: str, temperature: float = 0.3) -> str:
    """Single-shot chat call. Returns plain text."""
    try:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_KEY)
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            temperature=temperature,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception as e:
        print(f"[llm_reasoner] OpenAI call failed: {e}")
        return ""


# ── Agent: verification narrative ─────────────────────────────────────

def narrate_verification(report: dict) -> str:
    """
    Given a structured verification report, return a 1-2 sentence
    natural-language summary for the dealer.
    """
    if _has_openai():
        prompt = (
            "You are a bank underwriter's assistant. Given a JSON verification "
            "report comparing customer documents, write one short sentence "
            "summarising the outcome. Do not invent facts. If anything failed, "
            "say exactly what. 25 words max."
        )
        user = f"Verification report:\n{report}"
        out = _openai_chat(prompt, user, temperature=0.2)
        if out:
            return out

    # Fallback — deterministic
    passed = report.get("passed", 0)
    total  = report.get("total", 0)
    flags  = report.get("flags", [])
    if not flags and passed == total:
        return (
            f"All {total} cross-document checks passed cleanly — "
            "identity, address, income and employment are consistent across sources."
        )
    if flags:
        return (
            f"{passed}/{total} checks passed. Flags raised: "
            + "; ".join(flags[:3]) + "."
        )
    return f"{passed}/{total} checks passed."


# ── Agent: dealer brief ───────────────────────────────────────────────

def write_brief(context: dict) -> str:
    """
    Given the full review context (app + docs + verification + recommendation),
    return a 3-line dealer-facing brief.
    """
    if _has_openai():
        system = (
            "You are a bank loan officer's AI assistant. Write a concise 3-line "
            "brief for the dealer about this customer. Cover: who they are (name, "
            "employment, verified income), credit health (EMIs, bureau band), "
            "and your recommendation. No markdown. No bullet points. Flowing "
            "prose. Under 75 words. Do not invent numbers."
        )
        user = f"Context:\n{context}"
        out = _openai_chat(system, user, temperature=0.25)
        if out:
            return out

    # Fallback — templated
    name        = context.get("customer_name", "Customer")
    first       = name.split(" ")[0]
    employment  = context.get("employment", "salaried")
    employer    = context.get("employer", "their employer")
    verified    = context.get("verified_income", 0)
    existing    = context.get("existing_emi", 0)
    foir_pct    = context.get("foir_pct", 0)
    foir_max    = context.get("foir_max", 55)
    band        = context.get("bureau_band", "good")
    rec         = context.get("recommendation", "SANCTION")
    car         = context.get("car_label", "the selected car")

    existing_note = (
        f"₹{existing:,} existing EMI"
        if existing > 0 else "no existing EMI obligations"
    )

    return (
        f"{first} is a {employment} professional at {employer}, with a verified "
        f"monthly income of ₹{verified:,}. They have {existing_note} and their "
        f"{band.lower()} credit profile leaves FOIR at {foir_pct}% — well within "
        f"the {foir_max}% policy cap for {car}. Recommendation: {rec}."
    )


# ── Agent: step-by-step reasoning event ────────────────────────────────

def narrate_step(step: str, context: dict) -> str:
    """
    Short status line shown to the dealer while a node runs.
    e.g. 'Sending Aadhaar OTP to customer's phone...'
    """
    templates = {
        "start":              "Starting AI review…",
        "request_aadhaar":    "Sending Aadhaar OTP to {phone}",
        "fetch_aadhaar":      "Aadhaar verified · {name}",
        "request_aa":         "Account Aggregator consent sent to {phone}",
        "fetch_aa":           "6 months of statements fetched from {bank}",
        "request_itr":        "Income Tax portal OTP sent to {phone}",
        "fetch_itr":          "Income Tax data fetched · annual income ₹{income:,}",
        "verify":             "Cross-checking identity, income and employment across all 3 sources",
        "underwrite":         "Re-running underwriter rules on verified income",
        "brief":              "Composing dealer brief",
        "flagged":            "Discrepancy detected — flagging for human review",
        "done":               "Review complete",
    }
    tmpl = templates.get(step, step)
    try:
        return tmpl.format(**context)
    except Exception:
        return tmpl
