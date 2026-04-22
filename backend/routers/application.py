import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from agents.followup_agent import schedule_followup, cancel_followup

router = APIRouter(prefix="/application", tags=["Application"])

# In-memory store — replace with DB in production
applications: dict = {}


class ApplicationSubmit(BaseModel):
    customer_name: str
    phone: str
    pan: str
    bureau_data: dict
    car: dict
    loan: dict   # approved_amount, rate, tenure, emi


class DropoffRegister(BaseModel):
    phone: str
    current_stage: str
    session_snapshot: dict


@router.post("/submit")
def submit(req: ApplicationSubmit):
    """Customer submits final application from kiosk."""
    app_id = f"KTK-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:5].upper()}"

    application = {
        "application_id": app_id,
        "submitted_at": datetime.now().isoformat(),
        "status": "submitted",
        "stage": "awaiting_dealer",
        "customer_name": req.customer_name,
        "phone": req.phone,
        "pan": req.pan,
        "bureau_data": req.bureau_data,
        "car": req.car,
        "loan": req.loan,
        "documents": {},
        "timeline": [
            {"stage": "submitted", "at": datetime.now().isoformat()}
        ]
    }

    applications[app_id] = application

    # Cancel any pending follow-up (they completed the journey)
    cancel_followup(req.phone)

    return {"application_id": app_id, "status": "submitted"}


@router.get("/{app_id}")
def get_application(app_id: str):
    if app_id not in applications:
        raise HTTPException(status_code=404, detail="Application not found")
    return applications[app_id]


@router.patch("/{app_id}/status")
def update_status(app_id: str, status: str, stage: str):
    if app_id not in applications:
        raise HTTPException(status_code=404, detail="Application not found")
    applications[app_id]["status"] = status
    applications[app_id]["stage"] = stage
    applications[app_id]["timeline"].append({
        "stage": stage, "at": datetime.now().isoformat()
    })
    return applications[app_id]


@router.post("/dropoff")
def register_dropoff(req: DropoffRegister):
    """
    Called when customer leaves kiosk mid-flow with phone captured.
    Schedules follow-up agent.
    """
    snapshot = req.session_snapshot
    snapshot["phone"] = req.phone
    snapshot["current_stage"] = req.current_stage

    schedule_followup(snapshot)
    return {"scheduled": True, "stage": req.current_stage}
