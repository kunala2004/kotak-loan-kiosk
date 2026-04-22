"""
LLM Client — uses Groq (free, fast, OpenAI-compatible).
Falls back to demo responses if API key not set.
Switch to any OpenAI-compatible provider by changing base_url + model.
"""
import os
from openai import OpenAI

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
MODEL = "llama-3.3-70b-versatile"

client = OpenAI(
    api_key=GROQ_API_KEY or "demo",
    base_url="https://api.groq.com/openai/v1"
) if GROQ_API_KEY else None


def chat(messages: list, temperature: float = 0.7) -> str:
    """Single LLM call. Returns text response."""
    if not client:
        return _demo_response(messages)
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=300
    )
    return response.choices[0].message.content.strip()


def _demo_response(messages: list) -> str:
    """Hardcoded demo responses when no API key present."""
    last = messages[-1]["content"].lower() if messages else ""

    if "congratulations" in last or "eligible" in last or "approved" in last:
        return (
            "Congratulations! Based on your excellent credit profile, "
            "you qualify for this loan at our best available rate. "
            "You're all set to drive home your dream car today!"
        )
    if "car" in last and ("react" in last or "selected" in last or "chose" in last):
        return "Great choice! This is one of our most popular models this month."

    if "dealer" in last or "summary" in last or "brief" in last:
        return (
            "Strong applicant with good credit standing. "
            "High purchase intent — recommend priority engagement."
        )
    if "follow" in last or "whatsapp" in last or "remind" in last:
        return (
            "Hi! You were just one step away from your car loan approval. "
            "Your personalised offer is still reserved. Come back and complete it in under 2 minutes!"
        )
    return "I'm here to help you with your car loan journey. What would you like to know?"
