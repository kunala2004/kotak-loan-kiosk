import json
from pathlib import Path
from engines.emi_calculator import calculate_emi

rules = json.loads((Path(__file__).parent.parent / "data/loan_rules.json").read_text())


def get_interest_rate(cibil: int) -> float | None:
    for band in rules["rate_matrix"]:
        if band["cibil_min"] <= cibil <= band["cibil_max"]:
            return band["rate"]
    return None


def get_income_midpoint(income_range: str) -> float:
    return rules["income_midpoints"].get(income_range, 0) \
        if "income_midpoints" in rules \
        else rules["income_range_midpoints"].get(income_range, 0)


def check_eligibility(
    income_range: str,
    employment_type: str,
    down_payment: float,
    vehicle_price: float,
    tenure_months: int,
    cibil: int,
    existing_emi: float,
    age: int
) -> dict:
    """
    Core rules engine. Returns eligibility decision and offer details.
    This function makes the credit decision — LLM never touches this logic.
    """

    income = get_income_midpoint(income_range)
    rate = get_interest_rate(cibil)
    loan_asked = vehicle_price - down_payment
    ltv = loan_asked / vehicle_price
    min_income = rules["min_income_by_employment"].get(employment_type, 25000)

    # --- Hard Declines ---
    if cibil < rules["min_cibil_eligible"]:
        return _decline("credit_score", cibil, rate)

    if income < min_income:
        return _decline("income_too_low", cibil, rate)

    if rate is None:
        return _decline("credit_score", cibil, rate)

    # --- LTV Check ---
    actual_loan = loan_asked
    if ltv > rules["ltv_max_new_car"]:
        actual_loan = vehicle_price * rules["ltv_max_new_car"]

    # --- FOIR Check ---
    proposed_emi = calculate_emi(actual_loan, rate, tenure_months)["emi"]
    foir = (proposed_emi + existing_emi) / income

    if foir > rules["foir_max"]:
        # Try to reduce loan to fit FOIR
        max_emi_allowed = (income * rules["foir_max"]) - existing_emi
        if max_emi_allowed < 3000:
            return _decline("foir_exceeded", cibil, rate)

        # Recalculate max loan for this EMI
        monthly_rate = rate / (12 * 100)
        actual_loan = max_emi_allowed * \
            ((1 + monthly_rate) ** tenure_months - 1) / \
            (monthly_rate * (1 + monthly_rate) ** tenure_months)
        actual_loan = round(actual_loan / 1000) * 1000  # round to nearest 1K

        if actual_loan < rules["min_loan_amount"]:
            return _decline("foir_exceeded", cibil, rate)

        proposed_emi = calculate_emi(actual_loan, rate, tenure_months)["emi"]

    # --- Final Approval ---
    return {
        "eligible": True,
        "decision": "approved",
        "approved_amount": round(actual_loan),
        "interest_rate": rate,
        "tenure_months": tenure_months,
        "emi": proposed_emi,
        "foir": round(foir * 100, 1),           # internal — do not send to frontend
        "cibil_band": _cibil_band(cibil),
        "show_cibil": cibil >= 650,
        "cibil_score": cibil if cibil >= 650 else None
    }


def _decline(reason: str, cibil: int, rate) -> dict:
    return {
        "eligible": False,
        "decision": "declined",
        "reason": reason,
        "approved_amount": 0,
        "interest_rate": None,
        "emi": 0,
        "show_cibil": False,
        "cibil_score": None,
        "cibil_band": _cibil_band(cibil)
    }


def _cibil_band(cibil: int) -> str:
    if cibil >= 750: return "excellent"
    if cibil >= 700: return "good"
    if cibil >= 650: return "average"
    return "low"
