"""
LLM abstraction layer — the "brain" of the agentic review.

Three responsibilities:
  1. Talk to a real LLM via OpenRouter (proxy to xAI Grok 4.1 Fast by default,
     OR OpenAI directly if OPENAI_API_KEY is set, OR Groq).
  2. Pull relevant policy/FAQ chunks from the knowledge base before every call
     (RAG — Retrieval-Augmented Generation).
  3. Return either plain text OR a validated Pydantic structured object.

If no LLM key is configured, all functions transparently fall back to
deterministic templates so the demo never breaks.

The agents in review_graph.py call these functions; they never touch the
LLM SDK directly. This means swapping providers is a one-line config change.
"""
from __future__ import annotations

import os
import json
from typing import Optional, Literal

from pydantic import BaseModel, Field, ValidationError

from agents.knowledge_base import get_kb, format_chunks_for_prompt

# Defensive: if LangSmith tracing is requested but no API key is present, disable
# it so the OpenAI client doesn't spam 401s against api.smith.langchain.com.
if os.getenv("LANGCHAIN_TRACING_V2", "").lower() in ("1", "true", "yes") \
        and not os.getenv("LANGSMITH_API_KEY", "").strip():
    os.environ["LANGCHAIN_TRACING_V2"] = "false"
    print("[llm_reasoner] LANGCHAIN_TRACING_V2 was on but no LANGSMITH_API_KEY — disabled.")

# ── Provider config ──────────────────────────────────────────────────────

OPENROUTER_KEY   = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "x-ai/grok-4.1-fast").strip()
OPENROUTER_REF   = os.getenv("OPENROUTER_REFERER", "https://github.com/")
OPENROUTER_TITLE = os.getenv("OPENROUTER_TITLE", "Car Loan Kiosk")

OPENAI_KEY   = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o").strip()


def _provider() -> Optional[str]:
    if OPENROUTER_KEY:
        return "openrouter"
    if OPENAI_KEY:
        return "openai"
    return None


def _client_and_model() -> tuple[Optional[object], str, dict]:
    """Returns (client, model_id, extra_headers) — or (None, "", {}) if no key."""
    try:
        from openai import OpenAI
    except ImportError:
        return None, "", {}

    p = _provider()
    if p == "openrouter":
        client = OpenAI(api_key=OPENROUTER_KEY, base_url="https://openrouter.ai/api/v1")
        headers = {
            "HTTP-Referer": OPENROUTER_REF,
            "X-Title":      OPENROUTER_TITLE,
        }
        return client, OPENROUTER_MODEL, headers
    if p == "openai":
        return OpenAI(api_key=OPENAI_KEY), OPENAI_MODEL, {}
    return None, "", {}


def llm_status() -> dict:
    """Surface the current LLM config for /health and the dealer UI."""
    p = _provider()
    return {
        "provider": p or "none",
        "model":    OPENROUTER_MODEL if p == "openrouter" else (OPENAI_MODEL if p == "openai" else None),
        "rag":      get_kb().stats(),
    }


# ── Low-level call ───────────────────────────────────────────────────────

def _chat(system: str, user: str, *, temperature: float = 0.3, json_mode: bool = False) -> str:
    client, model, headers = _client_and_model()
    if not client:
        return ""
    try:
        kwargs: dict = {
            "model":       model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ],
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        if headers:
            kwargs["extra_headers"] = headers
        resp = client.chat.completions.create(**kwargs)
        return (resp.choices[0].message.content or "").strip()
    except Exception as e:
        print(f"[llm_reasoner] chat call failed: {e}")
        return ""


def _structured(system: str, user: str, model_cls: type[BaseModel], *, temperature: float = 0.2) -> Optional[BaseModel]:
    """Ask for JSON, validate with Pydantic. One retry on validation failure."""
    schema = model_cls.model_json_schema()
    user_with_schema = (
        f"{user}\n\n"
        "Respond with ONLY a JSON object — no prose, no markdown fences. "
        "It MUST validate against this JSON Schema:\n"
        f"{json.dumps(schema)}"
    )
    for attempt in (1, 2):
        text = _chat(system, user_with_schema, temperature=temperature, json_mode=True)
        if not text:
            return None
        # Strip stray fences if the model added them
        text = text.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:].lstrip()
        try:
            return model_cls.model_validate_json(text)
        except ValidationError as e:
            print(f"[llm_reasoner] structured validation failed (attempt {attempt}): {e}")
            if attempt == 2:
                return None
    return None


# ── KB retrieval helper ──────────────────────────────────────────────────

def _retrieve(query: str, k: int = 3, category: Optional[str] = None) -> str:
    chunks = get_kb().retrieve(query, k=k, category=category)
    return format_chunks_for_prompt(chunks)


# ── Pydantic schemas ─────────────────────────────────────────────────────

class DealerBrief(BaseModel):
    """Structured brief shown to the dealer after the agentic review completes."""
    summary:         str                            = Field(description="2-3 line prose summary of customer profile and recommendation")
    risk_level:      Literal["LOW", "MEDIUM", "HIGH"]
    confidence_pct:  int                            = Field(ge=0, le=100, description="Confidence in the recommendation, 0-100")
    key_positives:   list[str]                      = Field(min_length=2, max_length=4, description="2-4 bullet points of positives")
    key_concerns:    list[str]                      = Field(min_length=0, max_length=3, description="0-3 concerns or soft flags")
    talking_points:  list[str]                      = Field(min_length=2, max_length=4, description="What the dealer should mention to the customer when handing back the decision")
    cross_sell_hint: str                            = Field(description="One-line hint for an adjacent product to mention naturally — empty string if none fits")


class VerificationNarrative(BaseModel):
    headline:  str = Field(description="One-sentence outcome — under 25 words")
    rationale: str = Field(description="One-sentence reason citing specific check results — under 35 words")


# ── Public API: agents call these ────────────────────────────────────────

def narrate_verification(report: dict) -> str:
    """
    Given a structured verification report, return a 1-2 sentence
    natural-language summary for the dealer. Falls back to a deterministic
    template if no LLM key is set.
    """
    if _provider():
        ctx = _retrieve(
            query="cross-document verification name DOB income employment EMI banking flags",
            k=2,
            category="risk",
        )
        system = (
            "You are a senior bank underwriter's assistant. Given a JSON cross-document "
            "verification report and policy context, write the outcome in one short headline "
            "sentence and one rationale sentence. Cite specific check names if any failed. "
            "Do not invent facts. Return JSON matching the VerificationNarrative schema."
        )
        user = (
            f"POLICY CONTEXT:\n{ctx}\n\n"
            f"VERIFICATION REPORT:\n{json.dumps(report, default=str)}"
        )
        out = _structured(system, user, VerificationNarrative, temperature=0.2)
        if out:
            return f"{out.headline} {out.rationale}".strip()

    # Template fallback
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


def template_brief(context: dict) -> str:
    """
    Deterministic template brief — always available, no LLM, no KB.
    Used as the visible "before" version next to the AI-generated brief
    so a viewer can see what the system produces without intelligence.
    """
    name        = context.get("customer_name", "Customer")
    first       = name.split(" ")[0]
    employment  = context.get("employment", "salaried")
    employer    = context.get("employer", "their employer")
    verified    = context.get("verified_income", 0)
    existing    = context.get("existing_emi", 0)
    foir_pct    = round(context.get("foir_pct", 0), 1)
    foir_max    = round(context.get("foir_max", 55), 1)
    band        = context.get("bureau_band", "good")
    rec         = context.get("recommendation", "SANCTION")
    car         = context.get("car_label", "the selected car")
    existing_note = (
        f"₹{existing:,} existing EMI" if existing > 0 else "no existing EMI obligations"
    )
    return (
        f"{first} is a {employment} professional at {employer}, with a verified "
        f"monthly income of ₹{verified:,}. They have {existing_note} and their "
        f"{band.lower()} credit profile leaves FOIR at {foir_pct}% — well within "
        f"the {foir_max}% policy cap for {car}. Recommendation: {rec}."
    )


def write_brief(context: dict) -> str | dict:
    """
    Compose the dealer brief. Returns a JSON-serialisable dict if the LLM
    succeeded with structured output, OR a plain prose string from the
    template fallback.

    Callers should accept both shapes. The dealer portal renders the
    structured dict as a card and the plain string as a paragraph.
    """
    if _provider():
        # Profile-aware retrieval — pull cross-sell hints relevant to the customer
        employment = context.get("employment", "salaried")
        band       = context.get("bureau_band", "good")
        income     = context.get("verified_income", 0)
        car        = context.get("car_label", "")
        query = f"{employment} {band} band income {income} car {car} cross sell"

        ctx_cross_sell = _retrieve(query, k=2, category="cross_sell")
        ctx_policy     = _retrieve(
            f"FOIR rate band {employment} {band} eligibility",
            k=2,
            category="policy",
        )
        ctx = f"{ctx_policy}\n\n{ctx_cross_sell}"

        system = (
            "You are a bank loan officer's AI co-pilot. Produce a structured "
            "DealerBrief for the dealer who is about to hand back a decision to "
            "this customer. Ground every claim in the provided policy + cross-sell "
            "context. Do NOT invent numbers. Risk level reflects the verification "
            "report and FOIR; confidence reflects how clean the verification was. "
            "Return JSON matching the DealerBrief schema."
        )
        user = (
            f"POLICY + CROSS-SELL CONTEXT:\n{ctx}\n\n"
            f"CUSTOMER REVIEW STATE:\n{json.dumps(context, default=str)}"
        )
        out = _structured(system, user, DealerBrief, temperature=0.3)
        if out:
            return out.model_dump()

    # No LLM available, or LLM/parse failed — fall back to template
    return template_brief(context)


# ── Step narrator (no LLM needed — terse status lines) ──────────────────

def narrate_step(step: str, context: dict) -> str:
    """
    Short status line shown to the dealer while a node runs.
    Templates only — these are tight system messages, not AI prose.
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
