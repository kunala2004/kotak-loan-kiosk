from fastapi import APIRouter
from pydantic import BaseModel
from engines.emi_calculator import get_emi_for_display

router = APIRouter(prefix="/emi", tags=["EMI"])


class EMIRequest(BaseModel):
    principal: float
    annual_rate: float
    tenure_months: int


@router.post("/calculate")
def calculate(req: EMIRequest):
    return get_emi_for_display(req.principal, req.annual_rate, req.tenure_months)
