from fastapi import APIRouter
from pydantic import BaseModel
from engines.eligibility_engine import check_eligibility
from agents.result_writer import write_eligibility_message

router = APIRouter(prefix="/eligibility", tags=["Eligibility"])


class EligibilityRequest(BaseModel):
    income_range: str
    employment_type: str
    down_payment: float
    vehicle_price: float
    tenure_months: int
    cibil: int
    existing_emi: float
    age: int
    # For LLM message generation
    customer_name: str
    car_brand: str
    car_model: str
    car_variant: str


@router.post("/check")
def check(req: EligibilityRequest):
    """
    Runs the rules engine then has LLM write the result message.
    Rules make the decision. LLM only writes the words.
    """
    result = check_eligibility(
        income_range=req.income_range,
        employment_type=req.employment_type,
        down_payment=req.down_payment,
        vehicle_price=req.vehicle_price,
        tenure_months=req.tenure_months,
        cibil=req.cibil,
        existing_emi=req.existing_emi,
        age=req.age
    )

    car = {
        "brand": req.car_brand,
        "model": req.car_model,
        "variant": req.car_variant
    }

    first_name = req.customer_name.split(" ")[0] if req.customer_name else "there"

    if not result.get("eligible"):
        # Deterministic decline message — LLM output can vary, we want this consistent.
        result["priya_message"] = (
            f"{first_name}, unfortunately you are not pre-approved right now. "
            "But don't worry — please connect with our dealer at the desk "
            "for more personalised offers and options we can work out together."
        )
    else:
        # LLM writes the message — it does NOT make the decision
        result["priya_message"] = write_eligibility_message(req.customer_name, result, car)

    # Strip internal fields before sending to frontend
    result.pop("foir", None)

    return result
