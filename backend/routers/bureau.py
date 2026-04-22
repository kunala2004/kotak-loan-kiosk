import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/bureau", tags=["Bureau"])

profiles = json.loads((Path(__file__).parent.parent / "data/bureau_profiles.json").read_text())


class PANRequest(BaseModel):
    pan: str


@router.post("/fetch")
def fetch_bureau(req: PANRequest):
    """
    Mock bureau fetch via PAN.
    In production: calls CIBIL / Experian / CRIF API.
    PAN first letter maps to a customer profile for demo.
    """
    pan = req.pan.strip().upper()

    if len(pan) != 10:
        raise HTTPException(status_code=400, detail="Invalid PAN format")

    prefix = pan[0]
    profile = profiles.get(prefix)

    if not profile:
        # Default to profile B for unknown prefixes
        profile = profiles["B"]

    # Return only what bureau actually gives — never more
    return {
        "found": True,
        "name": profile["name"],
        "dob": profile["dob"],
        "age": profile["age"],
        "cibil": profile["cibil"],
        "existing_emi_total": profile["existing_emi_total"],
        "existing_loans_count": len(profile["existing_loans"]),
        "profile_label": profile["profile_label"],
        "address": profile["address"],
        # Internal fields (not sent to frontend display, used by rules engine)
        "_internal": {
            "monthly_income_verified": profile["monthly_income_verified"],
            "employment_verified": profile["employment_verified"],
            "missed_payments": profile["missed_payments"],
            "credit_utilization": profile["credit_utilization"]
        }
    }
