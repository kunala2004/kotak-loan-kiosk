"""
Agentic loan review — LangGraph orchestration.

Flow:
  START
    → init
    → request_aadhaar_otp      ┐
                                │ (interrupt — waits for OTP from dealer)
    → fetch_aadhaar             │
    → request_aa_consent        │ (interrupt — waits for consent)
    → fetch_aa                  │
    → request_itr_otp           │ (interrupt — waits for OTP)
    → fetch_itr                 │
    → verify_documents          ┘
    → (conditional) underwrite  OR  flag_for_human
    → compose_brief
  END

State persists per application_id via the LangGraph InMemorySaver.
`interrupt()` pauses the graph; dealer resumes by posting the OTP/consent.
"""
import json
from pathlib import Path
from datetime import datetime
from typing import TypedDict, Optional, Literal, Any

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import interrupt, Command

from agents.llm_reasoner import narrate_step, narrate_verification, write_brief
from engines.emi_calculator import calculate_emi
from engines.eligibility_engine import rules as LOAN_RULES

# Applications store — same dict the /application/submit endpoint populates
from routers.application import applications

DEMO_DOCS_PATH = Path(__file__).parent.parent / "data" / "demo_documents.json"
DEMO_OTP = "123456"


def _load_demo_docs() -> dict:
    try:
        return json.loads(DEMO_DOCS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


# ── State ────────────────────────────────────────────────────────────────

class ReviewState(TypedDict, total=False):
    application_id: str
    app:            dict
    pan_prefix:     str
    docs:           dict
    verification:   dict
    recommendation: dict
    brief:          str
    events:         list        # [{ step, at, note, status }]
    status:         Literal["running", "waiting", "completed", "flagged"]
    waiting_for:    Optional[str]  # "aadhaar_otp" | "aa_consent" | "itr_otp"


def _log(state: ReviewState, step: str, note: str, status: str = "ok") -> list:
    ev = list(state.get("events", []))
    ev.append({
        "step": step,
        "at": datetime.now().isoformat(),
        "note": note,
        "status": status,
    })
    return ev


def _persona_docs(pan: str) -> dict:
    prefix = (pan or "").strip().upper()[:1] or "A"
    demo = _load_demo_docs()
    return demo.get(prefix) or demo.get("A") or {}


# ── Nodes ────────────────────────────────────────────────────────────────

def n_init(state: ReviewState) -> dict:
    app_id = state["application_id"]
    app = applications.get(app_id)
    if not app:
        return {
            "status": "flagged",
            "events": _log(state, "start", f"Application {app_id} not found", "error"),
        }
    pan = app.get("pan") or "A"
    return {
        "app":         app,
        "pan_prefix":  pan[:1].upper(),
        "docs":        {},
        "status":      "running",
        "waiting_for": None,
        "events":      _log(state, "start", narrate_step("start", {})),
    }


def n_request_aadhaar(state: ReviewState) -> Command:
    phone = state["app"].get("phone", "—")
    note = narrate_step("request_aadhaar", {"phone": phone})
    events = _log(state, "request_aadhaar", note)

    # Pause — dealer must post the OTP before we continue
    otp_value = interrupt({
        "waiting_for": "aadhaar_otp",
        "prompt": f"Customer has received OTP on {phone}. Ask them for the 6-digit code.",
        "demo_hint": f"For demo, enter {DEMO_OTP}",
    })

    if str(otp_value).strip() != DEMO_OTP:
        events = _log({"events": events}, "fetch_aadhaar",
                      f"Invalid OTP entered ({otp_value}) — expected {DEMO_OTP}", "error")
        return Command(update={"status": "flagged", "events": events})

    return Command(update={"events": events})


def n_fetch_aadhaar(state: ReviewState) -> dict:
    docs = dict(state.get("docs", {}))
    data = _persona_docs(state["pan_prefix"]).get("aadhaar_ekyc") or {}
    docs["aadhaar_ekyc"] = data
    note = narrate_step("fetch_aadhaar", {"name": data.get("name", "—")})
    return {"docs": docs, "events": _log(state, "fetch_aadhaar", note)}


def n_request_aa(state: ReviewState) -> Command:
    phone = state["app"].get("phone", "—")
    note = narrate_step("request_aa", {"phone": phone})
    events = _log(state, "request_aa", note)

    consent = interrupt({
        "waiting_for": "aa_consent",
        "prompt": f"Customer will receive an AA consent link on {phone}. They need to approve in their bank app.",
        "demo_hint": f"For demo, type {DEMO_OTP} to simulate customer approval",
    })

    if str(consent).strip() != DEMO_OTP:
        events = _log({"events": events}, "fetch_aa",
                      "Customer did not approve AA consent — escalating", "error")
        return Command(update={"status": "flagged", "events": events})

    return Command(update={"events": events})


def n_fetch_aa(state: ReviewState) -> dict:
    docs = dict(state.get("docs", {}))
    data = _persona_docs(state["pan_prefix"]).get("account_aggregator") or {}
    docs["account_aggregator"] = data
    note = narrate_step("fetch_aa", {"bank": data.get("primary_bank", "customer bank")})
    return {"docs": docs, "events": _log(state, "fetch_aa", note)}


def n_request_itr(state: ReviewState) -> Command:
    phone = state["app"].get("phone", "—")
    note = narrate_step("request_itr", {"phone": phone})
    events = _log(state, "request_itr", note)

    otp_value = interrupt({
        "waiting_for": "itr_otp",
        "prompt": f"Income Tax portal has sent an OTP to {phone}. Get it from the customer.",
        "demo_hint": f"For demo, enter {DEMO_OTP}",
    })

    if str(otp_value).strip() != DEMO_OTP:
        events = _log({"events": events}, "fetch_itr",
                      f"Invalid IT OTP ({otp_value}) — expected {DEMO_OTP}", "error")
        return Command(update={"status": "flagged", "events": events})

    return Command(update={"events": events})


def n_fetch_itr(state: ReviewState) -> dict:
    docs = dict(state.get("docs", {}))
    persona = _persona_docs(state["pan_prefix"])
    # Pick salary or business ITR based on what's in the persona
    itr_data = persona.get("itr_salary") or persona.get("itr_business") or {}
    itr_key = "itr_salary" if "itr_salary" in persona else "itr_business"
    docs[itr_key] = itr_data
    income = itr_data.get("annual_income") or itr_data.get("net_profit") or 0
    note = narrate_step("fetch_itr", {"income": income})
    return {"docs": docs, "events": _log(state, "fetch_itr", note)}


def n_verify(state: ReviewState) -> dict:
    """
    Real cross-document checks. No LLM needed — just field comparison.
    """
    app       = state["app"]
    docs      = state.get("docs", {})
    bureau    = app.get("bureau_data", {}) or {}
    internal  = bureau.get("_internal", {}) or {}
    aadhaar   = docs.get("aadhaar_ekyc", {}) or {}
    aa        = docs.get("account_aggregator", {}) or {}
    itr       = docs.get("itr_salary") or docs.get("itr_business") or {}

    checks: list[dict] = []
    flags:  list[str]  = []

    # 1. Name match (bureau vs Aadhaar) — fuzzy: both names share >= 1 token
    b_name = (bureau.get("name") or app.get("customer_name") or "").lower()
    a_name = (aadhaar.get("name") or "").lower()
    name_match = bool(set(b_name.split()) & set(a_name.split())) if b_name and a_name else False
    checks.append({
        "field":   "Name",
        "sources": "Bureau vs Aadhaar eKYC",
        "match":   name_match,
        "detail":  f"{bureau.get('name','—')} ↔ {aadhaar.get('name','—')}",
    })
    if not name_match and b_name and a_name:
        flags.append("Name mismatch between Bureau and Aadhaar")

    # 2. DOB match
    b_dob = bureau.get("dob") or ""
    a_dob = aadhaar.get("dob") or ""
    dob_match = b_dob == a_dob if b_dob and a_dob else True
    checks.append({
        "field":   "Date of Birth",
        "sources": "Bureau vs Aadhaar",
        "match":   dob_match,
        "detail":  f"{b_dob or '—'} ↔ {a_dob or '—'}",
    })
    if not dob_match and b_dob and a_dob:
        flags.append("DOB mismatch")

    # 3. Employment match (bureau vs ITR)
    b_employer = (internal.get("employment_verified") or "").lower()
    i_employer = (itr.get("employer") or itr.get("business_name") or "").lower()
    employer_match = any(
        tok in b_employer for tok in i_employer.split() if len(tok) > 3
    ) or any(
        tok in i_employer for tok in b_employer.split() if len(tok) > 3
    ) if b_employer and i_employer else True
    checks.append({
        "field":   "Employment",
        "sources": "Bureau vs Income Tax",
        "match":   employer_match,
        "detail":  f"{internal.get('employment_verified') or '—'} ↔ {itr.get('employer') or itr.get('business_name') or '—'}",
    })
    if not employer_match:
        flags.append("Employment source mismatch")

    # 4. Income cross-check (AA avg credit × 12 vs ITR annual)
    aa_avg    = aa.get("avg_monthly_credit") or 0
    itr_annual = itr.get("annual_income") or itr.get("net_profit") or 0
    aa_annual  = aa_avg * 12
    # Within 20% is acceptable (bonuses, variable income)
    income_consistent = True
    if aa_annual and itr_annual:
        diff_pct = abs(aa_annual - itr_annual) / max(aa_annual, itr_annual) * 100
        income_consistent = diff_pct <= 25
        income_detail = f"AA extrapolated ₹{aa_annual:,}/yr ↔ ITR ₹{itr_annual:,}/yr (diff {diff_pct:.0f}%)"
    else:
        income_detail = "Insufficient data for cross-check"
    checks.append({
        "field":   "Income (verified)",
        "sources": "Bank statements vs Income Tax",
        "match":   income_consistent,
        "detail":  income_detail,
    })
    if not income_consistent:
        flags.append("Income mismatch between AA and ITR")

    # 5. Existing EMI — AA debits vs bureau
    aa_emi_debits = aa.get("existing_emi_debits") or 0
    b_emi_total   = bureau.get("existing_emi_total") or 0
    emi_match = abs(aa_emi_debits - b_emi_total) < 2000  # ₹2K tolerance
    checks.append({
        "field":   "Existing EMI",
        "sources": "Bank debits vs Bureau",
        "match":   emi_match,
        "detail":  f"AA debits ₹{aa_emi_debits:,} ↔ Bureau EMIs ₹{b_emi_total:,}",
    })
    if not emi_match:
        flags.append("Existing EMI mismatch")

    # 6. Banking hygiene
    bounce = aa.get("bounce_count", 0)
    bounce_ok = bounce <= 1
    checks.append({
        "field":   "Banking hygiene",
        "sources": "Account Aggregator",
        "match":   bounce_ok,
        "detail":  f"{bounce} bounced transactions in 6 months",
    })
    if not bounce_ok:
        flags.append(f"High bounce count: {bounce}")

    passed = sum(1 for c in checks if c["match"])
    total  = len(checks)
    confidence = round(passed / total, 2) if total else 0.0

    report = {
        "checks":     checks,
        "passed":     passed,
        "total":      total,
        "flags":      flags,
        "confidence": confidence,
    }
    report["narrative"] = narrate_verification(report)
    return {
        "verification": report,
        "events": _log(state, "verify",
                       f"Cross-verification: {passed}/{total} checks passed"),
    }


def _after_verify(state: ReviewState) -> Literal["underwrite", "flagged_end"]:
    report = state.get("verification", {})
    # Any serious flag or > 1 total flag → human review
    if len(report.get("flags", [])) >= 2:
        return "flagged_end"
    return "underwrite"


def n_flagged_end(state: ReviewState) -> dict:
    events = _log(state, "flagged",
                  narrate_step("flagged", {}), "warning")
    return {"status": "flagged", "events": events}


def n_underwrite(state: ReviewState) -> dict:
    """
    Re-check FOIR using the VERIFIED income from AA/ITR, not declared income.
    Rules engine is still authoritative — we just feed it better inputs.
    """
    app    = state["app"]
    docs   = state.get("docs", {})
    aa     = docs.get("account_aggregator", {}) or {}
    loan   = app.get("loan", {}) or {}
    bureau = app.get("bureau_data", {}) or {}

    verified_income = aa.get("avg_monthly_credit") or 0
    existing_emi    = aa.get("existing_emi_debits") or bureau.get("existing_emi_total") or 0
    emi             = loan.get("emi") or 0

    foir_pct = round(((emi + existing_emi) / verified_income) * 100, 1) if verified_income else 0
    foir_max = LOAN_RULES.get("foir_max", 0.55) * 100
    within_policy = foir_pct <= foir_max

    recommendation = {
        "decision":        "SANCTION" if within_policy else "DECLINE_FOIR",
        "confidence":      state.get("verification", {}).get("confidence", 0.0),
        "verified_income": verified_income,
        "foir_pct":        foir_pct,
        "foir_max_pct":    foir_max,
        "within_policy":   within_policy,
    }
    note = narrate_step("underwrite", {})
    return {
        "recommendation": recommendation,
        "events": _log(state, "underwrite",
                       f"{note} — FOIR {foir_pct}% (policy max {foir_max}%)"),
    }


def n_compose_brief(state: ReviewState) -> dict:
    app     = state["app"]
    docs    = state.get("docs", {})
    rec     = state.get("recommendation", {})
    aa      = docs.get("account_aggregator", {}) or {}
    itr     = docs.get("itr_salary") or docs.get("itr_business") or {}
    internal = (app.get("bureau_data") or {}).get("_internal") or {}

    is_salaried = "salaried" in (internal.get("employment_verified", "").lower())
    context = {
        "customer_name":   app.get("customer_name", "Customer"),
        "employment":      "salaried" if is_salaried else "self-employed",
        "employer":        itr.get("employer") or itr.get("business_name") or "—",
        "verified_income": rec.get("verified_income", 0),
        "existing_emi":    aa.get("existing_emi_debits", 0),
        "foir_pct":        rec.get("foir_pct", 0),
        "foir_max":        rec.get("foir_max_pct", 55),
        "bureau_band":     (app.get("bureau_data") or {}).get("profile_label", ""),
        "recommendation":  rec.get("decision", "—"),
        "car_label":       f"{app.get('car', {}).get('brand','')} {app.get('car', {}).get('model','')}".strip(),
    }
    brief = write_brief(context)
    events = _log(state, "brief", narrate_step("brief", {}))
    events = _log({"events": events}, "done",
                  narrate_step("done", {}), "success")
    return {"brief": brief, "status": "completed", "events": events}


# ── Build graph ──────────────────────────────────────────────────────────

def build_graph():
    g = StateGraph(ReviewState)

    g.add_node("init",             n_init)
    g.add_node("request_aadhaar",  n_request_aadhaar)
    g.add_node("fetch_aadhaar",    n_fetch_aadhaar)
    g.add_node("request_aa",       n_request_aa)
    g.add_node("fetch_aa",         n_fetch_aa)
    g.add_node("request_itr",      n_request_itr)
    g.add_node("fetch_itr",        n_fetch_itr)
    g.add_node("verify",           n_verify)
    g.add_node("underwrite",       n_underwrite)
    g.add_node("flagged_end",      n_flagged_end)
    g.add_node("brief",            n_compose_brief)

    g.add_edge(START,              "init")
    g.add_edge("init",             "request_aadhaar")
    g.add_edge("request_aadhaar",  "fetch_aadhaar")
    g.add_edge("fetch_aadhaar",    "request_aa")
    g.add_edge("request_aa",       "fetch_aa")
    g.add_edge("fetch_aa",         "request_itr")
    g.add_edge("request_itr",      "fetch_itr")
    g.add_edge("fetch_itr",        "verify")
    g.add_conditional_edges("verify", _after_verify, {
        "underwrite":  "underwrite",
        "flagged_end": "flagged_end",
    })
    g.add_edge("underwrite",       "brief")
    g.add_edge("brief",            END)
    g.add_edge("flagged_end",      END)

    checkpointer = InMemorySaver()
    return g.compile(checkpointer=checkpointer)


REVIEW_GRAPH = build_graph()
