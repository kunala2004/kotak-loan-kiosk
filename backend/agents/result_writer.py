"""
LLM Result Writer — writes human-readable messages from structured rule engine outputs.
LLM is PRESENTER only. All numbers come from the rules engine.
"""
from agents.llm_client import chat


def write_eligibility_message(name: str, result: dict, car: dict) -> str:
    """Writes Priya's eligibility reveal message."""
    if not result["eligible"]:
        return _write_decline_message(name, result)

    prompt = f"""You are Priya, a warm and enthusiastic car loan assistant at a showroom kiosk.
A customer just got pre-approved for a car loan. Write a short, excited congratulatory message (2-3 sentences max).

Customer name: {name}
Car selected: {car['brand']} {car['model']} {car['variant']}
Pre-approved amount: ₹{result['approved_amount']:,}
Interest rate: {result['interest_rate']}% p.a.
Monthly EMI: ₹{result['emi']:,}
CIBIL band: {result['cibil_band']}

Rules:
- Be warm, personal, celebratory
- Mention the car and the EMI
- Do NOT mention total interest, total payable, or obligations
- Do NOT make up any numbers — only use the ones given above
- Keep it under 40 words"""

    return chat([{"role": "user", "content": prompt}], temperature=0.8)


def write_car_reaction(car_name: str, brand: str) -> str:
    """Priya's reaction when customer selects a car."""
    prompt = f"""You are Priya, a friendly car loan assistant at a showroom kiosk.
A customer just selected the {brand} {car_name}.
Write ONE warm, enthusiastic sentence reacting to their choice.
Be specific to this car. Under 15 words."""

    return chat([{"role": "user", "content": prompt}], temperature=0.9)


def write_dealer_brief(application: dict) -> str:
    """2-line brief for the dealer about the incoming customer."""
    bureau = application.get("bureau_data", {})
    loan = application.get("loan", {})
    car = application.get("car", {})

    prompt = f"""Write a 2-line professional brief for a car dealer about this loan applicant.

Customer: {bureau.get('name')}, Age {bureau.get('age')}
Employment: {bureau.get('employment_verified')}
CIBIL: {bureau.get('cibil')} ({bureau.get('profile_label')})
Car: {car.get('brand')} {car.get('model')} {car.get('variant')}
Pre-approved: ₹{loan.get('approved_amount'):,} at {loan.get('rate')}%
EMI: ₹{loan.get('emi'):,}/month

Be professional, factual, actionable. Dealer should know how to approach this customer."""

    return chat([{"role": "user", "content": prompt}], temperature=0.5)


def write_followup_message(name: str, car: dict, emi: int, drop_off_stage: str) -> str:
    """WhatsApp follow-up message based on where customer dropped off."""
    stage_context = {
        "car_selection": "They selected a car but didn't check their EMI yet.",
        "financial_discovery": "They saw their estimated EMI but didn't check eligibility.",
        "eligibility_teaser": "They saw their eligibility range but didn't enter their PAN.",
        "emi_optimizer": "They got pre-approved but didn't finalise their loan amount.",
        "application_review": "Their application was 90% complete but they didn't submit."
    }

    prompt = f"""Write a short WhatsApp message to bring back a customer who left a car loan kiosk.

Customer name: {name}
Car they were looking at: {car.get('brand')} {car.get('model')}
EMI they saw: ₹{emi:,}/month
Drop-off point: {stage_context.get(drop_off_stage, 'mid-process')}

Rules:
- Friendly, not pushy
- Personal — mention their specific car
- Create urgency without being desperate
- Under 40 words
- End with a simple call to action"""

    return chat([{"role": "user", "content": prompt}], temperature=0.7)


def recommend_cars_nlp(query: str, cars: list) -> dict:
    """Parse natural language car query and return matching car IDs."""
    import json as _json
    cars_summary = "\n".join([
        f"- {c['id']}: {c['brand']} {c['model']} {c['variant']}, {c['segment']}, ₹{c['price']/100000:.1f}L"
        for c in cars
    ])
    prompt = f"""A customer at a car showroom kiosk said: "{query}"

Available cars:
{cars_summary}

Return JSON only — no other text:
{{"ids": ["car_id_1", "car_id_2"], "reason": "one sentence why these match"}}

Pick 1-4 best matching cars. Consider budget hints, family size, segment preference, use-case."""

    try:
        raw = chat([{"role": "user", "content": prompt}], temperature=0.3, max_tokens=200)
        # Extract JSON from response
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return _json.loads(raw[start:end])
    except Exception:
        return {"ids": [], "reason": ""}


def _write_decline_message(name: str, result: dict) -> str:
    reason = result.get("reason", "")
    if reason == "credit_score":
        return (
            f"Thank you {name}. Based on your current credit profile, "
            "we're unable to process a loan at this time. "
            "Our advisor can suggest ways to improve your eligibility — please speak to them at the desk."
        )
    return (
        f"Thank you {name}. We're working with your profile to find the best option. "
        "Please speak to our financial advisor at the desk for personalised assistance."
    )
