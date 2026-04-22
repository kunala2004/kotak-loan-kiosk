"""
Follow-up Re-engagement Agent — plain Python, no framework needed.
Triggered when customer leaves kiosk mid-flow after giving phone number.
Reasons about drop-off stage → decides timing + message → sends WhatsApp/SMS.
"""
import os
from apscheduler.schedulers.background import BackgroundScheduler
from agents.result_writer import write_followup_message

scheduler = BackgroundScheduler()
scheduler.start()

# Delay in minutes before sending follow-up per drop-off stage
FOLLOWUP_DELAY = {
    "car_selection":        180,   # 3 hours
    "financial_discovery":  120,   # 2 hours
    "eligibility_teaser":   30,    # 30 mins — they were very close
    "emi_optimizer":        15,    # 15 mins — almost done
    "application_review":   10     # 10 mins — literally 1 tap away
}


def schedule_followup(session_snapshot: dict):
    """
    Called when customer leaves kiosk mid-flow with phone captured.
    Agent decides timing based on drop-off stage.
    """
    phone = session_snapshot.get("phone")
    drop_off_stage = session_snapshot.get("current_stage", "car_selection")
    name = session_snapshot.get("bureau_data", {}).get("name", "there")
    car = session_snapshot.get("car", {})
    emi = session_snapshot.get("loan", {}).get("emi", 0)

    if not phone:
        return  # no phone captured, nothing to follow up on

    delay_minutes = FOLLOWUP_DELAY.get(drop_off_stage, 120)

    scheduler.add_job(
        func=_send_followup,
        trigger="interval",
        minutes=delay_minutes,
        id=f"followup_{phone}",
        replace_existing=True,
        max_instances=1,
        kwargs={
            "phone": phone,
            "name": name,
            "car": car,
            "emi": emi,
            "drop_off_stage": drop_off_stage
        }
    )


def _send_followup(phone: str, name: str, car: dict, emi: int, drop_off_stage: str):
    """Writes and sends the follow-up message."""
    message = write_followup_message(name, car, emi, drop_off_stage)
    _send_whatsapp(phone, message)
    scheduler.remove_job(f"followup_{phone}")


def _send_whatsapp(phone: str, message: str):
    """Send WhatsApp via Twilio. Falls back to SMS if WhatsApp fails."""
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    from_number = os.getenv("TWILIO_WHATSAPP_NUMBER", "")

    if not account_sid:
        print(f"[DEMO] Would send WhatsApp to {phone}:\n{message}")
        return

    from twilio.rest import Client
    client = Client(account_sid, auth_token)

    try:
        client.messages.create(
            from_=f"whatsapp:{from_number}",
            to=f"whatsapp:+91{phone}",
            body=message
        )
    except Exception:
        # Fallback to SMS
        client.messages.create(
            from_=from_number,
            to=f"+91{phone}",
            body=message
        )


def cancel_followup(phone: str):
    """Cancel scheduled follow-up if customer completes the journey."""
    job_id = f"followup_{phone}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
