import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from agents.result_writer import write_dealer_brief
from routers.application import applications

router = APIRouter(prefix="/dealer", tags=["Dealer"])

DEMO_DOCS_PATH = Path(__file__).parent.parent / "data" / "demo_documents.json"


def _load_demo_docs() -> dict:
    try:
        return json.loads(DEMO_DOCS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _is_salaried(app: dict) -> bool:
    bd = app.get("bureau_data") or {}
    internal = bd.get("_internal") or {}
    emp = (
        bd.get("employment_verified", "")
        or internal.get("employment_verified", "")
        or (app.get("financial_answers") or {}).get("employment_type", "")
    ).lower()
    return "salaried" in emp and "self" not in emp


def _doc_list_for(app: dict) -> list[dict]:
    common = [
        {
            "id": "aadhaar_ekyc",
            "label": "Aadhaar eKYC",
            "desc":  "Identity & address verified via UIDAI OTP",
            "icon":  "🪪",
            "source": "UIDAI",
            "eta_seconds": 2,
        },
        {
            "id": "account_aggregator",
            "label": "Bank Statements (6 months)",
            "desc":  "Fetched via RBI Account Aggregator framework",
            "icon":  "🏦",
            "source": "Account Aggregator",
            "eta_seconds": 3,
        },
    ]
    if _is_salaried(app):
        common.append({
            "id": "itr_salary",
            "label": "ITR / Form 16",
            "desc":  "TDS, employer, and salary details from IT Department",
            "icon":  "📄",
            "source": "Income Tax Dept",
            "eta_seconds": 2,
        })
    else:
        common.append({
            "id": "itr_business",
            "label": "ITR (Business)",
            "desc":  "Business turnover, profit, and GST status",
            "icon":  "📊",
            "source": "Income Tax Dept",
            "eta_seconds": 3,
        })
    return common


def _add_notification(app: dict, channel: str, message: str):
    app.setdefault("notifications", []).append({
        "sent_at":  datetime.now().isoformat(),
        "channel":  channel,
        "phone":    app.get("phone"),
        "message":  message,
        "status":   "delivered",
    })


# ── Dashboard feed ───────────────────────────────────────────────────────

@router.get("/applications")
def list_applications():
    """Live feed of all applications for dealer dashboard."""
    return list(applications.values())


@router.get("/applications/{app_id}")
def get_application(app_id: str):
    if app_id not in applications:
        raise HTTPException(status_code=404, detail="Not found")
    return applications[app_id]


@router.get("/applications/{app_id}/brief")
def get_brief(app_id: str):
    if app_id not in applications:
        raise HTTPException(status_code=404, detail="Not found")
    app = applications[app_id]
    return {"brief": write_dealer_brief(app)}


# ── Dynamic document requirements ───────────────────────────────────────

@router.get("/applications/{app_id}/doc-requirements")
def doc_requirements(app_id: str):
    """
    Returns the list of docs the dealer needs to collect for this customer.
    Varies by employment type: salaried gets Form 16, self-employed gets ITR (Business).
    """
    if app_id not in applications:
        raise HTTPException(status_code=404, detail="Not found")
    app = applications[app_id]
    return {"docs": _doc_list_for(app)}


# ── Digital document fetch ──────────────────────────────────────────────

class FetchDocRequest(BaseModel):
    doc_type: str


@router.post("/applications/{app_id}/fetch-doc")
def fetch_doc(app_id: str, req: FetchDocRequest):
    """
    Simulates the digital fetch flow — UIDAI OTP for Aadhaar, AA consent for
    bank statements, IT portal OTP for ITR. Returns the customer's data from
    the demo document bank keyed by PAN prefix.
    """
    if app_id not in applications:
        raise HTTPException(status_code=404, detail="Not found")

    app = applications[app_id]
    pan = (app.get("pan") or "").strip().upper()
    prefix = pan[0] if pan else "A"

    all_demo = _load_demo_docs()
    persona_docs = all_demo.get(prefix) or all_demo.get("A") or {}
    doc_data = persona_docs.get(req.doc_type)

    if doc_data is None:
        raise HTTPException(
            status_code=400,
            detail=f"No mock data available for doc_type '{req.doc_type}'",
        )

    now = datetime.now().isoformat()
    app.setdefault("documents", {})[req.doc_type] = {
        "data":        doc_data,
        "source":      "digital_fetch",
        "verified_at": now,
    }
    app.setdefault("timeline", []).append({
        "stage": f"doc_fetched_{req.doc_type}",
        "at":    now,
    })

    return {"status": "fetched", "doc_type": req.doc_type, "data": doc_data}


# ── Back-compat: manual upload still supported ──────────────────────────

class DocumentUpdate(BaseModel):
    doc_type: str
    data: dict


@router.post("/applications/{app_id}/documents")
def add_document(app_id: str, req: DocumentUpdate):
    if app_id not in applications:
        raise HTTPException(status_code=404, detail="Not found")
    now = datetime.now().isoformat()
    applications[app_id].setdefault("documents", {})[req.doc_type] = {
        "data":        req.data,
        "source":      "manual_upload",
        "verified_at": now,
    }
    applications[app_id].setdefault("timeline", []).append({
        "stage": f"document_{req.doc_type}_added",
        "at":    now,
    })
    return {"status": "document_added", "doc_type": req.doc_type}


# ── Sanction — also notifies customer ───────────────────────────────────

@router.post("/applications/{app_id}/sanction")
def sanction(app_id: str):
    """
    Dealer triggers final sanction after all documents verified.
    Kiosk is polling — it will auto-advance to celebration.
    A mock SMS is logged for the dealer portal to show proof of notification.
    """
    if app_id not in applications:
        raise HTTPException(status_code=404, detail="Not found")

    app = applications[app_id]
    now = datetime.now().isoformat()
    app["status"]        = "sanctioned"
    app["stage"]         = "sanctioned"
    app["sanctioned_at"] = now
    app.setdefault("timeline", []).append({"stage": "sanctioned", "at": now})

    first = (app.get("customer_name") or "").split(" ")[0] or "Customer"
    amt_l = f"{app['loan']['approved_amount'] / 100000:.1f}L"
    rate  = app["loan"]["rate"]
    _add_notification(
        app,
        channel="mock_sms",
        message=(
            f"Hi {first}! Great news — your Kotak car loan is approved for "
            f"₹{amt_l} at {rate}% p.a. Your car is waiting for you. "
            f"Visit our dealer desk to complete the paperwork."
        ),
    )

    return {
        "status":           "sanctioned",
        "application_id":   app_id,
        "customer_name":    app["customer_name"],
        "approved_amount":  app["loan"]["approved_amount"],
        "emi":              app["loan"]["emi"],
        "rate":             app["loan"]["rate"],
        "tenure_months":    app["loan"]["tenure_months"],
        "notification":     app["notifications"][-1],
    }


# ── Document format check (kept from earlier for manual upload path) ────

class DocCheckRequest(BaseModel):
    doc_type: str
    file_name: str
    file_size: int


@router.post("/applications/{app_id}/check-doc")
def check_document(app_id: str, req: DocCheckRequest):
    issues = []
    allowed_exts = [".jpg", ".jpeg", ".png", ".pdf"]
    if not any(req.file_name.lower().endswith(ext) for ext in allowed_exts):
        issues.append("Unsupported format — use JPG, PNG or PDF")
    if req.file_size < 8_000:
        issues.append("File too small — image may be unreadable or corrupt")
    if req.file_size > 10_000_000:
        issues.append("File too large — compress below 10 MB")

    if issues:
        return {"status": "rejected", "issues": issues, "message": "; ".join(issues)}

    doc_labels = {
        "aadhaar_ekyc":       "Aadhaar eKYC",
        "account_aggregator": "Bank statement",
        "itr_salary":         "Form 16 / ITR",
        "itr_business":       "ITR (Business)",
    }
    label = doc_labels.get(req.doc_type, req.doc_type)
    return {
        "status":  "accepted",
        "issues":  [],
        "message": f"{label} verified — format and quality check passed.",
    }


# ── Disburse ────────────────────────────────────────────────────────────

@router.post("/applications/{app_id}/disburse")
def disburse(app_id: str):
    if app_id not in applications:
        raise HTTPException(status_code=404, detail="Not found")

    app = applications[app_id]
    now = datetime.now().isoformat()
    app["status"]        = "disbursed"
    app["stage"]         = "disbursed"
    app["disbursed_at"]  = now
    app.setdefault("timeline", []).append({"stage": "disbursed", "at": now})

    amt = app["loan"]["approved_amount"]
    _add_notification(
        app,
        channel="mock_sms",
        message=(
            f"₹{amt:,} has been disbursed to the dealer for your new "
            f"{app['car'].get('brand','')} {app['car'].get('model','')}. "
            f"Welcome to the Kotak family!"
        ),
    )

    return {
        "status":         "disbursed",
        "application_id": app_id,
        "message":        f"₹{amt:,} disbursed to dealer account",
        "notification":   app["notifications"][-1],
    }
