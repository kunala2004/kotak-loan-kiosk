def calculate_emi(principal: float, annual_rate: float, tenure_months: int) -> dict:
    """
    Standard reducing balance EMI formula.
    Returns EMI, total payable, total interest (internal use only — never show to customer).
    """
    if annual_rate == 0:
        emi = principal / tenure_months
    else:
        monthly_rate = annual_rate / (12 * 100)
        emi = principal * monthly_rate * (1 + monthly_rate) ** tenure_months / \
              ((1 + monthly_rate) ** tenure_months - 1)

    total_payable = emi * tenure_months
    total_interest = total_payable - principal

    return {
        "emi": round(emi),
        "total_payable": round(total_payable),   # internal only
        "total_interest": round(total_interest)  # internal only — never show customer
    }


def get_emi_for_display(principal: float, annual_rate: float, tenure_months: int) -> dict:
    """
    Customer-facing EMI data. Only returns what customer should see.
    """
    result = calculate_emi(principal, annual_rate, tenure_months)
    return {
        "emi": result["emi"],
        "principal": round(principal),
        "rate": annual_rate,
        "tenure_months": tenure_months
    }
